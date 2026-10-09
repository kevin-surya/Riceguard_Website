export function chatSettings(env) {
 const key=env.OPENAI_API_KEY?.trim();
 return {key,model:env.OPENAI_MODEL?.trim()||'gpt-6-luna',configured:Boolean(key&&!['your_api_key_here','sk-your-key-here'].includes(key))};
}

export function chatStatus(req,res,env) {
 res.statusCode=req.method==='GET'?200:405;
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Allow','GET');
 res.end(JSON.stringify(req.method==='GET'?{configured:chatSettings(env).configured}:{code:'METHOD_NOT_ALLOWED'}));
}
