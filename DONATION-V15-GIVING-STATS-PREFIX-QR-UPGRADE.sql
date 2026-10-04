-- WNW Donation V15
-- Adds: giving-on-behalf type, campaigns + per-campaign certificate prefixes,
-- period dashboard stats, and QR verification support metadata.
-- Run ONCE after Donation V14. Existing donation records are preserved.

BEGIN;

-- 1) Campaigns / events -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.donation_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  prefix text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CONSTRAINT donation_campaigns_prefix_format CHECK (prefix ~ '^[A-Z0-9][A-Z0-9-]{1,19}$')
);

CREATE INDEX IF NOT EXISTS donation_campaigns_active_idx
  ON public.donation_campaigns (is_active, is_default DESC, sort_order, name);
CREATE UNIQUE INDEX IF NOT EXISTS donation_campaigns_prefix_unique_idx
  ON public.donation_campaigns (UPPER(prefix));

ALTER TABLE public.donation_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "donation campaigns public read active" ON public.donation_campaigns;
CREATE POLICY "donation campaigns public read active"
ON public.donation_campaigns FOR SELECT TO anon, authenticated
USING (is_active OR public.is_site_admin());

DROP POLICY IF EXISTS "donation campaigns manager insert" ON public.donation_campaigns;
CREATE POLICY "donation campaigns manager insert"
ON public.donation_campaigns FOR INSERT TO authenticated
WITH CHECK (public.is_site_admin());

DROP POLICY IF EXISTS "donation campaigns manager update" ON public.donation_campaigns;
CREATE POLICY "donation campaigns manager update"
ON public.donation_campaigns FOR UPDATE TO authenticated
USING (public.is_site_admin()) WITH CHECK (public.is_site_admin());

DROP POLICY IF EXISTS "donation campaigns manager delete" ON public.donation_campaigns;
CREATE POLICY "donation campaigns manager delete"
ON public.donation_campaigns FOR DELETE TO authenticated
USING (public.is_site_admin());

GRANT SELECT ON public.donation_campaigns TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.donation_campaigns TO authenticated;

-- Seed one campaign from the current Donation settings when none exists.
INSERT INTO public.donation_campaigns (name, prefix, description, is_active, is_default, sort_order)
SELECT
  COALESCE(NULLIF(BTRIM(s.campaign_title), ''), 'ร่วมทำบุญเพื่อการศึกษา'),
  UPPER(COALESCE(NULLIF(REGEXP_REPLACE(BTRIM(s.certificate_prefix), '[^A-Za-z0-9-]', '', 'g'), ''), 'WNW')),
  COALESCE(s.campaign_description, ''),
  true,
  true,
  0
FROM public.donation_settings s
WHERE s.id = 1
  AND NOT EXISTS (SELECT 1 FROM public.donation_campaigns);

-- Ensure exactly one existing campaign is preferred as default if none is marked.
UPDATE public.donation_campaigns c
SET is_default = true, updated_at = now()
WHERE c.id = (
  SELECT x.id FROM public.donation_campaigns x
  ORDER BY x.is_active DESC, x.sort_order, x.created_at
  LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM public.donation_campaigns d WHERE d.is_default);

-- 2) Donation record snapshots ----------------------------------------------
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS giving_as_type text NOT NULL DEFAULT 'person',
  ADD COLUMN IF NOT EXISTS giving_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS campaign_id uuid,
  ADD COLUMN IF NOT EXISTS campaign_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS campaign_prefix text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS donations_campaign_idx
  ON public.donations (campaign_prefix, transfer_date DESC, submitted_at DESC);
CREATE INDEX IF NOT EXISTS donations_giving_as_idx
  ON public.donations (giving_as_type, submitted_at DESC);

