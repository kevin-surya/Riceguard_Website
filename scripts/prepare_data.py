"""Download reproducible open-data snapshots; keep the last good snapshot on errors."""
import csv
import io
import json
import urllib.request
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
CODES = ['IDN', 'VNM', 'THA', 'MMR', 'PHL', 'KHM', 'LAO', 'MYS', 'SGP', 'BRN', 'TLS']
URLS = {
    'rice': 'https://ourworldindata.org/grapher/rice-production.csv',
    'population': 'https://ourworldindata.org/grapher/population-with-un-projections.csv',
}

def download(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'RiceGuard/1.0 open-data prototype'})
    with urllib.request.urlopen(request, timeout=90) as response:
        return response.read().decode('utf-8-sig')

def main():
    records = {code: {} for code in CODES}
    columns = {}
    for indicator, url in URLS.items():
        rows = csv.DictReader(io.StringIO(download(url)))
        print(indicator, rows.fieldnames)
        candidates = [name for name in rows.fieldnames if name not in ['Entity', 'Code', 'Year']]
        column = next((name for name in candidates if 'Population' in name or 'population' in name), candidates[0]) if indicator == 'population' else candidates[0]
        columns[indicator] = column
        for row in rows:
            code, year = row['Code'], int(row['Year'])
            value = row[column] or (row.get('Population (Projected)', '') if indicator == 'population' else '')
            if code not in CODES or not 1961 <= year <= 2024 or not value:
                continue
            records[code].setdefault(year, {'year': year})[indicator] = round(float(value) / 1e6, 6)
            if indicator == 'population':
                records[code][year]['populationProjected'] = not bool(row[column])
    data = {'retrievedAt': datetime.now(timezone.utc).isoformat(), 'urls': URLS, 'columns': columns,
            'countries': {code: [dict(point, rice=point.get('rice')) for year, point in sorted(points.items()) if 'population' in point] for code, points in records.items()}}
    # Never silently render missing national records as zero.
    for code, points in data['countries'].items():
        if not points or points[-1]['year'] != 2024:
            raise ValueError(f'Missing 2024 data for {code}; snapshot not overwritten')
    (ROOT / 'src' / 'data.json').write_text(json.dumps(data, separators=(',', ':')), encoding='utf-8')
    print('Snapshot saved:', {code: points[-1] for code, points in data['countries'].items()})
    geo_url = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'
    world = json.loads(download(geo_url))
    geo = {'type': 'FeatureCollection', 'features': []}
    for feature in world['features']:
        props = feature['properties']
        code = props.get('ADM0_A3')
        if code in CODES + ['CHN', 'IND', 'BGD', 'NPL', 'BTN', 'PNG', 'AUS', 'TWN']:
            feature['properties'] = {'code': code, 'name': props.get('NAME_EN', props.get('NAME'))}
            geo['features'].append(feature)
    (ROOT / 'public' / 'sea.geojson').write_text(json.dumps(geo, separators=(',', ':')), encoding='utf-8')
    print('Natural Earth map saved')

if __name__ == '__main__':
    main()
