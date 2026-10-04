-- WNW Donation V18 CLEAN FULL REPAIR
-- ใช้ไฟล์นี้แทน SQL V17 + V18 เดิม หากรันแล้ว error
-- ปลอดภัยกับข้อมูลเดิม: เพิ่มเฉพาะคอลัมน์ที่ยังไม่มี และสร้าง RPC ใหม่

-- 1) Ensure required columns exist
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS certificate_image_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS certificate_image_drive_file_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS photo_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_alumni boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS alumni_batch text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS giving_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_name text NOT NULL DEFAULT '';

-- 2) History by private history code
DROP FUNCTION IF EXISTS public.get_donation_history_v2(text);
CREATE FUNCTION public.get_donation_history_v2(p_history_code text)
RETURNS TABLE(
  request_no text,
  display_name text,
  amount numeric,
  transfer_date date,
  transfer_time time,
  status text,
  certificate_no text,
  certificate_issued_at timestamptz,
  certificate_pdf_url text,
  certificate_image_url text,
  certificate_generation_status text,
  admin_note text,
  photo_url text,
  is_alumni boolean,
  alumni_batch text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
BEGIN ATOMIC
  SELECT
    d.request_no,
    COALESCE(NULLIF(d.certificate_name_override, ''), d.display_name),
    d.amount,
    d.transfer_date,
    d.transfer_time,
    d.status,
    d.certificate_no,
    d.certificate_issued_at,
    CASE WHEN d.status = 'verified' THEN COALESCE(d.certificate_pdf_url, '') ELSE '' END,
    CASE WHEN d.status = 'verified' THEN COALESCE(d.certificate_image_url, '') ELSE '' END,
    CASE WHEN d.status = 'verified' THEN COALESCE(d.certificate_generation_status, 'not_generated') ELSE 'not_generated' END,
    CASE WHEN d.status = 'rejected' THEN COALESCE(d.admin_note, '') ELSE '' END,
    COALESCE(d.photo_url, ''),
    COALESCE(d.is_alumni, false),
    COALESCE(d.alumni_batch, '')
  FROM public.donations d
  WHERE d.history_code = UPPER(BTRIM(COALESCE(p_history_code, '')))
    AND d.submission_state = 'submitted'
  ORDER BY d.submitted_at DESC
  LIMIT 100;
END;

REVOKE ALL ON FUNCTION public.get_donation_history_v2(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_donation_history_v2(text) TO anon, authenticated;

-- 3) History by name + phone/email
DROP FUNCTION IF EXISTS public.get_donation_history_by_contact(text, text, text);
CREATE FUNCTION public.get_donation_history_by_contact(
  p_full_name text,
  p_phone text DEFAULT '',
  p_email text DEFAULT ''
)
RETURNS TABLE(
  request_no text,
  display_name text,
  amount numeric,
  transfer_date date,
  transfer_time time,
  status text,
  certificate_no text,
  certificate_issued_at timestamptz,
  certificate_pdf_url text,
  certificate_image_url text,
  certificate_generation_status text,
  admin_note text,
  photo_url text,
  is_alumni boolean,
  alumni_batch text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
BEGIN ATOMIC
  SELECT
    d.request_no,
    COALESCE(NULLIF(d.certificate_name_override, ''), d.display_name),
    d.amount,
    d.transfer_date,
    d.transfer_time,
    d.status,
    d.certificate_no,
    d.certificate_issued_at,
    CASE WHEN d.status = 'verified' THEN COALESCE(d.certificate_pdf_url, '') ELSE '' END,
    CASE WHEN d.status = 'verified' THEN COALESCE(d.certificate_image_url, '') ELSE '' END,
    CASE WHEN d.status = 'verified' THEN COALESCE(d.certificate_generation_status, 'not_generated') ELSE 'not_generated' END,
    CASE WHEN d.status = 'rejected' THEN COALESCE(d.admin_note, '') ELSE '' END,
    COALESCE(d.photo_url, ''),
    COALESCE(d.is_alumni, false),
    COALESCE(d.alumni_batch, '')
  FROM public.donations d
  WHERE d.submission_state = 'submitted'
    AND BTRIM(COALESCE(p_full_name, '')) <> ''
    AND (
      BTRIM(COALESCE(p_phone, '')) <> ''
      OR BTRIM(COALESCE(p_email, '')) <> ''
    )
    AND (
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          LOWER(COALESCE(NULLIF(d.certificate_name_override, ''), d.display_name)),
          '^(นาย|นางสาว|นาง|ดร[.]?|พระมหา|พระครู|พระ|สามเณร)[[:space:]]*',
          '',
          'g'
        ),
        '[[:space:]]+',
        '',
        'g'
      )
      LIKE '%' ||
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          LOWER(BTRIM(p_full_name)),
          '^(นาย|นางสาว|นาง|ดร[.]?|พระมหา|พระครู|พระ|สามเณร)[[:space:]]*',
          '',
          'g'
        ),
        '[[:space:]]+',
        '',
        'g'
      ) || '%'
      OR
      REGEXP_REPLACE(LOWER(COALESCE(d.contact_name, '')), '[[:space:]]+', '', 'g')
      LIKE '%' || REGEXP_REPLACE(LOWER(BTRIM(p_full_name)), '[[:space:]]+', '', 'g') || '%'
      OR
      REGEXP_REPLACE(LOWER(COALESCE(d.giving_name, '')), '[[:space:]]+', '', 'g')
      LIKE '%' || REGEXP_REPLACE(LOWER(BTRIM(p_full_name)), '[[:space:]]+', '', 'g') || '%'
    )
    AND (
      (
        LENGTH(REGEXP_REPLACE(COALESCE(p_phone, ''), '[^0-9]', '', 'g')) >= 9
        AND RIGHT(REGEXP_REPLACE(COALESCE(d.phone, ''), '[^0-9]', '', 'g'), 9)
          = RIGHT(REGEXP_REPLACE(COALESCE(p_phone, ''), '[^0-9]', '', 'g'), 9)
      )
      OR
      (
        BTRIM(COALESCE(p_email, '')) <> ''
        AND LOWER(BTRIM(COALESCE(d.email, ''))) = LOWER(BTRIM(p_email))
      )
    )
  ORDER BY d.submitted_at DESC
  LIMIT 100;
