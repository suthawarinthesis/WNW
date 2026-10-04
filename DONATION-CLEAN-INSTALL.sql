-- ============================================================
-- WNW DONATION SYSTEM - CLEAN INSTALL
-- For the current Supabase schema supplied by the user
-- Run this WHOLE FILE once in Supabase > SQL Editor > New query
--
-- This file creates ONLY Donation objects.
-- It does not alter Alumni, Personnel, Student Portal, Admission,
-- News, Achievements, University Admission, or site_settings.
-- ============================================================

-- ------------------------------------------------------------
-- 0) Manager helper
-- Same rule used by the current website:
-- every authenticated, non-anonymous Auth user is a Website Manager.
-- ------------------------------------------------------------
BEGIN;

create or replace function public.is_site_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $wnw_admin$
  select auth.uid() is not null
     and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
$wnw_admin$;

revoke all on function public.is_site_admin() from public;
grant execute on function public.is_site_admin() to authenticated;

-- ------------------------------------------------------------
-- 1) Donation settings
-- ------------------------------------------------------------
create table if not exists public.donation_settings (
  id smallint primary key default 1 check (id = 1),
  campaign_title text not null default 'ร่วมทำบุญเพื่อการศึกษา',
  campaign_description text not null default 'ร่วมสนับสนุนการศึกษาและกิจการของโรงเรียนวัดหนองแวงวิทยา',
  banner_url text not null default '',
  bank_name text not null default '',
  bank_account_name text not null default '',
  bank_account_no text not null default '',
  promptpay text not null default '',
  qr_image_url text not null default '',
  donation_note text not null default '',
  is_open boolean not null default true,

  certificate_prefix text not null default 'WNW-DN',
  certificate_provider text not null default 'google_slides',
  google_apps_script_url text not null default '',
  google_slides_template_id text not null default '',
  google_drive_folder_id text not null default '',

  -- Kept for compatibility with the current frontend fallback renderer.
  certificate_template_url text not null default '',
  certificate_template_type text not null default 'image'
    check (certificate_template_type in ('image','pdf')),
  certificate_layout jsonb not null default
    '{"name":{"x":50,"y":43,"fontSize":3.0,"align":"center","maxWidth":82},"amount":{"x":50,"y":52,"fontSize":2.7,"align":"center","maxWidth":75},"certificate_no":{"x":82,"y":13,"fontSize":1.55,"align":"center","maxWidth":30}}'::jsonb,

  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- Add the Google fields too, in case an earlier partial install created the table.
alter table public.donation_settings
  add column if not exists certificate_provider text not null default 'google_slides',
  add column if not exists google_apps_script_url text not null default '',
  add column if not exists google_slides_template_id text not null default '',
  add column if not exists google_drive_folder_id text not null default '';

insert into public.donation_settings (
  id,
  certificate_provider,
  google_apps_script_url,
  google_slides_template_id,
  google_drive_folder_id
)
values (
  1,
  'google_slides',
  'https://script.google.com/macros/s/AKfycby2RD2z8dMwB3Ajp0JPCPHN_rKFIL1M5IckIN4VyUMG2yNAV_2gW4kWaGjx-49CXECJ4A/exec',
  '1N0OEEhnCdfqn5ohtZa47pUfenVYizdePtXo9vGsVGy4',
  '1JUTSXLLdR7X5KiV6KINe6Nk85DS-YdYk'
)
on conflict (id) do update set
  certificate_provider = excluded.certificate_provider,
  google_apps_script_url = excluded.google_apps_script_url,
  google_slides_template_id = excluded.google_slides_template_id,
  google_drive_folder_id = excluded.google_drive_folder_id,
  updated_at = now();

alter table public.donation_settings enable row level security;

drop policy if exists "donation settings public read" on public.donation_settings;
create policy "donation settings public read"
on public.donation_settings
for select
to anon, authenticated
using (id = 1);

drop policy if exists "donation settings manager insert" on public.donation_settings;
create policy "donation settings manager insert"
on public.donation_settings
for insert
to authenticated
with check (public.is_site_admin());

drop policy if exists "donation settings manager update" on public.donation_settings;
create policy "donation settings manager update"
on public.donation_settings
for update
to authenticated
using (public.is_site_admin())
with check (public.is_site_admin());

grant select on public.donation_settings to anon, authenticated;
grant insert, update on public.donation_settings to authenticated;

-- ------------------------------------------------------------
-- 2) Donation records
-- ------------------------------------------------------------
create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  request_no text not null unique,
  history_code text not null,
  submission_state text not null default 'uploading'
    check (submission_state in ('uploading','submitted')),
  status text not null default 'pending'
    check (status in ('pending','verified','rejected')),

  donor_type text not null
    check (donor_type in ('layperson','monastic')),
  donor_prefix text not null default '',
  first_name text not null default '',
  dhamma_name text not null default '',
  last_name text not null default '',
  display_name text not null default '',
  certificate_name_override text not null default '',

  organization text not null default '',
  temple_name text not null default '',
  address_line text not null default '',
  subdistrict text not null default '',
  district text not null default '',
  province text not null default '',
  postal_code text not null default '',
  phone text not null default '',
  email text not null default '',

  amount numeric(12,2) not null check (amount > 0),
  transfer_date date not null,
  transfer_time time without time zone not null,
  slip_path text not null default '',
  donor_note text not null default '',
  consent_accepted boolean not null default false,
  show_public_name boolean not null default true,
  show_public_amount boolean not null default true,

  upload_token uuid,
  submitted_at timestamptz,
  admin_note text not null default '',
  verified_at timestamptz,
  verified_by uuid,
  rejected_at timestamptz,
  rejected_by uuid,

  certificate_no text unique,
  certificate_issued_at timestamptz,
  certificate_pdf_url text not null default '',
  certificate_drive_file_id text not null default '',
  certificate_generated_at timestamptz,
  certificate_generation_status text not null default 'not_generated'
    check (certificate_generation_status in ('not_generated','generating','ready','error')),
  certificate_generation_error text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compatibility with a possible partial earlier install.
