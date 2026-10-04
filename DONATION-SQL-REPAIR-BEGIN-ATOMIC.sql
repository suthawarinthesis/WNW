-- ============================================================
-- WNW Donation System - SQL REPAIR (BEGIN ATOMIC)
-- Fixes: unterminated quoted string / dollar-quoted function body
-- Safe to run more than once.
-- Requires PostgreSQL 14+ (Supabase supports modern PostgreSQL).
-- ============================================================

-- 1) Ensure the single settings row exists.
insert into public.donation_settings (id)
values (1)
on conflict (id) do nothing;

-- 2) Google Slides / Apps Script settings.
alter table public.donation_settings
  add column if not exists certificate_provider text not null default 'google_slides';

alter table public.donation_settings
  add column if not exists google_apps_script_url text not null default '';

alter table public.donation_settings
  add column if not exists google_slides_template_id text not null default '';

alter table public.donation_settings
  add column if not exists google_drive_folder_id text not null default '';

update public.donation_settings
set certificate_provider = 'google_slides',
    google_apps_script_url = 'https://script.google.com/macros/s/AKfycby2RD2z8dMwB3Ajp0JPCPHN_rKFIL1M5IckIN4VyUMG2yNAV_2gW4kWaGjx-49CXECJ4A/exec',
    google_slides_template_id = '1N0OEEhnCdfqn5ohtZa47pUfenVYizdePtXo9vGsVGy4',
    google_drive_folder_id = '1JUTSXLLdR7X5KiV6KINe6Nk85DS-YdYk',
    updated_at = now()
where id = 1;

-- 3) Generated certificate metadata.
alter table public.donations
  add column if not exists certificate_pdf_url text not null default '';

alter table public.donations
  add column if not exists certificate_drive_file_id text not null default '';

alter table public.donations
  add column if not exists certificate_generated_at timestamptz;

alter table public.donations
  add column if not exists certificate_generation_status text not null default 'not_generated';

alter table public.donations
  add column if not exists certificate_generation_error text not null default '';

create index if not exists donations_certificate_generation_idx
  on public.donations (certificate_generation_status, certificate_generated_at desc);

-- ============================================================
-- 4) Donor history RPC
-- IMPORTANT: SQL-standard BEGIN ATOMIC body; no quoted function body.
-- ============================================================
drop function if exists public.get_donation_history(text);

create function public.get_donation_history(p_history_code text)
returns table (
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
  admin_note text
)
language sql
security definer
stable
set search_path = public
begin atomic
  select
    d.request_no,
    coalesce(nullif(d.certificate_name_override, ''), d.display_name),
    d.amount,
    d.transfer_date,
    d.transfer_time,
    d.status,
    d.certificate_no,
    d.certificate_issued_at,
    case
      when d.status = 'verified' then coalesce(d.certificate_pdf_url, '')
      else ''
    end,
    case
      when d.status = 'verified' then coalesce(d.certificate_generation_status, 'not_generated')
      else 'not_generated'
    end,
    case
      when d.status = 'rejected' then coalesce(d.admin_note, '')
      else ''
    end
  from public.donations as d
  where d.history_code = upper(btrim(p_history_code))
    and d.submission_state = 'submitted'
  order by d.submitted_at desc
  limit 100;
end;

revoke all on function public.get_donation_history(text) from public;
grant execute on function public.get_donation_history(text) to anon, authenticated;

-- ============================================================
-- 5) Public certificate verification RPC
-- ============================================================
drop function if exists public.verify_donation_certificate(text);

create function public.verify_donation_certificate(p_certificate_no text)
returns table (
  certificate_no text,
  display_name text,
  amount numeric,
  transfer_date date,
  certificate_issued_at timestamptz,
  certificate_pdf_url text,
  certificate_generation_status text
)
language sql
security definer
stable
set search_path = public
begin atomic
  select
    d.certificate_no,
    coalesce(nullif(d.certificate_name_override, ''), d.display_name),
    d.amount,
    d.transfer_date,
    d.certificate_issued_at,
    coalesce(d.certificate_pdf_url, ''),
    coalesce(d.certificate_generation_status, 'not_generated')
  from public.donations as d
  where upper(d.certificate_no) = upper(btrim(p_certificate_no))
    and d.status = 'verified'
    and d.certificate_no is not null
  limit 1;
end;

revoke all on function public.verify_donation_certificate(text) from public;
grant execute on function public.verify_donation_certificate(text) to anon, authenticated;

-- 6) Helpful comments.
comment on column public.donation_settings.google_apps_script_url is
  'Google Apps Script Web App URL used to generate donation certificate PDFs.';

comment on column public.donation_settings.google_slides_template_id is
  'Google Slides template presentation ID.';

comment on column public.donation_settings.google_drive_folder_id is
  'Google Drive folder ID for generated certificate PDFs.';

comment on column public.donations.certificate_pdf_url is
  'Google Drive URL of the generated official donation certificate PDF.';

-- ============================================================
-- 7) Verification: these SELECTs should return rows after success.
-- ============================================================
select
  id,
  certificate_provider,
  google_apps_script_url,
  google_slides_template_id,
  google_drive_folder_id
from public.donation_settings
where id = 1;

select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('get_donation_history', 'verify_donation_certificate')
order by routine_name;

select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'donations'
  and column_name in (
    'certificate_pdf_url',
    'certificate_drive_file_id',
    'certificate_generated_at',
    'certificate_generation_status',
    'certificate_generation_error'
  )
order by column_name;
