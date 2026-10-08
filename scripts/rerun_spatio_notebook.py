"""Execute the supplied notebook's GloRice visualization cells on new model outputs."""
from pathlib import Path
import json,csv,zipfile,hashlib
import numpy as np
import rasterio
from rasterio.transform import from_bounds
import nbformat
from nbclient import NotebookClient
from jupyter_client import KernelManager

ROOT=Path(__file__).resolve().parents[1];DATA=ROOT/'data/processed/glorice';MODEL=DATA/'model';MODEL.mkdir(exist_ok=True)
pred=np.load(DATA/'annual_grid_predictions.npz');fine=np.load(DATA/'glorice_sea_intensive_harvested_area_1961_2021.npz');history=np.load(DATA/'historical_grid.npz');active=pred['active'];meta=json.loads((ROOT/'public/research/spatio-timeline.json').read_text());west,east,south,north=meta['extent'];blocks=np.nan_to_num(fine['area_ha'][-1],nan=0).reshape(22,24,26,24);totals=blocks.sum(axis=(1,3));fraction=np.divide(blocks,totals[:,None,:,None],out=np.zeros_like(blocks),where=totals[:,None,:,None]>0)
def full(values):
 grid=np.zeros((22,26));grid[active]=values;return grid
summary=[]
for scenario in ['ssp245','ssp585']:
 arrays={name:full(pred[f'{scenario}_{name}'][-1]) for name in ['mean','lower','upper']}
 with (MODEL/f'glorice_dynamic_bym2_ar1_{scenario}_2030_2deg.csv').open('w',newline='',encoding='utf-8') as handle:
  writer=csv.writer(handle);writer.writerow(['row','col','predicted_area_ha','predicted_lower_ha','predicted_upper_ha'])
  for r in range(22):
   for c in range(26):writer.writerow([r,c,arrays['mean'][r,c],arrays['lower'][r,c],arrays['upper'][r,c]])
 values=(fraction*arrays['mean'][:,None,:,None]).reshape(528,624).astype('float32');values[values<=0]=np.nan
 with rasterio.open(MODEL/f'glorice_pattern_disaggregated_{scenario}_2030_5arcmin.tif','w',driver='GTiff',height=528,width=624,count=1,dtype='float32',crs='EPSG:4326',transform=from_bounds(west,south,east,north,624,528),nodata=np.nan,compress='deflate') as target:target.write(values,1)
 summary.append({'scenario':scenario,'total_predicted_area_ha':float(arrays['mean'].sum()),'model_cells':int(active.sum())})
with (MODEL/'glorice_dynamic_bym2_ar1_cmip6_2030_2deg_summary.csv').open('w',newline='',encoding='utf-8') as handle:
 writer=csv.DictWriter(handle,fieldnames=list(summary[0]));writer.writeheader();writer.writerows(summary)
names={}
for code in meta['codes']:
 with zipfile.ZipFile(ROOT/f'data/raw/gadm41_adm0/gadm41_{code}_0.json.zip') as archive:
  name=next(n for n in archive.namelist() if n.endswith('.json'));names[code]=json.loads(archive.read(name))['features'][0]['properties']['COUNTRY']
with (MODEL/'glorice_dynamic_bym2_ar1_cmip6_2030_country_summary.csv').open('w',newline='',encoding='utf-8') as handle:
 writer=csv.writer(handle);writer.writerow(['scenario','GID_0','COUNTRY','predicted_area_ha','predicted_lower_ha','predicted_upper_ha'])
 for frame in meta['frames']:
  if frame['year']==2030:
   for country in frame['countries']:writer.writerow([frame['scenario'],country['code'],names[country['code']],country['mean'],country['lower'],country['upper']])
original=ROOT.parent/'spatioASEAN.ipynb';source=nbformat.read(original,as_version=4)
setup=f'''from pathlib import Path
import json, zipfile
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
%matplotlib inline
ROOT=Path({str(ROOT)!r})
PROCESSED=ROOT/'data/processed'
MODEL_DIR=PROCESSED/'glorice/model'
# The helper reproduces the boundary overlay using the downloaded GADM GeoJSON.
def draw_asean_boundaries(ax):
    ax.set_facecolor('#edf2f4')
    for code in {meta['codes']!r}:
        with zipfile.ZipFile(ROOT/f'data/raw/gadm41_adm0/gadm41_{{code}}_0.json.zip') as archive:
            name=next(n for n in archive.namelist() if n.endswith('.json'))
            geometry=json.loads(archive.read(name))['features'][0]['geometry']
        polygons=geometry['coordinates'] if geometry['type']=='MultiPolygon' else [geometry['coordinates']]
        for polygon in polygons:
            for ring in polygon:
                xy=np.asarray(ring);ax.plot(xy[:,0],xy[:,1],color='#2b2b2b',linewidth=.55,zorder=3)
    return ax
'''
indices=[32,37,39,41]
book=nbformat.v4.new_notebook(cells=[nbformat.v4.new_markdown_cell('# Rice Guard: executed GloRice visualization rerun\n\nThe selected visualization cells below are copied unchanged from the supplied notebook. They use the newly reconstructed annual model outputs, not the unavailable original training implementation. APRA500 legacy and unrelated FAO ADM1 sections are excluded. The original notebook is unchanged.'),nbformat.v4.new_code_cell(setup)]+[nbformat.v4.new_code_cell(source.cells[index].source,metadata={'original_cell_index':index}) for index in indices],metadata={'kernelspec':{'name':'python3','display_name':'Python 3','language':'python'},'original_sha256':hashlib.sha256(original.read_bytes()).hexdigest(),'executed_original_cells':indices})
manager=KernelManager(kernel_name='python3');manager.kernel_spec.argv=[str(ROOT/'.venv-spatio/Scripts/python.exe'),'-m','ipykernel_launcher','-f','{connection_file}']
try:
 NotebookClient(book,timeout=180,km=manager,resources={'metadata':{'path':str(ROOT)}}).execute()
finally:
 if manager.has_kernel:manager.shutdown_kernel(now=True)
output=ROOT/'artifacts/spatio-glorice-executed.ipynb';nbformat.write(book,output)
assert not any(out.output_type=='error' for cell in book.cells for out in cell.get('outputs',[]))
print('Executed original GloRice cells:',indices,flush=True);print('Saved:',output,flush=True)
