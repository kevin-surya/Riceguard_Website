/** Read both Node request streams and Vercel's already-parsed request.body. */
export class RequestBodyError extends Error {
 constructor(status,code){super(code);this.status=status;this.code=code;}
}

export async function readJsonBody(req,maxBytes) {
 let raw,body;
 try{body=req.body;}catch{throw new RequestBodyError(400,'INVALID_REQUEST');}
 if(body!==undefined){
  if(Buffer.isBuffer(body))raw=body;
  else if(typeof body==='string')raw=Buffer.from(body,'utf8');
  else {
   try{raw=Buffer.from(JSON.stringify(body),'utf8');}catch{throw new RequestBodyError(400,'INVALID_REQUEST');}
   if(raw.length>maxBytes)throw new RequestBodyError(413,'REQUEST_TOO_LARGE');
   return body;
  }
 }else{
  let size=0;const chunks=[];
  for await(const chunk of req){const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=bytes.length;if(size>maxBytes)throw new RequestBodyError(413,'REQUEST_TOO_LARGE');chunks.push(bytes);}
  raw=Buffer.concat(chunks);
 }
 if(raw.length>maxBytes)throw new RequestBodyError(413,'REQUEST_TOO_LARGE');
 try{return JSON.parse(raw.toString('utf8'));}catch{throw new RequestBodyError(400,'INVALID_REQUEST');}
}

/** Route adapters share the same middleware as local Vite development. */
export function vercelHandler(middleware,route) {
 return async(req,res)=>{
  const originalUrl=req.url;req.url=route;
  try{
   await middleware(req,res,()=>{res.statusCode=404;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({code:'NOT_FOUND'}));});
  }finally{req.url=originalUrl;}
 };
}
