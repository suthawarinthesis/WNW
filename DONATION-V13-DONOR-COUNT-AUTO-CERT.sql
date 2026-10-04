-- WNW Donation V13
-- Fix dashboard unique donor count.
-- The website-side automatic certificate flow is included in V13 files and needs no DB schema change.
-- Run this WHOLE file once after Donation V12.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_donation_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $wnw_dashboard$
DECLARE
  v_total numeric(14,2) := 0;
  v_donation_count bigint := 0;
  v_donor_count bigint := 0;
  v_latest jsonb := '[]'::jsonb;
BEGIN
  SELECT
    COALESCE(SUM(d.amount), 0),
    COUNT(*),
    COUNT(DISTINCT lower(btrim(regexp_replace(
      coalesce(nullif(d.certificate_name_override, ''), d.display_name),
      '[[:space:]]+', ' ', 'g'
    ))))
  INTO v_total, v_donation_count, v_donor_count
  FROM public.donations d
  WHERE d.status = 'verified'
    AND d.submission_state = 'submitted';

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', CASE WHEN x.show_public_name THEN x.public_name ELSE 'ผู้ไม่ประสงค์ออกนาม' END,
        'amount', CASE WHEN x.show_public_amount THEN x.amount ELSE NULL END,
        'date', x.transfer_date,
        'donorType', x.donor_type
      )
    ),
    '[]'::jsonb
  )
  INTO v_latest
  FROM (
    SELECT
      COALESCE(NULLIF(d.certificate_name_override,''), d.display_name) AS public_name,
      d.amount,
      d.transfer_date,
      d.donor_type,
      d.show_public_name,
      d.show_public_amount
    FROM public.donations d
    WHERE d.status = 'verified'
      AND d.submission_state = 'submitted'
    ORDER BY d.verified_at DESC NULLS LAST, d.submitted_at DESC
    LIMIT 12
  ) x;

  RETURN jsonb_build_object(
    'totalAmount', v_total,
    'donationCount', v_donation_count,
    'donorCount', v_donor_count,
    'latest', v_latest
  );
END
$wnw_dashboard$;

REVOKE ALL ON FUNCTION public.get_donation_dashboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_donation_dashboard() TO anon, authenticated;

COMMIT;
