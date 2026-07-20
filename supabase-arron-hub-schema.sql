create table if not exists public.hub_state (
  hub text primary key,
  state_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.hub_state enable row level security;

drop policy if exists "hub_state_select_anon" on public.hub_state;
create policy "hub_state_select_anon"
on public.hub_state
for select
to anon
using (true);

drop policy if exists "hub_state_insert_anon" on public.hub_state;
create policy "hub_state_insert_anon"
on public.hub_state
for insert
to anon
with check (true);

drop policy if exists "hub_state_update_anon" on public.hub_state;
create policy "hub_state_update_anon"
on public.hub_state
for update
to anon
using (true)
with check (true);

insert into public.hub_state (hub, state_json)
values ('arron', '{}'::jsonb)
on conflict (hub) do nothing;
