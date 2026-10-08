import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {geoArea} from 'd3-geo';
import {annualRows,annualTotal,timelineSeries,timelineCsv} from '../src/spatio-timeline.mjs';
const data=JSON.parse(readFileSync(new URL('../public/research/spatio-timeline.json',import.meta.url),'utf8'));

test('both scenarios have real annual frames from 1961 through 2030 without gaps or duplicates',()=>{
 assert.equal(data.frames.length,79);
 for(const scenario of ['ssp245','ssp585'])for(let year=1961;year<=2030;year++){
  const rows=annualRows(data,year,scenario);assert.equal(rows.length,10);assert.equal(new Set(rows.map(r=>r.code)).size,10);
  assert.ok(rows.every(r=>Number.isFinite(r.mean)&&r.mean>=0));
  if(year<=2021)assert.ok(rows.every(r=>r.lower===null&&r.upper===null&&r.width===null));
  else assert.ok(rows.every(r=>Number.isFinite(r.lower)&&r.lower<=r.mean&&r.mean<=r.upper&&r.width===r.upper-r.lower));
 }
 assert.deepEqual(annualRows(data,2021,'ssp245'),annualRows(data,2021,'ssp585'));
 assert.notDeepEqual(annualRows(data,2030,'ssp245'),annualRows(data,2030,'ssp585'));
 assert.deepEqual(annualRows(data,2031,'ssp245'),[]);assert.deepEqual(annualRows(data,2025.5,'ssp245'),[]);
});

test('selected-year values and CSV exports use exactly the stored forecast and preserve absent historical bounds',()=>{
 for(const year of [1961,2000,2021,2022,2028,2030]){
  const rows=annualRows(data,year,'ssp585');const csv=timelineCsv(data,year,'ssp585','IDN').split('\r\n');
  assert.equal(csv.length,2);const row=rows.find(row=>row.code==='IDN');const values=csv[1].split(',');assert.equal(Number(values[0]),year);assert.equal(Number(values[4]),row.mean);
  assert.equal(values[2],year<=2021?'':'ssp585');assert.equal(values[5],row.lower===null?'':String(row.lower));assert.equal(values[6],row.upper===null?'':String(row.upper));
  const total=annualTotal(rows);assert.equal(total.mean,rows.reduce((sum,row)=>sum+row.mean,0));assert.equal(total.lower,year<=2021?null:rows.reduce((sum,row)=>sum+row.lower,0));
 }
});

test('trend has a continuous annual axis and preserves the historical/projected boundary',()=>{
 const series=timelineSeries(data,'ssp245','IDN');assert.equal(series.length,70);
 const last=series.find(p=>p.year===2021);assert.equal(last.past,last.future);assert.ok(series.find(p=>p.year===2022).future>0);assert.equal(series.find(p=>p.year===2022).past,null);
 assert.equal(series.at(-1).future,annualRows(data,2030,'ssp245').find(r=>r.code==='IDN').mean/1e6);
 const middle=series.find(p=>p.year===2025).future;const linear=last.past+(series.at(-1).future-last.past)*4/9;assert.notEqual(middle,linear,'Annual projections must not be endpoint interpolation');
});

test('annual rasters exist, use the same dimensions, and change with the year',()=>{
 const pngs=[];
 for(const year of [1961,2000,2021,2022,2030]){
  const frame=data.frames.find(f=>f.year===year&&(f.kind==='historical'||f.scenario==='ssp245'));
  const png=readFileSync(new URL('../public'+frame.raster,import.meta.url));assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(png.readUInt32BE(16),624);assert.equal(png.readUInt32BE(20),528);pngs.push(png);
 }
 for(let i=1;i<pngs.length;i++)assert.notDeepEqual(pngs[i-1],pngs[i]);
 for(const frame of data.frames.filter(f=>f.kind==='projected'))for(const layer of ['lower','upper','width'])assert.ok(readFileSync(new URL('../public'+frame.raster.replace('-mean.png',`-${layer}.png`),import.meta.url)).length>100);
});

test('GADM geometry has a valid display orientation and evaluation comes from the new independent holdout',()=>{
 const geo=JSON.parse(readFileSync(new URL('../public/research/gadm-spatio.geojson',import.meta.url),'utf8'));assert.equal(geo.features.length,10);assert.ok(geo.features.every(f=>geoArea(f)>0&&geoArea(f)<.2));
 const report=JSON.parse(readFileSync(new URL('../artifacts/spatio-rerun-report.json',import.meta.url),'utf8'));assert.equal(report.selection.rmse_ha,Math.min(...report.candidates.map(row=>row.rmse_ha)));assert.equal(data.metrics.n_test,data.model.cellCount*10);assert.equal(data.model.test,'2012–2021');assert.deepEqual(report.test,data.metrics);
});
