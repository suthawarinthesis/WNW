-- WNW Donation V18 — Donor history search by name + phone/email
-- Safe upgrade: preserves existing donation data.

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
  WHERE d.submission_state = 'submitted'
    AND BTRIM(COALESCE(p_full_name, '')) <> ''
    AND (
      BTRIM(COALESCE(p_phone, '')) <> ''
      OR BTRIM(COALESCE(p_email, '')) <> ''
    )
    AND (
      REGEXP_REPLACE(LOWER(COALESCE(NULLIF(d.certificate_name_override, ''), d.display_name)), '[[:space:]]+', '', 'g')
        LIKE '%' || REGEXP_REPLACE(LOWER(BTRIM(p_full_name)), '[[:space:]]+', '', 'g') || '%'
      OR REGEXP_REPLACE(LOWER(COALESCE(d.contact_name, '')), '[[:space:]]+', '', 'g')
        LIKE '%' || REGEXP_REPLACE(LOWER(BTRIM(p_full_name)), '[[:space:]]+', '', 'g') || '%'
      OR REGEXP_REPLACE(LOWER(COALESCE(d.giving_name, '')), '[[:space:]]+', '', 'g')
        LIKE '%' || REGEXP_REPLACE(LOWER(BTRIM(p_full_name)), '[[:space:]]+', '', 'g') || '%'
    )
    AND (
      (
        LENGTH(REGEXP_REPLACE(COALESCE(p_phone, ''), '[^0-9]', '', 'g')) >= 9
        AND RIGHT(REGEXP_REPLACE(COALESCE(d.phone, ''), '[^0-9]', '', 'g'), 9)
          = RIGHT(REGEXP_REPLACE(COALESCE(p_phone, ''), '[^0-9]', '', 'g'), 9)
      )
      OR (
        BTRIM(COALESCE(p_email, '')) <> ''
        AND LOWER(BTRIM(COALESCE(d.email, ''))) = LOWER(BTRIM(p_email))
      )
    )
  ORDER BY d.submitted_at DESC
  LIMIT 100;
END;

REVOKE ALL ON FUNCTION public.get_donation_history_by_contact(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_donation_history_by_contact(text, text, text) TO anon, authenticated;
