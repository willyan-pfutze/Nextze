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
   return answer(200,{ticket:t.data,messages:m.data||[],history:h.data||[]},origin);
  }
  if(action==='status'){
   const status=body.status;
   if(typeof status!=='string'||!statuses.includes(status))return answer(400,{error:'Status inválido'},origin);
   const {data:before,error:beforeError}=await db.from('support_tickets').select('status').eq('id',id).maybeSingle();
   if(beforeError)return fail();if(!before)return answer(404,{error:'Chamado não encontrado'},origin);
   if(before.status===status)return answer(200,{ok:true},origin);
   const {error}=await db.from('support_tickets').update({status,updated_at:new Date().toISOString()}).eq('id',id);
   if(error)return fail();
   const {error:auditError}=await db.from('support_history').insert({ticket_id:id,status,actor:agent.display_name,internal_note:'Status alterado de '+before.status+' para '+status});
   if(auditError){console.error('Status audit insert failed');return fail();}
   return answer(200,{ok:true},origin);
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
