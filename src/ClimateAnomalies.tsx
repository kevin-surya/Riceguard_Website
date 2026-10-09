import { CloudRain, Thermometer, ArrowUpRight, ArrowRight } from 'lucide-react';
import { t, getLocale, formatNumber } from './i18n';
import data from './climate.json';
import { countries } from './model.mjs';
import { climateFor } from './climate-model.mjs';
import './climate.css';

export const climatePeriods = data.periods;
export const latestClimatePeriod = data.latestPeriod;
export function periodLabel(period: string) {
  return new Intl.DateTimeFormat(getLocale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${period}-01T12:00:00Z`));
}
const number = (value: number | null, digits = 1) => value == null ? '—' : formatNumber(value, digits);
const signed = (value: number | null) => value == null ? '—' : `${value > 0 ? '+' : ''}${number(value)}`;

export default function ClimateAnomalies({ countryCode, period, onCountry, onPeriod, onOpen, full = false }: {
  countryCode: string; period: string; onCountry: (code: string) => void; onPeriod: (period: string) => void; onOpen: () => void; full?: boolean;
}) {
  const climate = climateFor(data, countryCode, period);
  const country = countries.find(item => item.code === countryCode)!;
  return <section className="card climate-anomalies">
    <div className="section-head"><div><h3>{t('Monthly climate comparison')}</h3><p>{t('Same calendar month · baseline 1991–2020')}</p></div><span className="mini-badge">ERA5</span></div>
    {full && <div className="climate-selectors"><label>{t('Monitoring location')}<select value={countryCode} onChange={event => onCountry(event.target.value)}>{countries.map(item => <option key={item.code} value={item.code}>{t(item.name)} · {t(item.location)}</option>)}</select></label><label>{t('Comparison month')}<select value={period} onChange={event => onPeriod(event.target.value)}>{[...data.periods].reverse().map(month => <option key={month} value={month}>{periodLabel(month)}</option>)}</select></label></div>}
    <p className="climate-point"><strong>{t(country.name)} · {t(country.location)}</strong><span>{periodLabel(period)}</span></p>
    {climate.available ? <div className="climate-comparison-grid">
      <div className="climate-metric"><span className="climate-icon warm"><Thermometer size={21} /></span><span>{t('Temperature anomaly')}</span><strong>{signed(climate.temperature)}<small>°C</small></strong><p>{climate.temperature == null ? t('Data not available') : climate.temperature > 0 ? t('Warmer than the baseline') : climate.temperature < 0 ? t('Cooler than the baseline') : t('Equal to the baseline')}</p><div><span>{t('Monthly mean')}</span><b>{number(climate.current?.temperatureMeanC ?? null)}°C</b></div><div><span>{t('Baseline mean')}</span><b>{number(climate.normal?.temperatureMeanC ?? null)}°C</b></div></div>
      <div className="climate-metric"><span className="climate-icon blue"><CloudRain size={21} /></span><span>{t('Rainfall change')}</span><strong>{signed(climate.rain)}<small>%</small></strong><p>{climate.rain == null ? t('Percentage unavailable: baseline rainfall is zero.') : climate.rain > 0 ? t('Wetter than the baseline') : climate.rain < 0 ? t('Drier than the baseline') : t('Equal to the baseline')}</p><div><span>{t('Monthly rainfall')}</span><b>{number(climate.current?.precipitationMm ?? null)} mm</b></div><div><span>{t('Baseline rainfall')}</span><b>{number(climate.normal?.precipitationMm ?? null)} mm</b></div></div>
    </div> : <p className="inline-error">{t('A complete comparison is not available for this month.')}</p>}
    <p className="fine-print">{t('One monitoring point, not a national average. ERA5 reanalysis combines observations and a weather model; it is not a field measurement.')}</p>
    <p className="fine-print">{t('Snapshot retrieved: {p0}', {p0: data.retrievedAt.slice(0, 10)})}</p>
    {full && <details className="climate-method"><summary>{t('How is the comparison calculated?')}</summary><p>{t('Temperature anomaly = monthly mean temperature minus the mean for the same month in 1991–2020.')}</p><p>{t('Rainfall change = (monthly rainfall minus baseline rainfall) divided by baseline rainfall, multiplied by 100%.')}</p><p>{t('Each baseline month averages 30 complete years. Only complete monitoring months are shown; this is historical weather, not a forecast for the selected production year.')}</p><a href={data.source.normalsUrl} target="_blank" rel="noreferrer">{t('WMO reference period')}<ArrowUpRight size={13}/></a></details>}
    <div className="climate-foot"><a href={data.source.url} target="_blank" rel="noreferrer">{t('Source: ERA5 via Open-Meteo')}<ArrowUpRight size={13}/></a>{!full && <button className="text-button" onClick={onOpen}>{t('Open monitor')}<ArrowRight size={14}/></button>}</div>
  </section>;
}
