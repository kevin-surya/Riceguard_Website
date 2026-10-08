"""Prepare real GloRice annual grids, GADM fractions and CHIRPS/CMIP6 inputs."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import json,re,zipfile,warnings
import numpy as np
from netCDF4 import Dataset
import rasterio
from rasterio.windows import from_bounds
from rasterio.enums import Resampling
from shapely.geometry import shape,box,mapping,MultiPolygon
from shapely.geometry.polygon import orient
from shapely.ops import transform
from pyproj import Transformer

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/processed/glorice';OUT.mkdir(parents=True,exist_ok=True)
CODES=['BRN','KHM','IDN','LAO','MYS','MMR','PHL','SGP','THA','VNM']

def block_sum(a):
 return a.reshape(*a.shape[:-2],22,24,26,24).sum(axis=(-3,-1))
def block_mean(a,factor):
 with warnings.catch_warnings():
  warnings.simplefilter('ignore',RuntimeWarning)
  return np.nanmean(a.reshape(22,factor,26,factor),axis=(1,3))

historical=OUT/'glorice_sea_intensive_harvested_area_1961_2021.npz'
if not historical.exists():
 rows=[]
 with zipfile.ZipFile(ROOT/'data/raw/glorice/GloRice-hvst-In.zip') as archive:
  files={int(re.search(r'(\d{4})\.nc$',n)[1]):n for n in archive.namelist() if n.endswith('.nc')}
  for year in range(1961,2022):
   with Dataset('GloRice',memory=archive.read(files[year])) as dataset:
    lon0=np.asarray(dataset['lon'][:]);lat0=np.asarray(dataset['lat'][:]);xi=np.flatnonzero((lon0>=92-1e-6)&(lon0<144-1e-6));yi=np.flatnonzero((lat0<=32+1e-6)&(lat0>-12+1e-6));lon=lon0[xi];lat=lat0[yi]
    data=np.asarray(np.ma.filled(dataset['area'][yi[0]:yi[-1]+1,xi[0]:xi[-1]+1],np.nan),dtype=np.float32)
    assert data.shape==(528,624);assert np.all(data[np.isfinite(data)]>=0)
    rows.append(data)
   if year%10==1:print('GloRice cropped:',year,flush=True)
 np.savez_compressed(historical,years=np.arange(1961,2022),area_ha=np.array(rows),lon=lon,lat=lat)
hist=np.load(historical);lon,lat=hist['lon'],hist['lat'];fine=hist['area_ha'];grid=block_sum(np.nan_to_num(fine,nan=0)).astype(float)
step=abs(lon[1]-lon[0]);extent=[float(lon[0]-step/2),float(lon[-1]+step/2),float(lat[-1]-step/2),float(lat[0]+step/2)]
np.savez_compressed(OUT/'historical_grid.npz',years=hist['years'],area_ha=grid,extent=extent)
west,east,south,north=extent
lon_edges=np.linspace(west,east,27);lat_edges=np.linspace(north,south,23)
weights_path=OUT/'country_weights.npz'
if not weights_path.exists():
 project=Transformer.from_crs('EPSG:4326','EPSG:6933',always_xy=True).transform
 cells=[transform(project,box(lon_edges[c],lat_edges[r+1],lon_edges[c+1],lat_edges[r])) for r in range(22) for c in range(26)]
 weights=[];features=[]
 for code in CODES:
  with zipfile.ZipFile(ROOT/f'data/raw/gadm41_adm0/gadm41_{code}_0.json.zip') as archive:
   name=next(n for n in archive.namelist() if n.endswith('.json'));feature=json.loads(archive.read(name))['features'][0]
  country=transform(project,shape(feature['geometry']));fraction=np.array([cell.intersection(country).area/cell.area if cell.intersects(country) else 0 for cell in cells]);assert np.all((fraction>=0)&(fraction<=1+1e-6));weights.append(fraction)
  display_geometry=shape(feature['geometry']).simplify(.015,preserve_topology=True)
  display_geometry=MultiPolygon([orient(poly,sign=-1) for poly in display_geometry.geoms]) if display_geometry.geom_type=='MultiPolygon' else orient(display_geometry,sign=-1)
  features.append({'type':'Feature','properties':{'code':code,'name':feature['properties'].get('COUNTRY',code)},'geometry':mapping(display_geometry)})
  print('GADM fractions:',code,flush=True)
 weights=np.array(weights);assert np.max(weights.sum(axis=0))<1.001
 np.savez_compressed(weights_path,codes=CODES,weights=weights)
 (ROOT/'public/research/gadm-spatio.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features}),encoding='utf-8')

climate_directory=OUT/'chirps_annual';climate_directory.mkdir(exist_ok=True)
def chirps(year):
 path=climate_directory/f'{year}.npy'
 if not path.exists():
  url=f'https://data.chc.ucsb.edu/products/CHIRPS/v3.0/annual/global/tifs/chirps-v3.0.{year}.tif'
  import time
  for attempt in range(4):
   try:
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif',GDAL_HTTP_TIMEOUT='90',GDAL_HTTP_MAX_RETRY='2'):
     with rasterio.open(url) as src:
      a=src.read(1,window=from_bounds(west,south,east,north,src.transform),out_shape=(880,1040),resampling=Resampling.nearest).astype(float)
    a[a<0]=np.nan;rain=block_mean(a,40);assert np.nanmax(rain)<20000 and np.nanmin(rain)>=0;np.save(path,rain);break
   except Exception:
    if attempt==3:raise
    time.sleep(2*(attempt+1))
 print('CHIRPS annual subset:',year,flush=True)
 return np.load(path)
with ThreadPoolExecutor(max_workers=5) as pool:
 futures={pool.submit(chirps,year):year for year in range(1981,2022)}
 for future in as_completed(futures):future.result()
rain=np.array([np.load(climate_directory/f'{year}.npy') for year in range(1981,2022)])

def read_climate(src):
 a=src.read(window=from_bounds(west,south,east,north,src.transform),out_shape=(src.count,264,312),resampling=Resampling.nearest).astype(float);a[a<0]=np.nan
 with warnings.catch_warnings():
  warnings.simplefilter('ignore',RuntimeWarning);a=np.nanmean(a,axis=0)*src.count
 return block_mean(a,12)
future=[]
for scenario in ['ssp245','ssp585']:
 with rasterio.open(ROOT/f'data/raw/cmip6/prec_{scenario}.tif') as src:future.append(read_climate(src))
with zipfile.ZipFile(ROOT/'data/raw/worldclim/wc2.1_10m_prec.zip') as archive:
 monthly=[]
 for name in sorted(n for n in archive.namelist() if n.endswith('.tif')):
  with rasterio.MemoryFile(archive.read(name)) as memory:
   with memory.open() as src:monthly.append(read_climate(src))
 baseline=np.nansum(monthly,axis=0);baseline[np.all(~np.isfinite(monthly),axis=0)]=np.nan
np.savez_compressed(OUT/'climate.npz',years=np.arange(1981,2022),rain=rain,worldclim_baseline=baseline,future_rain=future,scenarios=['ssp245','ssp585'])
print('Prepared 61 historical frames, 41 rainfall years, GADM fractions and two CMIP6 scenarios.',flush=True)
