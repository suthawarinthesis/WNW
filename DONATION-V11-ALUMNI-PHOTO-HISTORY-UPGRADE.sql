-- WNW Donation V11 upgrade
-- Run this WHOLE file once after Donation V7/V8/V9/V10 is already installed.
-- Adds: donor photo URL, alumni flag/batch, and history RPC v2.
BEGIN;

-- ------------------------------------------------------------
-- V11: donor photo link + alumni flag + richer donor history
-- ------------------------------------------------------------
alter table public.donations
  add column if not exists photo_url text not null default '',
  add column if not exists is_alumni boolean not null default false,
  add column if not exists alumni_batch text not null default '';

create index if not exists donations_alumni_idx
  on public.donations (is_alumni, alumni_batch, submitted_at desc);

drop function if exists public.set_donation_profile_extras(uuid, uuid, boolean, text, text);
create function public.set_donation_profile_extras(
  p_id uuid,
  p_upload_token uuid,
  p_is_alumni boolean default false,
  p_alumni_batch text default '',
  p_photo_url text default ''
)
returns boolean
language sql
security definer
set search_path = public
begin atomic
  with changed as (
    update public.donations d
    set
      is_alumni = coalesce(p_is_alumni, false),
      alumni_batch = case
        when coalesce(p_is_alumni, false) then btrim(coalesce(p_alumni_batch, ''))
        else ''
      end,
      photo_url = btrim(coalesce(p_photo_url, '')),
      updated_at = now()
    where d.id = p_id
      and d.upload_token = p_upload_token
      and d.submission_state = 'uploading'
      and (
        not coalesce(p_is_alumni, false)
        or (
          btrim(coalesce(p_alumni_batch, '')) ~ '^[0-9]{1,2}$'
          and btrim(coalesce(p_alumni_batch, ''))::integer between 1 and 50
        )
      )
      and (
        btrim(coalesce(p_photo_url, '')) = ''
        or btrim(coalesce(p_photo_url, '')) ~* '^https?://'
      )
    returning 1
  )
  select exists(select 1 from changed);
end;

revoke all on function public.set_donation_profile_extras(uuid, uuid, boolean, text, text) from public;
grant execute on function public.set_donation_profile_extras(uuid, uuid, boolean, text, text) to anon, authenticated;

drop function if exists public.get_donation_history_v2(text);
create function public.get_donation_history_v2(p_history_code text)
returns table(
  request_no text,
  display_name text,
  amount numeric,
  transfer_date date,
  transfer_time time,
  status text,
  certificate_no text,
  certificate_issued_at timestamptz,
  certificate_pdf_url text,
  certificate_generation_status text,
  admin_note text,
  photo_url text,
  is_alumni boolean,
  alumni_batch text
)
language sql
stable
security definer
set search_path = public
begin atomic
  select
    d.request_no,
    coalesce(nullif(d.certificate_name_override, ''), d.display_name) as display_name,
    d.amount,
    d.transfer_date,
    d.transfer_time,
    d.status,
    d.certificate_no,
    d.certificate_issued_at,
    case when d.status = 'verified' then d.certificate_pdf_url else '' end as certificate_pdf_url,
    case when d.status = 'verified' then d.certificate_generation_status else 'not_generated' end as certificate_generation_status,
    case when d.status = 'rejected' then d.admin_note else '' end as admin_note,
    d.photo_url,
    d.is_alumni,
    d.alumni_batch
  from public.donations d
  where d.history_code = upper(btrim(p_history_code))
    and d.submission_state = 'submitted'
  order by d.submitted_at desc
  limit 100;
end;

revoke all on function public.get_donation_history_v2(text) from public;
grant execute on function public.get_donation_history_v2(text) to anon, authenticated;

COMMIT;
