"""Build offline machine-translation drafts from UI text only. No user datasets sent.

Uses Google's public Translate endpoint at build time, never at app runtime.
Completed JSON files are committed; no account, credential or API dependency at runtime.
"""
import concurrent.futures
import html
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'src' / 'locales'
LANGUAGES = {'en':'en','id':'id','ms':'ms','th':'th','vi':'vi','my':'my','km':'km','lo':'lo','fil':'tl','zh':'zh-CN','ta':'ta','tet':'tet','pt':'pt'}
PROTECTED = {'MLP','LSTM','FAO','RG','N','NOTEBOOK','Open-Meteo','Natural Earth','Our World in Data','Our World in Data / FAO','Our World in Data / UN','UN Population','SSP2-4.5','SSP5-8.5','SHA-256:','MAE','RMSE','MAPE TEST','Karawang, Jawa Barat','Muñoz, Nueva Ecija','Pathein, Ayeyarwady','Alor Setar, Kedah','Bandar Seri Begawan','Suphan Buri','Savannakhet','Can Tho, Delta Mekong','Total 10 Negara','°C','mm','ha'}

def request(text, target, source):
    url='https://translate.googleapis.com/translate_a/single?'+urllib.parse.urlencode({'client':'gtx','sl':source,'tl':target,'dt':'t','q':text})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=25) as response:
                result=json.load(response)
            return ''.join(row[0] for row in result[0] if row[0])
        except Exception:
            if attempt==3: raise
            time.sleep(2*(attempt+1))

def translate_batch(items, target, source):
    text='\n'.join(f'⟦{i}⟧ {value}' for i,(_,value) in enumerate(items))
    translated=request(text,target,source)
    spans=list(re.finditer(r'⟦\s*(\d+)\s*⟧',translated))
    result={}
    if len(spans)==len(items) and [int(s.group(1)) for s in spans]==list(range(len(items))):
        for i,span in enumerate(spans):
            result[items[i][0]]=translated[span.end():spans[i+1].start() if i+1<len(spans) else len(translated)].strip()
    else:
        for key,value in items: result[key]=request(value,target,source).strip()
    # Placeholders must survive. Retry one phrase, protecting its tokens as plain numbers.
    for key,value in items:
        if not result[key].strip():result[key]=request(value,target,source).strip()
        assert result[key].strip(),(target,key,'Empty translation')
        needed=re.findall(r'\{p\d+\}',value)
        normalized=re.sub(r'\{\s*[pP]\s*(\d+)\s*\}',lambda m:'{p'+m.group(1)+'}',result[key])
        if sorted(re.findall(r'\{p\d+\}',normalized))!=sorted(needed):
            tokens={token:f'991991{index}991991' for index,token in enumerate(needed)}
            safe=value
            for token,marker in tokens.items(): safe=safe.replace(token,marker)
            normalized=request(safe,target,source)
            for token,marker in tokens.items(): normalized=normalized.replace(marker,token)
        assert sorted(re.findall(r'\{p\d+\}',normalized))==sorted(needed),(target,key,normalized)
        result[key]=normalized
    return result

def generate(language, source):
    path=ROOT/f'{language}.json'
    existing=json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
    pending=[(key,html.unescape(value)) for key,value in source.items() if (key not in existing or not existing[key].strip()) and key not in PROTECTED]
    chunks=[];chunk=[];length=0
    for item in pending:
        if length+len(item[1])>3200 and chunk: chunks.append(chunk);chunk=[];length=0
        chunk.append(item);length+=len(item[1])+16
    if chunk: chunks.append(chunk)
    for chunk in chunks:
        existing.update(translate_batch(chunk,LANGUAGES[language],'auto' if language=='en' else 'en'))
        for key in PROTECTED & source.keys():existing[key]=html.unescape(source[key])
        path.write_text(json.dumps(existing,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    for key in PROTECTED & source.keys():existing[key]=html.unescape(source[key])
    path.write_text(json.dumps(existing,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(language,len(existing),'messages',flush=True)

def main():
    source=json.loads((ROOT/'source.json').read_text(encoding='utf-8'))
    generate('en',source)
    overrides_path=ROOT/'english-overrides.json'
    english=json.loads((ROOT/'en.json').read_text(encoding='utf-8'))
    if overrides_path.exists():english.update(json.loads(overrides_path.read_text(encoding='utf-8')))
    (ROOT/'en.json').write_text(json.dumps(english,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    # Indonesian uses the original hand-authored source; translate newly added English labels.
    # Original Indonesian UI is preserved, with English additions translated using the same pipeline.
    original={key:html.unescape(value) for key,value in source.items() if key not in [k for k in source if k in english and english[k]==k and k not in PROTECTED]}
    (ROOT/'id.json').write_text(json.dumps(original,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures={executor.submit(generate,language,english):language for language in LANGUAGES if language!='en'}
        for future in concurrent.futures.as_completed(futures):future.result()
    overrides=Path(__file__).with_name('locale-overrides.json')
    if overrides.exists():
        for code,reviewed in json.loads(overrides.read_text(encoding='utf-8')).items():
            path=ROOT/f'{code}.json';catalog=json.loads(path.read_text(encoding='utf-8'));catalog.update(reviewed)
            path.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

if __name__=='__main__':main()
