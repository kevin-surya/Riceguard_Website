import { readFileSync } from 'node:fs';
import { climateFor } from '../src/climate-model.mjs';
const snapshot = JSON.parse(readFileSync(new URL('../src/climate.json', import.meta.url), 'utf8'));

/** Clients select a point/month; the server supplies the actual saved measurements. */
export function climateContext(selection, fallbackCountry = 'SEA') {
  const code = selection?.countryCode ?? (fallbackCountry === 'SEA' ? null : fallbackCountry);
  if (!code) return null;
  const period = selection?.period ?? snapshot.latestPeriod;
  if (!Object.hasOwn(snapshot.points, code) || !snapshot.periods.includes(period)) throw Error('Invalid climate selection');
  const { temperature, rain, ...facts } = climateFor(snapshot, code, period);
  return {...facts, temperatureAnomalyC:temperature, rainfallChangePercent:rain,
    units:{temperatureAnomalyC:'degrees Celsius difference',rainfallChangePercent:'percent difference, already multiplied by 100',temperatureMeanC:'degrees Celsius',precipitationMm:'millimetres'},
    interpretation:'Historical gridded reanalysis estimate at the stated point, not a field observation. Compare the same calendar month; rainfallChangePercent is not millimetres.'};
}
