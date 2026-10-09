import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFileSync,mkdtempSync,mkdirSync,copyFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,dirname,resolve,sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { readJsonBody } from '../server/http.mjs';

const input={language:'id',selection:{page:'spatio',countryCode:'SEA',year:2030,scenario:'notebook',stress:0,spatio:{year:2030,scenario:'ssp585',countryCode:'IDN',layer:'mean'}},messages:[{role:'user',content:'How should I prepare for harvest losses?'}]};
const originalFetch=globalThis.fetch,envKeys=['OPENAI_API_KEY','OPENAI_MODEL','AI_API_KEY','AI_API_URL','AI_MODEL'];
const backup=Object.fromEntries(envKeys.map(key=>[key,process.env[key]]));
let server,base;const providerCalls=[],consumedBodies=[];

before(async()=>{
 Object.assign(process.env,{OPENAI_API_KEY:'vercel-test-only-secret',OPENAI_MODEL:'gpt-6-luna',AI_API_KEY:'',AI_API_URL:'',AI_MODEL:''});
 globalThis.fetch=async(url,options)=>{
  if(!String(url).startsWith('https://api.openai.com/'))return originalFetch(url,options);
  providerCalls.push({url,body:JSON.parse(options.body)});
  if(String(url).endsWith('/responses'))return {ok:true,json:async()=>({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'Check local irrigation and drainage.'}]}]})};
  return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({summary:'Prepare for the selected scenario.',actions:['Check local weather guidance.']})}}]})};
 };
 const routes=Object.fromEntries(await Promise.all([
  ['/api/chat','../api/chat.js'],['/api/chat/status','../api/chat/status.js'],['/api/analyze','../api/analyze.js'],
 ].map(async([route,path])=>[route,(await import(path)).default])));
 server=createServer(async(req,res)=>{
  try{
   if(req.method==='POST'){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    req.body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    consumedBodies.push(req.readableEnded);
   }
   const handler=routes[new URL(req.url,'http://test.local').pathname];
   if(!handler){res.statusCode=404;return res.end();}
   await handler(req,res);
  }catch{res.statusCode=500;res.end(JSON.stringify({code:'TEST_HANDLER_FAILED'}));}
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{
 if(server)await new Promise(resolve=>server.close(resolve));
 globalThis.fetch=originalFetch;
 for(const key of envKeys)if(backup[key]===undefined)delete process.env[key];else process.env[key]=backup[key];
});

test('JSON reader supports Vercel objects and buffers without re-reading a consumed stream',async()=>{
 for(const body of [input,JSON.stringify(input),Buffer.from(JSON.stringify(input))]){
  const req={body,[Symbol.asyncIterator](){assert.fail('The body was already consumed by Vercel');}};
  assert.deepEqual(await readJsonBody(req,65536),input);
 }
 assert.deepEqual(await readJsonBody(Readable.from([JSON.stringify(input)]),65536),input);
 await assert.rejects(()=>readJsonBody({body:'{bad'},65536),error=>error.status===400);
 await assert.rejects(()=>readJsonBody({get body(){throw SyntaxError('JSON parsing failed');}},65536),error=>error.status===400);
});
test('body limits apply to parsed objects, buffers, and UTF-8 request streams',async()=>{
 for(const req of [{body:{text:'x'.repeat(100)}},{body:Buffer.from('x'.repeat(100))},Readable.from(['田'.repeat(25)])])await assert.rejects(()=>readJsonBody(req,64),error=>error.status===413);
});
test('deployed status entry reads runtime environment and returns only configuration state',async()=>{
 const response=await fetch(`${base}/api/chat/status?check=1`);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),{configured:true});
 delete process.env.OPENAI_API_KEY;
 assert.deepEqual(await (await fetch(`${base}/api/chat/status`)).json(),{configured:false});
 process.env.OPENAI_API_KEY='vercel-test-only-secret';
});
test('deployed chat entry handles a consumed Vercel body and retains saved map facts',async()=>{
 const response=await fetch(`${base}/api/chat?source=vercel`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(input)});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{reply:'Check local irrigation and drainage.'});assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(consumedBodies.at(-1),true);
 const payload=providerCalls.at(-1).body;assert.equal(payload.model,'gpt-6-luna');assert.deepEqual(payload.reasoning,{effort:'none'});assert.equal(payload.store,false);
 const context=JSON.parse(payload.input[0].content.split('\n').slice(1).join('\n'));assert.equal(context.spatioTemporal.country,'Indonesia');assert.equal(context.spatioTemporal.year,2030);assert.equal(context.spatioTemporal.scenario,'ssp585');assert.ok(context.spatioTemporal.harvestedAreaHa>0);
});
test('deployed analyze entry accepts Vercel parsed JSON and preserves the existing UI response',async()=>{
 const response=await fetch(`${base}/api/analyze`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({country:'Indonesia',year:2030,scenario:'trend',language:'id',risk:{score:40},climate:{temperature:1.4,rain:-18},stress:0})});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{summary:'Prepare for the selected scenario.',actions:['Check local weather guidance.']});
});
test('deployed handlers reject unsupported methods and foreign origins before provider access',async()=>{
 const count=providerCalls.length;
 assert.equal((await fetch(`${base}/api/chat`)).status,405);
 assert.equal((await fetch(`${base}/api/analyze`)).status,405);
 assert.equal((await fetch(`${base}/api/chat/status`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,405);
 assert.equal((await fetch(`${base}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://foreign.invalid'},body:JSON.stringify(input)})).status,403);
 assert.equal(providerCalls.length,count);
});
test('server functions load from an isolated deployment directory without .env or node_modules',()=>{
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.equal(config.framework,'vite');assert.equal(config.outputDirectory,'dist');assert.ok(config.functions['api/chat.js'].maxDuration>45);
 const included=config.functions['api/chat.js'].includeFiles.slice(1,-1).split(',');
 const temp=mkdtempSync(join(tmpdir(),'riceguard-vercel-'));
 try{
  const files=['package.json','api/chat.js','api/chat/status.js','api/analyze.js','server/chat.mjs','server/chat-config.mjs','server/chat-context.mjs','server/climate-context.mjs','server/ai.mjs','server/http.mjs','server/riceguard-prompt.mjs','src/model.mjs','src/climate-model.mjs','src/i18n-core.mjs','src/research-model.mjs','src/spatio-timeline.mjs',...included];
  for(const file of files){const destination=join(temp,file);mkdirSync(dirname(destination),{recursive:true});copyFileSync(new URL(`../${file}`,import.meta.url),destination);}
  const otherCwd=join(temp,'unrelated-cwd');mkdirSync(otherCwd);
  const root=pathToFileURL(temp+sep).href;
  const code=`const root=${JSON.stringify(root)};const {buildChatContext}=await import(new URL('server/chat-context.mjs',root));const handlers=await Promise.all(['api/chat.js','api/chat/status.js','api/analyze.js'].map(path=>import(new URL(path,root))));const context=buildChatContext(${JSON.stringify(input.selection)});console.log(JSON.stringify({rice:context.forecast.rice,area:context.spatioTemporal.harvestedAreaHa,handlers:handlers.every(module=>typeof module.default==='function')}));`;
  const result=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',code],{cwd:otherCwd,env:{...process.env,OPENAI_API_KEY:''},encoding:'utf8'}));
  assert.equal(result.rice,196.367174);assert.ok(result.area>0);assert.equal(result.handlers,true);
 }finally{
  assert.ok(resolve(temp).startsWith(resolve(tmpdir())+sep+'riceguard-vercel-'));
  rmSync(temp,{recursive:true,force:true});
 }
});
