-- ============================================================
-- Donation + Anumodana Certificate System
-- Wat Nongwang Wittaya School
-- Run once in Supabase > SQL Editor. Safe to run again.
-- ============================================================

create extension if not exists pgcrypto;

-- Same convention as the rest of this website:
-- every authenticated non-anonymous Supabase Auth user is a Website Manager.
create or replace function public.is_site_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select auth.uid() is not null
     and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false;
$$;

revoke all on function public.is_site_admin() from public;
grant execute on function public.is_site_admin() to authenticated;

-- ------------------------------------------------------------
-- Settings shown on the public donation subweb.
-- certificate_layout uses percentage coordinates so a template can
-- be changed later without changing code.
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
  certificate_template_url text not null default '',
  certificate_template_type text not null default 'image'
    check (certificate_template_type in ('image','pdf')),
  certificate_layout jsonb not null default
    '{
      "name":{"x":50,"y":43,"fontSize":3.0,"align":"center","maxWidth":82},
      "amount":{"x":50,"y":52,"fontSize":2.7,"align":"center","maxWidth":75},
      "certificate_no":{"x":82,"y":13,"fontSize":1.55,"align":"center","maxWidth":30}
    }'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.donation_settings
  add column if not exists certificate_provider text not null default 'google_slides',
  add column if not exists google_apps_script_url text not null default '',
  add column if not exists google_slides_template_id text not null default '',
  add column if not exists google_drive_folder_id text not null default '';

insert into public.donation_settings (id)
values (1)
on conflict (id) do nothing;

update public.donation_settings set certificate_provider='google_slides', google_slides_template_id='180GXEdZA9C1VCdmqp9qA0-tK17SHG93s0ZsLpS8ZuY8', google_drive_folder_id='1JUTSXLLdR7X5KiV6KINe6Nk85DS-YdYk' where id=1;

alter table public.donation_settings enable row level security;

drop policy if exists "public read donation settings" on public.donation_settings;
create policy "public read donation settings"
on public.donation_settings for select
to anon, authenticated
using (id = 1);

drop policy if exists "admin insert donation settings" on public.donation_settings;
create policy "admin insert donation settings"
on public.donation_settings for insert
to authenticated
with check (public.is_site_admin());

drop policy if exists "admin update donation settings" on public.donation_settings;
create policy "admin update donation settings"
on public.donation_settings for update
to authenticated
using (public.is_site_admin())
with check (public.is_site_admin());

grant select on public.donation_settings to anon, authenticated;
grant insert, update on public.donation_settings to authenticated;

-- ------------------------------------------------------------
-- Donation submissions. Public users never read this table directly.
-- They use limited RPC functions below.
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

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.donations
  add column if not exists certificate_pdf_url text not null default '',
  add column if not exists certificate_drive_file_id text not null default '',
  add column if not exists certificate_generated_at timestamptz,
  add column if not exists certificate_generation_status text not null default 'not_generated',
  add column if not exists certificate_generation_error text not null default '';

create index if not exists donations_certificate_generation_idx
  on public.donations (certificate_generation_status, certificate_generated_at desc);

create index if not exists donations_status_idx
  on public.donations (status, submitted_at desc);
create index if not exists donations_history_code_idx
  on public.donations (history_code, submitted_at desc);
create index if not exists donations_certificate_no_idx
  on public.donations (certificate_no);
create index if not exists donations_transfer_date_idx
  on public.donations (transfer_date desc);

