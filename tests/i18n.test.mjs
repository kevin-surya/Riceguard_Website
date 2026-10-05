import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {languages,registerCatalog,activateLanguage,getLanguage,getLocale,t,formatNumber,formatDate,subscribeLanguage} from '../src/i18n-core.mjs';
import {recommendedModels,notebookForecast} from '../src/research-model.mjs';
const catalogs=Object.fromEntries(languages.map(({code})=>[code,JSON.parse(readFileSync(new URL(`../src/locales/${code}.json`,import.meta.url),'utf8'))]));
const research=JSON.parse(readFileSync(new URL('../src/research.json',import.meta.url),'utf8'));
for(const [code,catalog] of Object.entries(catalogs))registerCatalog(code,catalog);

test('thirteen offline catalogs cover all supported languages and preserve interpolation tokens',()=>{
  assert.equal(languages.length,13);assert.equal(new Set(languages.map(l=>l.code)).size,13);
  const expected=Object.keys(catalogs.en).sort();
  for(const {code} of languages){assert.deepEqual(Object.keys(catalogs[code]).sort(),expected,code);for(const key of expected){assert.ok(catalogs[code][key].trim(),`${code}: ${key}`);assert.deepEqual((catalogs[code][key].match(/\{p\d+\}/g)||[]).sort(),(catalogs.en[key].match(/\{p\d+\}/g)||[]).sort(),`${code}: ${key}`);}}
  for(const country of ['Indonesia','Malaysia','Brunei','Singapore','Thailand','Vietnam','Myanmar','Cambodia','Laos','Philippines','Timor-Leste'])assert.ok(languages.some(l=>l.countries.includes(country)),country);
});

test('English is the default; aliases, parameters, unknown labels and zero values are safe',()=>{
  assert.equal(getLanguage(),'en');assert.equal(t('Produksi padi'),'Paddy production');
  activateLanguage('id');assert.equal(t('Paddy production'),t('Produksi padi'));
  assert.equal(t('YOUR {p0} OUTLOOK',{p0:2030}),catalogs.id['YOUR {p0} OUTLOOK'].replace('{p0}','2030'));
  assert.ok(t('Harvest loss by {p0}',{p0:0}).includes('0'));
  assert.equal(t('Untouched scientific ID'),'Untouched scientific ID');assert.equal(t(null),'');
  const before=getLanguage();assert.equal(activateLanguage('not-a-language'),false);assert.equal(getLanguage(),before);activateLanguage('en');
});

test('every locale formats numbers and dates and changing locale notifies subscribers',()=>{
  let events=0;const unsubscribe=subscribeLanguage(()=>events++);
  for(const {code,locale} of languages){assert.equal(activateLanguage(code),true);assert.equal(getLocale(),locale);assert.equal(formatNumber(1234.5,1),new Intl.NumberFormat(locale,{maximumFractionDigits:1,minimumFractionDigits:1}).format(1234.5));assert.ok(formatDate('2024-06-01',{year:'numeric',timeZone:'UTC'}));assert.equal(formatNumber(null),'—');}
  unsubscribe();assert.equal(events,languages.length);activateLanguage('en');assert.equal(events,languages.length);
});

test('automatic forecasts use the lowest test error among available future results, independent of display language',()=>{
  const selected=recommendedModels(research);assert.deepEqual(selected,{riceModel:'MLP',populationModel:'LSTM'});
  for(const {code} of languages){activateLanguage(code);assert.deepEqual(notebookForecast(research,2030,selected.riceModel,selected.populationModel).at(-1),{year:2030,rice:196.367174,population:695.193894});}
  const updated=structuredClone(research);updated.forecast.riceMetrics.unshift({Model:'XGBoost','MAPE (%)':0.01});assert.equal(recommendedModels(updated).riceModel,'MLP');
  updated.forecast.future.rice.XGBoost=[{year:2030,value:200000000}];assert.equal(recommendedModels(updated).riceModel,'XGBoost');activateLanguage('en');
});
