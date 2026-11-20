import {useEffect,useState} from 'react';
import {ArrowLeft,BarChart3,BriefcaseBusiness,CheckCircle2,FolderKanban,Plus,RefreshCw,Save,TrendingUp} from 'lucide-react';
export type Project={id:string;name:string;client_name:string|null;version:string|null;description:string|null;project_status:string;active:boolean;created_at:string;updated_at:string};
type Stats={system_id:string;total_tickets:number;open_tickets:number;resolved_tickets:number;urgent_tickets:number;problem_tickets:number;last_ticket_at:string|null};
type Area={system_id:string;issue_area:string;ticket_count:number;open_count:number};
export const PROJECT_STATUSES:{value:string;label:string}[]=[
 {value:'planejamento',label:'Planejamento'},
 {value:'desenvolvimento',label:'Desenvolvimento'},
 {value:'testes',label:'Testes e validação'},
 {value:'implantacao',label:'Implantação'},
 {value:'producao',label:'Em produção'},
 {value:'manutencao',label:'Manutenção'},
 {value:'pausado',label:'Pausado'},
 {value:'encerrado',label:'Encerrado'}
];
const blank={name:'',client_name:'',version:'',description:'',project_status:'planejamento'};
type Editor=typeof blank & {id?:string};
type Props={call:(action:string,params?:Record<string,unknown>)=>Promise<any>;onError:(error:unknown)=>void;onMessage:(message:string)=>void};
export default function SupportProjects({call,onError,onMessage}:Props){
 const [projects,setProjects]=useState<Project[]>([]);
 const [stats,setStats]=useState<Stats[]>([]);
 const [areas,setAreas]=useState<Area[]>([]);
 const [unlinked,setUnlinked]=useState(0);
 const [mode,setMode]=useState<'list'|'edit'|'analytics'>('list');
 const [draft,setDraft]=useState<Editor>(blank);
 const [busy,setBusy]=useState(false);
 const [query,setQuery]=useState('');
 async function load(){
  setBusy(true);
  try{const data=await call('projects');setProjects(data.projects||[]);setStats(data.stats||[]);setAreas(data.areas||[]);setUnlinked(data.unlinked_tickets||0);}
  catch(e){onError(e);}
  finally{setBusy(false);}
 }
 useEffect(()=>{void load();},[]);
 function edit(p?:Project){
  setDraft(p?{id:p.id,name:p.name,client_name:p.client_name||'',version:p.version||'',description:p.description||'',project_status:p.project_status}:blank);
  setMode('edit');
 }
 async function save(e:React.FormEvent){
  e.preventDefault();setBusy(true);
  try{await call('save_project',{project:draft});onMessage('Projeto salvo com sucesso.');setMode('list');await load();}
  catch(e){onError(e);}finally{setBusy(false);}
 }
 const count=(id:string)=>stats.find(s=>s.system_id===id);
 const filtered=projects.filter(p=>[p.name,p.client_name||'',p.project_status].some(x=>x.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))));
 const totalTickets=stats.reduce((s,p)=>s+Number(p.total_tickets||0),0);
 const openTickets=stats.reduce((s,p)=>s+Number(p.open_tickets||0),0);
 const label=(s:string)=>PROJECT_STATUSES.find(x=>x.value===s)?.label||s;
 return <section className="adm-projects">
  <div className="adm-project-head"><div><p className="adm-eyebrow">PORTFÓLIO DE DESENVOLVIMENTO</p><h2>Projetos e sistemas NEXTZE</h2><p>Cadastre cada solução e acompanhe as ocorrências vinculadas aos chamados.</p></div>
  <div className="adm-project-actions"><button className="adm-secondary" type="button" disabled={busy} onClick={()=>void load()}><RefreshCw size={15}/> Atualizar</button><button className="adm-secondary" type="button" onClick={()=>setMode(mode==='analytics'?'list':'analytics')}><BarChart3 size={16}/> {mode==='analytics'?'Projetos':'Indicadores'}</button><button className="adm-primary" type="button" onClick={()=>edit()}><Plus size={16}/> Novo projeto</button></div></div>
  {mode==='edit'?<section className="adm-panel adm-project-editor"><button className="adm-back-button" type="button" onClick={()=>setMode('list')}><ArrowLeft size={16}/> Voltar aos projetos</button><h3>{draft.id?'Editar projeto':'Cadastrar projeto'}</h3><form onSubmit={save} className="adm-project-form">
   <label>Nome do sistema / projeto *<input required maxLength={120} minLength={2} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="Ex.: Estoque Aromas"/></label>
   <label>Empresa cliente *<input required maxLength={120} minLength={2} value={draft.client_name} onChange={e=>setDraft({...draft,client_name:e.target.value})} placeholder="Mesmo nome que o cliente usará na abertura"/></label>
   <label>Versão atual<input maxLength={60} value={draft.version} onChange={e=>setDraft({...draft,version:e.target.value})} placeholder="Ex.: 1.2.0"/></label>
   <label>Status do projeto<select value={draft.project_status} onChange={e=>setDraft({...draft,project_status:e.target.value})}>{PROJECT_STATUSES.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
   <label className="adm-project-wide">Descrição / escopo<textarea rows={5} maxLength={3000} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})} placeholder="Objetivo do projeto, principais módulos, integrações e observações relevantes"/></label>
   <p className="adm-project-tip">A associação automática exige correspondência do nome do sistema e da empresa. Projetos encerrados ficam no histórico, mas não recebem novos vínculos automáticos.</p>
   <div className="adm-project-form-actions"><button className="adm-secondary" type="button" onClick={()=>setMode('list')}>Cancelar</button><button className="adm-primary" type="submit" disabled={busy}><Save size={16}/> {busy?'Salvando…':'Salvar projeto'}</button></div>
  </form></section>:mode==='analytics'?<><div className="adm-project-kpis"><div><strong>{projects.length}</strong><span>Projetos cadastrados</span></div><div><strong>{totalTickets}</strong><span>Chamados vinculados</span></div><div><strong>{openTickets}</strong><span>Em atendimento</span></div><div><strong>{unlinked}</strong><span>Aguardando vínculo</span></div></div><section className="adm-panel"><h3><TrendingUp size={18}/> Ocorrências por sistema</h3><p className="adm-muted">Contagens absolutas dos chamados vinculados. Para comparar confiabilidade entre sistemas, também considere quantidade de usuários, tempo em operação e volume de uso.</p><div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Sistema</th><th>Empresa</th><th>Chamados</th><th>Em atendimento</th><th>Erros/falhas</th><th>Urgentes</th></tr></thead><tbody>{[...projects].sort((a,b)=>Number(count(b.id)?.total_tickets||0)-Number(count(a.id)?.total_tickets||0)).map(p=><tr key={p.id}><td><strong>{p.name}</strong></td><td>{p.client_name||'—'}</td><td>{count(p.id)?.total_tickets||0}</td><td>{count(p.id)?.open_tickets||0}</td><td>{count(p.id)?.problem_tickets||0}</td><td>{count(p.id)?.urgent_tickets||0}</td></tr>)}</tbody></table></div>{projects.length===0&&<p className="adm-muted">Cadastre seu primeiro projeto para começar a medir ocorrências.</p>}</section><section className="adm-panel"><h3>Áreas com mais registros</h3><div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Sistema</th><th>Área / módulo</th><th>Total</th><th>Em atendimento</th></tr></thead><tbody>{areas.map((a,i)=><tr key={a.system_id+'-'+a.issue_area+'-'+i}><td>{projects.find(p=>p.id===a.system_id)?.name||'Projeto'}</td><td>{a.issue_area}</td><td>{a.ticket_count}</td><td>{a.open_count}</td></tr>)}</tbody></table></div>{areas.length===0&&<p className="adm-muted">Os módulos com falhas aparecerão conforme novos chamados forem vinculados.</p>}</section></>
  :<><div className="adm-project-kpis"><div><strong>{projects.length}</strong><span>Projetos cadastrados</span></div><div><strong>{projects.filter(p=>p.active).length}</strong><span>Ativos</span></div><div><strong>{totalTickets}</strong><span>Chamados vinculados</span></div><div><strong>{unlinked}</strong><span>Sem associação</span></div></div><section className="adm-panel"><div className="adm-tools"><label className="adm-search"><BriefcaseBusiness size={17}/><input placeholder="Buscar projeto, cliente ou status…" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>{filtered.length===0?<div className="adm-empty"><FolderKanban size={30}/><p>Nenhum projeto cadastrado ou encontrado.</p><button className="adm-primary" onClick={()=>edit()}><Plus size={16}/> Cadastrar projeto</button></div>:<div className="adm-project-list">{filtered.map(p=><article className="adm-project-item" key={p.id}><div className="adm-project-item-main"><span className="adm-project-badge">{label(p.project_status)}</span><h3>{p.name}</h3><p><strong>Cliente:</strong> {p.client_name||'Não informado'} · <strong>Versão:</strong> {p.version||'—'}</p>{p.description&&<p className="adm-project-description">{p.description}</p>}</div><div className="adm-project-item-stats"><strong>{count(p.id)?.total_tickets||0}</strong><span>chamados</span><small>{count(p.id)?.open_tickets||0} em atendimento</small><button className="adm-secondary" type="button" onClick={()=>edit(p)}>Editar projeto</button></div></article>)}</div>}</section></>}
 </section>;
}
