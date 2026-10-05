import { t, formatNumber } from './i18n';
import { Users, Wheat, TrendingUp, ShieldCheck, TriangleAlert } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { changePercent } from './model.mjs';

type Point = {year:number; rice:number|null; population:number};
type Props = { history:Point[]; projected:Point[]; year:number; country:string; regional:boolean; stress:number };
const n = (value:number|null|undefined,digits=1) => value == null ? '—' : formatNumber(value,digits);

function OutlookChart({ history, projected, target, title, unit, color }: {history:Point[]; projected:Point[]; target:'rice'|'population'; title:string; unit:string; color:string}) {
  const last=history.at(-1)!;
  const data=[...history.filter(row=>row.year>=2015).map(row=>({year:row.year,past:row[target],future:row.year===last.year?row[target]:null})),...projected.map(row=>({year:row.year,past:null,future:row[target]}))];
  return <section className="card simple-outlook-chart"><div className="section-head"><div><h3>{title}</h3><p>{unit}</p></div></div>{last[target]==null ? <div className="forecast-missing">{t('Production data is unavailable for this country.')}</div> : <div className="simple-chart-canvas" role="img" aria-label={t('{p0}: past data and future estimates', {p0:title})}><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{left:0,right:16,top:20,bottom:10}}><CartesianGrid vertical={false} stroke="#e5ebe2" strokeDasharray="3 5"/><XAxis dataKey="year" type="number" domain={['dataMin','dataMax']} ticks={[2015,2020,2024,projected.at(-1)!.year]} tick={{fontSize:11,fill:'#7c8a77'}} tickLine={false} axisLine={false}/><YAxis domain={[0,'auto']} tickFormatter={value=>n(value,0)} tick={{fontSize:11,fill:'#7c8a77'}} tickLine={false} axisLine={false} width={50}/><Tooltip content={({active,payload,label})=>active&&payload?.some(item=>item.value!=null)?<div className="chart-tooltip"><strong>{label} · {Number(label)>2024?t('Forecast'):t('Past data')}</strong><p>{n(Number(payload.find(item=>item.value!=null)!.value),2)} {unit}</p></div>:null}/><ReferenceLine x={2024} stroke="#b6c1ad" strokeDasharray="3 5"/><Line dataKey="past" type="monotone" stroke={color} strokeWidth={2.6} dot={false} isAnimationActive={false}/><Line dataKey="future" type="monotone" stroke={color} strokeWidth={2.6} strokeDasharray="5 5" dot={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></div>}</section>;
}

export default function ForecastResearch({history,projected,year,country,regional,stress}:Props) {
  const base=history.at(-1)!,end=projected.at(-1)!;
  const riceChange=changePercent(end.rice,base.rice),populationChange=changePercent(end.population,base.population);
  const perPerson=end.rice==null?null:end.rice/end.population*1000;
  const basePerPerson=base.rice==null?null:base.rice/base.population*1000;
  const supplyChange=changePercent(perPerson,basePerPerson);
  const declining=supplyChange!=null&&supplyChange < -1;
  const direction=(value:number|null)=>value==null?t('Data unavailable'):Math.abs(value)<.05?t('About the same as 2024'):t(value<0?'{p0}% less than 2024':'{p0}% more than 2024',{p0:n(Math.abs(value))});
  return <div className="simple-forecast">
    <div className="forecast-summary-heading"><div><span className="control-label">{t('YOUR {p0} OUTLOOK',{p0:year})}</span><h2>{country}</h2></div><span className="mini-badge">{stress>0?t('HARVEST-LOSS SCENARIO'):regional?t('RECOMMENDED FORECAST'):t('COUNTRY OUTLOOK')}</span></div>
    <div className="forecast-result-grid">
      <section className="card forecast-result"><span><Wheat size={19}/>{t('Expected paddy production')}</span><strong>{n(end.rice,2)}<small>{t('million tonnes')}</small></strong><p>{direction(riceChange)}</p></section>
      <section className="card forecast-result"><span><Users size={19}/>{t('Expected population')}</span><strong>{n(end.population,2)}<small>{t('million people')}</small></strong><p>{direction(populationChange)}</p></section>
      <section className="card forecast-result"><span><TrendingUp size={19}/>{t('Paddy produced per person')}</span><strong>{n(perPerson)}<small>{t('kg per year')}</small></strong><p>{direction(supplyChange)}</p></section>
    </div>
    <section className={`forecast-takeaway ${declining?'needs-attention':''}`} role="status">{declining?<TriangleAlert size={26}/>:<ShieldCheck size={26}/>}<div><span className="control-label">{t('WHAT THIS MEANS')}</span><h3>{supplyChange==null?t('More data is needed for this outlook.'):declining?t('Production per person may fall.'):Math.abs(supplyChange)<=1?t('Production per person is expected to stay broadly stable.'):t('Production per person may rise.')}</h3><p>{supplyChange==null?t('Population can be estimated, but missing paddy data prevents a supply comparison.'):declining?t('There may be less paddy produced for each person. Keep an eye on harvests, food reserves, and imports.'):t('Keep monitoring harvests, weather, and food reserves to maintain a reliable supply.')}</p></div></section>
    <div className="forecast-chart-heading"><div><h3>{t('How the outlook changes')}</h3><p>{t('Solid lines show the past. Dashed lines show the forecast.')}</p></div></div>
    <div className="simple-outlook-grid"><OutlookChart history={history} projected={projected} target="rice" title={t('Paddy production')} unit={t('million tonnes')} color="#548969"/><OutlookChart history={history} projected={projected} target="population" title={t('Population')} unit={t('million people')} color="#c2a463"/></div>
    <div className="forecast-reading-note"><p>{t('Paddy is rice before milling. Production per person is a supply indicator, not the amount each person eats. Imports, exports, reserves, and consumption also affect food availability.')}</p><p>{regional?t('The regional outlook uses the available forecasts that performed best against past data.'):t('This country outlook follows recent production and population trends. It may differ from the regional outlook.')}</p>{stress>0&&<p>{t('This view includes a {p0}% harvest-loss scenario by {p1}.',{p0:stress,p1:year})}</p>}</div>
  </div>;
}