alter table public.donations
  add column if not exists certificate_pdf_url text not null default '',
  add column if not exists certificate_drive_file_id text not null default '',
  add column if not exists certificate_generated_at timestamptz,
  add column if not exists certificate_generation_status text not null default 'not_generated',
  add column if not exists certificate_generation_error text not null default '';

create index if not exists donations_status_idx
  on public.donations (status, submitted_at desc);
create index if not exists donations_history_code_idx
  on public.donations (history_code, submitted_at desc);
create index if not exists donations_certificate_no_idx
  on public.donations (certificate_no);
create index if not exists donations_transfer_date_idx
  on public.donations (transfer_date desc);
create index if not exists donations_certificate_generation_idx
  on public.donations (certificate_generation_status, certificate_generated_at desc);

alter table public.donations enable row level security;

drop policy if exists "donations manager read" on public.donations;
create policy "donations manager read"
on public.donations
for select
to authenticated
using (public.is_site_admin());

drop policy if exists "donations manager update" on public.donations;
create policy "donations manager update"
on public.donations
for update
to authenticated
using (public.is_site_admin())
with check (public.is_site_admin());

drop policy if exists "donations manager delete" on public.donations;
create policy "donations manager delete"
on public.donations
for delete
to authenticated
using (public.is_site_admin());

grant select, update, delete on public.donations to authenticated;

-- ------------------------------------------------------------
-- 3) Certificate running number by Buddhist year
-- ------------------------------------------------------------
create table if not exists public.donation_certificate_counters (
  year_be integer primary key,
  last_no integer not null default 0 check (last_no >= 0),
  updated_at timestamptz not null default now()
);

alter table public.donation_certificate_counters enable row level security;

drop policy if exists "donation counters manager read" on public.donation_certificate_counters;
create policy "donation counters manager read"
on public.donation_certificate_counters
for select
to authenticated
using (public.is_site_admin());

