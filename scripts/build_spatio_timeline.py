"""Fit and export the annual spatial timeline from cached official source data."""
from pathlib import Path
import json,hashlib,csv,warnings
import numpy as np
import matplotlib
matplotlib.use('Agg')
from matplotlib import colormaps
from matplotlib.colors import LogNorm
from PIL import Image
from spatio_model import spatial_precision,fit,predict,errors

ROOT=Path(__file__).resolve().parents[1];DATA=ROOT/'data/processed/glorice';PUBLIC=ROOT/'public/research/timeline';PUBLIC.mkdir(parents=True,exist_ok=True)
history=np.load(DATA/'historical_grid.npz');fine=np.load(DATA/'glorice_sea_intensive_harvested_area_1961_2021.npz');countries=np.load(DATA/'country_weights.npz');climate=np.load(DATA/'climate.npz')
years=history['years'];grid=history['area_ha'];weights=countries['weights'];codes=countries['codes'].tolist();active=(weights.sum(axis=0)>1e-9).reshape(22,26)
# Include valid country-intersecting land cells, including historically empty cells in the hurdle.
qspace,spatial_variance,coordinates=spatial_precision(active);n=int(active.sum());areas=grid[years>=1981][:,active];rain=climate['rain'][:,active].copy()
with warnings.catch_warnings():
 warnings.simplefilter('ignore',RuntimeWarning);medians=np.nanmedian(rain[:26],axis=0)
missing=~np.isfinite(rain);fallback=float(np.nanmedian(rain[:26]));medians=np.where(np.isfinite(medians),medians,fallback);rain=np.where(missing,medians[None,:],rain)
assert np.isfinite(rain).all() and (rain>=0).all();print(f'Annual model: {n} cells, 1981-2021; {int(missing.sum())} missing rainfall values imputed from training.',flush=True)
fit_years=np.arange(1981,2022);candidates=[]
for rho in [.8,.95,.99]:
 for lam in [.1,1,10]:
  model=fit(areas[:26],rain[:26],fit_years[:26],qspace,rho,lam)
  estimate=predict(model,fit_years[26:31],rain[26:31])
  frequency=(np.sum(areas[:26]>0,axis=0)+.5)/27
  score=errors(areas[26:31],estimate*frequency[None,:])
  candidates.append({'rho':rho,'lambda':lam,**score});print('Validation',rho,lam,round(score['rmse_ha'],1),flush=True)
best=min(candidates,key=lambda row:row['rmse_ha']);rho,lam=best['rho'],best['lambda']
print('Selected using 2007-2011:',rho,lam,flush=True)
area_test=fit(areas[:31],rain[:31],fit_years[:31],qspace,rho,lam);presence_test=fit(areas[:31],rain[:31],fit_years[:31],qspace,rho,lam,binary=True)
test_prediction=predict(area_test,fit_years[31:],rain[31:])*predict(presence_test,fit_years[31:],rain[31:]);metrics=errors(areas[31:],test_prediction);print('Independent 2012-2021 test:',metrics,flush=True)
area_model=fit(areas,rain,fit_years,qspace,rho,lam);presence_model=fit(areas,rain,fit_years,qspace,rho,lam,binary=True)
np.savez_compressed(DATA/'annual_model_parameters.npz',area_coef=area_model['coef'],presence_coef=presence_model['coef'],rho=rho,precision=lam,area_sigma2=area_model['sigma2'],active=active)
future_years=np.arange(2022,2031);last_rain=rain[-10:].mean(axis=0);baseline=climate['worldclim_baseline'][active];scenario_names=['ssp245','ssp585'];projections={};support=grid[-1][active]>0
for index,scenario in enumerate(scenario_names):
 target=climate['future_rain'][index][active];ratio=np.divide(target,baseline,out=np.ones_like(target),where=(baseline>0)&np.isfinite(target));assert np.all(ratio>0)
 annual_rain=last_rain[None,:]*(1+(ratio[None,:]-1)*(future_years[:,None]-2021)/9)
 point,lower,upper=predict(area_model,future_years,annual_rain,True,spatial_variance);probability=predict(presence_model,future_years,annual_rain)
 point*=probability;lower*=probability;upper*=probability
 for a in [point,lower,upper]:a[:,~support]=0
 assert np.isfinite(point).all() and (point>=0).all();assert np.all(lower<=point) and np.all(point<=upper)
 projections[scenario]=(point,lower,upper)
np.savez_compressed(DATA/'annual_grid_predictions.npz',years=future_years,active=active,**{f'{scenario}_{field}':a for scenario,arrays in projections.items() for field,a in zip(['mean','lower','upper'],arrays)})
print('Calculated both scenarios for every year 2022-2030.',flush=True)

# Spatially comparable country summaries: the same equal-area 2-degree GADM fractions for both periods.
frames=[];active_weights=weights[:,active.ravel()]
def summaries(values,lo=None,hi=None):
 means=active_weights@values;lows=active_weights@lo if lo is not None else None;highs=active_weights@hi if hi is not None else None
 return [{'code':code,'mean':float(means[i]),'lower':float(lows[i]) if lows is not None else None,'upper':float(highs[i]) if highs is not None else None} for i,code in enumerate(codes)]
