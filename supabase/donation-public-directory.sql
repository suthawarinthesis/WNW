-- WNW Donation V12: Public Donor Directory
-- Run this WHOLE file once after Donation V11.
-- Public output contains only verified donation information intended for the donor directory.

BEGIN;

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

COMMIT;