grant select on public.donation_certificate_counters to authenticated;

-- ------------------------------------------------------------
-- 4) Helper: random readable code
-- ------------------------------------------------------------
drop function if exists public.donation_random_code(integer);
create function public.donation_random_code(p_chars integer default 16)
returns text
language sql
volatile
security definer
set search_path = public
as $wnw_random$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, greatest(8, least(p_chars, 32))))
$wnw_random$;

revoke all on function public.donation_random_code(integer) from public;

-- ------------------------------------------------------------
-- 5) Public RPC: start a donation submission
-- ------------------------------------------------------------
drop function if exists public.create_donation_submission(jsonb);
create function public.create_donation_submission(p_payload jsonb)
returns table(
  id uuid,
  request_no text,
  history_code text,
  upload_token uuid
)
language plpgsql
security definer
set search_path = public
as $wnw_create$
declare
  v_id uuid := gen_random_uuid();
  v_upload_token uuid := gen_random_uuid();
  v_request_no text;
  v_history_code text;
  v_type text := coalesce(btrim(p_payload->>'donorType'), '');
  v_prefix text := coalesce(btrim(p_payload->>'donorPrefix'), '');
  v_first text := coalesce(btrim(p_payload->>'firstName'), '');
  v_dhamma text := coalesce(btrim(p_payload->>'dhammaName'), '');
  v_last text := coalesce(btrim(p_payload->>'lastName'), '');
  v_phone text := coalesce(btrim(p_payload->>'phone'), '');
  v_email text := lower(coalesce(btrim(p_payload->>'email'), ''));
  v_history_in text := upper(coalesce(btrim(p_payload->>'historyCode'), ''));
  v_display text;
  v_amount numeric(12,2);
  v_date date;
  v_time time;
  v_open boolean;
  v_try integer;
