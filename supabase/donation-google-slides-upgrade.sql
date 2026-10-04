-- ============================================================
-- Donation V3: Google Slides certificate generator
-- Wat Nongwang Wittaya School
-- Run once in Supabase > SQL Editor. Safe to run again.
-- ============================================================

alter table public.donation_settings
  add column if not exists certificate_provider text not null default 'google_slides',
  add column if not exists google_apps_script_url text not null default '',
  add column if not exists google_slides_template_id text not null default '',
  add column if not exists google_drive_folder_id text not null default '';

update public.donation_settings
set certificate_provider = 'google_slides',
    google_apps_script_url = 'https://script.google.com/macros/s/AKfycby2RD2z8dMwB3Ajp0JPCPHN_rKFIL1M5IckIN4VyUMG2yNAV_2gW4kWaGjx-49CXECJ4A/exec',
    google_slides_template_id = '180GXEdZA9C1VCdmqp9qA0-tK17SHG93s0ZsLpS8ZuY8',
    google_drive_folder_id = '1JUTSXLLdR7X5KiV6KINe6Nk85DS-YdYk',
    updated_at = now()
where id = 1;

alter table public.donations
  add column if not exists certificate_pdf_url text not null default '',
  add column if not exists certificate_drive_file_id text not null default '',
  add column if not exists certificate_generated_at timestamptz,
  add column if not exists certificate_generation_status text not null default 'not_generated',
  add column if not exists certificate_generation_error text not null default '';

create index if not exists donations_certificate_generation_idx
  on public.donations (certificate_generation_status, certificate_generated_at desc);

drop function if exists public.get_donation_history(text);
create function public.get_donation_history(p_history_code text)
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
  admin_note text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    d.request_no,
    coalesce(nullif(d.certificate_name_override,''),d.display_name),
    d.amount,
    d.transfer_date,
    d.transfer_time,
    d.status,
    d.certificate_no,
    d.certificate_issued_at,
    case when d.status='verified' then d.certificate_pdf_url else '' end,
    case when d.status='verified' then d.certificate_generation_status else 'not_generated' end,
    case when d.status = 'rejected' then d.admin_note else '' end
  from public.donations d
  where d.history_code = upper(btrim(p_history_code))
    and d.submission_state = 'submitted'
  order by d.submitted_at desc
  limit 100;
$$;
revoke all on function public.get_donation_history(text) from public;
grant execute on function public.get_donation_history(text) to anon, authenticated;

drop function if exists public.verify_donation_certificate(text);
create function public.verify_donation_certificate(p_certificate_no text)
returns table(
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
as $$
  select
    d.certificate_no,
    coalesce(nullif(d.certificate_name_override,''),d.display_name),
    d.amount,
    d.transfer_date,
    d.certificate_issued_at,
    d.certificate_pdf_url,
    d.certificate_generation_status
  from public.donations d
  where upper(d.certificate_no) = upper(btrim(p_certificate_no))
    and d.status = 'verified'
    and d.certificate_no is not null
  limit 1;
$$;
revoke all on function public.verify_donation_certificate(text) from public;
grant execute on function public.verify_donation_certificate(text) to anon, authenticated;

comment on column public.donation_settings.google_apps_script_url is 'Google Apps Script Web App /exec URL used by authenticated managers to generate certificate PDFs.';
comment on column public.donation_settings.google_slides_template_id is 'Google Slides presentation ID containing donor_name, donation_amount and certificate_no tags.';
comment on column public.donation_settings.google_drive_folder_id is 'Google Drive folder ID for generated certificate PDFs.';
comment on column public.donations.certificate_pdf_url is 'Google Drive URL of the generated official certificate PDF.';
