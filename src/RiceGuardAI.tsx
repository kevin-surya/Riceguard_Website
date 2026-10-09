import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageCircle, Send, Sparkles, Sprout, X, LoaderCircle, RotateCcw } from 'lucide-react';
import { t, useLanguage } from './i18n';
import { recentChat } from './chat-history.mjs';
import './chat.css';

export type SpatioSelection = {year:number;scenario:string;countryCode:string;layer:string};
export type ChatSelection = {page:string;countryCode:string;year:number;scenario:string;stress:number;spatio:SpatioSelection|null;climate?:{countryCode:string;period:string};weather:{countryCode:string;days:{date:string;maxTemperatureC:number|null;rainMm:number|null}[]}|null};
type Message={role:'user'|'assistant';content:string;scope:string};
const prompts=['How can I prepare for drought?','How can I reduce losses from heavy rain?','What should I do based on this outlook?'];
const errors:Record<string,string>={NOT_CONFIGURED:'AI is not connected yet. Add your API key in .env and restart the server.',INVALID_KEY:'The API key could not be used. Check your OpenAI key and model access.',RATE_LIMITED:'The AI usage limit was reached. Check your API quota, then try again.',BUSY:'AI is handling another request. Try again shortly.',TIMEOUT:'The reply took too long. Please try again.',INCOMPLETE_RESPONSE:'The reply was incomplete. Please try again.'};

export default function RiceGuardAI({selection,scope}:{selection:ChatSelection;scope:string}) {
 const language=useLanguage();
 const [open,setOpen]=useState(false),[messages,setMessages]=useState<Message[]>([]),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [configured,setConfigured]=useState<boolean|null>(null),[check,setCheck]=useState(0),[checking,setChecking]=useState(false);
 const input=useRef<HTMLTextAreaElement>(null),list=useRef<HTMLDivElement>(null),launcher=useRef<HTMLButtonElement>(null),request=useRef<AbortController|null>(null);
 useEffect(()=>()=>request.current?.abort(),[]);
 useEffect(()=>{
  if(!open)return;
  const controller=new AbortController();setChecking(true);
  fetch('/api/chat/status',{signal:controller.signal}).then(async response=>{if(!response.ok)throw Error('status');const status=await response.json();if(typeof status.configured!=='boolean')throw Error('status');setConfigured(status.configured);}).catch(()=>{if(!controller.signal.aborted)setConfigured(null);}).finally(()=>{if(!controller.signal.aborted)setChecking(false);});
  input.current?.focus();
  return()=>controller.abort();
 },[open,check]);
 useEffect(()=>{if(open&&list.current)list.current.scrollTop=list.current.scrollHeight;},[open,messages,busy,error]);
 const close=()=>{setOpen(false);launcher.current?.focus();};
 const clear=()=>{request.current?.abort();request.current=null;setBusy(false);setMessages([]);setError('');setDraft('');input.current?.focus();};
 const submit=async(event:FormEvent)=>{
  event.preventDefault();const content=draft.trim();if(!content||busy||configured!==true)return;
  const conversation=[...messages,{role:'user' as const,content,scope}];setMessages(conversation);setDraft('');setError('');setBusy(true);
  const controller=new AbortController();request.current=controller;
  const timeout=setTimeout(()=>controller.abort(),50000);
  try{
   const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({language,selection,messages:recentChat(conversation)})});
   const result=await response.json();
   if(!response.ok){if(result.code==='NOT_CONFIGURED')setConfigured(false);throw Error(result.code||'PROVIDER_ERROR');}
   if(typeof result.reply!=='string'||!result.reply.trim())throw Error('INCOMPLETE_RESPONSE');
   if(request.current===controller)setMessages([...conversation,{role:'assistant',content:result.reply,scope}]);
  }catch(failure){if(request.current===controller){setMessages(messages);setDraft(content);setError(errors[failure instanceof Error?failure.message:'']|| (controller.signal.aborted?errors.TIMEOUT:'AI could not reply. Check your connection and try again.'));}}
  finally{clearTimeout(timeout);if(request.current===controller){request.current=null;setBusy(false);input.current?.focus();}}
 };
 return <div className="riceguard-chat">
  {open&&<section className="riceguard-chat-panel" id="riceguard-ai-panel" role="dialog" aria-labelledby="riceguard-ai-title" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();close();}}}>
   <header className="riceguard-chat-header"><span className="riceguard-chat-mark"><Sprout size={23}/></span><div><h2 id="riceguard-ai-title">Panel RiceGuard AI</h2><p>{t('Practical steps for a safer harvest')}</p></div><button className="riceguard-chat-icon" onClick={close} aria-label={t('Close AI panel')}><X size={19}/></button></header>
   <div className="riceguard-chat-context"><span><i className={configured===true?'ready':''}/>{checking?t('Checking connection…'):configured===true?t('Ready to chat'):t('AI not connected')}</span><p>{scope}</p></div>
   <div className="riceguard-chat-messages" ref={list} role="log" aria-label={t('Conversation with RiceGuard AI')} aria-live="polite" aria-relevant="additions text" aria-busy={busy}>
    {!messages.length&&<div className="riceguard-chat-welcome"><Sparkles size={26}/><h3>{t('Let’s protect your next harvest.')}</h3><p>{t('Ask about water, weather, crop care, or harvest planning. I use your selected dashboard context.')}</p><div className="riceguard-chat-prompts">{prompts.map(prompt=><button key={prompt} onClick={()=>{setDraft(t(prompt));input.current?.focus();}}>{t(prompt)}</button>)}</div></div>}
    {messages.map((message,index)=><article key={index} className={`riceguard-chat-message ${message.role}`}><span>{message.role==='assistant'?'RiceGuard AI':t('You')}</span><p>{message.content}</p>{message.role==='assistant'&&<small>{message.scope}</small>}</article>)}
    {busy&&<div className="riceguard-chat-thinking" role="status"><LoaderCircle size={16} className="spin"/>{t('Preparing practical recommendations…')}</div>}
   </div>
   {configured!==true&&!checking&&<div className="riceguard-chat-notice" role="status"><p>{t(configured===false?errors.NOT_CONFIGURED:'AI could not connect. Check that the local server is running.')}</p><button onClick={()=>setCheck(value=>value+1)}>{t('Check connection')}</button></div>}
   {error&&<p className="riceguard-chat-error" role="alert">{t(error)}</p>}
   <form className="riceguard-chat-composer" onSubmit={event=>void submit(event)}><label className="sr-only" htmlFor="riceguard-ai-input">{t('Ask RiceGuard AI')}</label><textarea ref={input} id="riceguard-ai-input" rows={2} maxLength={2000} value={draft} disabled={busy} placeholder={t('Describe your field or ask a question…')} onChange={event=>setDraft(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();if(draft.trim()&&!busy&&configured===true)event.currentTarget.form?.requestSubmit();}}}/><button type="submit" disabled={!draft.trim()||busy||configured!==true} aria-label={t('Send message')}><Send size={18}/></button></form>
   <footer className="riceguard-chat-footer"><span>{t('Verify field decisions with local advice.')}</span><button onClick={clear} aria-label={t('Start a new conversation')}><RotateCcw size={13}/>{t('New chat')}</button></footer>
  </section>}
  <button ref={launcher} className={`riceguard-chat-launcher ${open?'is-open':''}`} aria-expanded={open} aria-controls="riceguard-ai-panel" onClick={()=>open?close():setOpen(true)}><MessageCircle size={21}/><span>Panel RiceGuard AI</span>{busy&&<LoaderCircle size={15} className="spin"/>}</button>
 </div>;
}