begin
  select is_open into v_open
  from public.donation_settings
  where donation_settings.id = 1;

  if coalesce(v_open, true) is false then
    raise exception 'ระบบรับบริจาคปิดรับรายการชั่วคราว';
  end if;

  if v_type not in ('layperson','monastic') then
    raise exception 'กรุณาเลือกประเภทผู้บริจาค';
  end if;

  if v_first = '' then
    raise exception 'กรุณาระบุชื่อ';
  end if;

  if v_type = 'layperson' and v_last = '' then
    raise exception 'กรุณาระบุนามสกุล';
  end if;

  if v_type = 'monastic' then
    if v_prefix = '' then
      raise exception 'กรุณาเลือกคำนำหน้าพระ/สามเณร';
    end if;
    if coalesce(btrim(p_payload->>'templeName'), '') = '' then
      raise exception 'กรุณาระบุชื่อวัด';
    end if;
    if coalesce(btrim(p_payload->>'subdistrict'), '') = ''
       or coalesce(btrim(p_payload->>'district'), '') = ''
       or coalesce(btrim(p_payload->>'province'), '') = '' then
      raise exception 'กรุณาระบุตำบล อำเภอ และจังหวัดของวัด';
    end if;
  end if;

  if v_phone = '' and v_email = '' then
    raise exception 'กรุณาระบุเบอร์โทรศัพท์หรือ Email อย่างน้อย 1 ช่อง';
  end if;

  if coalesce((p_payload->>'consentAccepted')::boolean, false) is not true then
    raise exception 'กรุณายอมรับเงื่อนไขก่อนส่งข้อมูล';
  end if;

  begin
    v_amount := (p_payload->>'amount')::numeric;
  exception when others then
    raise exception 'จำนวนเงินไม่ถูกต้อง';
  end;

  if v_amount <= 0 then
    raise exception 'จำนวนเงินต้องมากกว่า 0 บาท';
  end if;

  begin
    v_date := (p_payload->>'transferDate')::date;
  exception when others then
    raise exception 'วันที่โอนไม่ถูกต้อง';
  end;

  begin
    v_time := (p_payload->>'transferTime')::time;
  exception when others then
    raise exception 'เวลาโอนไม่ถูกต้อง';
  end;

  if v_type = 'monastic' then
    v_display := concat_ws(' ', nullif(v_prefix,''), nullif(v_first,''), nullif(v_dhamma,''), nullif(v_last,''));
  else
    v_display := concat_ws(' ', nullif(v_prefix,''), nullif(v_first,''), nullif(v_last,''));
  end if;

  -- Reuse a previous history code only if contact information matches.
  if v_history_in ~ '^HIS-[A-F0-9]{12,32}$'
     and exists (
       select 1
       from public.donations d
       where d.history_code = v_history_in
         and (
           (v_phone <> '' and regexp_replace(d.phone, '[^0-9]', '', 'g') = regexp_replace(v_phone, '[^0-9]', '', 'g'))
           or
           (v_email <> '' and lower(d.email) = v_email)
         )
     ) then
    v_history_code := v_history_in;
  else
    v_history_code := 'HIS-' || public.donation_random_code(16);
  end if;

  for v_try in 1..10 loop
    v_request_no := 'REQ-' || to_char(current_date, 'YYYYMMDD') || '-' || public.donation_random_code(8);
    exit when not exists (
      select 1 from public.donations d where d.request_no = v_request_no
    );
  end loop;

  insert into public.donations (
    id,
    request_no,
    history_code,
    submission_state,
    status,
    donor_type,
    donor_prefix,
    first_name,
    dhamma_name,
    last_name,
    display_name,
    organization,
    temple_name,
    address_line,
    subdistrict,
    district,
    province,
    postal_code,
    phone,
    email,
    amount,
    transfer_date,
    transfer_time,
    donor_note,
    consent_accepted,
    show_public_name,
    show_public_amount,
    upload_token
  )
  values (
    v_id,
    v_request_no,
    v_history_code,
    'uploading',
    'pending',
    v_type,
    v_prefix,
    v_first,
    v_dhamma,
    v_last,
    v_display,
    coalesce(btrim(p_payload->>'organization'), ''),
    coalesce(btrim(p_payload->>'templeName'), ''),
    coalesce(btrim(p_payload->>'addressLine'), ''),
    coalesce(btrim(p_payload->>'subdistrict'), ''),
    coalesce(btrim(p_payload->>'district'), ''),
    coalesce(btrim(p_payload->>'province'), ''),
    coalesce(btrim(p_payload->>'postalCode'), ''),
    v_phone,
    v_email,
    v_amount,
    v_date,
    v_time,
    coalesce(p_payload->>'donorNote', ''),
    true,
    coalesce((p_payload->>'showPublicName')::boolean, true),
    coalesce((p_payload->>'showPublicAmount')::boolean, true),
    v_upload_token
  );

  return query
  select v_id, v_request_no, v_history_code, v_upload_token;
end
$wnw_create$;

revoke all on function public.create_donation_submission(jsonb) from public;
grant execute on function public.create_donation_submission(jsonb) to anon, authenticated;

