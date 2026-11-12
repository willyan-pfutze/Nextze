import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ChevronDown, Clock3, FileText, Headphones, Info, LockKeyhole, Mail, Menu, Search, Send, ShieldCheck, UploadCloud, X } from 'lucide-react';
import './styles.css';
import './support.css';

const home = '../';
const endpoint = (import.meta.env.VITE_SUPPORT_ENDPOINT || '').trim();
const siteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();
const ready = Boolean(endpoint && siteKey);
const categories = ['Todas as categorias','Primeiros passos','Acesso e autenticação','Utilização dos sistemas','Erros e problemas conhecidos','Procedimentos operacionais','Administração do sistema','Solicitação de suporte'];
const systems = (import.meta.env.VITE_SUPPORT_SYSTEMS || '').split(',').map((x:string)=>x.trim()).filter(Boolean);
type FormFields = {company:string; requester:string; email:string; phone:string; system:string; type:string; title:string; description:string; occurred_at:string; impact:string; attempted:string; priority:'normal'|'urgente'; privacy:boolean};
const initial:FormFields = {company:'',requester:'',email:'',phone:'',system:'',type:'',title:'',description:'',occurred_at:'',impact:'',attempted:'',priority:'normal',privacy:false};
const maxFiles = 3, maxBytes = 5 * 1024 * 1024, maxTotal = 12 * 1024 * 1024;
declare global { interface Window { turnstile?: { render:(node:HTMLElement,options:{sitekey:string;callback:(token:string)=>void;'expired-callback':()=>void;'error-callback':()=>void;theme:string})=>string; remove:(id:string)=>void } } }
function Captcha({onToken}:{onToken:(token:string)=>void}) {
 const area=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!siteKey || !area.current) return;
  let widget:string|undefined; let disposed=false;
  const render=()=>{if(disposed||!area.current||!window.turnstile||widget)return;widget=window.turnstile.render(area.current,{sitekey:siteKey,theme:'light',callback:onToken,'expired-callback':()=>onToken(''),'error-callback':()=>onToken('')});};
  const existing=document.querySelector('script[data-nxz-turnstile]');
  if(!existing){const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.defer=true;script.dataset.nxzTurnstile='true';script.onload=render;document.head.append(script);}else{existing.addEventListener('load',render);}
  const poll=window.setInterval(render,300);
  return ()=>{disposed=true;window.clearInterval(poll);existing?.removeEventListener('load',render);if(widget&&window.turnstile)window.turnstile.remove(widget);};
 },[onToken]);
 return <div ref={area} aria-label="Verificação antispam"/>;
}
function App(){
 const [mobile,setMobile]=useState(false);
 const [search,setSearch]=useState('');
 const [cat,setCat]=useState('Todas as categorias');
 const [fields,setFields]=useState<FormFields>(initial);
 const [files,setFiles]=useState<File[]>([]);
 const [fileError,setFileError]=useState('');
 const [token,setToken]=useState('');
 const [sending,setSending]=useState(false);
 const [error,setError]=useState('');
 const [receipt,setReceipt]=useState<{protocol:string;date:string;priority:string;title:string}|null>(null);
 const select=(key:keyof FormFields,value:string|boolean)=>setFields(p=>({...p,[key]:value}));
 const articles:never[]=[]; // Nenhuma KB técnica real foi aprovada para publicação.
 const filtered=articles.filter(()=>false);
 const onFiles=(list:FileList|null)=>{
  if(!list)return;
  const next=Array.from(list);
  if(next.length>maxFiles||next.reduce((n,f)=>n+f.size,0)>maxTotal||next.some(f=>f.size>maxBytes || !['image/jpeg','image/png','application/pdf','text/plain'].includes(f.type))){setFileError('Envie no máximo 3 arquivos JPG, PNG, PDF ou TXT, até 5 MB por arquivo e 12 MB no total.');setFiles([]);return;}
  setFileError('');setFiles(next);
 };
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setError('');
  if(!ready){setError('A abertura online ainda não está habilitada. Os serviços seguros de suporte precisam ser configurados.');return;}
  if(!fields.privacy||!token){setError('Confirme a privacidade e conclua a verificação antispam.');return;}
  setSending(true);
  try{
   const body=new FormData();
   for(const [k,v] of Object.entries(fields))body.append(k,String(v));
   body.append('turnstile_token',token);
   files.forEach(file=>body.append('evidences',file,file.name));
   const response=await fetch(endpoint,{method:'POST',body,headers:{'Accept':'application/json'}});
   const json=await response.json().catch(()=>({}));
   if(!response.ok||!json.protocol)throw new Error(typeof json.error==='string'?json.error:'Não foi possível registrar a solicitação. Tente novamente.');
   setReceipt({protocol:json.protocol,date:json.created_at,priority:fields.priority,title:fields.title});
   setFields(initial);setFiles([]);
  }catch(err){setError(err instanceof Error?err.message:'Não foi possível enviar a solicitação.');setToken('');}
  finally{setSending(false);}
 }
 return <>
 <a className="skip" href="#principal">Pular para o conteúdo</a>
 <header className="site-header"><div className="container header-inner"><a href={home} className="brand" aria-label="Página inicial NEXTZE"><svg viewBox="0 0 64 52" aria-hidden="true"><path d="M12 1h33L64 26 38 51H19l25-25z" fill="currentColor"/><path d="M2 28 13 15h22L23 28zM1 49l22-25h20L20 49z" fill="#00D6A3"/></svg><span>NEXT<span>ZE</span><small>Processos inteligentes. Negócios eficientes.</small></span></a>
 <nav className={mobile?'nav open':'nav'} aria-label="Navegação"><a href={home}>Início</a><a href="#conhecimento" onClick={()=>setMobile(false)}>Base de conhecimento</a><a href="#abrir-chamado" onClick={()=>setMobile(false)}>Abrir chamado</a><a href="#atendimento" onClick={()=>setMobile(false)}>Atendimento</a></nav>
 <a className="header-cta" href="#abrir-chamado">Solicitar suporte <ArrowRight size={16}/></a><button className="menu-toggle" type="button" aria-label={mobile?'Fechar menu':'Abrir menu'} aria-expanded={mobile} onClick={()=>setMobile(!mobile)}>{mobile?<X/>:<Menu/>}</button></div></header>
 <main id="principal">
 <section className="support-hero"><div className="support-pattern" aria-hidden="true"/><div className="container support-hero-inner"><div className="support-eyebrow"><span/> NEXTZE / CENTRAL DE ATENDIMENTO</div><h1>Central de Suporte <em>NEXTZE</em></h1><p>Encontre orientações, consulte nossa Base de Conhecimento ou registre uma solicitação técnica. Estamos aqui para ajudar você a manter seus processos funcionando.</p><div className="support-hero-actions"><a className="support-action-primary" href="#conhecimento"><BookOpen size={19}/> Consultar Base de Conhecimento</a><a className="support-action-secondary" href="#abrir-chamado"><Headphones size={19}/> Abrir Chamado</a></div><div className="support-hero-facts"><span><Clock3 size={16}/> Registro disponível a qualquer momento</span><span><ShieldCheck size={16}/> Privacidade em primeiro lugar</span></div></div></section>
 <section id="conhecimento" className="support-section kb-section"><div className="container"><div className="support-section-heading"><span>01 / AUTOATENDIMENTO</span><h2>Base de Conhecimento</h2><p>Procure orientações oficiais para o seu sistema. Os artigos serão disponibilizados conforme cada solução for documentada.</p></div><div className="kb-tools"><label className="kb-search"><Search size={20}/><span className="sr-only">Pesquisar artigos</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar por título, código KB ou sistema…"/></label><label className="kb-filter"><span className="sr-only">Filtrar por categoria</span><select value={cat} onChange={e=>setCat(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select><ChevronDown size={18}/></label></div><div className="kb-categories">{categories.slice(1).map(c=><button key={c} type="button" className={cat===c?'selected':''} onClick={()=>setCat(cat===c?'Todas as categorias':c)}>{c}</button>)}</div>{filtered.length===0&&<div className="kb-empty"><div><BookOpen size={30}/></div><h3>Nenhum artigo publicado ainda</h3><p>{search||cat!=='Todas as categorias'?'Não há artigos disponíveis para os filtros selecionados.':'Estamos estruturando a documentação dos sistemas NEXTZE. Por enquanto, utilize os canais de suporte previstos no seu contrato.'}</p><a href="#abrir-chamado">Ir para abertura de chamado <ArrowRight size={16}/></a></div>}</div></section>
 <section id="atendimento" className="support-policy"><div className="container support-policy-grid"><div><span>02 / NOSSO COMPROMISSO</span><h2>Atendimento organizado, com prazos claros.</h2><p>A Central de Suporte NEXTZE está disponível para registro de solicitações a qualquer momento. O atendimento técnico ocorre conforme os horários e condições previstos em contrato.</p><small>Em aplicações críticas, a cobertura emergencial depende de contratação específica.</small></div><div className="support-time-cards"><article><Clock3 size={23}/><span>CHAMADOS NORMAIS</span><strong>Até 2 dias úteis</strong><p>Prazo de primeira resposta</p></article><article><Info size={23}/><span>CHAMADOS URGENTES</span><strong>Até 1 dia útil</strong><p>Prazo de primeira resposta, sujeito à validação da prioridade</p></article></div></div></section>
 <section id="abrir-chamado" className="support-section ticket-section"><div className="container"><div className="support-section-heading"><span>03 / SOLICITAÇÃO TÉCNICA</span><h2>Abrir chamado</h2><p>Descreva sua necessidade para facilitar a triagem. O registro não significa atendimento técnico imediato ou garantia de resolução no prazo de primeira resposta.</p></div>
 {!ready&&<div className="support-disabled" role="status"><LockKeyhole size={22}/><div><strong>Formulário em preparação — ainda não recebe solicitações</strong><p>Estamos configurando armazenamento seguro, protocolo e notificações. Até a ativação, utilize os canais de contato previstos no seu contrato. Nenhum dado preenchido aqui será enviado.</p></div></div>}
 {receipt?<div className="ticket-success" role="status"><CheckCircle2 size={42}/><h3>Solicitação registrada</h3><p>O servidor confirmou o armazenamento do seu chamado. Guarde o protocolo para referência.</p><strong>{receipt.protocol}</strong><dl><dt>Solicitação</dt><dd>{receipt.title}</dd><dt>Prioridade solicitada</dt><dd>{receipt.priority}</dd><dt>Data de abertura</dt><dd>{new Date(receipt.date).toLocaleString('pt-BR')}</dd><dt>Primeira resposta</dt><dd>{receipt.priority==='urgente'?'Até 1 dia útil':'Até 2 dias úteis'}, conforme as condições do contrato</dd></dl><p>Consulte o e-mail informado para confirmação, se o serviço de notificações estiver habilitado.</p><button type="button" onClick={()=>{setReceipt(null);setToken('');}}>Novo chamado</button></div>:<form className="ticket-form" onSubmit={submit}><fieldset disabled={!ready||sending}><legend>Identificação</legend><div className="form-grid"><label>Empresa *<input required maxLength={120} value={fields.company} onChange={e=>select('company',e.target.value)} placeholder="Nome da empresa"/></label><label>Nome do solicitante *<input required maxLength={120} value={fields.requester} onChange={e=>select('requester',e.target.value)} placeholder="Nome completo"/></label><label>E-mail corporativo *<input type="email" required maxLength={254} value={fields.email} onChange={e=>select('email',e.target.value)} placeholder="nome@empresa.com.br"/></label><label>Telefone de contato *<input type="tel" required maxLength={30} value={fields.phone} onChange={e=>select('phone',e.target.value)} placeholder="(11) 99999-9999"/></label></div><legend>Detalhes da solicitação</legend><div className="form-grid"><label>Sistema NEXTZE utilizado *<select required value={fields.system} onChange={e=>select('system',e.target.value)}><option value="">Selecione</option>{systems.map(s=><option key={s}>{s}</option>)}<option>Outro / não identificado</option></select></label><label>Tipo de solicitação *<select required value={fields.type} onChange={e=>select('type',e.target.value)}><option value="">Selecione</option>{['Erro ou falha','Dúvida operacional','Problema de acesso','Solicitação de melhoria','Outro'].map(s=><option key={s}>{s}</option>)}</select></label><label className="form-wide">Título do problema *<input required maxLength={160} value={fields.title} onChange={e=>select('title',e.target.value)} placeholder="Resuma o que está acontecendo"/></label><label className="form-wide">Descrição detalhada *<textarea required maxLength={6000} rows={5} value={fields.description} onChange={e=>select('description',e.target.value)} placeholder="Explique o que ocorreu, desde quando e qual resultado esperava."/></label><label>Data e horário da ocorrência *<input type="datetime-local" required value={fields.occurred_at} onChange={e=>select('occurred_at',e.target.value)}/></label><label>Impacto nas operações *<select required value={fields.impact} onChange={e=>select('impact',e.target.value)}><option value="">Selecione</option><option>Baixo — operação continua</option><option>Médio — parte da operação afetada</option><option>Alto — processo essencial indisponível</option></select></label><label className="form-wide">Procedimentos já realizados<textarea rows={3} maxLength={3000} value={fields.attempted} onChange={e=>select('attempted',e.target.value)} placeholder="Descreva tentativas anteriores, caso existam."/></label></div><legend>Prioridade solicitada</legend><div className="priority-options"><label><input type="radio" name="priority" checked={fields.priority==='normal'} onChange={()=>select('priority','normal')}/> Normal — até 2 dias úteis para primeira resposta</label><label><input type="radio" name="priority" checked={fields.priority==='urgente'} onChange={()=>select('priority','urgente')}/> Urgente — até 1 dia útil para primeira resposta</label></div><p className="priority-note">A prioridade final será validada pela equipe NEXTZE conforme o impacto e as condições contratadas.</p><legend>Evidências</legend><label className="upload-area"><UploadCloud size={25}/><span>Selecionar evidências (opcional)</span><small>JPG, PNG, PDF e TXT · até 3 arquivos · 5 MB por arquivo, 12 MB no total</small><input type="file" multiple accept=".jpg,.jpeg,.png,.pdf,.txt,image/jpeg,image/png,application/pdf,text/plain" onChange={e=>onFiles(e.target.files)}/></label>{files.length>0&&<ul className="upload-list">{files.map((f,i)=><li key={i}><FileText size={15}/>{f.name}</li>)}</ul>}{fileError&&<p className="form-error" role="alert">{fileError}</p>}<p className="privacy-warning"><ShieldCheck size={17}/> Antes de enviar, remova senhas, tokens, dados pessoais desnecessários e informações confidenciais das evidências.</p><label className="privacy-consent"><input type="checkbox" required checked={fields.privacy} onChange={e=>select('privacy',e.target.checked)}/> Li as <a href="../privacidade/" target="_blank" rel="noopener noreferrer">informações de privacidade</a> e compreendo o uso dos meus dados para atendimento.</label>{ready&&<Captcha onToken={setToken}/>}</fieldset>{error&&<p className="form-error" role="alert">{error}</p>}<button type="submit" className="submit-ticket" disabled={!ready||sending||Boolean(fileError)||!token}>{sending?'Enviando solicitação…':'Registrar solicitação'}<Send size={18}/></button></form>}</div></section>
 <section className="support-last-cta"><div className="container"><div><span>SUPORTE NEXTZE</span><h2>Seu negócio não precisa parar para evoluir.</h2><p>Organização, comunicação clara e tecnologia para sua operação.</p></div><a href={home}>Voltar ao site institucional <ArrowRight size={18}/></a></div></section>
 </main><footer className="support-footer"><div className="container"><strong>NEXT<span>ZE</span></strong><p>Processos inteligentes. Negócios eficientes.</p><div><a href={home}>Início</a><a href="../privacidade/">Privacidade</a><a href="#principal">Voltar ao topo</a></div><small>© {new Date().getFullYear()} NEXTZE · nextze.com.br</small></div></footer>
 </>;
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
