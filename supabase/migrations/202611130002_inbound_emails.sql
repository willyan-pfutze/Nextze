-- NEXTZE inbound email: no access from frontend, idempotent storage, human review required.
alter table public.support_messages
  add column if not exists source_email_id text,
  add column if not exists moderation_status text not null default 'approved'
    check (moderation_status in ('pending_review', 'approved', 'rejected'));
create unique index if not exists support_messages_source_email_unique
  on public.support_messages(source_email_id) where source_email_id is not null;
create index if not exists support_messages_ticket_created_idx
  on public.support_messages(ticket_id,created_at);
create index if not exists support_messages_moderation_idx
  on public.support_messages(moderation_status,created_at);
-- RLS already enabled. Do not expose messages, notes or inbound mail to public clients.
revoke all on public.support_messages from anon, authenticated;
