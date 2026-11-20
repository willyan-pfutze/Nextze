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
  const text='Olá! O status do seu chamado '+protocol+' foi atualizado para: '+(labels[notification.status]||notification.status)+'.\n\nAcompanhe pelo site: https://nextze.com.br/suporte/consultar/\nPor segurança, você precisará confirmar seu e-mail com um código temporário.\n\nNEXTZE — Processos inteligentes. Negócios eficientes.';
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
   const {data,error}=await db.from('support_tickets').select('id,protocol,title,status,company_name,requester_name,system_name,requested_priority,validated_priority,created_at,updated_at').order('created_at',{ascending:false}).limit(100);
   if(error)return fail();
   return answer(200,{agent:agent.display_name,tickets:data||[]},origin);
  }
  if(!id)return answer(400,{error:'Identificador do chamado inválido'},origin);
  if(action==='detail'){
   const [t,m,h]=await Promise.all([
    db.from('support_tickets').select('id,protocol,title,status,company_name,requester_name,requester_email,requester_phone,system_name,request_type,description,occurred_at,impact,attempted,requested_priority,validated_priority,created_at,updated_at').eq('id',id).maybeSingle(),
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
