
BEGIN;

ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS certificate_image_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS certificate_image_drive_file_id text NOT NULL DEFAULT '';

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
AS $$
  SELECT
    d.request_no,
    COALESCE(NULLIF(d.certificate_name_override, ''), d.display_name) AS display_name,
    d.amount,
    d.transfer_date,
    d.transfer_time,
    d.status,
    d.certificate_no,
    d.certificate_issued_at,
    CASE WHEN d.status = 'verified' THEN COALESCE(d.certificate_pdf_url, '') ELSE '' END AS certificate_pdf_url,
    CASE WHEN d.status = 'verified' THEN COALESCE(d.certificate_image_url, '') ELSE '' END AS certificate_image_url,
    CASE WHEN d.status = 'verified' THEN d.certificate_generation_status ELSE 'not_generated' END AS certificate_generation_status,
    CASE WHEN d.status = 'rejected' THEN d.admin_note ELSE '' END AS admin_note,
    d.photo_url,
    d.is_alumni,
    d.alumni_batch
  FROM public.donations d
  WHERE d.history_code = UPPER(BTRIM(p_history_code))
    AND d.submission_state = 'submitted'
  ORDER BY d.submitted_at DESC
  LIMIT 100;
$$;
REVOKE ALL ON FUNCTION public.get_donation_history_v2(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_donation_history_v2(text) TO anon, authenticated;

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
AS $$
  SELECT
    d.certificate_no,
    COALESCE(NULLIF(d.certificate_name_override, ''), d.display_name) AS display_name,
    d.amount,
    d.transfer_date,
    d.certificate_issued_at,
    COALESCE(d.certificate_pdf_url, '') AS certificate_pdf_url,
    COALESCE(d.certificate_image_url, '') AS certificate_image_url,
    d.certificate_generation_status
  FROM public.donations d
  WHERE UPPER(d.certificate_no) = UPPER(BTRIM(p_certificate_no))
    AND d.status = 'verified'
    AND d.certificate_no IS NOT NULL
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.verify_donation_certificate(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_donation_certificate(text) TO anon, authenticated;

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
AS $$
  SELECT
    d.transfer_date,
    d.transfer_time,
    CASE WHEN d.show_public_name THEN COALESCE(NULLIF(d.certificate_name_override, ''), d.display_name) ELSE 'ผู้ไม่ประสงค์ออกนาม' END AS display_name,
    CASE WHEN d.show_public_amount THEN d.amount ELSE NULL END AS amount,
    d.certificate_no,
    CASE WHEN d.certificate_generation_status = 'ready' THEN COALESCE(d.certificate_pdf_url, '') ELSE '' END AS certificate_pdf_url,
    CASE WHEN d.certificate_generation_status = 'ready' THEN COALESCE(d.certificate_image_url, '') ELSE '' END AS certificate_image_url,
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
$$;
REVOKE ALL ON FUNCTION public.get_public_donor_directory(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_donor_directory(text, integer, integer) TO anon, authenticated;

COMMIT;
