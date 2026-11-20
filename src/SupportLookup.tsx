import React,{useEffect,useRef,useState,useCallback} from 'react';
import ReactDOM from 'react-dom/client';
import {ArrowLeft,ArrowRight,CheckCircle2,Clock3,KeyRound,LockKeyhole,Mail,Search,ShieldCheck,AlertCircle} from 'lucide-react';
import './styles.css';
import './support-lookup.css';
const endpoint='https://jqeonloeyvdapwmafnkm.supabase.co/functions/v1/support-lookup';
const siteKey=(import.meta.env.VITE_TURNSTILE_SITE_KEY||'').trim();
type Result={ticket:{protocol:string;title:string;status:string;priority:string;created_at:string;updated_at:string};history:{status:string;date:string;message:string|null}[]};
const labels:Record<string,string>={aberto:'Aberto',em_triagem:'Em triagem',aguardando_informacoes:'Aguardando informações',em_analise:'Em análise',em_correcao:'Em correção',aguardando_validacao:'Aguardando validação',resolvido:'Resolvido',encerrado:'Encerrado'};
declare global{interface Window{turnstile?:{render:(el:HTMLElement,opts:{sitekey:string;callback:(t:string)=>void;'expired-callback':()=>void;'error-callback':()=>void;theme:string})=>string;remove:(id:string)=>void}}}
function Captcha({onToken,onError}:{onToken:(token:string)=>void;onError:(message:string)=>void}){
 const ref=useRef<HTMLDivElement>(null);
 const callback=useRef(onToken); const errorCallback=useRef(onError);
 useEffect(()=>{callback.current=onToken;errorCallback.current=onError},[onToken,onError]);
 useEffect(()=>{
  if(!siteKey||!ref.current)return;
  let id:string|undefined;let stopped=false;
  const render=()=>{if(!stopped&&!id&&ref.current&&window.turnstile)id=window.turnstile.render(ref.current,{sitekey:siteKey,theme:'light',callback:t=>callback.current(t),'expired-callback':()=>callback.current(''),'error-callback':(code?:string)=>{callback.current('');errorCallback.current('Falha no Cloudflare Turnstile'+(code?' (código '+code+')':'')+'. Confirme se o domínio nextze.com.br está autorizado no widget.');}});};
  if(!document.querySelector('script[data-nxz-lookup-turnstile]')){
   const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.dataset.nxzLookupTurnstile='1';script.async=true;document.head.append(script);
  }
  const interval=window.setInterval(()=>{try{render();}catch{errorCallback.current('Não foi possível inicializar o Turnstile. Atualize a página.');window.clearInterval(interval);}},250);try{render();}catch{errorCallback.current('Falha ao inicializar Turnstile.');}
  return ()=>{stopped=true;window.clearInterval(interval);if(id)window.turnstile?.remove(id);}
 },[]);
 return <div ref={ref} aria-label="Verificação antispam"/>;
}
function App(){
 const params=new URLSearchParams(window.location.search);
 const [protocol,setProtocol]=useState((params.get('protocolo')||'').toUpperCase().slice(0,15));
 const [email,setEmail]=useState(''),[code,setCode]=useState(''),[token,setToken]=useState(''),[captchaRevision,setCaptchaRevision]=useState(0);
 const [phase,setPhase]=useState<'request'|'verify'|'result'>('request');
 const [result,setResult]=useState<Result|null>(null),[loading,setLoading]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const onToken=useCallback((x:string)=>setToken(x),[]);
 async function api(body:Record<string,string>){
  const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data.error||'Não foi possível consultar o atendimento.');
  return data;
 }
 async function request(e:React.FormEvent){e.preventDefault();setError('');setMessage('');setLoading(true);
  try{
   const data=await api({action:'request',protocol:protocol.trim().toUpperCase(),email:email.trim().toLowerCase(),turnstile_token:token});
   setMessage(data.message||'Confira seu e-mail cadastrado.');setPhase('verify');setToken('');
  }catch(err){setError(err instanceof Error?err.message:'Falha ao enviar o código');setToken('');setCaptchaRevision(n=>n+1);}
  finally{setLoading(false);}
 }
 async function verify(e:React.FormEvent){e.preventDefault();setError('');setLoading(true);
  try{const data=await api({action:'verify',protocol:protocol.trim().toUpperCase(),email:email.trim().toLowerCase(),code:code.trim()});setResult(data);setPhase('result');setCode('');setMessage('');}
  catch(err){setError(err instanceof Error?err.message:'Código inválido ou expirado');}
  finally{setLoading(false);}
 }
 const date=(v:string)=>new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
 return <div className="lookup-root"><header className="lookup-header"><a href="../../" className="lookup-brand">NEXT<span>ZE</span></a><a href="../"><ArrowLeft size={16}/> Voltar à Central de Suporte</a></header><main className="lookup-main"><div className="lookup-heading"><span>ATENDIMENTO NEXTZE</span><h1>Acompanhe seu chamado</h1><p>Consulte a situação de uma solicitação com seu protocolo e o e-mail cadastrado. A consulta é protegida por verificação de acesso.</p></div>
 <section className="lookup-card">
  {phase!=='result'&&<div className="lookup-progress"><span className="current"><Search size={16}/> 1. Identificação</span><span className={phase==='verify'?'current':''}><Mail size={16}/> 2. Código de segurança</span><span><CheckCircle2 size={16}/> 3. Acompanhamento</span></div>}
  {error&&<p className="lookup-error" role="alert"><AlertCircle size={17}/>{error}</p>}
  {phase==='request'&&<form onSubmit={request} className="lookup-form"><h2>Identifique o atendimento</h2><label>Protocolo do chamado<input required maxLength={15} pattern="NXZ-[0-9]{4}-[0-9]{6}" value={protocol} onChange={e=>setProtocol(e.target.value.toUpperCase())} placeholder="NXZ-2026-000002" autoComplete="off"/></label><label>E-mail utilizado na abertura<input required type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="seuemail@empresa.com.br" autoComplete="email"/></label>{siteKey?<Captcha key={captchaRevision} onToken={onToken} onError={setError}/>:<p className="lookup-error">Verificação antispam indisponível no momento.</p>}<button disabled={loading||!siteKey||!token} className="lookup-primary" type="submit">{loading?'Verificando…':'Enviar código de acesso'}<ArrowRight size={17}/></button><small><ShieldCheck size={15}/> O protocolo não permite consultar dados sem acesso ao e-mail do solicitante.</small></form>}
  {phase==='verify'&&<form onSubmit={verify} className="lookup-form"><div className="lookup-icon"><KeyRound size={27}/></div><h2>Verifique seu e-mail</h2><p>{message}</p><p>Informe o código de 8 dígitos, válido por 10 minutos. Se o código não chegar, confira o spam ou volte para solicitar outro.</p><label>Código de confirmação<input required autoComplete="one-time-code" type="text" inputMode="numeric" pattern="[0-9]{8}" maxLength={8} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,8))} placeholder="00000000"/></label><button disabled={loading||code.length!==8} type="submit" className="lookup-primary">{loading?'Confirmando…':'Consultar status'}<Search size={16}/></button><button type="button" className="lookup-secondary" onClick={()=>{setPhase('request');setCode('');setError('');setMessage('');}}>Voltar e solicitar novo código</button></form>}
  {phase==='result'&&result&&<div className="lookup-result"><div className="lookup-icon"><CheckCircle2 size={27}/></div><small>PROTOCOLO {result.ticket.protocol}</small><h2>{result.ticket.title}</h2><div className="lookup-current"><span>Status atual</span><strong>{labels[result.ticket.status]||result.ticket.status}</strong><span>Última atualização: {date(result.ticket.updated_at)}</span></div><div className="lookup-details"><div><span>Aberto em</span><strong>{date(result.ticket.created_at)}</strong></div><div><span>Prioridade</span><strong>{result.ticket.priority==='urgente'?'Urgente':'Normal'}</strong></div></div><h3>Histórico público de andamento</h3><div className="lookup-timeline">{result.history.map((h,i)=><article key={i}><Clock3 size={17}/><div><strong>{labels[h.status]||h.status}</strong><small>{date(h.date)}</small>{h.message&&<p>{h.message}</p>}</div></article>)}</div><p className="lookup-privacy"><LockKeyhole size={16}/> Notas internas e informações privadas da equipe não são exibidas.</p><button className="lookup-secondary" onClick={()=>{setResult(null);setPhase('request');setToken('');setCode('');setError('');}}>Consultar novamente</button></div>}
 </section></main><footer className="lookup-footer">NEXTZE · Processos inteligentes. Negócios eficientes.</footer></div>;
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
