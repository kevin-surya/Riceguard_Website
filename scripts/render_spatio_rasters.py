"""Render cached model outputs using one fixed scale for every year/layer."""
from pathlib import Path
import json,numpy as np
from PIL import Image
from matplotlib import colormaps
from matplotlib.colors import LogNorm
ROOT=Path(__file__).resolve().parents[1];directory=ROOT/'data/processed/glorice';public=ROOT/'public/research/timeline'
fine=np.load(directory/'glorice_sea_intensive_harvested_area_1961_2021.npz');pred=np.load(directory/'annual_grid_predictions.npz');active=pred['active'];last=np.nan_to_num(fine['area_ha'][-1],nan=0);blocks=last.reshape(22,24,26,24);totals=blocks.sum(axis=(1,3));fraction=np.divide(blocks,totals[:,None,:,None],out=np.zeros_like(blocks),where=totals[:,None,:,None]>0)
def allocate(values):
 grid=np.zeros((22,26));grid[active]=values;return (fraction*grid[:,None,:,None]).reshape(528,624)
vmax=max(float(np.nanmax(fine['area_ha'])),max(float(allocate(values).max()) for scenario in ['ssp245','ssp585'] for field in ['mean','lower','upper'] for values in pred[f'{scenario}_{field}']))
meta=json.loads((ROOT/'public/research/spatio-timeline.json').read_text());print('Fixed shared scale:',vmax,'previous:',meta['rasterScale']['maximum'])
norm=LogNorm(1,vmax);palette=colormaps['YlGn'];background=np.array([237,242,244,255],dtype=np.uint8)
def save(values,name):
 valid=np.isfinite(values)&(values>0);rgba=np.broadcast_to(background,(*values.shape,4)).copy();rgba[valid]=np.round(palette(norm(values[valid]))*255).astype(np.uint8);Image.fromarray(rgba,'RGBA').save(public/name,optimize=True)
for i,year in enumerate(fine['years']):save(fine['area_ha'][i],f'historical-{year}.png')
for scenario in ['ssp245','ssp585']:
 for i,year in enumerate(pred['years']):
  for layer in ['mean','lower','upper','width']:
   values=pred[f'{scenario}_upper'][i]-pred[f'{scenario}_lower'][i] if layer=='width' else pred[f'{scenario}_{layer}'][i];save(allocate(values),f'{scenario}-{year}-{layer}.png')
meta['rasterScale']['maximum']=vmax;(ROOT/'public/research/spatio-timeline.json').write_text(json.dumps(meta,separators=(',',':'),allow_nan=False),encoding='utf-8')