END;

REVOKE ALL ON FUNCTION public.get_donation_history_by_contact(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_donation_history_by_contact(text, text, text) TO anon, authenticated;

-- 4) Public certificate verification
DROP FUNCTION IF EXISTS public.verify_donation_certificate(text);
CREATE FUNCTION public.verify_donation_certificate(p_certificate_no text)
RETURNS TABLE(
  certificate_no text,
  display_name text,
  amount numeric,
  transfer_date date,
  certificate_issued_at timestamptz,
  certificate_pdf_url text,
  certificate_image_url text,
  certificate_generation_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
BEGIN ATOMIC
  SELECT
    d.certificate_no,
    COALESCE(NULLIF(d.certificate_name_override, ''), d.display_name),
    d.amount,
    d.transfer_date,
    d.certificate_issued_at,
    COALESCE(d.certificate_pdf_url, ''),
    COALESCE(d.certificate_image_url, ''),
    COALESCE(d.certificate_generation_status, 'not_generated')
  FROM public.donations d
  WHERE UPPER(d.certificate_no) = UPPER(BTRIM(COALESCE(p_certificate_no, '')))
    AND d.status = 'verified'
    AND d.certificate_no IS NOT NULL
  LIMIT 1;
END;

REVOKE ALL ON FUNCTION public.verify_donation_certificate(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_donation_certificate(text) TO anon, authenticated;

-- 5) Public donor directory
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
  certificate_image_url text,
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
    CASE
      WHEN d.show_public_name THEN COALESCE(NULLIF(d.certificate_name_override, ''), d.display_name)
      ELSE 'ผู้ไม่ประสงค์ออกนาม'
    END,
    CASE WHEN d.show_public_amount THEN d.amount ELSE NULL END,
    d.certificate_no,
    CASE WHEN d.certificate_generation_status = 'ready' THEN COALESCE(d.certificate_pdf_url, '') ELSE '' END,
    CASE WHEN d.certificate_generation_status = 'ready' THEN COALESCE(d.certificate_image_url, '') ELSE '' END,
    COALESCE(d.certificate_generation_status, 'not_generated'),
    CASE WHEN d.show_public_name THEN COALESCE(d.photo_url, '') ELSE '' END,
    CASE WHEN d.show_public_name THEN COALESCE(d.is_alumni, false) ELSE false END,
    CASE WHEN d.show_public_name AND COALESCE(d.is_alumni, false) THEN COALESCE(d.alumni_batch, '') ELSE '' END,
    COUNT(*) OVER()
  FROM public.donations d
  WHERE d.status = 'verified'
    AND d.submission_state = 'submitted'
    AND (
      BTRIM(COALESCE(p_search, '')) = ''
      OR (
        d.show_public_name
        AND COALESCE(NULLIF(d.certificate_name_override, ''), d.display_name)
          ILIKE '%' || BTRIM(p_search) || '%'
      )
      OR COALESCE(d.certificate_no, '') ILIKE '%' || BTRIM(p_search) || '%'
    )
  ORDER BY d.transfer_date DESC, d.transfer_time DESC, d.verified_at DESC NULLS LAST, d.submitted_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;

REVOKE ALL ON FUNCTION public.get_public_donor_directory(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_donor_directory(text, integer, integer) TO anon, authenticated;

-- 6) Quick check: should return true / function names if installation succeeded
SELECT
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'donations'
      AND column_name = 'certificate_image_url'
  ) AS certificate_image_column_ok,
  to_regprocedure('public.get_donation_history_v2(text)') IS NOT NULL AS history_code_rpc_ok,
  to_regprocedure('public.get_donation_history_by_contact(text,text,text)') IS NOT NULL AS contact_search_rpc_ok,
  to_regprocedure('public.verify_donation_certificate(text)') IS NOT NULL AS verify_rpc_ok,
  to_regprocedure('public.get_public_donor_directory(text,integer,integer)') IS NOT NULL AS donor_directory_rpc_ok;
