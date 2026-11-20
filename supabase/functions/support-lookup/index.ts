// NEXTZE customer status lookup. A protocol alone never authorizes access.
// One-time verification code emailed to the exact requester address, Turnstile-gated.
import {createClient} from 'npm:@supabase/supabase-js@2.49.8';
const allowed=['https://nextze.com.br','https://www.nextze.com.br'];
const pattern=/^NXZ-\d{4}-\d{6}$/;
const generic='Se os dados corresponderem a um chamado, enviaremos um código ao e-mail cadastrado.';
const json=(status:number,body:unknown,origin:string)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':origin,'Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function hash(input:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
function same(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'';
 if(!allowed.includes(origin))return new Response('Forbidden',{status:403});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'content-type','Vary':'Origin'}});
 if(req.method!=='POST')return json(405,{error:'Método não permitido'},origin);
 if(Number(req.headers.get('content-length')||0)>6000)return json(413,{error:'Requisição muito grande'},origin);
 const url=Deno.env.get('SUPABASE_URL')||'',key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 const resend=Deno.env.get('RESEND_API_KEY')||'',captcha=Deno.env.get('TURNSTILE_SECRET_KEY')||'';
 const sender=Deno.env.get('SUPPORT_FROM_EMAIL')||'NEXTZE Suporte <suporte@nextze.com.br>';
 if(!url||!key||!resend||!captcha)return json(503,{error:'Consulta temporariamente indisponível'},origin);
 let body:Record<string,unknown>;
 try{body=await req.json();if(!body||typeof body!=='object'||Array.isArray(body))throw Error();}catch{return json(400,{error:'Dados inválidos'},origin);}
 const action=body.action;
 const protocol=typeof body.protocol==='string'?body.protocol.trim().toUpperCase():'';
 const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
 if(!pattern.test(protocol)||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json(400,{error:'Informe um protocolo e e-mail válidos'},origin);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const now=Date.now();
 if(action==='request'){
  const token=typeof body.turnstile_token==='string'?body.turnstile_token:'';
  if(!token||token.length>3000)return json(400,{error:'Conclua a verificação antispam'},origin);
  try{
   const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({secret:captcha,response:token,remoteip:req.headers.get('cf-connecting-ip')||''})});
   const result=await response.json();
   if(!response.ok||!result.success||!allowed.some(x=>new URL(x).hostname===result.hostname)){
    // Diagnostic data only: never log the secret or Turnstile response token.
    console.warn('support-lookup siteverify rejected',JSON.stringify({success:result.success===true,hostname:typeof result.hostname==='string'?result.hostname:null,error_codes:Array.isArray(result['error-codes'])?result['error-codes']:[],http_status:response.status}));
    return json(400,{error:'Verificação antispam inválida. Atualize a verificação e tente novamente.'},origin);
   }
  }catch{return json(503,{error:'Serviço antispam indisponível'},origin);}
  // Even successful CAPTCHA requests are throttled by anonymized remote IP hash.
  const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
  const ipHash=await hash('nextze-lookup-ip:'+ip);
  const hour=new Date(now-3600000).toISOString();
  const {count:ipCount,error:ipError}=await db.from('support_lookup_challenges').select('id',{count:'exact',head:true}).eq('request_ip_hash',ipHash).gte('created_at',hour);
  if(ipError)return json(503,{error:'Consulta indisponível'},origin);
  if((ipCount||0)>=8)return json(429,{error:'Limite temporário de consultas. Tente mais tarde.'},origin);
  const {data:ticket,error:ticketError}=await db.from('support_tickets').select('id,requester_email').eq('protocol',protocol).eq('requester_email',email).maybeSingle();
  if(ticketError)return json(503,{error:'Consulta indisponível'},origin);
  if(!ticket)return json(200,{message:generic},origin);
  const {count,error:countError}=await db.from('support_lookup_challenges').select('id',{count:'exact',head:true}).eq('ticket_id',ticket.id).gte('created_at',hour);
  if(countError)return json(503,{error:'Consulta indisponível'},origin);
  if((count||0)>=3)return json(200,{message:generic},origin);
  const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%100000000).padStart(8,'0');
  const salt=crypto.randomUUID();
  const digest=await hash(salt+':'+code);
  const {data:challenge,error:insertError}=await db.from('support_lookup_challenges').insert({ticket_id:ticket.id,email,code_hash:digest,salt,request_ip_hash:ipHash,expires_at:new Date(now+10*60000).toISOString()}).select('id').single();
  if(insertError||!challenge)return json(503,{error:'Consulta indisponível'},origin);
  try{
   const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+resend,'Content-Type':'application/json','Idempotency-Key':'nxz-lookup-'+challenge.id},body:JSON.stringify({from:sender,to:[email],subject:'NEXTZE — Código para consultar '+protocol,text:'Seu código de consulta é '+code+'. Válido por 10 minutos. Se você não solicitou, ignore este e-mail. Nunca compartilhe este código.',reply_to:'suporte@nextze.com.br'})});
   if(!sent.ok){await db.from('support_lookup_challenges').delete().eq('id',challenge.id);return json(503,{error:'Não foi possível enviar o código. Tente novamente mais tarde.'},origin);}
  }catch{await db.from('support_lookup_challenges').delete().eq('id',challenge.id);return json(503,{error:'Serviço de e-mail indisponível'},origin);}
  return json(200,{message:generic},origin);
 }
 if(action==='verify'){
  const code=typeof body.code==='string'?body.code.trim():'';
  if(!/^\d{8}$/.test(code))return json(400,{error:'Código inválido'},origin);
  const {data:ticket,error:ticketError}=await db.from('support_tickets').select('id,protocol,title,status,requested_priority,validated_priority,created_at,updated_at').eq('protocol',protocol).eq('requester_email',email).maybeSingle();
  if(ticketError)return json(503,{error:'Consulta indisponível'},origin);
  if(!ticket)return json(403,{error:'Código inválido ou expirado'},origin);
  const {data:challenge,error:challengeError}=await db.from('support_lookup_challenges').select('id,code_hash,salt,attempts,expires_at,consumed_at').eq('ticket_id',ticket.id).eq('email',email).is('consumed_at',null).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(challengeError)return json(503,{error:'Consulta indisponível'},origin);
  if(!challenge||challenge.attempts>=5)return json(403,{error:'Código inválido ou expirado'},origin);
  // Atomic attempt increment prevents parallel guesses from bypassing retry quota.
  const {data:reserved,error:reserveError}=await db.from('support_lookup_challenges').update({attempts:challenge.attempts+1}).eq('id',challenge.id).eq('attempts',challenge.attempts).eq('consumed_at',null).lt('attempts',5).select('id');
  if(reserveError||!reserved?.length)return json(403,{error:'Código inválido ou expirado'},origin);
  const expected=await hash(challenge.salt+':'+code);
  if(!same(expected,challenge.code_hash))return json(403,{error:'Código inválido ou expirado'},origin);
  const {data:used,error:consumeError}=await db.from('support_lookup_challenges').update({consumed_at:new Date().toISOString()}).eq('id',challenge.id).is('consumed_at',null).select('id');
  if(consumeError||!used?.length)return json(403,{error:'Código inválido ou expirado'},origin);
  const {data:events,error:eventsError}=await db.from('support_history').select('status,public_message,created_at').eq('ticket_id',ticket.id).order('created_at',{ascending:false}).limit(30);
  if(eventsError)return json(503,{error:'Consulta indisponível'},origin);
  return json(200,{ticket:{protocol:ticket.protocol,title:ticket.title,status:ticket.status,priority:ticket.validated_priority||ticket.requested_priority,created_at:ticket.created_at,updated_at:ticket.updated_at},history:(events||[]).map(e=>({status:e.status,date:e.created_at,message:e.public_message||null}))},origin);
 }
 return json(400,{error:'Operação inválida'},origin);
});
