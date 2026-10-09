import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { countries, seriesFor, forecast, slope, indicator, climateFor, pressureThresholds, pressureReason } from '../src/model.mjs';
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
  assert.deepEqual(indicator(history, projection), { level: 'unknown', change: null, supply: null, decline: null });
});

test('production pressure increases with harvest loss and a zero future harvest is a 100% decline', () => {
  const history = seriesFor(data, 'IDN');
  const climate = climateFor('IDN');
  const base = indicator(history, forecast(history, 2030), climate);
  const stressed = indicator(history, forecast(history, 2030, 'trend', 30), climate);
  assert.ok(stressed.decline >= base.decline);
  assert.ok(stressed.supply < base.supply);
  const extreme = [{ year: 2030, rice: 0, population: 1000 }];
  assert.equal(indicator(history, extreme).decline, 100);
  assert.equal(indicator(history, extreme).level, 'high');
});

test('planning categories use exact 5% and 10% boundaries without rounding near-boundary declines',()=>{
 const history=[{year:2024,rice:200,population:1000}];
 for(const [decline,expected] of [[-12,'low'],[0,'low'],[3,'low'],[4.999,'low'],[5,'medium'],[7,'medium'],[9.999,'medium'],[10,'high'],[12,'high'],[100,'high']]){
  const value=indicator(history,[{year:2030,rice:200*(1-decline/100),population:1000}]);
  assert.equal(value.level,expected,`decline ${decline}`);assert.ok(Math.abs(value.decline-Math.max(0,decline))<1e-9);assert.ok(!Object.hasOwn(value,'score'));
 }
 assert.deepEqual(pressureThresholds,{watch:5,high:10,baselineYear:2024});
});
test('pressure is based on production per person rather than production alone and ignores climate demos',()=>{
 const history=[{year:2024,rice:100,population:100}];
 const future=[{year:2030,rice:100,population:125}];
 const normal=indicator(history,future,{temperature:0,rain:0});
 const extreme=indicator(history,future,{temperature:30,rain:-100});
 assert.deepEqual(normal,extreme);assert.ok(Math.abs(normal.change+20)<1e-9);assert.equal(normal.level,'high');assert.equal(normal.supply,800);
});
test('missing or unusable baseline and future values are not assessed; 2024 remains the fixed baseline',()=>{
 for(const [base,future] of [
  [{year:2023,rice:100,population:100},{year:2030,rice:80,population:100}],
  [{year:2024,rice:0,population:100},{year:2030,rice:80,population:100}],
  [{year:2024,rice:100,population:100},{year:2030,rice:null,population:100}],
  [{year:2024,rice:100,population:100},{year:2030,rice:80,population:0}],
 ])assert.equal(indicator([base],[future]).level,'unknown');
 const history=[{year:2024,rice:100,population:100},{year:2025,rice:150,population:100}];
 assert.ok(Math.abs(indicator(history,[{year:2030,rice:95,population:100}]).change+5)<1e-9);
});
test('plain-language reasons describe the observed change and preserve missing data',()=>{
 assert.match(pressureReason({change:-7}),/fall 7.00% from 2024/);
 assert.match(pressureReason({change:3}),/rise 3.00% from 2024/);
 assert.match(pressureReason({change:0}),/unchanged/);
 assert.match(pressureReason({change:null}),/insufficient/);
});
