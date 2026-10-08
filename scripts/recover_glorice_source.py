"""Recover the original public GloRice archive; data only, no remote code execution."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import hashlib
import json
import math
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / 'data/raw/glorice'
DIRECTORY.mkdir(parents=True, exist_ok=True)
METADATA_URL = 'https://api.figshare.com/v2/articles/25752207'
metadata = json.load(urllib.request.urlopen(METADATA_URL, timeout=30))
(DIRECTORY / 'figshare-metadata.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
record = next(file for file in metadata['files'] if file['name'] == 'GloRice-hvst-In.zip')
target = DIRECTORY / record['name']
expected = record.get('computed_md5') or record.get('supplied_md5')

def matches(path):
    if not path.exists() or path.stat().st_size != record['size']:
        return False
    return not expected or hashlib.md5(path.read_bytes()).hexdigest() == expected

if not matches(target):
    count = 8
    size = math.ceil(record['size'] / count)
    def download(index):
        import time
        part_start, end = index * size, min((index + 1) * size, record['size']) - 1
        path = DIRECTORY / f'archive.part-{index}'
        done = path.stat().st_size if path.exists() else 0
        if done > end - part_start + 1:
            path.unlink(); done = 0
        while done < end - part_start + 1:
            start = part_start + done
            stop = min(start + 1024 * 1024 - 1, end)
            for attempt in range(5):
                try:
                    request = urllib.request.Request(record['download_url'], headers={'Range': f'bytes={start}-{stop}', 'User-Agent': 'RiceGuardResearch/1.0'})
                    with urllib.request.urlopen(request, timeout=60) as response:
                        assert response.status == 206
                        assert response.headers.get('Content-Range', '').startswith(f'bytes {start}-{stop}/')
                        block = response.read()
                    assert len(block) == stop - start + 1
                    with path.open('ab') as output: output.write(block)
                    done += len(block)
                    break
                except Exception as error:
                    if attempt == 4: raise
                    time.sleep(2 * (attempt + 1))
        return index
    print(f'Recovering {record["size"]/1e6:.1f} MB of public historical data', flush=True)
    with ThreadPoolExecutor(max_workers=count) as executor:
        for future in as_completed([executor.submit(download, index) for index in range(count)]):
            print(f'Part {future.result()+1}/{count} verified', flush=True)
    temporary = DIRECTORY / 'archive.complete.tmp'
    with temporary.open('wb') as output:
        for index in range(count):
            with (DIRECTORY / f'archive.part-{index}').open('rb') as source:
                while block := source.read(1024 * 1024):
                    output.write(block)
    assert matches(temporary), 'Archive checksum mismatch'
    temporary.replace(target)
    for index in range(count):
        (DIRECTORY / f'archive.part-{index}').unlink()
print('Verified public archive:', target, flush=True)