-- ------------------------------------------------------------
-- 6) Storage upload authorization for a private transfer slip
-- Object path: <donation-id>/<upload-token>/<filename>
-- ------------------------------------------------------------
drop function if exists public.can_upload_donation_slip(text);
create function public.can_upload_donation_slip(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $wnw_upload$
declare
  v_id_text text := split_part(coalesce(object_name,''), '/', 1);
  v_token_text text := split_part(coalesce(object_name,''), '/', 2);
  v_id uuid;
  v_token uuid;
begin
  if v_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;
  if v_token_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;

  v_id := v_id_text::uuid;
  v_token := v_token_text::uuid;

  return exists (
    select 1
    from public.donations d
    where d.id = v_id
      and d.upload_token = v_token
      and d.submission_state = 'uploading'
  );
end
$wnw_upload$;

revoke all on function public.can_upload_donation_slip(text) from public;
grant execute on function public.can_upload_donation_slip(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 7) Public RPC: finalize submission after slip upload
-- ------------------------------------------------------------
drop function if exists public.finalize_donation_submission(uuid, uuid, text);
create function public.finalize_donation_submission(
  p_id uuid,
  p_upload_token uuid,
  p_slip_path text
)
returns table(
  request_no text,
  history_code text,
  submitted_at timestamptz,
  status text
)
language plpgsql
security definer
set search_path = public
as $wnw_finalize$
declare
  v_row public.donations%rowtype;
begin
  if coalesce(btrim(p_slip_path), '') = '' then
    raise exception 'กรุณาแนบหลักฐานการโอนเงิน';
  end if;

  if p_slip_path not like p_id::text || '/' || p_upload_token::text || '/%' then
    raise exception 'ตำแหน่งไฟล์หลักฐานไม่ถูกต้อง';
  end if;

  update public.donations d
  set slip_path = btrim(p_slip_path),
      submission_state = 'submitted',
      submitted_at = now(),
      upload_token = null,
      updated_at = now()
  where d.id = p_id
    and d.upload_token = p_upload_token
    and d.submission_state = 'uploading'
  returning d.* into v_row;

  if v_row.id is null then
    raise exception 'ไม่สามารถยืนยันรายการได้ กรุณาลองใหม่';
  end if;

  return query
  select v_row.request_no, v_row.history_code, v_row.submitted_at, v_row.status;
end
$wnw_finalize$;

revoke all on function public.finalize_donation_submission(uuid, uuid, text) from public;
grant execute on function public.finalize_donation_submission(uuid, uuid, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 8) Public dashboard
-- ------------------------------------------------------------
drop function if exists public.get_donation_dashboard();
create function public.get_donation_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $wnw_dashboard$
declare
  v_total numeric(14,2) := 0;
  v_donation_count bigint := 0;
  v_donor_count bigint := 0;
  v_latest jsonb := '[]'::jsonb;
begin
  select
    coalesce(sum(d.amount), 0),
    count(*),
    count(distinct lower(btrim(regexp_replace(coalesce(nullif(d.certificate_name_override, ''), d.display_name), '[[:space:]]+', ' ', 'g'))))
  into v_total, v_donation_count, v_donor_count
  from public.donations d
  where d.status = 'verified'
    and d.submission_state = 'submitted';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', case when x.show_public_name then x.public_name else 'ผู้ไม่ประสงค์ออกนาม' end,
        'amount', case when x.show_public_amount then x.amount else null end,
        'date', x.transfer_date,
        'donorType', x.donor_type
      )
    ),
    '[]'::jsonb
  )
  into v_latest
  from (
    select
      coalesce(nullif(d.certificate_name_override,''), d.display_name) as public_name,
      d.amount,
      d.transfer_date,
      d.donor_type,
      d.show_public_name,
      d.show_public_amount
    from public.donations d
    where d.status = 'verified'
      and d.submission_state = 'submitted'
    order by d.verified_at desc nulls last, d.submitted_at desc
    limit 12
  ) x;

  return jsonb_build_object(
    'totalAmount', v_total,
    'donationCount', v_donation_count,
    'donorCount', v_donor_count,
    'latest', v_latest
  );
end
$wnw_dashboard$;

revoke all on function public.get_donation_dashboard() from public;
grant execute on function public.get_donation_dashboard() to anon, authenticated;

-- ------------------------------------------------------------
-- 9) Donor history by private history code
-- ------------------------------------------------------------
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
language plpgsql
stable
security definer
set search_path = public
as $wnw_history$
begin
  return query
  select
    d.request_no,
    coalesce(nullif(d.certificate_name_override, ''), d.display_name),
    d.amount,
    d.transfer_date,
    d.transfer_time,
    d.status,
    d.certificate_no,
    d.certificate_issued_at,
    case when d.status = 'verified' then d.certificate_pdf_url else '' end,
    case when d.status = 'verified' then d.certificate_generation_status else 'not_generated' end,
    case when d.status = 'rejected' then d.admin_note else '' end
  from public.donations d
  where d.history_code = upper(btrim(p_history_code))
    and d.submission_state = 'submitted'
  order by d.submitted_at desc
  limit 100;
