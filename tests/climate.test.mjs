import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { monthlyAnomaly, climateFor } from '../src/climate-model.mjs';
import { climateContext } from '../server/climate-context.mjs';
const data = JSON.parse(readFileSync(new URL('../src/climate.json', import.meta.url), 'utf8'));

test('monthly anomalies preserve cooler and drier signs, and do not turn missing data into zero', () => {
  assert.deepEqual(monthlyAnomaly({temperatureMeanC:28,precipitationMm:50},{temperatureMeanC:27,precipitationMm:100}),{temperature:1,rain:-50});
  assert.deepEqual(monthlyAnomaly({temperatureMeanC:26,precipitationMm:150},{temperatureMeanC:27,precipitationMm:100}),{temperature:-1,rain:50});
  assert.deepEqual(monthlyAnomaly({temperatureMeanC:27,precipitationMm:100},{temperatureMeanC:27,precipitationMm:100}),{temperature:0,rain:0});
  assert.deepEqual(monthlyAnomaly({temperatureMeanC:null,precipitationMm:0},{temperatureMeanC:27,precipitationMm:0}),{temperature:null,rain:null});
  assert.equal(monthlyAnomaly({temperatureMeanC:NaN,precipitationMm:-2},{temperatureMeanC:27,precipitationMm:100}).rain,null);
});

test('comparison uses the same calendar month, not an annual average or the production forecast year', () => {
  const fixture = {latestPeriod:'2024-02',periods:['2024-02'],baseline:{startYear:1991,endYear:2020},source:{name:'ERA5'},points:{IDN:{normals:{'02':{temperatureMeanC:20,precipitationMm:100,completeYears:30},'01':{temperatureMeanC:10,precipitationMm:10,completeYears:30}},months:{'2024-02':{temperatureMeanC:22,precipitationMm:150,days:29}}}}};
  const result=climateFor(fixture,'IDN');assert.equal(result.temperature,2);assert.equal(result.rain,50);assert.equal(result.current.days,29);
  assert.equal(climateFor(fixture,'IDN','2030-02').available,false);
  assert.equal(climateFor(fixture,'SEA').available,false);
  fixture.points.IDN.normals['02'].completeYears=29;assert.equal(climateFor(fixture,'IDN').available,false);
});

test('saved snapshot has 30-year normals and only complete monitoring months at 11 stated points', () => {
  assert.deepEqual(data.baseline,{startYear:1991,endYear:2020,years:30});assert.equal(data.source.model,'era5');
  assert.equal(Object.keys(data.points).length,11);assert.equal(data.periods.at(-1),data.latestPeriod);
  for(const [code,point] of Object.entries(data.points)){
    assert.equal(Object.keys(point.normals).length,12);
    assert.ok(Object.values(point.normals).every(row=>row.completeYears===30&&Number.isFinite(row.temperatureMeanC)&&row.precipitationMm>=0));
    for(const period of data.periods){const row=point.months[period];const [y,m]=period.split('-').map(Number);assert.equal(row.days,new Date(Date.UTC(y,m,0)).getUTCDate());assert.ok(Number.isFinite(row.temperatureMeanC)&&row.precipitationMm>=0);assert.equal(climateFor(data,code,period).available,true);}
  }
});

test('server accepts point/month selections but supplies saved values rather than client anomalies', () => {
  const selected={countryCode:'IDN',period:data.latestPeriod,temperature:999,rain:999};
  const climate=climateContext(selected);assert.equal(climate.temperatureAnomalyC,climateFor(data,'IDN').temperature);assert.notEqual(climate.temperatureAnomalyC,999);assert.equal(climate.kind,'gridded reanalysis');
  assert.equal(climate.rainfallChangePercent,climateFor(data,'IDN').rain);assert.ok(!Object.hasOwn(climate,'rain'));assert.match(climate.units.rainfallChangePercent,/percent/);
  assert.equal(climateContext(undefined,'SEA'),null);assert.ok(climateContext(undefined,'IDN').available);
  assert.throws(()=>climateContext({countryCode:'SEA',period:data.latestPeriod}));assert.throws(()=>climateContext({countryCode:'IDN',period:'2030-09'}));
});
