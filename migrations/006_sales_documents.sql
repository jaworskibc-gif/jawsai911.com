-- Team-only documents and reusable outreach templates.
create table public.hub_sales_documents (
 id uuid primary key,
 client_id text not null,
 lead_id uuid references public.crm_leads(id) on delete set null,
 kind text not null check(kind in ('invoice','estimate','proposal','receipt','sales_order','purchase_order')),
 number text not null unique,
 payload jsonb not null,
 revision integer not null default 1,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index hub_sales_documents_client on public.hub_sales_documents(client_id,updated_at desc);
create index hub_sales_documents_lead on public.hub_sales_documents(lead_id);
alter table public.hub_sales_documents enable row level security;
revoke all on public.hub_sales_documents from public,anon,authenticated;
grant select on public.hub_sales_documents to authenticated;
create policy team_document_read on public.hub_sales_documents for select to authenticated using ((select public.hub_is_team_member()));
create table public.hub_message_templates (
 id uuid primary key,
 name text not null check(length(trim(name)) between 1 and 120),
 channel text not null check(channel in ('email','sms')),
 subject text not null default '',
 body text not null check(length(trim(body)) between 1 and 10000),
 updated_at timestamptz not null default now()
);
alter table public.hub_message_templates enable row level security;
revoke all on public.hub_message_templates from public,anon,authenticated;
grant select,insert,update on public.hub_message_templates to authenticated;
create policy team_template_access on public.hub_message_templates for all to authenticated using ((select public.hub_is_team_member())) with check ((select public.hub_is_team_member()));
create function public.hub_save_sales_document(p_id uuid,p_revision integer,p_client_id text,p_lead_id uuid,p_kind text,p_payload jsonb)
returns public.hub_sales_documents language plpgsql security definer set search_path='' as $$
declare item jsonb; qty numeric; price numeric; subtotal numeric:=0; tax numeric; total numeric; prior public.hub_sales_documents; saved public.hub_sales_documents;
begin
 if auth.uid() is null or not public.hub_is_team_member() then raise exception 'Approved team sign-in required' using errcode='42501';end if;
 if not exists(select 1 from public.clients where id::text=p_client_id) then raise exception 'Choose an existing business';end if;
 if p_lead_id is not null and not exists(select 1 from public.crm_leads where id=p_lead_id and client_id=p_client_id) then raise exception 'Lead does not belong to this business';end if;
 if p_kind not in ('invoice','estimate','proposal','receipt','sales_order','purchase_order') then raise exception 'Invalid document type';end if;
 if length(trim(coalesce(p_payload->>'customer',''))) not between 1 and 200 then raise exception 'Customer or supplier name is required';end if;
 if jsonb_typeof(p_payload->'items') is distinct from 'array' or jsonb_array_length(p_payload->'items') not between 1 and 100 then raise exception 'Add 1 to 100 line items';end if;
 for item in select value from jsonb_array_elements(p_payload->'items') loop
  if length(trim(coalesce(item->>'description',''))) not between 1 and 500 then raise exception 'Every line needs a description';end if;
  qty:=(item->>'qty')::numeric;price:=(item->>'price')::numeric;
  if qty is null or price is null or qty<=0 or qty>1000000 or price<0 or price>100000000 then raise exception 'Invalid quantity or price';end if;
  subtotal:=subtotal+round(qty*price,2);
 end loop;
 tax:=(p_payload->>'tax')::numeric;
 if tax is null or tax<0 or tax>100 then raise exception 'Tax must be between 0 and 100';end if;
 if coalesce(p_payload->>'status','') not in ('draft','issued','paid','void') then raise exception 'Invalid status';end if;
 if p_kind='receipt' and ((p_payload->>'amountPaid')::numeric is null or (p_payload->>'amountPaid')::numeric<=0 or coalesce(trim(p_payload->>'paymentMethod'),'')='') then raise exception 'A receipt needs an amount received and payment method';end if;
 perform (p_payload->>'date')::date;
 if nullif(p_payload->>'date','') is null then raise exception 'Document date required';end if;
 total:=subtotal+round(subtotal*tax/100,2);
 if p_kind='receipt' and (p_payload->>'amountPaid')::numeric>total then raise exception 'Amount received cannot exceed the document total';end if;
 p_payload:=p_payload||jsonb_build_object('subtotal',subtotal,'total',total);
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into prior from public.hub_sales_documents where id=p_id for update;
 if found then
  if prior.client_id<>p_client_id then raise exception 'Cannot move a document to another business';end if;
  if prior.payload=p_payload and prior.kind=p_kind and prior.lead_id is not distinct from p_lead_id then return prior;end if;
  if prior.revision<>p_revision then raise exception 'This document changed in another session. Reopen it before saving.';end if;
  update public.hub_sales_documents set kind=p_kind,lead_id=p_lead_id,payload=p_payload,revision=revision+1,updated_at=now() where id=p_id returning * into saved;
 else
  if p_revision<>0 then raise exception 'Document no longer exists';end if;
  insert into public.hub_sales_documents(id,client_id,lead_id,kind,number,payload,created_by)
  values(p_id,p_client_id,p_lead_id,p_kind,upper(replace(p_kind,'_','-'))||'-'||upper(right(replace(p_id::text,'-',''),12)),p_payload,auth.uid()) returning * into saved;
 end if;
 return saved;
end $$;
revoke all on function public.hub_save_sales_document(uuid,integer,text,uuid,text,jsonb) from public,anon;
grant execute on function public.hub_save_sales_document(uuid,integer,text,uuid,text,jsonb) to authenticated;