end
$wnw_history$;

revoke all on function public.get_donation_history(text) from public;
grant execute on function public.get_donation_history(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 10) Public certificate verification
-- ------------------------------------------------------------
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
language plpgsql
stable
security definer
set search_path = public
as $wnw_verify$
begin
  return query
  select
    d.certificate_no,
    coalesce(nullif(d.certificate_name_override, ''), d.display_name),
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
end
$wnw_verify$;

revoke all on function public.verify_donation_certificate(text) from public;
grant execute on function public.verify_donation_certificate(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 11) Manager: approve and issue certificate number atomically
-- Example: WNW-DN-2569-000001
-- ------------------------------------------------------------
drop function if exists public.approve_donation(uuid);
create function public.approve_donation(p_id uuid)
returns table(
  certificate_no text,
  certificate_issued_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $wnw_approve$
declare
  v_row public.donations%rowtype;
  v_year_be integer;
  v_serial integer;
  v_prefix text;
  v_cert text;
begin
  if not public.is_site_admin() then
    raise exception 'ไม่มีสิทธิ์ดำเนินการ';
  end if;

  select d.*
  into v_row
  from public.donations d
  where d.id = p_id
  for update;

  if v_row.id is null then
    raise exception 'ไม่พบรายการบริจาค';
  end if;

  if v_row.submission_state <> 'submitted' then
    raise exception 'รายการนี้ยังส่งข้อมูลไม่สมบูรณ์';
  end if;

  if v_row.status = 'verified' and v_row.certificate_no is not null then
    return query
    select v_row.certificate_no, v_row.certificate_issued_at;
    return;
  end if;

  v_year_be := extract(year from current_date)::integer + 543;

  select coalesce(nullif(btrim(s.certificate_prefix), ''), 'WNW-DN')
  into v_prefix
  from public.donation_settings s
  where s.id = 1;

  if v_prefix is null then
    v_prefix := 'WNW-DN';
  end if;

  insert into public.donation_certificate_counters (year_be, last_no, updated_at)
  values (v_year_be, 1, now())
  on conflict (year_be) do update
  set last_no = public.donation_certificate_counters.last_no + 1,
      updated_at = now()
  returning last_no into v_serial;

  v_cert := v_prefix || '-' || v_year_be::text || '-' || lpad(v_serial::text, 6, '0');

  update public.donations d
  set status = 'verified',
      verified_at = now(),
      verified_by = auth.uid(),
      rejected_at = null,
      rejected_by = null,
      certificate_no = v_cert,
      certificate_issued_at = now(),
      certificate_generation_status = 'not_generated',
      certificate_generation_error = '',
      updated_at = now()
  where d.id = p_id
  returning d.* into v_row;

  return query
  select v_row.certificate_no, v_row.certificate_issued_at;
end
$wnw_approve$;

revoke all on function public.approve_donation(uuid) from public;
grant execute on function public.approve_donation(uuid) to authenticated;

-- ------------------------------------------------------------
-- 12) Manager: reject a donation
-- ------------------------------------------------------------
drop function if exists public.reject_donation(uuid, text);
create function public.reject_donation(p_id uuid, p_note text default '')
returns boolean
language plpgsql
security definer
set search_path = public
as $wnw_reject$
begin
  if not public.is_site_admin() then
    raise exception 'ไม่มีสิทธิ์ดำเนินการ';
  end if;

  update public.donations d
  set status = 'rejected',
      admin_note = coalesce(p_note, ''),
      rejected_at = now(),
      rejected_by = auth.uid(),
      verified_at = null,
      verified_by = null,
      updated_at = now()
  where d.id = p_id
    and d.submission_state = 'submitted';

  return found;
end
$wnw_reject$;

revoke all on function public.reject_donation(uuid, text) from public;
grant execute on function public.reject_donation(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- 13) Storage buckets
-- ------------------------------------------------------------
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'donation-slips',
  'donation-slips',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'donation-assets',
  'donation-assets',
  true,
  20971520,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Private transfer slips
