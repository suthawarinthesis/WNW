-- ============================================================
-- RESTORE: Donation "ภาพ พม. นิกร" UI/data support
-- Safe repair migration. Does not delete existing donation data.
-- Run in Supabase > SQL Editor once (safe to run again).
-- ============================================================

alter table public.donation_settings
  add column if not exists certificate_provider text not null default 'google_slides',
  add column if not exists google_apps_script_url text not null default '',
  add column if not exists google_slides_template_id text not null default '',
  add column if not exists google_drive_folder_id text not null default '',
  add column if not exists verify_base_url text not null default 'https://wnw-vit.site/donation/verify/?no=',
  add column if not exists nikorn_enabled boolean not null default true,
  add column if not exists nikorn_google_slides_template_id text not null default '',
  add column if not exists nikorn_google_drive_folder_id text not null default '',
  add column if not exists nikorn_fallback_photo_url text not null default '',
  add column if not exists auto_process_on_submit boolean not null default true;

alter table public.donations
  add column if not exists certificate_pdf_url text not null default '',
  add column if not exists certificate_drive_file_id text not null default '',
  add column if not exists certificate_generated_at timestamptz,
  add column if not exists certificate_generation_status text not null default 'not_generated',
  add column if not exists certificate_generation_error text not null default '',
  add column if not exists certificate_image_url text not null default '',
  add column if not exists certificate_image_drive_file_id text not null default '',
  add column if not exists nikorn_image_url text not null default '',
  add column if not exists nikorn_image_drive_file_id text not null default '',
  add column if not exists nikorn_generated_at timestamptz,
  add column if not exists nikorn_generation_status text not null default 'not_generated',
  add column if not exists nikorn_generation_error text not null default '',
  add column if not exists auto_process_token uuid,
  add column if not exists auto_processed_at timestamptz,
  add column if not exists auto_process_error text not null default '',
  add column if not exists auto_process_started_at timestamptz,
  add column if not exists auto_process_request_id bigint;

-- Normalize old/null values without replacing valid generated data.
update public.donations set nikorn_generation_status='ready'
where coalesce(nikorn_image_url,'')<>'' and coalesce(nikorn_generation_status,'not_generated')='not_generated';

create index if not exists donations_nikorn_status_idx
  on public.donations (nikorn_generation_status, submitted_at desc);

-- Public-safe history RPC including generated assets.
-- Access still requires the random donor history code.
drop function if exists public.get_donation_history_v2(text);
create function public.get_donation_history_v2(p_history_code text)
returns table(
  request_no text,
  display_name text,
  amount numeric,
  transfer_date date,
  transfer_time time without time zone,
  status text,
  certificate_no text,
  certificate_issued_at timestamptz,
  admin_note text,
  certificate_image_url text,
  nikorn_generation_status text,
  nikorn_image_url text,
  nikorn_generated_at timestamptz
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
    case when d.status='rejected' then d.admin_note else '' end,
    coalesce(d.certificate_image_url,''),
    coalesce(d.nikorn_generation_status,'not_generated'),
    coalesce(d.nikorn_image_url,''),
    d.nikorn_generated_at
  from public.donations d
  where d.history_code = upper(btrim(p_history_code))
    and d.submission_state = 'submitted'
  order by d.submitted_at desc
  limit 100;
$$;

revoke all on function public.get_donation_history_v2(text) from public;
grant execute on function public.get_donation_history_v2(text) to anon, authenticated;

comment on function public.get_donation_history_v2(text) is
'Public-safe donor history lookup by random history code, including certificate/Nikorn generated asset URLs.';
