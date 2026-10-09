import { readFileSync } from 'node:fs';
import { countries, seriesFor, forecast, indicator, pressureThresholds } from '../src/model.mjs';
import { climateContext } from './climate-context.mjs';
import { notebookForecast, recommendedModels } from '../src/research-model.mjs';
import { annualRows, annualTotal } from '../src/spatio-timeline.mjs';

// Literal paths allow Vercel's file tracer to include the runtime datasets.
const snapshot = JSON.parse(readFileSync(new URL('../src/data.json', import.meta.url), 'utf8'));
const research = JSON.parse(readFileSync(new URL('../src/research.json', import.meta.url), 'utf8'));
const spatial = JSON.parse(readFileSync(new URL('../public/research/spatio-timeline.json', import.meta.url), 'utf8'));
const models = recommendedModels(research);
const pages = ['overview','forecast','climate','map','warnings','spatio','sources'];
const outlooks = ['notebook','trend','infographic','resilient'];
const names = {SEA:'Southeast Asia',ALL:'10 covered ASEAN countries',IDN:'Indonesia',VNM:'Vietnam',THA:'Thailand',MMR:'Myanmar',PHL:'Philippines',KHM:'Cambodia',LAO:'Laos',MYS:'Malaysia',SGP:'Singapore',BRN:'Brunei',TLS:'Timor-Leste'};
const number = (value,min,max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

export function buildChatContext(selection) {
 if (!selection || !pages.includes(selection.page) || !Object.hasOwn(names,selection.countryCode) || selection.countryCode==='ALL' || !Number.isInteger(selection.year) || !number(selection.year,2025,2035) || !outlooks.includes(selection.scenario) || !number(selection.stress,0,30)) throw Error('Invalid dashboard selection');
 const { countryCode, year, scenario, stress } = selection;
 const regional = countryCode==='SEA' && scenario==='notebook';
 if (regional && year>2030) throw Error('Unavailable regional forecast');
 const history = seriesFor(snapshot,countryCode).map(row => regional && row.year===2024 ? {...row,rice:research.forecast.baseline2024.rice/1e6,population:research.forecast.baseline2024.population/1e6} : row);
 const projected = regional ? notebookForecast(research,year,models.riceModel,models.populationModel,stress) : forecast(history,year,scenario==='notebook'?'trend':scenario,stress);
 const climate = climateContext(selection.climate, countryCode);
 const context = {
  page:selection.page,country:names[countryCode],forecastYear:year,outlook:regional?'selected regional forecast':'exploratory country/regional trend scenario',harvestLossScenarioPercent:stress,
  units:{rice:'million tonnes of unmilled paddy',population:'million people'},baseline:history.at(-1),forecast:projected.at(-1),
  productionPressure:{...indicator(history,projected),units:{change:'percent change, already multiplied by 100',decline:'percent decline, already multiplied by 100',supply:'kg of unmilled paddy produced per person'},thresholds:pressureThresholds,classificationBasis:'Percentage decline in paddy production per person from 2024; prototype planning tolerances, not validated food-shortage thresholds; climate excluded'},climate,weather:null,spatioTemporal:null,
 };
 const weather=selection.weather;
 if (weather && countries.some(country=>country.code===weather.countryCode) && Array.isArray(weather.days) && weather.days.length>0 && weather.days.length<=7) {
  const days=weather.days.filter(day=>/^\d{4}-\d{2}-\d{2}$/.test(day.date) && (day.maxTemperatureC==null||number(day.maxTemperatureC,-70,65)) && (day.rainMm==null||number(day.rainMm,0,1500))).map(day=>({date:day.date,maxTemperatureC:day.maxTemperatureC??null,rainMm:day.rainMm??null}));
  if(days.length)context.weather={source:'Open-Meteo point forecast fetched by the browser',country:names[weather.countryCode],location:countries.find(country=>country.code===weather.countryCode).location,days};
 }
 if (selection.page==='spatio' && selection.spatio) {
  const {year:spatialYear,scenario:spatialScenario,countryCode:spatialCountry,layer}=selection.spatio;
  if (!Number.isInteger(spatialYear)||!number(spatialYear,1961,2030)||!['ssp245','ssp585'].includes(spatialScenario)||!['ALL',...spatial.frames[0].countries.map(row=>row.code)].includes(spatialCountry)||!['mean','lower','upper','width'].includes(layer))throw Error('Invalid map selection');
  const rows=annualRows(spatial,spatialYear,spatialScenario);
  const values=spatialCountry==='ALL'?annualTotal(rows):rows.find(row=>row.code===spatialCountry);
  context.spatioTemporal={year:spatialYear,country:names[spatialCountry],kind:spatialYear<=2021?'historical':'projected',scenario:spatialYear<=2021?null:spatialScenario,layer:spatialYear<=2021?'mean':layer,harvestedAreaHa:values.mean,conditionalLowerHa:values.lower,conditionalUpperHa:values.upper};
 }
 return context;
}
