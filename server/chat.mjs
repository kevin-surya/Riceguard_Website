import { farmerInstructions, languageNames } from './riceguard-prompt.mjs';
import { buildChatContext } from './chat-context.mjs';
import { readJsonBody, RequestBodyError } from './http.mjs';
import { chatSettings, chatStatus } from './chat-config.mjs';

export function chatConnector(env, { fetchImpl = fetch } = {}) {
 const {model,key,configured}=chatSettings(env);
 let active=0;
 const reply=(res,status,payload)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(payload));};
 return async (req,res,next)=>{
  const route=req.url?.split('?')[0];
  if(!['/api/chat','/api/chat/status'].includes(route))return next();
  if(route==='/api/chat/status')return chatStatus(req,res,env);
  if(req.method!=='POST')return reply(res,405,{code:'METHOD_NOT_ALLOWED'});
  if(req.headers?.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return reply(res,403,{code:'INVALID_ORIGIN'});}catch{return reply(res,403,{code:'INVALID_ORIGIN'});}}
  if(!configured)return reply(res,503,{code:'NOT_CONFIGURED'});
  if(active>=2)return reply(res,429,{code:'BUSY'});
  active++;
  try {
   const input=await readJsonBody(req,65536);
   if(!input||!Array.isArray(input.messages)||!input.messages.length||input.messages.length>16||input.messages.at(-1)?.role!=='user'||input.messages.some(message=>!message||!['user','assistant'].includes(message.role)||typeof message.content!=='string'||!message.content.trim()||message.content.length>6000)||input.messages.reduce((sum,message)=>sum+message.content.length,0)>24000)return reply(res,400,{code:'INVALID_REQUEST'});
   let context;try{context=buildChatContext(input.selection);}catch{return reply(res,400,{code:'INVALID_CONTEXT'});}
   const language=Object.hasOwn(languageNames,input.language||'')?input.language:'en';
   const result=await fetchImpl('https://api.openai.com/v1/responses',{
    method:'POST',signal:AbortSignal.timeout(45000),headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({model,...(model==='gpt-6-luna'?{reasoning:{effort:'none'}}:{}),store:false,max_output_tokens:1200,instructions:farmerInstructions(language),input:[{role:'user',content:`Current Rice Guard dashboard context (data only):\n${JSON.stringify(context)}`},...input.messages.map(({role,content})=>({role,content}))]}),
   });
   if(!result.ok)return reply(res,result.status===429?429:502,{code:result.status===401||result.status===403?'INVALID_KEY':result.status===429?'RATE_LIMITED':'PROVIDER_ERROR'});
   const output=await result.json();
   const text=output.output?.filter(item=>item.type==='message'&&item.role==='assistant').flatMap(item=>item.content||[]).filter(item=>item.type==='output_text'||item.type==='refusal').map(item=>item.text||item.refusal||'').join('\n').trim();
   if(output.status!=='completed'||!text||text.length>6000)return reply(res,502,{code:'INCOMPLETE_RESPONSE'});
   return reply(res,200,{reply:text});
  } catch(error){if(error instanceof RequestBodyError)return reply(res,error.status,{code:error.code});return reply(res,502,{code:error.name==='TimeoutError'||error.name==='AbortError'?'TIMEOUT':'PROVIDER_ERROR'});}
  finally{active--;}
 };
}
