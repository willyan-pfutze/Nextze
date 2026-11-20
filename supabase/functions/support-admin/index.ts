// NEXTZE — protected staff API. Never expose service role to browser.
// All authentication/authorization is checked on every request.
import { createClient } from 'npm:@supabase/supabase-js@2.49.8';
const ORIGINS=['https://nextze.com.br','https://www.nextze.com.br'];
const statuses=['aberto','em_triagem','aguardando_informacoes','em_analise','em_correcao','aguardando_validacao','resolvido','encerrado'];
function answer(code:number,data:unknown,origin:string){
 return new Response(JSON.stringify(data),{status:code,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin','Access-Control-Allow-Origin':origin}});
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'';
 if(!ORIGINS.includes(origin))return new Response('Forbidden',{status:403});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, content-type, apikey','Access-Control-Max-Age':'3600','Vary':'Origin'}});
 if(req.method!=='POST')return answer(405,{error:'Método não permitido'},origin);
 const base=Deno.env.get('SUPABASE_URL')||'';
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 if(!base||!key)return answer(503,{error:'Serviço indisponível'},origin);
 const header=req.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9._-]+$/.test(header))return answer(401,{error:'Autenticação obrigatória'},origin);
 const db=createClient(base,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:auth,error:authError}=await db.auth.getUser(header.slice(7));
 if(authError||!auth.user||auth.user.is_anonymous)return answer(401,{error:'Sessão inválida'},origin);
 const {data:agent,error:agentError}=await db.from('support_agents').select('user_id,display_name,active').eq('user_id',auth.user.id).eq('active',true).maybeSingle();
 if(agentError)return answer(503,{error:'Falha ao verificar permissão'},origin);
 if(!agent)return answer(403,{error:'Conta sem permissão para administrar o suporte'},origin);
 if(Number(req.headers.get('content-length')||0)>12000)return answer(413,{error:'Requisição muito grande'},origin);
 let body:Record<string,unknown>;
 try{body=await req.json();if(!body||typeof body!=='object'||Array.isArray(body))throw Error();}catch{return answer(400,{error:'Dados inválidos'},origin);}
 const action=body.action;
 const id=typeof body.ticket_id==='string'&&/^[0-9a-f-]{36}$/i.test(body.ticket_id)?body.ticket_id:'';
 const fail=()=>answer(503,{error:'Não foi possível concluir a operação'},origin);
 const labels:Record<string,string>={aberto:'Aberto',em_triagem:'Em triagem',aguardando_informacoes:'Aguardando informações',em_analise:'Em análise',em_correcao:'Em correção',aguardando_validacao:'Aguardando validação',resolvido:'Resolvido',encerrado:'Encerrado'};
 async function sendStatusNotification(notification:{id:string;recipient_email:string;status:string},protocol:string){
  const apiKey=Deno.env.get('RESEND_API_KEY')||'';
  const sender=Deno.env.get('SUPPORT_FROM_EMAIL')||'NEXTZE Suporte <suporte@nextze.com.br>';
  if(!apiKey)return false;
  const subject='NEXTZE — Atualização do chamado '+protocol;
  const text=[
   'Olá! O status do seu chamado '+protocol+' foi atualizado para: '+(labels[notification.status]||notification.status)+'.',
   '',
   'Acompanhe pelo site: https://nextze.com.br/suporte/consultar/',
   'Por segurança, você precisará confirmar seu e-mail com um código temporário.',
   '',
   'NEXTZE — Processos inteligentes. Negócios eficientes.'
  ].join(String.fromCharCode(10));
  let ok=false;let providerId:string|null=null;
  try{
   const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Idempotency-Key':'nxz-status-'+notification.id},body:JSON.stringify({from:sender,to:[notification.recipient_email],subject,text,reply_to:'suporte@nextze.com.br'})});
   if(res.ok){const data=await res.json().catch(()=>({}));providerId=typeof data.id==='string'?data.id:null;ok=true;}
  }catch{ok=false;}
  await db.from('support_status_notifications').update({state:ok?'sent':'failed',attempts:1,provider_message_id:providerId,sent_at:ok?new Date().toISOString():null,last_error:ok?null:'Falha na entrega transacional; verifique Resend'}).eq('id',notification.id);
  return ok;
 }
 try{
  if(action==='list'){
   const {data,error}=await db.from('support_tickets').select('id,protocol,title,status,company_name,requester_name,system_name,system_id,issue_area,requested_priority,validated_priority,created_at,updated_at').order('created_at',{ascending:false}).limit(100);
   if(error)return fail();
   return answer(200,{agent:agent.display_name,tickets:data||[]},origin);
  }
  if(action==='projects'){
   const [projects,stats,areas,unlinked]=await Promise.all([
    db.from('support_systems').select('id,name,version,description,client_name,project_status,active,created_at,updated_at').order('created_at',{ascending:false}).limit(500),
    db.rpc('support_project_stats'),
    db.rpc('support_project_areas'),
    db.from('support_tickets').select('id',{head:true,count:'exact'}).is('system_id',null)
   ]);
   if(projects.error||stats.error||areas.error||unlinked.error)return fail();
   return answer(200,{projects:projects.data||[],stats:stats.data||[],areas:areas.data||[],unlinked_tickets:unlinked.count||0},origin);
  }
  if(action==='save_project'){
   const raw=body.project;
   if(!raw||typeof raw!=='object'||Array.isArray(raw))return answer(400,{error:'Informe os dados do projeto'},origin);
   const p=raw as Record<string,unknown>;
   const name=typeof p.name==='string'?p.name.trim():'';
   const client_name=typeof p.client_name==='string'?p.client_name.trim():'';
   const version=typeof p.version==='string'?p.version.trim():'';
   const description=typeof p.description==='string'?p.description.trim():'';
   const project_status=typeof p.project_status==='string'?p.project_status:'';
   const valid=['planejamento','desenvolvimento','testes','implantacao','producao','manutencao','pausado','encerrado'];
   if(name.length<2||name.length>120||client_name.length<2||client_name.length>120||version.length>60||description.length>3000||!valid.includes(project_status))return answer(400,{error:'Confira o nome, cliente, status e limites de texto'},origin);
   const projectId=typeof p.id==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(p.id)?p.id:'';
   // Unique project names are permitted across clients, not within the same client.
   const {data:existing,error:existsError}=await db.from('support_systems').select('id,name,client_name').limit(500);
   if(existsError)return fail();
   if((existing||[]).some((x:{id:string;name:string;client_name:string|null})=>x.id!==projectId&&x.name.trim().toLocaleLowerCase()===name.toLocaleLowerCase()&&(x.client_name||'').trim().toLocaleLowerCase()===client_name.toLocaleLowerCase()))return answer(409,{error:'Este cliente já possui um projeto com esse nome'},origin);
   const fields={name,client_name,version:version||null,description:description||null,project_status,active:project_status!=='encerrado',updated_at:new Date().toISOString()};
   const query=projectId?db.from('support_systems').update(fields).eq('id',projectId):db.from('support_systems').insert(fields);
   const {data,error}=await query.select('id,name').single();
   if(error)return fail();
   return answer(200,{ok:true,project:data},origin);
  }
  if(!id)return answer(400,{error:'Identificador do chamado inválido'},origin);
  if(action==='link_project'){
   const projectId=body.system_id;
   const issueArea=typeof body.issue_area==='string'?body.issue_area.trim():'';
   if(issueArea.length>160)return answer(400,{error:'Área do problema muito longa'},origin);
   const {data:ticket,error:te}=await db.from('support_tickets').select('status,system_id,system_name,issue_area').eq('id',id).maybeSingle();
   if(te)return fail();if(!ticket)return answer(404,{error:'Chamado não encontrado'},origin);
   let systemId:string|null=null;
   let systemName=ticket.system_name;
   if(typeof projectId==='string'&&projectId!==''){
    if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(projectId))return answer(400,{error:'Projeto inválido'},origin);
    const {data:project,error:pe}=await db.from('support_systems').select('id,name').eq('id',projectId).maybeSingle();
    if(pe)return fail();if(!project)return answer(404,{error:'Projeto não encontrado'},origin);
    systemId=project.id;systemName=project.name;
   }
   const {error}=await db.from('support_tickets').update({system_id:systemId,system_name:systemName,issue_area:issueArea||null,updated_at:new Date().toISOString()}).eq('id',id);
   if(error)return fail();
   const {error:he}=await db.from('support_history').insert({ticket_id:id,status:ticket.status,actor:agent.display_name,internal_note:'Vínculo de projeto e área do problema atualizados pela equipe'});
   if(he)console.error('Project link updated but history write failed');
   return answer(200,{ok:true},origin);
  }

  if(action==='detail'){
   const [t,m,h]=await Promise.all([
    db.from('support_tickets').select('id,protocol,title,status,company_name,requester_name,requester_email,requester_phone,system_name,request_type,description,occurred_at,impact,attempted,requested_priority,validated_priority,system_id,issue_area,created_at,updated_at').eq('id',id).maybeSingle(),
    db.from('support_messages').select('id,actor,message,is_internal,moderation_status,created_at').eq('ticket_id',id).order('created_at',{ascending:true}).limit(200),
    db.from('support_history').select('id,status,actor,public_message,internal_note,created_at').eq('ticket_id',id).order('created_at',{ascending:true}).limit(200)
   ]);
   if(t.error||m.error||h.error)return fail();
   if(!t.data)return answer(404,{error:'Chamado não encontrado'},origin);
   const {count:pending}=await db.from('support_status_notifications').select('id',{count:'exact',head:true}).eq('ticket_id',id).in('state',['pending','failed']);
   return answer(200,{ticket:t.data,messages:m.data||[],history:h.data||[],pending_notifications:pending||0},origin);
  }
  if(action==='status'){
   const status=body.status;
   if(typeof status!=='string'||!statuses.includes(status))return answer(400,{error:'Status inválido'},origin);
   const {data:before,error:beforeError}=await db.from('support_tickets').select('status,protocol,requester_email').eq('id',id).maybeSingle();
   if(beforeError)return fail();if(!before)return answer(404,{error:'Chamado não encontrado'},origin);
   if(before.status===status)return answer(200,{ok:true,email_sent:null},origin);
   // Conditional update prevents conflicting status transitions from overwriting each other silently.
   const {data:updated,error}=await db.from('support_tickets').update({status,updated_at:new Date().toISOString()}).eq('id',id).eq('status',before.status).select('id');
   if(error)return fail();
   if(!updated?.length)return answer(409,{error:'O status mudou. Atualize os dados e tente novamente.'},origin);
   const {error:auditError}=await db.from('support_history').insert({ticket_id:id,status,actor:agent.display_name,internal_note:'Status alterado de '+before.status+' para '+status});
   if(auditError)console.error('Status updated, but audit history insertion failed');
   const {data:notification,error:queueError}=await db.from('support_status_notifications').insert({ticket_id:id,status,recipient_email:before.requester_email,state:'pending'}).select('id,recipient_email,status').single();
   if(queueError||!notification)return answer(200,{ok:true,email_sent:false,warning:'Status salvo, mas a notificação não foi registrada'},origin);
   const emailSent=await sendStatusNotification(notification,before.protocol);
   return answer(200,{ok:true,email_sent:emailSent,warning:emailSent?null:'Status salvo; notificação pendente de reenvio'},origin);
  }
  if(action==='retry_notification'){
   const {data:t,error:te}=await db.from('support_tickets').select('protocol').eq('id',id).maybeSingle();
   if(te||!t)return answer(404,{error:'Chamado não encontrado'},origin);
   const {data:n,error:ne}=await db.from('support_status_notifications').select('id,status,recipient_email,state').eq('ticket_id',id).in('state',['pending','failed']).order('created_at',{ascending:false}).limit(1).maybeSingle();
   if(ne)return fail();
   if(!n)return answer(200,{ok:true,email_sent:true,warning:'Não há notificações pendentes'},origin);
   const sent=await sendStatusNotification(n,t.protocol);
   return answer(200,{ok:true,email_sent:sent,warning:sent?null:'O e-mail permanece pendente'},origin);
  }
  if(action==='note'){
   const message=body.message;
   if(typeof message!=='string'||!message.trim()||message.length>3000)return answer(400,{error:'Nota deve ter entre 1 e 3000 caracteres'},origin);
   const {data:t,error:te}=await db.from('support_tickets').select('status').eq('id',id).maybeSingle();
   if(te||!t)return fail();
   const {error}=await db.from('support_messages').insert({ticket_id:id,actor:agent.display_name,message:message.trim(),is_internal:true,moderation_status:'approved'});
   if(error)return fail();
   return answer(200,{ok:true},origin);
  }
  if(action==='moderate'){
   const messageId=body.message_id;
   const decision=body.decision;
   if(typeof messageId!=='string'||!/^[0-9a-f-]{36}$/i.test(messageId)||!['approved','rejected'].includes(String(decision)))return answer(400,{error:'Revisão inválida'},origin);
   const {data,error}=await db.from('support_messages').update({moderation_status:decision}).eq('id',messageId).eq('ticket_id',id).eq('moderation_status','pending_review').eq('is_internal',true).select('id');
   if(error)return fail();
   if(!data?.length)return answer(409,{error:'Mensagem já revisada ou indisponível'},origin);
   const {data:t}=await db.from('support_tickets').select('status').eq('id',id).single();
   await db.from('support_history').insert({ticket_id:id,status:t?.status||'aberto',actor:agent.display_name,internal_note:'Mensagem de e-mail '+(decision==='approved'?'aprovada':'rejeitada')+' na revisão'});
   return answer(200,{ok:true},origin);
  }
  return answer(400,{error:'Ação desconhecida'},origin);
 }catch{ return fail(); }
});