for index,year in enumerate(years):frames.append({'year':int(year),'kind':'historical','scenario':None,'countries':summaries(grid[index][active]),'raster':f'/research/timeline/historical-{year}.png'})
for scenario,arrays in projections.items():
 for index,year in enumerate(future_years):frames.append({'year':int(year),'kind':'projected','scenario':scenario,'countries':summaries(*[a[index] for a in arrays]),'raster':f'/research/timeline/{scenario}-{year}-mean.png'})

# Project only onto the observed 2021 fine-pixel pattern; do not invent new rice-field locations.
last=np.nan_to_num(fine['area_ha'][-1],nan=0);last_blocks=last.reshape(22,24,26,24);total=last_blocks.sum(axis=(1,3));fraction=np.divide(last_blocks,total[:,None,:,None],out=np.zeros_like(last_blocks),where=total[:,None,:,None]>0)
def allocate(values):
 coarse=np.zeros((22,26));coarse[active]=values
 result=(fraction*coarse[:,None,:,None]).reshape(528,624)
 assert np.allclose(result.sum(),values[support].sum(),rtol=1e-6)
 return result
vmax=max(float(np.nanmax(fine['area_ha'])),max(float(allocate(values).max()) for arrays in projections.values() for values in arrays[2]));norm=LogNorm(vmin=1,vmax=vmax);palette=colormaps['YlGn'];background=np.array([237,242,244,255],dtype=np.uint8)
def save_raster(values,path):
 valid=np.isfinite(values)&(values>0);rgba=np.broadcast_to(background,(*values.shape,4)).copy();rgba[valid]=np.round(palette(norm(values[valid]))*255).astype(np.uint8);Image.fromarray(rgba,'RGBA').save(path,optimize=True)
for index,year in enumerate(years):save_raster(fine['area_ha'][index],PUBLIC/f'historical-{year}.png')
for scenario,arrays in projections.items():
 for index,year in enumerate(future_years):
  for name,a in [('mean',arrays[0]),('lower',arrays[1]),('upper',arrays[2]),('width',arrays[2]-arrays[1])]:save_raster(allocate(a[index]),PUBLIC/f'{scenario}-{year}-{name}.png')

sources=[{'name':'GloRice intensive harvested area','url':'https://figshare.com/articles/dataset/GloRice_I_Gridded_paddy_rice_distribution_for_the_years_1961_to_2021/25752207','file':'data/raw/glorice/GloRice-hvst-In.zip'}, {'name':'CHIRPS v3 annual rainfall','url':'https://chc.ucsb.edu/data/chirps3'}, {'name':'WorldClim ACCESS-CM2','url':'https://worldclim.org/data/cmip6/cmip6_clim10m.html'}, {'name':'GADM 4.1','url':'https://gadm.org/data.html'}]
for source in sources:
 if 'file' in source:source['sha256']=hashlib.sha256((ROOT/source['file']).read_bytes()).hexdigest()
result={'version':1,'startYear':1961,'lastHistoricalYear':2021,'endYear':2030,'codes':codes,'extent':history['extent'].tolist(),'rasterScale':{'minimum':1,'maximum':vmax,'type':'log'},'frames':frames,'metrics':metrics,'model':{'name':'Regularized BYM2-style + AR(1) hurdle (MAP)','gridDegrees':2,'cellCount':n,'training':'1981–2011','validation':'2007–2011 (initial fitting 1981–2006)','test':'2012–2021','refit':'1981–2021','rho':rho,'precision':lam,'spatialMixing':.5,'selectedBy':'2007–2011 RMSE','climateModel':'ACCESS-CM2','climatePeriod':'2021–2040','rainfallImputed':int(missing.sum()),'implementation':'Reconstructed MAP pipeline; not a rerun of the unavailable original training implementation','interval':'Approximate conditional log-area intervals, with presence probability fixed; summed cell bounds are not regional posterior intervals','climatePath':'Linear transition of rainfall covariates from the 2012–2021 CHIRPS mean to the WorldClim 2021–2040 anomaly ratio. Harvested-area outputs are model forecasts, not endpoint interpolation.'},'sources':sources}
(ROOT/'public/research/spatio-timeline.json').write_text(json.dumps(result,separators=(',',':'),allow_nan=False),encoding='utf-8')
with (ROOT/'public/research/spatio-annual-countries.csv').open('w',newline='',encoding='utf-8-sig') as handle:
 writer=csv.writer(handle);writer.writerow(['year','kind','scenario','country','estimated_harvested_area_ha','conditional_lower_ha','conditional_upper_ha'])
 for frame in frames:
  for country in frame['countries']:writer.writerow([frame['year'],frame['kind'],frame['scenario'] or '',country['code'],country['mean'],country['lower'] if country['lower'] is not None else '',country['upper'] if country['upper'] is not None else ''])
report={'candidates':candidates,'selection':best,'test':metrics,'source_files':sources,'implementation_sha256':hashlib.sha256((ROOT/'scripts/spatio_model.py').read_bytes()).hexdigest()}
(ROOT/'artifacts/spatio-rerun-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(f'Exported {len(frames)} annual/scenario frames, 133 rasters, 790 country records and new independent evaluation.',flush=True)
