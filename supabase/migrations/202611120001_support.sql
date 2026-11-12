-- NEXTZE Support: execute in Supabase after review, not automatically.
create extension if not exists pgcrypto;
create sequence if not exists public.nextze_ticket_seq start 1;
create table if not exists public.support_companies(
 id uuid primary key default gen_random_uuid(), name text not null unique,
 created_at timestamptz not null default now()
);
create table if not exists public.support_systems(
 id uuid primary key default gen_random_uuid(), company_id uuid references public.support_companies(id),
 name text not null, version text, active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.support_kb(
 id uuid primary key default gen_random_uuid(),
 code text not null unique, title text not null, system_id uuid references public.support_systems(id),
 category text not null, symptoms text, instructions text not null,
 visibility text not null default 'private' check(visibility in ('public','private')),
 version text, updated_at timestamptz not null default now()
);
create table if not exists public.support_tickets(
 id uuid primary key default gen_random_uuid(),
 number bigint not null unique default nextval('public.nextze_ticket_seq'),
 protocol text generated always as ('NXZ-'||extract(year from created_at at time zone 'UTC')::int::text||'-'||lpad(number::text,6,'0')) stored,
 company_name text not null, requester_name text not null,
 requester_email text not null, requester_phone text not null,
 system_name text not null, request_type text not null,
 title text not null, description text not null,
 occurred_at timestamptz not null,
 impact text not null, attempted text,
 requested_priority text not null check(requested_priority in ('normal','urgente')),
 validated_priority text check(validated_priority in ('normal','urgente')),
 status text not null default 'aberto' check(status in ('aberto','em_triagem','aguardando_informacoes','em_analise','em_correcao','aguardando_validacao','resolvido','encerrado')),
 classification text check(classification in ('garantia','suporte_contratado','melhoria')),
 assigned_to uuid, minutes_spent int not null default 0 check(minutes_spent >= 0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(protocol)
);
create table if not exists public.support_attachments(
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 storage_path text not null unique, original_name text not null,
 mime_type text not null, file_size integer not null check(file_size > 0 and file_size <= 5242880),
 created_at timestamptz not null default now()
);
create table if not exists public.support_history(
 id bigint generated always as identity primary key,
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 status text not null, actor text not null,
 public_message text, internal_note text,
 created_at timestamptz not null default now()
);
create table if not exists public.support_messages(
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 actor text not null, message text not null,
 is_internal boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.support_agents(
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null, active boolean not null default true
);
create table if not exists public.support_sla(
 id uuid primary key default gen_random_uuid(),
 company_id uuid references public.support_companies(id),
 priority text not null check(priority in ('normal','urgente')),
 response_business_days integer not null check(response_business_days >= 0),
 timezone text not null default 'America/Sao_Paulo',
 weekdays integer[] not null default array[1,2,3,4,5],
 start_time time, end_time time, holidays date[] not null default array[]::date[],
 notes text, created_at timestamptz not null default now()
);
create unique index if not exists support_tickets_protocol_idx on public.support_tickets(protocol);
create index if not exists support_tickets_email_time_idx on public.support_tickets(requester_email,created_at);
create index if not exists support_history_ticket_idx on public.support_history(ticket_id,created_at);
create index if not exists support_attachments_ticket_idx on public.support_attachments(ticket_id);
create or replace function public.nextze_ticket_initial_history() returns trigger
language plpgsql security definer set search_path = public as $$
begin
 insert into public.support_history(ticket_id,status,actor,public_message)
 values(new.id,new.status,'sistema','Solicitação recebida');
 return new;
end; $$;
drop trigger if exists support_ticket_insert_history on public.support_tickets;
create trigger support_ticket_insert_history after insert on public.support_tickets
for each row execute function public.nextze_ticket_initial_history();
-- All tables default DENY for anon/authenticated clients.
alter table public.support_companies enable row level security;
alter table public.support_systems enable row level security;
alter table public.support_kb enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_attachments enable row level security;
alter table public.support_history enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_agents enable row level security;
alter table public.support_sla enable row level security;
revoke all on all tables in schema public from anon, authenticated;
revoke all on sequence public.nextze_ticket_seq from anon, authenticated;
-- Private storage bucket; server-side service role only. No public URL.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('nextze-support','nextze-support',false,5242880,array['image/jpeg','image/png','application/pdf','text/plain'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