-- Backfill existing records with the default campaign snapshot.
UPDATE public.donations d
SET
  giving_as_type = COALESCE(NULLIF(d.giving_as_type, ''), 'person'),
  giving_name = CASE WHEN COALESCE(d.giving_name, '') = '' THEN COALESCE(NULLIF(d.certificate_name_override, ''), d.display_name) ELSE d.giving_name END,
  contact_name = CASE WHEN COALESCE(d.contact_name, '') = '' THEN d.display_name ELSE d.contact_name END,
  campaign_id = COALESCE(d.campaign_id, c.id),
  campaign_name = CASE WHEN COALESCE(d.campaign_name, '') = '' THEN c.name ELSE d.campaign_name END,
  campaign_prefix = CASE WHEN COALESCE(d.campaign_prefix, '') = '' THEN c.prefix ELSE d.campaign_prefix END,
  updated_at = now()
FROM (
  SELECT id, name, prefix
  FROM public.donation_campaigns
  ORDER BY is_default DESC, is_active DESC, sort_order, created_at
  LIMIT 1
) c
WHERE COALESCE(d.campaign_name, '') = '' OR COALESCE(d.campaign_prefix, '') = '' OR d.campaign_id IS NULL;

-- 3) Verification base URL ---------------------------------------------------
ALTER TABLE public.donation_settings
  ADD COLUMN IF NOT EXISTS verify_base_url text NOT NULL DEFAULT 'https://wnw-vit.site/donation/verify/?no=';

UPDATE public.donation_settings
SET verify_base_url = 'https://wnw-vit.site/donation/verify/?no='
WHERE id = 1 AND COALESCE(BTRIM(verify_base_url), '') = '';

