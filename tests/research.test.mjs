import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { notebookForecast, spatioRows, spatioTotal } from '../src/research-model.mjs';
const research = JSON.parse(readFileSync(new URL('../src/research.json', import.meta.url), 'utf-8'));

test('notebook hashes identify the unchanged supplied files', () => {
  for (const item of research.provenance) {
    const bytes = readFileSync(new URL(`../../${item.file}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256);
  }
});

test('MLP and LSTM forecasts preserve the distinct saved 2030 outputs and units', () => {
  const mlp = notebookForecast(research, 2030);
  const lstm = notebookForecast(research, 2030, 'LSTM', 'LSTM');
  assert.deepEqual(mlp.at(-1), { year: 2030, rice: 196.367174, population: 758.115227 });
  assert.deepEqual(lstm.at(-1), { year: 2030, rice: 199.329868, population: 695.193894 });
  assert.equal(mlp.length, 6);
  assert.deepEqual(notebookForecast(research, 2025)[0], { year: 2025, rice: 196.269589, population: 712.261194 });
});

test('independent targets, shorter horizons and optional stress do not change stored model outputs', () => {
  const mixed = notebookForecast(research, 2027, 'LSTM', 'MLP', 20);
  const normal = notebookForecast(research, 2027, 'LSTM', 'MLP');
  assert.equal(mixed.length, 3);
  assert.equal(mixed.at(-1).population, 728.634957);
  assert.ok(Math.abs(mixed.at(-1).rice - normal.at(-1).rice * .8) < 1e-10);
  assert.equal(research.forecast.future.rice.LSTM[2].value, 198476230);
});

test('unsupported notebook horizons and models are rejected rather than invented', () => {
  for (const year of [2024, 2031, 2025.5]) assert.throws(() => notebookForecast(research, year), RangeError);
  assert.throws(() => notebookForecast(research, 2030, 'XGBoost'), TypeError);
});

test('research metrics preserve their target and validation split', () => {
  assert.ok(Math.abs(research.forecast.riceMetrics[0]['MAPE (%)'] - .9300485927365346) < 1e-12);
  assert.equal(research.forecast.validation[0].Model, 'XGBoost');
  assert.ok(research.forecast.populationMetrics[0]['MAPE (%)'] < research.forecast.populationMetrics[1]['MAPE (%)']);
  assert.equal(research.spatio.metrics.n_test, 4940);
  assert.equal(research.spatio.residuals.length, 10);
  assert.ok(research.spatio.residuals.every(r => r.p_value === .005));
});

test('both spatio scenarios contain ten countries with ordered intervals; regional grid is a different coverage', () => {
  for (const scenario of ['ssp245', 'ssp585']) {
    const rows = spatioRows(research, scenario);
    assert.equal(rows.length, 10);
    assert.equal(new Set(rows.map(r => r.code)).size, 10);
    assert.ok(!rows.some(r => r.code === 'TLS'));
    assert.ok(rows.every(r => r.lower <= r.mean && r.mean <= r.upper && r.width === r.upper - r.lower));
    assert.ok(rows.find(r => r.code === 'SGP').mean > 0);
    const total = spatioTotal(rows);
    assert.ok(total.mean > 20e6 && total.mean < 21e6);
    assert.ok(total.mean < research.spatio.gridSummary.find(r => r.scenario === scenario).total_predicted_area_ha);
  }
  assert.equal(spatioRows(research, 'ssp245').find(r => r.code === 'IDN').mean, 2251881.603533023);
});

test('original notebook raster figures are valid PNG assets', () => {
  for (const item of research.spatio.figures) {
    const png = readFileSync(new URL('../public' + item.path, import.meta.url));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  }
});
