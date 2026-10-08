from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import urllib.request,hashlib,json,time
ROOT=Path(__file__).resolve().parents[1]
records=[]
for code in ['BRN','KHM','IDN','LAO','MYS','MMR','PHL','SGP','THA','VNM']:
 records.append((f'https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_{code}_0.json.zip',ROOT/f'data/raw/gadm41_adm0/gadm41_{code}_0.json.zip'))
for scenario in ['ssp245','ssp585']:
 records.append((f'https://geodata.ucdavis.edu/cmip6/10m/ACCESS-CM2/{scenario}/wc2.1_10m_prec_ACCESS-CM2_{scenario}_2021-2040.tif',ROOT/f'data/raw/cmip6/prec_{scenario}.tif'))
records.append(('https://geodata.ucdavis.edu/climate/worldclim/2_1/base/wc2.1_10m_prec.zip',ROOT/'data/raw/worldclim/wc2.1_10m_prec.zip'))
def fetch(item):
 url,path=item;path.parent.mkdir(parents=True,exist_ok=True)
 if not path.exists():
  temporary=path.with_suffix(path.suffix+'.partial')
  for attempt in range(4):
   try:
    with urllib.request.urlopen(url,timeout=90) as response,temporary.open('wb') as output:
     while block:=response.read(1024*256):output.write(block)
    temporary.replace(path);break
   except Exception:
    if attempt==3:raise
    time.sleep(2*(attempt+1))
 print('Cached',path.name,path.stat().st_size,flush=True)
 return {'url':url,'file':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
with ThreadPoolExecutor(max_workers=5) as executor:results=list(executor.map(fetch,records))
(ROOT/'data/raw/climate-boundary-sources.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
