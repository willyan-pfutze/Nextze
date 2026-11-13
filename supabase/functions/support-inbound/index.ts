// NEXTZE — signed Resend inbound webhook. Untrusted emails are NEVER commands.
// Activation requires RESEND_WEBHOOK_SECRET, RESEND_API_KEY and SUPPORT_INBOUND_ENABLED=true.
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const PROJECT_DOMAIN = 'suporte@nextze.com.br';
const maxWebhookBytes = 32768;
const maxTextChars = 12000;
const replyPattern = /\bNXZ-\d{4}-\d{6}\b/i;
const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
function out(status:number,body='OK') {
  return new Response(body,{status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
function decodeSecret(secret:string):Uint8Array {
  const value=secret.startsWith('whsec_')?secret.slice(6):secret;
  const binary=atob(value.replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
function decodeSignature(encoded:string):Uint8Array {
  return Uint8Array.from(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
}
function constantTimeEqual(a:Uint8Array,b:Uint8Array):boolean{
  if(a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
async function validSignature(body:string,req:Request,secret:string):Promise<boolean>{
  const id=req.headers.get('svix-id'),timestamp=req.headers.get('svix-timestamp'),header=req.headers.get('svix-signature');
  if(!id||!timestamp||!header||id.length>256||!/^[0-9]{10,13}$/.test(timestamp))return false;
  const t=Number(timestamp);
  if(!Number.isFinite(t)||Math.abs(Date.now()/1000-t)>300)return false;
  const key=await crypto.subtle.importKey('raw',decodeSecret(secret),'HMAC',false,['sign']);
  const signed=new TextEncoder().encode(id+'.'+timestamp+'.'+body);
  const expected=new Uint8Array(await crypto.subtle.sign('HMAC',key,signed));
  return header.split(' ').some(candidate=>{
    if(!candidate.startsWith('v1,'))return false;
    try{return constantTimeEqual(decodeSignature(candidate.slice(3)),expected);}catch{return false;}
  });
}
function address(s:unknown):string{
  if(typeof s!=='string')return '';
  const m=/<([^<>]+)>/.exec(s);
  const value=(m?m[1]:s).trim().toLowerCase();
  return emailPattern.test(value)?value:'';
}
function recipientMatch(to:unknown):boolean{
  return Array.isArray(to)&&to.some(item=>address(item)===PROJECT_DOMAIN);
}
function ticketNumber(subject:unknown):string{
  if(typeof subject!=='string'||subject.length>500)return '';
  return subject.match(replyPattern)?.[0].toUpperCase()||'';
}
Deno.serve(async (req:Request)=>{
  if(req.method!=='POST')return out(405,'Method Not Allowed');
  const enabled=Deno.env.get('SUPPORT_INBOUND_ENABLED')==='true';
  const webhookSecret=Deno.env.get('RESEND_WEBHOOK_SECRET')||'';
  const resendKey=Deno.env.get('RESEND_API_KEY')||'';
  const supaUrl=Deno.env.get('SUPABASE_URL')||'';
  const supaKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  if(!enabled||!webhookSecret||!resendKey||!supaUrl||!supaKey)return out(503,'Not configured');
  if(Number(req.headers.get('content-length')||0)>maxWebhookBytes)return out(413,'Too large');
  let raw:string;
  try{raw=await req.text();if(new TextEncoder().encode(raw).length>maxWebhookBytes)return out(413,'Too large');}
  catch{return out(400,'Bad request');}
  let verified=false;
  try{verified=await validSignature(raw,req,webhookSecret);}catch{return out(401,'Invalid signature');}
  if(!verified)return out(401,'Invalid signature');
  let event:any;
  try{event=JSON.parse(raw);}catch{return out(400,'Invalid JSON');}
  if(event?.type!=='email.received')return out(200);
  const id=event?.data?.email_id;
  if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))return out(200);
  // Unmatched, unknown, or unsolicited mail stays in Resend's receiving inbox.
  if(!recipientMatch(event?.data?.to))return out(200);
  const protocol=ticketNumber(event?.data?.subject);
  if(!protocol)return out(200);
  const db=createClient(supaUrl,supaKey,{auth:{persistSession:false}});
  try{
    const {data:existing,error:existingError}=await db.from('support_messages').select('id').eq('source_email_id',id).maybeSingle();
    if(existingError)throw existingError;
    if(existing)return out(200);
    const {data:ticket,error:ticketError}=await db.from('support_tickets')
      .select('id,protocol,requester_email,created_at').eq('protocol',protocol).maybeSingle();
    if(ticketError)throw ticketError;
    if(!ticket)return out(200);
    // Only accept email from original requester, with exact recipient and protocol.
    // Sender headers can be spoofed: record as untrusted, pending staff review.
    const sender=address(event?.data?.from);
    if(!sender||sender!==ticket.requester_email.toLowerCase())return out(200);
    const detail=await fetch('https://api.resend.com/emails/receiving/'+encodeURIComponent(id),{
      headers:{Authorization:'Bearer '+resendKey,'Accept':'application/json'},
    });
    if(!detail.ok){if(detail.status===404)return out(200);return out(503,'Unavailable');}
    const email=await detail.json();
    if(!recipientMatch(email.to)||address(email.from)!==sender)return out(200);
    const detailedProtocol=ticketNumber(email.subject);
    if(detailedProtocol!==protocol)return out(200);
    const text=typeof email.text==='string'?email.text.replace(/\u0000/g,'').trim():'';
    if(!text)return out(200); // HTML-only and attachments are held for manual review in Resend.
    const body=text.slice(0,maxTextChars);
    const {count,error:limitError}=await db.from('support_messages')
      .select('id',{count:'exact',head:true}).eq('ticket_id',ticket.id)
      .gte('created_at',new Date(Date.now()-86400000).toISOString())
      .not('source_email_id','is',null);
    if(limitError)throw limitError;
    if((count||0)>=30)return out(200);
    const {error:insertError}=await db.from('support_messages').insert({
      ticket_id:ticket.id,actor:'cliente_email_pendente',
      message:body,is_internal:true,source_email_id:id,moderation_status:'pending_review'
    });
    if(insertError&&insertError.code!=='23505')throw insertError;
    return out(200);
  }catch(err){
    console.error('Inbound support message processing failed',err instanceof Error?err.name:'error');
    return out(503,'Unavailable'); // Resend retries on transient failure.
  }
});