drop policy if exists "donation slips public upload" on storage.objects;
create policy "donation slips public upload"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'donation-slips'
  and public.can_upload_donation_slip(name)
);

drop policy if exists "donation slips manager read" on storage.objects;
create policy "donation slips manager read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'donation-slips'
  and public.is_site_admin()
);

drop policy if exists "donation slips manager delete" on storage.objects;
create policy "donation slips manager delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'donation-slips'
  and public.is_site_admin()
);

-- Public Donation assets: banner, QR, optional image/PDF template
drop policy if exists "donation assets public read" on storage.objects;
create policy "donation assets public read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'donation-assets');

drop policy if exists "donation assets manager upload" on storage.objects;
create policy "donation assets manager upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'donation-assets'
  and public.is_site_admin()
);

drop policy if exists "donation assets manager update" on storage.objects;
create policy "donation assets manager update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'donation-assets'
  and public.is_site_admin()
)
with check (
  bucket_id = 'donation-assets'
  and public.is_site_admin()
);

drop policy if exists "donation assets manager delete" on storage.objects;
create policy "donation assets manager delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'donation-assets'
  and public.is_site_admin()
);


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

comment on table public.donations is
'WNW Donation submissions, slip review, donor history and Anumodana certificate records.';

comment on table public.donation_settings is
'WNW Donation public campaign settings and Google Slides certificate integration.';

-- ============================================================
-- END OF INSTALL
-- If Supabase reports Success / No rows returned, installation is complete.
-- ============================================================

COMMIT;


-- ============================================================
-- V12 Public Donor Directory
-- ============================================================
-- WNW Donation V12: Public Donor Directory
-- Run this WHOLE file once after Donation V11.
-- Public output contains only verified donation information intended for the donor directory.


DROP FUNCTION IF EXISTS public.get_public_donor_directory(text, integer, integer);
CREATE FUNCTION public.get_public_donor_directory(
  p_search text DEFAULT '',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  transfer_date date,
  transfer_time time,
  display_name text,
  amount numeric,
  certificate_no text,
  certificate_pdf_url text,
  certificate_generation_status text,
  photo_url text,
  is_alumni boolean,
  alumni_batch text,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
BEGIN ATOMIC
  SELECT
    d.transfer_date,
    d.transfer_time,
    CASE WHEN d.show_public_name THEN COALESCE(NULLIF(d.certificate_name_override, ''), d.display_name) ELSE 'ผู้ไม่ประสงค์ออกนาม' END AS display_name,
    CASE WHEN d.show_public_amount THEN d.amount ELSE NULL END AS amount,
    d.certificate_no,
    CASE WHEN d.certificate_generation_status = 'ready' THEN d.certificate_pdf_url ELSE '' END AS certificate_pdf_url,
    d.certificate_generation_status,
    CASE WHEN d.show_public_name THEN d.photo_url ELSE '' END AS photo_url,
    CASE WHEN d.show_public_name THEN d.is_alumni ELSE false END AS is_alumni,
    CASE WHEN d.show_public_name AND d.is_alumni THEN d.alumni_batch ELSE '' END AS alumni_batch,
    COUNT(*) OVER() AS total_count
  FROM public.donations d
  WHERE d.status = 'verified'
    AND d.submission_state = 'submitted'
    AND (
      BTRIM(COALESCE(p_search, '')) = ''
      OR (d.show_public_name AND COALESCE(NULLIF(d.certificate_name_override, ''), d.display_name) ILIKE '%' || BTRIM(p_search) || '%')
      OR COALESCE(d.certificate_no, '') ILIKE '%' || BTRIM(p_search) || '%'
    )
  ORDER BY d.transfer_date DESC, d.transfer_time DESC, d.verified_at DESC NULLS LAST, d.submitted_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;

REVOKE ALL ON FUNCTION public.get_public_donor_directory(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_donor_directory(text, integer, integer) TO anon, authenticated;

