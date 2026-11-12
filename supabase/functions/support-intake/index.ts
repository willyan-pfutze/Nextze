// Deploy only after Supabase, Turnstile and Resend credentials are configured.
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const allowed = (Deno.env.get('SUPPORT_ALLOWED_ORIGINS') || 'https://nextze.com.br,https://www.nextze.com.br').split(',').map(s=>s.trim());
const maxFile = 5 * 1024 * 1024;
const maxTotal = 12 * 1024 * 1024;
const accepted = new Set(['image/jpeg','image/png','application/pdf','text/plain']);
const types = new Set(['Erro ou falha','Dúvida operacional','Problema de acesso','Solicitação de melhoria','Outro']);
const impacts = new Set(['Baixo — operação continua','Médio — parte da operação afetada','Alto — processo essencial indisponível']);
function response(data:unknown,status:number,origin:string){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':origin,'Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
function str(x:FormDataEntryValue|null,max:number,required=false){const s=typeof x==='string'?x.trim():'';if((required&&!s)||s.length>max)throw Error('Confira os campos obrigatórios e os limites de texto.');return s;}
function fileMatches(bytes:Uint8Array,mime:string):boolean{
 if(mime==='application/pdf')return bytes.length>5&&bytes[0]===37&&bytes[1]===80&&bytes[2]===68&&bytes[3]===70&&bytes[4]===45;
 if(mime==='image/png')return bytes.length>8&&[137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x);
 if(mime==='image/jpeg')return bytes.length>4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(mime==='text/plain')return !bytes.some(b=>b===0);
 return false;
}
function escapeHtml(value:string){return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));}
Deno.serve(async(req)=>{
 const origin=req.headers.get('origin')||'';
 if(!allowed.includes(origin))return new Response('Origem não permitida',{status:403});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'content-type','Access-Control-Max-Age':'3600','Vary':'Origin'}});
 if(req.method!=='POST')return response({error:'Método não permitido'},405,origin);
 const url=Deno.env.get('SUPABASE_URL'), key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), captchaSecret=Deno.env.get('TURNSTILE_SECRET_KEY');
 if(!url||!key||!captchaSecret)return response({error:'Atendimento digital indisponível no momento.'},503,origin);
 if(Number(req.headers.get('content-length')||0)>15*1024*1024)return response({error:'Tamanho total excedido.'},413,origin);
 let ticketId:string|undefined;const stored:string[]=[];
 const db=createClient(url,key,{auth:{persistSession:false}});
 try{
  const form=await req.formData();
  const token=str(form.get('turnstile_token'),3000,true);
  const verify=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({secret:captchaSecret,response:token,remoteip:req.headers.get('cf-connecting-ip')||''})});
  const verdict=await verify.json();
  if(!verify.ok||verdict.success!==true||!allowed.some(o=>new URL(o).hostname===verdict.hostname))return response({error:'Verificação antispam inválida. Atualize a página e tente novamente.'},400,origin);
  if(str(form.get('privacy'),5,true)!=='true')return response({error:'Confirme as informações de privacidade.'},400,origin);
  const company=str(form.get('company'),120,true),requester=str(form.get('requester'),120,true);
  const email=str(form.get('email'),254,true).toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Informe um e-mail válido.');
  const phone=str(form.get('phone'),30,true),system=str(form.get('system'),120,true);
  const type=str(form.get('type'),80,true),title=str(form.get('title'),160,true);
  const description=str(form.get('description'),6000,true),impact=str(form.get('impact'),100,true);
  const attempted=str(form.get('attempted'),3000);
  const priority=str(form.get('priority'),10,true);
  const occurred=str(form.get('occurred_at'),40,true);
  if(!types.has(type)||!impacts.has(impact)||!['normal','urgente'].includes(priority))throw Error('Seleção inválida.');
  const dt=new Date(occurred);
  if(Number.isNaN(dt.getTime())||dt.getTime()>Date.now()+86400000)throw Error('Data da ocorrência inválida.');
  const uploads=form.getAll('evidences').filter(x=>x instanceof File) as File[];
  if(uploads.length>3||uploads.reduce((n,f)=>n+f.size,0)>maxTotal)throw Error('Limite de 3 anexos ou 12 MB excedido.');
  const verified:{file:File;bytes:Uint8Array;mime:string}[]=[];
  for(const file of uploads){
   if(!file.size||file.size>maxFile||!accepted.has(file.type))throw Error('Anexo não permitido. Use JPG, PNG, PDF ou TXT de até 5 MB.');
   const bytes=new Uint8Array(await file.arrayBuffer());
   if(!fileMatches(bytes,file.type))throw Error('O conteúdo de um anexo não corresponde ao tipo informado.');
   verified.push({file,bytes,mime:file.type});
  }
  // Throttle by verified email (all access happens with server-side service role).
  const hour=new Date(Date.now()-3600000).toISOString();
  const {count,error:countError}=await db.from('support_tickets').select('id',{count:'exact',head:true}).eq('requester_email',email).gte('created_at',hour);
  if(countError)throw Error('Serviço temporariamente indisponível.');
  if((count||0)>=3)return response({error:'Limite temporário de solicitações atingido. Utilize o suporte previsto no seu contrato.'},429,origin);
  const {data:ticket,error:insertError}=await db.from('support_tickets').insert({
   company_name:company,requester_name:requester,requester_email:email,requester_phone:phone,system_name:system,
   request_type:type,title,description,occurred_at:dt.toISOString(),impact,attempted,requested_priority:priority
  }).select('id,protocol,created_at').single();
  if(insertError||!ticket)throw Error('Não foi possível registrar a solicitação.');
  ticketId=ticket.id;
  for(const {file,bytes,mime} of verified){
   const ext=({'image/jpeg':'jpg','image/png':'png','application/pdf':'pdf','text/plain':'txt'} as Record<string,string>)[mime];
   const path=ticketId+'/'+crypto.randomUUID()+'.'+ext;
   const {error:uploadError}=await db.storage.from('nextze-support').upload(path,bytes,{contentType:mime,upsert:false,cacheControl:'0'});
   if(uploadError)throw Error('Falha ao armazenar anexos.');
   stored.push(path);
   const {error:metaError}=await db.from('support_attachments').insert({ticket_id:ticketId,storage_path:path,original_name:file.name.slice(0,180),mime_type:mime,file_size:file.size});
   if(metaError)throw Error('Falha ao registrar evidência.');
  }
  let emailSent=false;
  const resend=Deno.env.get('RESEND_API_KEY');
  const sender=Deno.env.get('SUPPORT_FROM_EMAIL');
  if(resend&&sender){
   try{
    const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+resend,'Content-Type':'application/json'},body:JSON.stringify({
     from:sender,to:[email],subject:'NEXTZE — Solicitação recebida: '+ticket.protocol,
     html:'<div style="font-family:Arial,sans-serif;background:#0B1B3C;color:#fff;padding:32px"><h1 style="color:#00D6A3">NEXTZE</h1><p>Recebemos sua solicitação.</p><p><strong>Protocolo: '+escapeHtml(ticket.protocol)+'</strong></p><p>Assunto: '+escapeHtml(title)+'</p><p>Prioridade solicitada: '+escapeHtml(priority)+'</p><p>Primeira resposta conforme os prazos e janelas de atendimento previstos em contrato. Este e-mail não confirma atendimento imediato.</p></div>'
    })});
    emailSent=r.ok;
   }catch{emailSent=false;}
  }
  return response({protocol:ticket.protocol,created_at:ticket.created_at,email_sent:emailSent},201,origin);
 }catch(e){
  // No success response if any storage/database operation fails. Best effort cleanup.
  if(ticketId){for(const path of stored)await db.storage.from('nextze-support').remove([path]);await db.from('support_tickets').delete().eq('id',ticketId);}
  const msg=e instanceof Error?e.message:'Erro ao registrar solicitação.';
  const safe=['Confira os campos obrigatórios e os limites de texto.','Informe um e-mail válido.','Seleção inválida.','Data da ocorrência inválida.','Limite de 3 anexos ou 12 MB excedido.','Anexo não permitido. Use JPG, PNG, PDF ou TXT de até 5 MB.','O conteúdo de um anexo não corresponde ao tipo informado.'].includes(msg)?msg:'Não foi possível concluir o registro com segurança. Tente novamente mais tarde.';
  return response({error:safe},400,origin);
 }
});
