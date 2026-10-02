import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { countries, seriesFor, forecast, slope, indicator, climateFor } from '../src/model.mjs';
const data = JSON.parse(readFileSync(new URL('../src/data.json', import.meta.url), 'utf-8'));

test('snapshot has 64 annual population observations across all 11 countries', () => {
  assert.equal(countries.length, 11);
  for (const country of countries) {
    const series = data.countries[country.code];
    assert.equal(series.length, 64);
    assert.equal(series[0].year, 1961);
    assert.equal(series.at(-1).year, 2024);
    assert.equal(series.at(-1).populationProjected, true);
    assert.ok(series.every(point => point.population > 0));
  }
});

test('regional totals sum source records and expose missing production coverage', () => {
  const regional = seriesFor(data, 'SEA').at(-1);
  const expected = countries.reduce((sum, country) => sum + data.countries[country.code].at(-1).population, 0);
  assert.equal(regional.population, expected);
  assert.equal(regional.riceCoverage, 10);
  assert.ok(regional.rice > 196 && regional.rice < 198);
  assert.equal(seriesFor(data, 'SGP').at(-1).rice, null);
});

test('regression recovers a known annual trend and anchors projections to last year', () => {
  const points = Array.from({ length: 10 }, (_, index) => ({ year: 2015 + index, rice: 10 + 2 * index, population: 20 + index }));
  assert.equal(slope(points, 'rice'), 2);
  assert.equal(slope(points, 'population'), 1);
  const projection = forecast(points, 2030);
  assert.equal(projection.length, 6);
  assert.deepEqual(projection.at(-1), { year: 2030, rice: 40, population: 35 });
});

test('infographic six-year scenario applies stated growth assumptions', () => {
  const points = [{ year: 2024, rice: 100, population: 200 }];
  const end = forecast(points, 2030, 'infographic').at(-1);
  assert.ok(Math.abs(end.rice - 101.56) < 1e-9);
  assert.ok(Math.abs(end.population - 218.12) < 1e-9);
});

test('harvest pressure and resilience change rice while preserving population', () => {
  const points = seriesFor(data, 'SEA');
  const base = forecast(points, 2030).at(-1);
  const stressed = forecast(points, 2030, 'trend', 20).at(-1);
  const resilient = forecast(points, 2030, 'resilient').at(-1);
  assert.ok(Math.abs(stressed.rice - base.rice * 0.8) < 1e-9);
  assert.ok(resilient.rice > base.rice);
  assert.equal(base.population, stressed.population);
  assert.equal(base.population, resilient.population);
});

test('missing rice stays missing in projections and risk classification', () => {
  const history = seriesFor(data, 'SGP');
  const projection = forecast(history, 2030);
  assert.ok(projection.every(point => point.rice === null));
  assert.deepEqual(indicator(history, projection, climateFor('SGP')), { score: null, level: 'unknown', change: null, supply: null });
});

test('risk escalates under lower per-capita production and score stays bounded', () => {
  const history = seriesFor(data, 'IDN');
  const climate = climateFor('IDN');
  const base = indicator(history, forecast(history, 2030), climate);
  const stressed = indicator(history, forecast(history, 2030, 'trend', 30), climate);
  assert.ok(stressed.score >= base.score);
  assert.ok(stressed.score >= 0 && stressed.score <= 100);
  assert.ok(stressed.supply < base.supply);
  const extreme = [{ year: 2030, rice: 0, population: 1000 }];
  assert.equal(indicator(history, extreme, { temperature: 20, rain: -100 }).score, 100);
});