-- Keep display_name and updated_at correct whenever a manager edits a row.
create or replace function public.donation_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();

  if new.donor_type = 'monastic' then
    new.display_name := concat_ws(' ',
      nullif(btrim(new.donor_prefix),''),
      nullif(btrim(new.first_name),''),
      nullif(btrim(new.dhamma_name),''),
      nullif(btrim(new.last_name),'')
    );
  else
    new.display_name := concat_ws(' ',
      nullif(btrim(new.donor_prefix),''),
      nullif(btrim(new.first_name),''),
      nullif(btrim(new.last_name),'')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists donations_before_write on public.donations;
create trigger donations_before_write
before insert or update on public.donations
for each row execute function public.donation_before_write();

alter table public.donations enable row level security;

drop policy if exists "admin read donations" on public.donations;
create policy "admin read donations"
on public.donations for select
to authenticated
using (public.is_site_admin());

drop policy if exists "admin update donations" on public.donations;
create policy "admin update donations"
on public.donations for update
to authenticated
using (public.is_site_admin())
with check (public.is_site_admin());

drop policy if exists "admin delete donations" on public.donations;
create policy "admin delete donations"
on public.donations for delete
to authenticated
using (public.is_site_admin());

grant select, update, delete on public.donations to authenticated;

-- Certificate running number by Buddhist year.
create table if not exists public.donation_certificate_counters (
  year_be integer primary key,
  last_no integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.donation_certificate_counters enable row level security;

drop policy if exists "admin read donation counters" on public.donation_certificate_counters;
create policy "admin read donation counters"
on public.donation_certificate_counters for select
to authenticated
using (public.is_site_admin());

grant select on public.donation_certificate_counters to authenticated;

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------
create or replace function public.donation_random_code(p_bytes integer default 6)
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select upper(substr(encode(gen_random_bytes(greatest(4,least(p_bytes,16))), 'hex'), 1, greatest(8,least(p_bytes*2,32))));
$$;

revoke all on function public.donation_random_code(integer) from public;

-- ------------------------------------------------------------
-- Public: create the row before slip upload.
-- Returns an upload token used only for the private slip path.
-- ------------------------------------------------------------
create or replace function public.create_donation_submission(p_payload jsonb)
returns table(id uuid, request_no text, history_code text, upload_token uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.donations;
  v_amount numeric(12,2);
  v_date date;
  v_time time;
  v_type text := coalesce(btrim(p_payload->>'donorType'),'');
  v_phone text := coalesce(btrim(p_payload->>'phone'),'');
  v_email text := lower(coalesce(btrim(p_payload->>'email'),''));
  v_history text := upper(coalesce(btrim(p_payload->>'historyCode'),''));
  v_request text;
  v_open boolean;
  i integer;
begin
  select is_open into v_open from public.donation_settings where id = 1;
  if coalesce(v_open,true) is false then
    raise exception 'ระบบรับบริจาคปิดรับรายการชั่วคราว';
  end if;

  if v_type not in ('layperson','monastic') then
    raise exception 'กรุณาเลือกประเภทผู้บริจาค';
  end if;

  if coalesce(btrim(p_payload->>'firstName'),'') = '' then
    raise exception 'กรุณาระบุชื่อ';
  end if;

  if v_type = 'layperson' and coalesce(btrim(p_payload->>'lastName'),'') = '' then
    raise exception 'กรุณาระบุนามสกุล';
  end if;

  if v_type = 'monastic' then
    if coalesce(btrim(p_payload->>'donorPrefix'),'') = '' then
      raise exception 'กรุณาเลือกคำนำหน้าพระ/สามเณร';
    end if;
    if coalesce(btrim(p_payload->>'templeName'),'') = '' then
      raise exception 'กรุณาระบุชื่อวัด';
    end if;
    if coalesce(btrim(p_payload->>'subdistrict'),'') = ''
      or coalesce(btrim(p_payload->>'district'),'') = ''
      or coalesce(btrim(p_payload->>'province'),'') = '' then
      raise exception 'กรุณาระบุตำบล อำเภอ และจังหวัดของวัด';
    end if;
  end if;

  if v_phone = '' and v_email = '' then
    raise exception 'กรุณาระบุเบอร์โทรศัพท์หรือ Email อย่างน้อย 1 ช่อง เพื่อใช้ดูประวัติย้อนหลัง';
  end if;

  if coalesce((p_payload->>'consentAccepted')::boolean,false) is not true then
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

  -- Reuse the browser's previous history code only when contact data also matches.
  if v_history ~ '^HIS-[A-F0-9]{12,24}$' and exists (
    select 1 from public.donations d
    where d.history_code = v_history
      and (
        (v_phone <> '' and regexp_replace(d.phone,'[^0-9]','','g') = regexp_replace(v_phone,'[^0-9]','','g'))
        or (v_email <> '' and lower(d.email) = v_email)
      )
  ) then
    null;
  else
    loop
      v_history := 'HIS-' || public.donation_random_code(8);
      exit when not exists (select 1 from public.donations where history_code = v_history);
    end loop;
  end if;

  for i in 1..8 loop
    v_request := 'REQ-' || to_char(current_date,'YYYYMMDD') || '-' || public.donation_random_code(4);
    exit when not exists (select 1 from public.donations where request_no = v_request);
  end loop;

  insert into public.donations (
    request_no, history_code, submission_state, status,
    donor_type, donor_prefix, first_name, dhamma_name, last_name,
    organization, temple_name, address_line, subdistrict, district, province, postal_code,
    phone, email,
    amount, transfer_date, transfer_time,
    donor_note, consent_accepted, show_public_name, show_public_amount,
    upload_token
  ) values (
    v_request, v_history, 'uploading', 'pending',
    v_type,
    coalesce(btrim(p_payload->>'donorPrefix'),''),
    coalesce(btrim(p_payload->>'firstName'),''),
    coalesce(btrim(p_payload->>'dhammaName'),''),
    coalesce(btrim(p_payload->>'lastName'),''),
    coalesce(btrim(p_payload->>'organization'),''),
    coalesce(btrim(p_payload->>'templeName'),''),
    coalesce(btrim(p_payload->>'addressLine'),''),
    coalesce(btrim(p_payload->>'subdistrict'),''),
    coalesce(btrim(p_payload->>'district'),''),
    coalesce(btrim(p_payload->>'province'),''),
    coalesce(btrim(p_payload->>'postalCode'),''),
    v_phone, v_email,
    v_amount, v_date, v_time,
    coalesce(p_payload->>'donorNote',''),
    true,
    coalesce((p_payload->>'showPublicName')::boolean,true),
    coalesce((p_payload->>'showPublicAmount')::boolean,true),
    gen_random_uuid()
  ) returning * into v_row;

  return query select v_row.id, v_row.request_no, v_row.history_code, v_row.upload_token;
end;
$$;

revoke all on function public.create_donation_submission(jsonb) from public;
grant execute on function public.create_donation_submission(jsonb) to anon, authenticated;

-- Public slip upload authorization.
-- Object path must be: <donation-id>/<upload-token>/<filename>
create or replace function public.can_upload_donation_slip(object_name text)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_id uuid;
  v_token uuid;
begin
  begin
    v_id := split_part(object_name, '/', 1)::uuid;
    v_token := split_part(object_name, '/', 2)::uuid;
  exception when others then
    return false;
  end;

  return exists (
    select 1 from public.donations d
    where d.id = v_id
      and d.upload_token = v_token
      and d.submission_state = 'uploading'
  );
end;
$$;

revoke all on function public.can_upload_donation_slip(text) from public;
grant execute on function public.can_upload_donation_slip(text) to anon, authenticated;

-- Public: finalize after slip upload.
create or replace function public.finalize_donation_submission(
  p_id uuid,
  p_upload_token uuid,
  p_slip_path text
)
returns table(request_no text, history_code text, submitted_at timestamptz, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.donations;
begin
  if coalesce(btrim(p_slip_path),'') = '' then
    raise exception 'กรุณาแนบหลักฐานการโอนเงิน';
  end if;

  update public.donations
  set slip_path = btrim(p_slip_path),
      submission_state = 'submitted',
      submitted_at = now(),
      upload_token = null
  where id = p_id
    and upload_token = p_upload_token
    and submission_state = 'uploading'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'ไม่สามารถยืนยันรายการได้ กรุณาลองใหม่';
  end if;

  return query select v_row.request_no, v_row.history_code, v_row.submitted_at, v_row.status;
end;
$$;

revoke all on function public.finalize_donation_submission(uuid,uuid,text) from public;
grant execute on function public.finalize_donation_submission(uuid,uuid,text) to anon, authenticated;

-- ------------------------------------------------------------
-- Public dashboard: only verified donations are aggregated.
-- No phone/email/address is exposed.
-- ------------------------------------------------------------
create or replace function public.get_donation_dashboard()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_total numeric(14,2);
  v_donations bigint;
  v_donors bigint;
  v_latest jsonb;
begin
  select coalesce(sum(amount),0), count(*), count(distinct history_code)
  into v_total, v_donations, v_donors
  from public.donations
  where status = 'verified' and submission_state = 'submitted';

  select coalesce(jsonb_agg(jsonb_build_object(
    'name', case when s.show_public_name then s.public_name else 'ผู้ไม่ประสงค์ออกนาม' end,
    'amount', case when s.show_public_amount then s.amount else null end,
    'date', s.transfer_date,
    'donorType', s.donor_type
  )), '[]'::jsonb)
  into v_latest
  from (
    select
      coalesce(nullif(certificate_name_override,''),display_name) as public_name,
      amount, transfer_date, donor_type, show_public_name, show_public_amount
    from public.donations
    where status = 'verified' and submission_state = 'submitted'
    order by verified_at desc nulls last, submitted_at desc
    limit 12
  ) s;

  return jsonb_build_object(
    'totalAmount', v_total,
    'donationCount', v_donations,
    'donorCount', v_donors,
    'latest', v_latest
  );
end;
$$;

revoke all on function public.get_donation_dashboard() from public;
grant execute on function public.get_donation_dashboard() to anon, authenticated;

-- History uses the random history code shown only to the donor.
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


-- Public verification / certificate data.

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

-- ------------------------------------------------------------
-- Manager: issue certificate number atomically.
-- Example: WNW-DN-2569-000001
-- ------------------------------------------------------------
create or replace function public.approve_donation(p_id uuid)
returns table(certificate_no text, certificate_issued_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.donations;
  v_year_be integer;
  v_serial integer;
  v_prefix text;
  v_cert text;
begin
  if not public.is_site_admin() then
    raise exception 'ไม่มีสิทธิ์ดำเนินการ';
  end if;

  select * into v_row
  from public.donations
  where id = p_id
  for update;

  if v_row.id is null then
    raise exception 'ไม่พบรายการบริจาค';
  end if;
  if v_row.submission_state <> 'submitted' then
    raise exception 'รายการนี้ยังส่งข้อมูลไม่สมบูรณ์';
  end if;

  if v_row.status = 'verified' and v_row.certificate_no is not null then
    return query select v_row.certificate_no, v_row.certificate_issued_at;
    return;
  end if;

  v_year_be := extract(year from current_date)::integer + 543;
  select coalesce(nullif(btrim(certificate_prefix),''),'WNW-DN')
  into v_prefix
  from public.donation_settings where id = 1;

  insert into public.donation_certificate_counters (year_be,last_no,updated_at)
  values (v_year_be,1,now())
  on conflict (year_be) do update
  set last_no = public.donation_certificate_counters.last_no + 1,
      updated_at = now()
  returning last_no into v_serial;

  v_cert := v_prefix || '-' || v_year_be::text || '-' || lpad(v_serial::text,6,'0');

  update public.donations
  set status = 'verified',
      verified_at = now(),
      verified_by = auth.uid(),
      rejected_at = null,
      rejected_by = null,
      certificate_no = v_cert,
      certificate_issued_at = now(),
      certificate_generation_status = 'not_generated',
      certificate_generation_error = ''
  where id = p_id
  returning * into v_row;

  return query select v_row.certificate_no, v_row.certificate_issued_at;
end;
$$;

revoke all on function public.approve_donation(uuid) from public;
grant execute on function public.approve_donation(uuid) to authenticated;

create or replace function public.reject_donation(p_id uuid, p_note text default '')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_site_admin() then
    raise exception 'ไม่มีสิทธิ์ดำเนินการ';
  end if;

  update public.donations
  set status = 'rejected',
      admin_note = coalesce(p_note,''),
      rejected_at = now(),
      rejected_by = auth.uid(),
      verified_at = null,
      verified_by = null
  where id = p_id and submission_state = 'submitted';

  return found;
end;
$$;

revoke all on function public.reject_donation(uuid,text) from public;
grant execute on function public.reject_donation(uuid,text) to authenticated;

-- ------------------------------------------------------------
-- Storage
-- donation-slips: private, public can upload only to an active token path.
-- donation-assets: public, manager-only writes (banner / QR / template).
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'donation-slips', 'donation-slips', false, 10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'donation-assets', 'donation-assets', true, 20971520,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- slips
drop policy if exists "public upload donation slips" on storage.objects;
create policy "public upload donation slips"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'donation-slips'
  and public.can_upload_donation_slip(name)
);

drop policy if exists "admin read donation slips" on storage.objects;
create policy "admin read donation slips"
on storage.objects for select
to authenticated
using (bucket_id = 'donation-slips' and public.is_site_admin());

drop policy if exists "admin delete donation slips" on storage.objects;
create policy "admin delete donation slips"
on storage.objects for delete
to authenticated
using (bucket_id = 'donation-slips' and public.is_site_admin());

-- public assets
drop policy if exists "public read donation assets" on storage.objects;
create policy "public read donation assets"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'donation-assets');

drop policy if exists "admin upload donation assets" on storage.objects;
create policy "admin upload donation assets"
on storage.objects for insert
to authenticated
with check (bucket_id = 'donation-assets' and public.is_site_admin());

drop policy if exists "admin update donation assets" on storage.objects;
create policy "admin update donation assets"
on storage.objects for update
to authenticated
using (bucket_id = 'donation-assets' and public.is_site_admin())
with check (bucket_id = 'donation-assets' and public.is_site_admin());

drop policy if exists "admin delete donation assets" on storage.objects;
create policy "admin delete donation assets"
on storage.objects for delete
to authenticated
using (bucket_id = 'donation-assets' and public.is_site_admin());

comment on table public.donations is
'Donation submissions, transfer evidence review, certificate numbers and donor history.';
comment on table public.donation_settings is
'Public donation campaign, bank details, banner and certificate template/layout settings.';
