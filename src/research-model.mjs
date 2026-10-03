/** Saved research results are explicitly scoped to the notebook's regional aggregate. */
export function notebookForecast(research, endYear, riceModel = 'MLP', populationModel = 'MLP', stress = 0) {
  if (!Number.isInteger(endYear) || endYear < 2025 || endYear > 2030) throw new RangeError('Notebook horizon is 2025–2030');
  const rice = research.forecast.future.rice[riceModel];
  const population = research.forecast.future.population[populationModel];
  if (!rice || !population) throw new TypeError('Unknown notebook model');
  return rice.filter(row => row.year <= endYear).map(row => ({
    year: row.year,
    rice: row.value / 1e6 * (1 - stress / 100 * (row.year - 2024) / (endYear - 2024)),
    population: population.find(point => point.year === row.year).value / 1e6,
  }));
}

export function spatioRows(research, scenario) {
  return research.spatio.countries.filter(row => row.scenario === scenario).map(row => ({
    code: row.GID_0, name: row.COUNTRY, mean: row.predicted_area_ha,
    lower: row.predicted_lower_ha, upper: row.predicted_upper_ha,
    width: row.predicted_upper_ha - row.predicted_lower_ha,
  }));
}

export function spatioTotal(rows) {
  return rows.reduce((total, row) => ({ mean: total.mean + row.mean, lower: total.lower + row.lower, upper: total.upper + row.upper }), { mean: 0, lower: 0, upper: 0 });
}
