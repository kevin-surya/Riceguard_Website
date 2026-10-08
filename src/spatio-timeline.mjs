/** Resolve actual yearly outputs; never interpolate maps or replace missing years. */
export function annualRows(data, year, scenario = 'ssp245') {
 const frame=data.frames.find(frame=>frame.year===year&&(frame.kind==='historical'||frame.scenario===scenario));
 return frame?frame.countries.map(row=>({...row,width:row.lower==null||row.upper==null?null:row.upper-row.lower})):[];
}
export function annualTotal(rows) {
 if(!rows.length)return {mean:0,lower:null,upper:null,width:null};
 const bounds=rows.every(row=>row.lower!=null&&row.upper!=null);
 const total=rows.reduce((sum,row)=>({mean:sum.mean+row.mean,lower:sum.lower+(row.lower||0),upper:sum.upper+(row.upper||0)}),{mean:0,lower:0,upper:0});
 return {mean:total.mean,lower:bounds?total.lower:null,upper:bounds?total.upper:null,width:bounds?total.upper-total.lower:null};
}
export function timelineSeries(data,scenario,selected='ALL') {
 return Array.from({length:data.endYear-data.startYear+1},(_,index)=>{
  const year=data.startYear+index,rows=annualRows(data,year,scenario);const total=selected==='ALL'?annualTotal(rows):rows.find(row=>row.code===selected);
  const value=rows.length&&total?total.mean/1e6:null;
  return {year,past:year<=data.lastHistoricalYear?value:null,future:year>=data.lastHistoricalYear?value:null};
 });
}
export function timelineCsv(data,year,scenario,selected='ALL') {
 const kind=year<=data.lastHistoricalYear?'historical':'projected';
 const rows=annualRows(data,year,scenario).filter(row=>selected==='ALL'||row.code===selected);
 return [['year','kind','scenario','country','estimated_harvested_area_ha','conditional_lower_ha','conditional_upper_ha'],...rows.map(row=>[year,kind,kind==='projected'?scenario:'',row.code,row.mean,row.lower??'',row.upper??''])].map(row=>row.join(',')).join('\r\n');
}
