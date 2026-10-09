"""Refresh the small, offline monthly ERA5 climate snapshot for monitoring points.

Requires requests. Raw API responses are cached outside Git. Only complete months
are published; every baseline month must have all 30 years of complete daily data.
"""
import argparse
import calendar
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
import json
import math
from pathlib import Path
import subprocess
import time
import requests

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'data/raw/climate'
API = 'https://archive-api.open-meteo.com/v1/archive'


def monthly(daily):
    if len({len(daily[key]) for key in ['time', 'temperature_2m_mean', 'precipitation_sum']}) != 1:
        raise ValueError('Daily arrays have different lengths')
    buckets = defaultdict(list)
    for day, temp, rain in zip(daily['time'], daily['temperature_2m_mean'], daily['precipitation_sum']):
        buckets[day[:7]].append((day, temp, rain))
    result = {}
    for period, rows in buckets.items():
        year, month = map(int, period.split('-'))
        expected = calendar.monthrange(year, month)[1]
        dates = {day for day, _, _ in rows}
        complete_dates = {f'{period}-{day:02}' for day in range(1, expected + 1)}
        if dates != complete_dates or len(rows) != expected or any(
            not isinstance(t, (int, float)) or not isinstance(r, (int, float))
            or not math.isfinite(t) or not math.isfinite(r) or r < 0 for _, t, r in rows
        ):
            continue
        result[period] = {'temperatureMeanC': sum(t for _, t, _ in rows) / expected,
                          'precipitationMm': sum(r for _, _, r in rows), 'days': expected}
    return result


def build_point(country, response):
    values = monthly(response['daily'])
    normals = {}
    for month in range(1, 13):
        years = [values.get(f'{year}-{month:02}') for year in range(1991, 2021)]
        if any(row is None for row in years):
            raise ValueError(f"Incomplete 1991–2020 baseline: {country['code']}, month {month}")
        normals[f'{month:02}'] = {
            'temperatureMeanC': sum(row['temperatureMeanC'] for row in years) / 30,
            'precipitationMm': sum(row['precipitationMm'] for row in years) / 30,
            'completeYears': 30,
        }
    return {'location': country['location'], 'latitude': country['lat'], 'longitude': country['lon'],
            'gridLatitude': response['latitude'], 'gridLongitude': response['longitude'],
            'timezone': response['timezone'], 'normals': normals,
            'months': {period: row for period, row in values.items() if period >= '2021-01'}}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--as-of', default=date.today().isoformat())
    args = parser.parse_args()
    as_of = date.fromisoformat(args.as_of)
    # ERA5 has roughly five days' latency. Allow seven days and exclude partial months.
    safe_day = as_of - timedelta(days=7)
    end = safe_day.replace(day=1) - timedelta(days=1)
    countries = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
        "import {countries} from './src/model.mjs'; console.log(JSON.stringify(countries));"], cwd=ROOT, text=True, encoding='utf-8'))
    CACHE.mkdir(parents=True, exist_ok=True)
    points = {}
    for index, country in enumerate(countries):
        cache = CACHE / f"{country['code']}-era5-1991-{end.isoformat()}.json"
        if cache.exists():
            response = json.loads(cache.read_text(encoding='utf-8'))
        else:
            params = {'latitude': country['lat'], 'longitude': country['lon'],
                      'start_date': '1991-01-01', 'end_date': end.isoformat(),
                      'models': 'era5', 'daily': 'temperature_2m_mean,precipitation_sum', 'timezone': 'auto'}
            for attempt in range(4):
                try:
                    r = requests.get(API, params=params, timeout=120)
                    r.raise_for_status()
                    response = r.json()
                    break
                except requests.RequestException:
                    if attempt == 3:
                        raise
                    time.sleep(20 * (attempt + 1))
            cache.write_text(json.dumps(response), encoding='utf-8')
            # Long historical requests count as multiple calls under the public API limit.
            if index < len(countries) - 1:
                time.sleep(10)
        points[country['code']] = build_point(country, response)
        print(country['code'], len(points[country['code']]['months']), 'complete monitoring months', flush=True)
    periods = sorted(set.intersection(*(set(point['months']) for point in points.values())))
    if not periods:
        raise ValueError('No common complete monitoring month')
    result = {'schemaVersion': 1, 'retrievedAt': datetime.now(timezone.utc).isoformat(),
              'asOf': as_of.isoformat(), 'latestPeriod': periods[-1], 'periods': periods,
              'baseline': {'startYear': 1991, 'endYear': 2020, 'years': 30},
              'source': {'name': 'ERA5 via Open-Meteo', 'model': 'era5',
                         'url': 'https://open-meteo.com/en/docs/historical-weather-api',
                         'normalsUrl': 'https://wmo.int/wmo-climatological-normals',
                         'kind': 'gridded reanalysis', 'resolutionDegrees': 0.25},
              'points': points}
    target = ROOT / 'src/climate.json'
    temporary = target.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(target)
    print('Saved', target.name, 'latest complete month', periods[-1], flush=True)


if __name__ == '__main__':
    main()
