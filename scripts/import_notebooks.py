"""Import saved research outputs, never execute notebook code or fabricate raw rasters."""
import base64
import csv
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIME = 'application/vnd.microsoft.datawrangler.viewer.v0+json'


class Table(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows, self.row, self.cell = [], [], None

    def handle_starttag(self, tag, attrs):
        if tag == 'tr':
            self.row = []
        if tag in ('th', 'td'):
            self.cell = ''

    def handle_data(self, value):
        if self.cell is not None:
            self.cell += value

    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self.cell is not None:
            self.row.append(self.cell.strip())
            self.cell = None
        if tag == 'tr' and self.row:
            self.rows.append(self.row)


def frames(book, cell):
    found = []
    for output in book['cells'][cell].get('outputs', []):
        value = output.get('data', {}).get(MIME)
        if value:
            if isinstance(value, str):
                value = json.loads(value)
            names = [column['name'] for column in value['columns']]
            rows = []
            for row in value['rows']:
                record = {}
                for column, raw in zip(value['columns'], row):
                    if column['name'] == 'index':
                        continue
                    record[column['name']] = (float(raw) if column['type'] == 'float' else int(raw) if column['type'] == 'integer' else raw) if raw is not None else None
                rows.append(record)
            found.append(rows)
    return found


def projection(book, cell, label):
    for output in book['cells'][cell].get('outputs', []):
        html = output.get('data', {}).get('text/html')
        if not html:
            continue
        parser = Table()
        parser.feed(''.join(html))
        if not parser.rows or label not in parser.rows[0]:
            continue
        header = parser.rows[0]
        values = [{'year': int(row[header.index('Year')]), 'value': float(row[header.index(label)].replace(',', ''))} for row in parser.rows[1:]]
        assert [p['year'] for p in values] == list(range(2025, 2031))
        return values
    raise ValueError(f'Missing forecast table in cell {cell}')


def main():
    paths = [ROOT.parent / name for name in ['forecastDataBerasASEAN.ipynb', 'forecastPopulasiSEA.ipynb', 'spatioASEAN.ipynb']]
    books = [json.loads(path.read_text(encoding='utf-8')) for path in paths]
    rice, population_old, spatio = books
    provenance = [{'file': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'cells': len(book['cells'])} for path, book in zip(paths, books)]
    rice_metrics = frames(rice, 11)[0]
    pop_lstm = frames(rice, 34)[0][0]
    pop_mlp = frames(rice, 40)[1][0]
    metrics = [{**pop_lstm, 'Model': 'LSTM'}, {'Model': 'Multilayer Perceptron', 'MAPE (%)': pop_mlp['MAPE test (%)'], 'RMSE': pop_mlp['RMSE test'], 'MAE': pop_mlp['MAE test'], 'Parameters': frames(rice, 40)[0][0]['Parameters']}]
    future = {
        'rice': {'MLP': projection(rice, 22, 'Forecast MLP (tonnes)'), 'LSTM': projection(rice, 15, 'Forecast LSTM (tonnes)')},
        'population': {'MLP': projection(rice, 40, 'Forecast MLP population'), 'LSTM': projection(rice, 38, 'Forecast LSTM population')},
    }
    # The separate older population notebook saves a shorter horizon. Verify overlap.
    older = None
    for out in population_old['cells'][14].get('outputs', []):
        h = out.get('data', {}).get('text/html')
        if h:
            t = Table(); t.feed(''.join(h))
            if t.rows and any('Forecast' in v for v in t.rows[0]):
                older = [float(row[-1].replace(',', '')) for row in t.rows[1:]]
    if older:
        assert older == [p['value'] for p in future['population']['LSTM'][:len(older)]]
    validation = frames(rice, 9)[0]
    country = frames(spatio, 39)[0]
    assert len(country) == 20
    assert all(row['predicted_lower_ha'] <= row['predicted_area_ha'] <= row['predicted_upper_ha'] for row in country)
    directory = ROOT / 'public' / 'research'
    directory.mkdir(parents=True, exist_ok=True)
    figures = []
    for cell, name, title in [(32, 'historical', 'GloRice 1961 dan 2021'), (37, 'uncertainty', 'Proyeksi 2° dan lebar interval'), (39, 'country', 'Perbandingan proyeksi negara'), (41, 'fine-2030', 'Disagregasi visual 2030 pada grid 5 arcminute')]:
        for out in spatio['cells'][cell].get('outputs', []):
            png = out.get('data', {}).get('image/png')
            if png:
                (directory / f'{name}.png').write_bytes(base64.b64decode(''.join(png)))
                figures.append({'name': name, 'title': title, 'cell': cell, 'path': f'/research/{name}.png'})
                break
    assert len(figures) == 4
    with (directory / 'spatio-countries-2030.csv').open('w', newline='', encoding='utf-8-sig') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(country[0]))
        writer.writeheader(); writer.writerows(country)
    with (directory / 'forecast-notebook-2025-2030.csv').open('w', newline='', encoding='utf-8-sig') as handle:
        writer = csv.writer(handle)
        writer.writerow(['year', 'rice_MLP_tonnes', 'rice_LSTM_tonnes', 'population_MLP_people', 'population_LSTM_people'])
        for i, year in enumerate(range(2025, 2031)):
            writer.writerow([year] + [future[key][model][i]['value'] for key in ['rice', 'population'] for model in ['MLP', 'LSTM']])
    result = {
        'mode': 'saved-notebook-outputs', 'provenance': provenance,
        'forecast': {'future': future, 'riceMetrics': rice_metrics, 'populationMetrics': metrics, 'validation': validation, 'populationMlpValidation': frames(rice, 40)[0][0], 'baseline2024': {'rice': 197000964, 'population': 695149428}, 'sourceEntity': 'Total 10 Negara', 'outputPrecision': 'Forecast tables rounded to one tonne/person in notebook'},
        'spatio': {'metrics': frames(spatio, 35)[0][0], 'residuals': frames(spatio, 35)[1], 'gridSummary': frames(spatio, 37)[0], 'countries': country, 'figures': figures, 'modelGrid': '2 degree', 'climateModel': 'ACCESS-CM2', 'climatePeriod': '2021–2040', 'training': '1981–2011', 'holdout': '2012–2021'},
        'unavailableInputs': ['rice-production.csv (original aggregate)', '../populasiSEA.xlsx', 'data/processed/glorice/glorice_sea_intensive_harvested_area_1961_2021.npz', 'data/processed/glorice/ (fitted BYM2, grid CSV and projected GeoTIFFs)', 'data/raw/ (GADM, CHIRPS and CMIP6)'],
    }
    (ROOT / 'src' / 'research.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Imported 4 forecasts, 8 evaluation rows, 20 country projections, 10 residuals and 4 original figures.')


if __name__ == '__main__':
    main()
