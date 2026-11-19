import React,{useState} from 'react';
import ReactDOM from 'react-dom/client';
import {ArrowLeft,CheckCircle2,Clock3,Headphones,LockKeyhole,LogOut,MessageSquare,RefreshCw,Search,ShieldCheck,Send,AlertTriangle} from 'lucide-react';
import './styles.css';
import './support-admin.css';
// Publishable key is intentionally public. Authorization happens only on the server.
const base='https://jqeonloeyvdapwmafnkm.supabase.co';
const publishable='sb_publishable_78ikIoXORaG6ZPAhnKqKoA_cvddj9bt';
const api=base+'/functions/v1/support-admin';
type Ticket={id:string;protocol:string;title:string;status:string;company_name:string;requester_name:string;requester_email?:string;requester_phone?:string;system_name:string;request_type?:string;description?:string;impact?:string;attempted?:string;requested_priority:string;validated_priority?:string;created_at:string;updated_at:string};
type Msg={id:string;actor:string;message:string;is_internal:boolean;moderation_status:string;created_at:string};
type History={id:number;status:string;actor:string;public_message:string|null;internal_note:string|null;created_at:string};
const statuses=['aberto','em_triagem','aguardando_informacoes','em_analise','em_correcao','aguardando_validacao','resolvido','encerrado'];
const labels:Record<string,string>={aberto:'Aberto',em_triagem:'Em triagem',aguardando_informacoes:'Aguardando informações',em_analise:'Em análise',em_correcao:'Em correção',aguardando_validacao:'Aguardando validação',resolvido:'Resolvido',encerrado:'Encerrado'};
function format(d:string){return new Date(d).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});}
function App(){
 const [access,setAccess]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [tickets,setTickets]=useState<Ticket[]>([]),[selected,setSelected]=useState<Ticket|null>(null),[messages,setMessages]=useState<Msg[]>([]),[history,setHistory]=useState<History[]>([]);
 const [query,setQuery]=useState(''),[statusFilter,setStatusFilter]=useState('todos'),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[info,setInfo]=useState(''),[agent,setAgent]=useState('');
 const showError=(e:unknown)=>{setError(e instanceof Error?e.message:'Falha na operação');setInfo('');};
 async function call(action:string,params:Record<string,unknown>={},token=access){
  const res=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,'apikey':publishable},body:JSON.stringify({action,...params}),cache:'no-store'});
  const json=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(json.error||'Não foi possível concluir a solicitação.');
  return json;
 }
 async function login(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');
  try{
   const res=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json','apikey':publishable},body:JSON.stringify({email,password})});
   const json=await res.json().catch(()=>({}));
   if(!res.ok||!json.access_token)throw Error('Credenciais inválidas ou acesso indisponível.');
   const data=await call('list',{},json.access_token);
   setAccess(json.access_token);setAgent(data.agent||'Agente NEXTZE');setTickets(data.tickets||[]);setPassword('');
  }catch(e){showError(e);}finally{setBusy(false);}
 }
 async function refresh(){
  setBusy(true);setError('');
  try{const data=await call('list');setTickets(data.tickets||[]);}catch(e){showError(e);}finally{setBusy(false);}
 }
 async function open(t:Ticket){
  setBusy(true);setError('');setInfo('');
  try{const data=await call('detail',{ticket_id:t.id});setSelected(data.ticket);setMessages(data.messages||[]);setHistory(data.history||[]);}
  catch(e){showError(e);}finally{setBusy(false);}
 }
 async function act(action:string,payload:Record<string,unknown>){
  if(!selected)return;
  setBusy(true);setError('');setInfo('');
  try{
   await call(action,{ticket_id:selected.id,...payload});
   const data=await call('detail',{ticket_id:selected.id});
   setSelected(data.ticket);setMessages(data.messages||[]);setHistory(data.history||[]);
   setTickets(xs=>xs.map(x=>x.id===data.ticket.id?data.ticket:x));
   if(action==='note')setNote('');
   setInfo('Alteração registrada com sucesso.');
  }catch(e){showError(e);}finally{setBusy(false);}
 }
 function logout(){setAccess('');setTickets([]);setSelected(null);setMessages([]);setHistory([]);setNote('');setEmail('');setPassword('');setError('');setInfo('');}
 const filtered=tickets.filter(t=>(statusFilter==='todos'||t.status===statusFilter)&&[t.protocol,t.title,t.company_name,t.requester_name,t.system_name].some(s=>(s||'').toLowerCase().includes(query.toLowerCase())));
 return <div className="adm-root">
  <header className="adm-header"><div className="adm-head-inner"><a className="adm-logo" href="../../">NEXT<span>ZE</span></a><span className="adm-title">Central de Suporte <strong>/ Administração</strong></span>{access&&<button onClick={logout} className="adm-logout"><LogOut size={16}/> Sair</button>}</div></header>
  {!access?<main className="adm-login-wrap"><form onSubmit={login} className="adm-login"><div className="adm-sign"><LockKeyhole size={27}/></div><h1>Acesso administrativo</h1><p>Área exclusiva para agentes autorizados da NEXTZE.</p><label>E-mail do agente<input autoComplete="username" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="nome@nextze.com.br"/></label><label>Senha<input autoComplete="current-password" type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p role="alert" className="adm-error">{error}</p>}<button className="adm-primary" type="submit" disabled={busy}>{busy?'Verificando acesso…':'Entrar no painel'}</button><small><ShieldCheck size={14}/> Acesso protegido por autenticação e permissão no servidor.</small><a className="adm-back" href="../"><ArrowLeft size={15}/> Voltar à Central de Suporte</a></form></main>
  :<main className="adm-main"><div className="adm-overview"><div><small>PAINEL DE OPERAÇÕES</small><h1>Chamados de suporte</h1><p>Bem-vindo(a), {agent}. Acesso restrito e registros auditáveis.</p></div><div className="adm-counts"><div><strong>{tickets.length}</strong><span>Chamados recentes</span></div><div><strong>{tickets.filter(t=>!['resolvido','encerrado'].includes(t.status)).length}</strong><span>Em atendimento</span></div></div></div>
   {error&&<div className="adm-error" role="alert">{error}</div>}{info&&<div className="adm-info" role="status"><CheckCircle2 size={16}/>{info}</div>}
   {!selected?<section className="adm-panel"><div className="adm-tools"><label className="adm-search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar protocolo, empresa, título…"/></label><select aria-label="Filtrar status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="todos">Todos os status</option>{statuses.map(s=><option key={s} value={s}>{labels[s]}</option>)}</select><button onClick={refresh} disabled={busy} className="adm-secondary"><RefreshCw size={16}/> Atualizar</button></div><div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Protocolo</th><th>Solicitação</th><th>Empresa</th><th>Prioridade</th><th>Status</th><th>Data</th></tr></thead><tbody>{filtered.map(t=><tr key={t.id} onClick={()=>open(t)} tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')open(t);}}><td><strong>{t.protocol}</strong></td><td>{t.title}</td><td>{t.company_name}</td><td>{t.validated_priority||t.requested_priority}</td><td><span className="adm-status">{labels[t.status]||t.status}</span></td><td>{format(t.created_at)}</td></tr>)}</tbody></table>{filtered.length===0&&<div className="adm-empty"><Headphones size={28}/><p>Nenhum chamado encontrado.</p></div>}</div><p className="adm-footnote">Exibindo até os 100 chamados mais recentes. Não são disponibilizados dados aos visitantes públicos.</p></section>
   :<><button className="adm-back-button" onClick={()=>{setSelected(null);setInfo('');}}><ArrowLeft size={17}/> Voltar à lista</button><div className="adm-detail-top"><div><small>{selected.protocol}</small><h2>{selected.title}</h2><span className="adm-status">{labels[selected.status]||selected.status}</span></div><label>Alterar status<select disabled={busy} value={selected.status} onChange={e=>act('status',{status:e.target.value})}>{statuses.map(s=><option value={s} key={s}>{labels[s]}</option>)}</select></label></div>
   <div className="adm-grid"><div className="adm-detail-main"><section className="adm-panel"><h3>Descrição do chamado</h3><div className="adm-detail-meta"><p><strong>Empresa:</strong> {selected.company_name}</p><p><strong>Solicitante:</strong> {selected.requester_name}</p><p><strong>E-mail:</strong> {selected.requester_email}</p><p><strong>Telefone:</strong> {selected.requester_phone}</p><p><strong>Sistema:</strong> {selected.system_name}</p><p><strong>Tipo:</strong> {selected.request_type}</p><p><strong>Impacto:</strong> {selected.impact}</p><p><strong>Prioridade:</strong> {selected.validated_priority||selected.requested_priority}</p><p><strong>Aberto em:</strong> {format(selected.created_at)}</p></div><div className="adm-text-body">{selected.description}</div>{selected.attempted&&<><h4>Procedimentos realizados</h4><div className="adm-text-body">{selected.attempted}</div></>}</section>
   <section className="adm-panel"><h3><MessageSquare size={19}/> Mensagens do chamado</h3>{messages.length===0?<p className="adm-muted">Nenhuma mensagem registrada.</p>:messages.map(m=><article className="adm-message" key={m.id}><div className="adm-msg-head"><strong>{m.actor}</strong><small>{format(m.created_at)}</small></div><p className="adm-msg-state">Nota interna · {m.moderation_status==='pending_review'?'Aguardando revisão':m.moderation_status==='approved'?'Revisada':'Rejeitada'}</p><div className="adm-text-body">{m.message}</div>{m.moderation_status==='pending_review'&&<div className="adm-msg-actions"><button disabled={busy} onClick={()=>act('moderate',{message_id:m.id,decision:'approved'})}>Aprovar revisão</button><button disabled={busy} onClick={()=>act('moderate',{message_id:m.id,decision:'rejected'})}>Rejeitar</button></div>}</article>)}
   <form className="adm-note" onSubmit={e=>{e.preventDefault();act('note',{message:note});}}><label>Adicionar nota interna<textarea rows={4} maxLength={3000} required value={note} onChange={e=>setNote(e.target.value)} placeholder="Registre observações sobre o atendimento…"/></label><button className="adm-primary" type="submit" disabled={busy||!note.trim()}><Send size={16}/> Salvar nota interna</button><p>Notas internas não são enviadas por e-mail ao cliente.</p></form></section></div>
   <aside className="adm-panel adm-timeline"><h3><Clock3 size={19}/> Histórico</h3>{history.map(h=><div className="adm-history" key={h.id}><strong>{labels[h.status]||h.status}</strong><small>{format(h.created_at)} · {h.actor}</small>{h.internal_note&&<p>{h.internal_note}</p>}{h.public_message&&<p>{h.public_message}</p>}</div>)}<div className="adm-warning"><AlertTriangle size={17}/> Respostas externas e anexos ainda não estão habilitados neste painel.</div></aside></div></>}
  </main>}
 </div>;
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