-- 4) Public helper: save V15 fields before the slip is finalized -------------
DROP FUNCTION IF EXISTS public.set_donation_v15_extras(uuid, uuid, text, text, text, uuid);
CREATE FUNCTION public.set_donation_v15_extras(
  p_id uuid,
  p_upload_token uuid,
  p_giving_as_type text DEFAULT 'person',
  p_giving_name text DEFAULT '',
  p_contact_name text DEFAULT '',
  p_campaign_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $wnw_v15_extras$
DECLARE
  v_type text := LOWER(BTRIM(COALESCE(p_giving_as_type, 'person')));
  v_name text := BTRIM(COALESCE(p_giving_name, ''));
  v_contact text := BTRIM(COALESCE(p_contact_name, ''));
  v_campaign public.donation_campaigns%ROWTYPE;
  v_changed integer := 0;
BEGIN
  IF v_type NOT IN ('person','family','shop','company','alumni_group','host_group') THEN
    RAISE EXCEPTION 'ประเภทร่วมบุญในนามไม่ถูกต้อง';
  END IF;

  IF v_type <> 'person' AND v_name = '' THEN
    RAISE EXCEPTION 'กรุณาระบุชื่อครอบครัว ร้านค้า บริษัท หรือคณะที่ร่วมบุญ';
  END IF;

  IF p_campaign_id IS NOT NULL THEN
    SELECT * INTO v_campaign
    FROM public.donation_campaigns c
    WHERE c.id = p_campaign_id AND c.is_active
    LIMIT 1;
  END IF;

  IF v_campaign.id IS NULL THEN
    SELECT * INTO v_campaign
    FROM public.donation_campaigns c
    WHERE c.is_active
    ORDER BY c.is_default DESC, c.sort_order, c.created_at
    LIMIT 1;
  END IF;

  IF v_campaign.id IS NULL THEN
    RAISE EXCEPTION 'ยังไม่ได้ตั้งโครงการ/งานรับบริจาค';
  END IF;

  UPDATE public.donations d
  SET
    giving_as_type = v_type,
    giving_name = CASE WHEN v_type = 'person' THEN d.display_name ELSE v_name END,
    contact_name = CASE WHEN v_contact <> '' THEN v_contact ELSE d.display_name END,
    display_name = CASE WHEN v_type = 'person' THEN d.display_name ELSE v_name END,
    campaign_id = v_campaign.id,
    campaign_name = v_campaign.name,
    campaign_prefix = v_campaign.prefix,
    updated_at = now()
  WHERE d.id = p_id
    AND d.upload_token = p_upload_token
    AND d.submission_state = 'uploading';

  GET DIAGNOSTICS v_changed = ROW_COUNT;
  RETURN v_changed = 1;
END
$wnw_v15_extras$;

REVOKE ALL ON FUNCTION public.set_donation_v15_extras(uuid, uuid, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_donation_v15_extras(uuid, uuid, text, text, text, uuid) TO anon, authenticated;

-- 5) Per-campaign certificate counters --------------------------------------
CREATE TABLE IF NOT EXISTS public.donation_certificate_counters_v2 (
  prefix text NOT NULL,
  year_be integer NOT NULL,
  last_no integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (prefix, year_be)
);

-- Seed the new counters from already-issued certificate numbers.
INSERT INTO public.donation_certificate_counters_v2(prefix, year_be, last_no, updated_at)
SELECT
  (m)[1] AS prefix,
  ((m)[2])::integer AS year_be,
  MAX(((m)[3])::integer) AS last_no,
  now()
FROM (
  SELECT regexp_match(UPPER(d.certificate_no), '^(.+)-([0-9]{4})-([0-9]{4,8})$') AS m
  FROM public.donations d
  WHERE d.certificate_no IS NOT NULL
) q
WHERE m IS NOT NULL
GROUP BY (m)[1], ((m)[2])::integer
ON CONFLICT (prefix, year_be) DO UPDATE
SET last_no = GREATEST(public.donation_certificate_counters_v2.last_no, EXCLUDED.last_no),
    updated_at = now();

-- New approval RPC: issue certificate number using the donation's campaign prefix.
DROP FUNCTION IF EXISTS public.approve_donation_v2(uuid);
CREATE FUNCTION public.approve_donation_v2(p_id uuid)
RETURNS TABLE(certificate_no text, certificate_issued_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $wnw_approve_v2$
DECLARE
  v_row public.donations%ROWTYPE;
  v_year_be integer;
  v_serial integer;
  v_prefix text;
  v_cert text;
BEGIN
  IF NOT public.is_site_admin() THEN
    RAISE EXCEPTION 'ไม่มีสิทธิ์ดำเนินการ';
  END IF;

  SELECT d.* INTO v_row
  FROM public.donations d
  WHERE d.id = p_id
  FOR UPDATE;

  IF v_row.id IS NULL THEN RAISE EXCEPTION 'ไม่พบรายการบริจาค'; END IF;
  IF v_row.submission_state <> 'submitted' THEN RAISE EXCEPTION 'รายการนี้ยังส่งข้อมูลไม่สมบูรณ์'; END IF;

  IF v_row.status = 'verified' AND v_row.certificate_no IS NOT NULL THEN
    RETURN QUERY SELECT v_row.certificate_no, v_row.certificate_issued_at;
    RETURN;
  END IF;

  v_year_be := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Asia/Bangkok'))::integer + 543;
  v_prefix := UPPER(REGEXP_REPLACE(BTRIM(COALESCE(v_row.campaign_prefix, '')), '[^A-Za-z0-9-]', '', 'g'));

  IF v_prefix = '' THEN
    SELECT UPPER(REGEXP_REPLACE(BTRIM(COALESCE(s.certificate_prefix, 'WNW')), '[^A-Za-z0-9-]', '', 'g'))
    INTO v_prefix FROM public.donation_settings s WHERE s.id = 1;
  END IF;
  IF COALESCE(v_prefix, '') = '' THEN v_prefix := 'WNW'; END IF;

  INSERT INTO public.donation_certificate_counters_v2(prefix, year_be, last_no, updated_at)
  VALUES (v_prefix, v_year_be, 1, now())
  ON CONFLICT (prefix, year_be) DO UPDATE
  SET last_no = public.donation_certificate_counters_v2.last_no + 1,
      updated_at = now()
  RETURNING last_no INTO v_serial;

  v_cert := v_prefix || '-' || v_year_be::text || '-' || LPAD(v_serial::text, 6, '0');

  UPDATE public.donations d
  SET status = 'verified',
      verified_at = now(),
      verified_by = auth.uid(),
      rejected_at = null,
      rejected_by = null,
      certificate_no = v_cert,
      certificate_issued_at = now(),
      certificate_generation_status = 'not_generated',
      certificate_generation_error = '',
      updated_at = now()
  WHERE d.id = p_id
  RETURNING d.* INTO v_row;

  RETURN QUERY SELECT v_row.certificate_no, v_row.certificate_issued_at;
END
$wnw_approve_v2$;

REVOKE ALL ON FUNCTION public.approve_donation_v2(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_donation_v2(uuid) TO authenticated;

-- 6) Dashboard periods -------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_donation_dashboard_v2();
CREATE FUNCTION public.get_donation_dashboard_v2()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $wnw_dashboard_v2$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_latest jsonb := '[]'::jsonb;
  v_periods jsonb := '{}'::jsonb;
BEGIN
  WITH base AS (
    SELECT
      d.*,
      LOWER(BTRIM(REGEXP_REPLACE(COALESCE(NULLIF(d.certificate_name_override, ''), d.display_name), '[[:space:]]+', ' ', 'g'))) AS donor_key
    FROM public.donations d
    WHERE d.status = 'verified' AND d.submission_state = 'submitted'
  ), stats AS (
    SELECT 'today' AS key, COALESCE(SUM(amount),0)::numeric(14,2) amount, COUNT(*) items, COUNT(DISTINCT donor_key) donors FROM base WHERE transfer_date = v_today
    UNION ALL
    SELECT 'month', COALESCE(SUM(amount),0)::numeric(14,2), COUNT(*), COUNT(DISTINCT donor_key) FROM base WHERE transfer_date >= date_trunc('month', v_today)::date AND transfer_date < (date_trunc('month', v_today) + interval '1 month')::date
    UNION ALL
    SELECT 'year', COALESCE(SUM(amount),0)::numeric(14,2), COUNT(*), COUNT(DISTINCT donor_key) FROM base WHERE transfer_date >= date_trunc('year', v_today)::date AND transfer_date < (date_trunc('year', v_today) + interval '1 year')::date
    UNION ALL
    SELECT 'all', COALESCE(SUM(amount),0)::numeric(14,2), COUNT(*), COUNT(DISTINCT donor_key) FROM base
  )
  SELECT jsonb_object_agg(key, jsonb_build_object('totalAmount', amount, 'donationCount', items, 'donorCount', donors))
  INTO v_periods FROM stats;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'name', CASE WHEN x.show_public_name THEN x.public_name ELSE 'ผู้ไม่ประสงค์ออกนาม' END,
    'amount', CASE WHEN x.show_public_amount THEN x.amount ELSE NULL END,
    'date', x.transfer_date,
    'donorType', x.donor_type,
    'campaignName', x.campaign_name,
    'givingAsType', x.giving_as_type
  )), '[]'::jsonb)
  INTO v_latest
  FROM (
    SELECT COALESCE(NULLIF(d.certificate_name_override,''), d.display_name) public_name,
           d.amount, d.transfer_date, d.donor_type, d.show_public_name, d.show_public_amount,
           d.campaign_name, d.giving_as_type
    FROM public.donations d
    WHERE d.status='verified' AND d.submission_state='submitted'
    ORDER BY d.verified_at DESC NULLS LAST, d.submitted_at DESC
    LIMIT 12
  ) x;

  RETURN jsonb_build_object('periods', COALESCE(v_periods,'{}'::jsonb), 'latest', v_latest);
END
$wnw_dashboard_v2$;

REVOKE ALL ON FUNCTION public.get_donation_dashboard_v2() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_donation_dashboard_v2() TO anon, authenticated;

COMMIT;
