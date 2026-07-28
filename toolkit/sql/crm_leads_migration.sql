-- ============================================================
-- JAWSAI911 CRM Source-of-Truth Migration
-- ============================================================

create extension if not exists pgcrypto;

-- 1. Main leads table
create table if not exists crm_leads (
  id uuid primary key default gen_random_uuid(),

  full_name text not null,
  phone text,
  email text,
  company text,
  city text,
  state text default 'FL',

  status text not null default 'new'
    check (status in (
      'new', 'contacted', 'warm', 'booked',
      'showed', 'closed_won', 'closed_lost', 'nurture'
    )),

  source text,
  assigned_to text,
  client_id text,

  last_call_at timestamptz,
  last_call_outcome text,
  call_attempts integer default 0,
  next_follow_up_at timestamptz,

  notes text,
  tags text[] default '{}',
  custom_fields jsonb default '{}',

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Call log
create table if not exists crm_calls (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references crm_leads(id) on delete cascade,
  outcome text not null,
  notes text,
  duration_seconds integer,
  called_at timestamptz default now(),
  called_by text
);

-- 3. Tasks / follow-ups
create table if not exists crm_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references crm_leads(id) on delete cascade,
  title text not null,
  due_at timestamptz,
  status text default 'open' check (status in ('open', 'done', 'skipped')),
  task_type text default 'call',
  created_at timestamptz default now()
);

-- 4. Portal approval / response audit trail
create table if not exists crm_portal_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references crm_leads(id) on delete set null,
  invoice_id uuid,
  client_id text,
  event_type text not null,
  actor_name text,
  actor_title text,
  notes text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- 5. Indexes
create index if not exists idx_crm_leads_status on crm_leads(status);
create index if not exists idx_crm_leads_phone on crm_leads(phone);
create index if not exists idx_crm_leads_next_follow_up on crm_leads(next_follow_up_at);
create index if not exists idx_crm_leads_assigned on crm_leads(assigned_to);
create index if not exists idx_crm_leads_client_id on crm_leads(client_id);
create index if not exists idx_crm_calls_lead on crm_calls(lead_id);
create index if not exists idx_crm_tasks_lead on crm_tasks(lead_id);
create index if not exists idx_crm_tasks_due on crm_tasks(due_at) where status = 'open';
create index if not exists idx_crm_portal_events_lead on crm_portal_events(lead_id);
create index if not exists idx_crm_portal_events_invoice on crm_portal_events(invoice_id);
create index if not exists idx_crm_portal_events_client on crm_portal_events(client_id);
create index if not exists idx_crm_portal_events_created on crm_portal_events(created_at desc);

-- 6. Auto-update updated_at
create or replace function update_crm_leads_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_crm_leads_updated_at on crm_leads;
create trigger trg_crm_leads_updated_at
  before update on crm_leads
  for each row execute function update_crm_leads_updated_at();

-- Run toolkit/scripts/migrate_to_crm_leads.py after these tables exist.
