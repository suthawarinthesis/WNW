-- ============================================================
-- WNW Donation V23 — Backend Auto Process
-- ผู้บริจาคกดส่ง -> Supabase enqueue งานเอง -> ยืนยัน/ออกเลขใบ/
-- สร้างใบอนุโมทนาบัตร/สร้างภาพ พม.นิกร โดยไม่ต้องเปิด Manager
-- ============================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

ALTER TABLE public.donation_settings
  ADD COLUMN IF NOT EXISTS auto_process_on_submit boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS nikorn_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS nikorn_google_slides_template_id text NOT NULL DEFAULT '1aj3h3pMB-Ulz1SuldI-ckBlddfralVwF7sfx0x65cNE',
  ADD COLUMN IF NOT EXISTS nikorn_google_drive_folder_id text NOT NULL DEFAULT '1H_PEfawTOnn7LM4Pi6CSWJ6CYVnTo-iF',
  ADD COLUMN IF NOT EXISTS nikorn_fallback_photo_url text NOT NULL DEFAULT 'https://i.postimg.cc/Kz6vK8gM/Screenshot-2026-10-04-181000.png',
  ADD COLUMN IF NOT EXISTS verify_base_url text NOT NULL DEFAULT 'https://wnw-vit.site/donation/verify/?no=';

UPDATE public.donation_settings
SET auto_process_on_submit = true,
    google_apps_script_url = COALESCE(NULLIF(BTRIM(google_apps_script_url), ''), 'https://script.google.com/macros/s/AKfycby2RD2z8dMwB3Ajp0JPCPHN_rKFIL1M5IckIN4VyUMG2yNAV_2gW4kWaGjx-49CXECJ4A/exec'),
    google_slides_template_id = COALESCE(NULLIF(BTRIM(google_slides_template_id), ''), '1N0OEEhnCdfqn5ohtZa47pUfenVYizdePtXo9vGsVGy4'),
    google_drive_folder_id = COALESCE(NULLIF(BTRIM(google_drive_folder_id), ''), '1JUTSXLLdR7X5KiV6KINe6Nk85DS-YdYk'),
    nikorn_enabled = true,
    nikorn_google_slides_template_id = COALESCE(NULLIF(BTRIM(nikorn_google_slides_template_id), ''), '1aj3h3pMB-Ulz1SuldI-ckBlddfralVwF7sfx0x65cNE'),
    nikorn_google_drive_folder_id = COALESCE(NULLIF(BTRIM(nikorn_google_drive_folder_id), ''), '1H_PEfawTOnn7LM4Pi6CSWJ6CYVnTo-iF'),
    nikorn_fallback_photo_url = COALESCE(NULLIF(BTRIM(nikorn_fallback_photo_url), ''), 'https://i.postimg.cc/Kz6vK8gM/Screenshot-2026-10-04-181000.png'),
    verify_base_url = COALESCE(NULLIF(BTRIM(verify_base_url), ''), 'https://wnw-vit.site/donation/verify/?no=')
WHERE id = 1;

ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS certificate_image_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS certificate_image_drive_file_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS nikorn_image_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS nikorn_image_drive_file_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS nikorn_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS nikorn_generation_status text NOT NULL DEFAULT 'not_generated',
  ADD COLUMN IF NOT EXISTS nikorn_generation_error text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS auto_process_token uuid,
  ADD COLUMN IF NOT EXISTS auto_process_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_process_error text NOT NULL DEFAULT '';

ALTER TABLE public.donations DROP CONSTRAINT IF EXISTS donations_nikorn_generation_status_check;
ALTER TABLE public.donations
  ADD CONSTRAINT donations_nikorn_generation_status_check
  CHECK (nikorn_generation_status IN ('not_generated','generating','ready','error'));

CREATE TABLE IF NOT EXISTS public.donation_certificate_counters_v2 (
  prefix text NOT NULL,
  year_be integer NOT NULL,
  last_no integer NOT NULL DEFAULT 0 CHECK (last_no >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (prefix, year_be)
);

-- คืน id + token หลังส่งสลิป เพื่อความเข้ากันได้กับ frontend รุ่นก่อน
DROP FUNCTION IF EXISTS public.finalize_donation_submission(uuid, uuid, text);
CREATE FUNCTION public.finalize_donation_submission(
  p_id uuid,
  p_upload_token uuid,
  p_slip_path text
)
RETURNS TABLE(
  id uuid,
  request_no text,
  history_code text,
  submitted_at timestamptz,
  status text,
  auto_process_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_row public.donations%ROWTYPE;
BEGIN
  IF COALESCE(BTRIM(p_slip_path), '') = '' THEN
    RAISE EXCEPTION 'กรุณาแนบหลักฐานการโอนเงิน';
  END IF;

  IF p_slip_path NOT LIKE p_id::text || '/' || p_upload_token::text || '/%' THEN
    RAISE EXCEPTION 'ตำแหน่งไฟล์หลักฐานไม่ถูกต้อง';
  END IF;

  UPDATE public.donations d
  SET slip_path = BTRIM(p_slip_path),
      submission_state = 'submitted',
      submitted_at = NOW(),
      upload_token = NULL,
      auto_process_token = gen_random_uuid(),
      auto_process_started_at = NULL,
      auto_processed_at = NULL,
      auto_process_error = '',
      updated_at = NOW()
  WHERE d.id = p_id
    AND d.upload_token = p_upload_token
    AND d.submission_state = 'uploading'
  RETURNING d.* INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'ไม่สามารถยืนยันรายการได้ กรุณาลองใหม่';
  END IF;

  RETURN QUERY
  SELECT v_row.id, v_row.request_no, v_row.history_code, v_row.submitted_at, v_row.status, v_row.auto_process_token;
END;
$fn$;

REVOKE ALL ON FUNCTION public.finalize_donation_submission(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_donation_submission(uuid, uuid, text) TO anon, authenticated;

-- Claim งาน + ยืนยันอัตโนมัติ + ออกเลขใบ
DROP FUNCTION IF EXISTS public.auto_prepare_donation_processing(uuid, uuid);
CREATE FUNCTION public.auto_prepare_donation_processing(
  p_id uuid,
  p_auto_process_token uuid
)
RETURNS TABLE(
  donation_id uuid,
  request_no text,
  history_code text,
  display_name text,
  certificate_name text,
  amount numeric,
  certificate_no text,
  photo_url text,
  verify_base_url text,
  google_slides_template_id text,
  google_drive_folder_id text,
  nikorn_google_slides_template_id text,
  nikorn_google_drive_folder_id text,
  nikorn_fallback_photo_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_row public.donations%ROWTYPE;
  v_settings public.donation_settings%ROWTYPE;
  v_year_be integer;
  v_serial integer;
  v_prefix text;
  v_cert text;
BEGIN
  SELECT d.* INTO v_row
  FROM public.donations d
  WHERE d.id = p_id
    AND d.auto_process_token = p_auto_process_token
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'token งานอัตโนมัติไม่ถูกต้องหรือรายการถูกประมวลผลแล้ว';
  END IF;
  IF v_row.submission_state <> 'submitted' THEN
    RAISE EXCEPTION 'รายการนี้ยังส่งข้อมูลไม่สมบูรณ์';
  END IF;
  IF v_row.auto_process_started_at IS NOT NULL
     AND v_row.auto_process_started_at > NOW() - INTERVAL '10 minutes' THEN
    RAISE EXCEPTION 'รายการนี้กำลังถูกประมวลผลอยู่แล้ว';
  END IF;

  SELECT * INTO v_settings FROM public.donation_settings WHERE id = 1;

  IF COALESCE(v_row.certificate_no, '') = '' THEN
    v_year_be := EXTRACT(YEAR FROM (NOW() AT TIME ZONE 'Asia/Bangkok'))::integer + 543;
    v_prefix := UPPER(REGEXP_REPLACE(BTRIM(COALESCE(v_row.campaign_prefix, '')), '[^A-Za-z0-9-]', '', 'g'));
    IF v_prefix = '' THEN
      v_prefix := UPPER(REGEXP_REPLACE(BTRIM(COALESCE(v_settings.certificate_prefix, 'WNW-DN')), '[^A-Za-z0-9-]', '', 'g'));
    END IF;
    IF COALESCE(v_prefix, '') = '' THEN v_prefix := 'WNW-DN'; END IF;

    INSERT INTO public.donation_certificate_counters_v2(prefix, year_be, last_no, updated_at)
    VALUES (v_prefix, v_year_be, 1, NOW())
    ON CONFLICT (prefix, year_be) DO UPDATE
    SET last_no = public.donation_certificate_counters_v2.last_no + 1,
        updated_at = NOW()
    RETURNING last_no INTO v_serial;

    v_cert := v_prefix || '-' || v_year_be::text || '-' || LPAD(v_serial::text, 6, '0');
  ELSE
    v_cert := v_row.certificate_no;
  END IF;

  UPDATE public.donations d
  SET status = 'verified',
      verified_at = COALESCE(d.verified_at, NOW()),
      rejected_at = NULL,
      rejected_by = NULL,
      certificate_no = v_cert,
      certificate_issued_at = COALESCE(d.certificate_issued_at, NOW()),
      certificate_generation_status = CASE WHEN COALESCE(d.certificate_pdf_url,'') <> '' THEN 'ready' ELSE 'generating' END,
      certificate_generation_error = CASE WHEN COALESCE(d.certificate_pdf_url,'') <> '' THEN d.certificate_generation_error ELSE '' END,
      nikorn_generation_status = CASE WHEN COALESCE(d.nikorn_image_url,'') <> '' THEN 'ready' ELSE 'generating' END,
      nikorn_generation_error = CASE WHEN COALESCE(d.nikorn_image_url,'') <> '' THEN d.nikorn_generation_error ELSE '' END,
      auto_process_started_at = NOW(),
      auto_process_error = '',
      updated_at = NOW()
  WHERE d.id = p_id
  RETURNING d.* INTO v_row;

  RETURN QUERY
  SELECT
    v_row.id,
    v_row.request_no,
    v_row.history_code,
    v_row.display_name,
    COALESCE(NULLIF(v_row.certificate_name_override, ''), v_row.display_name),
    v_row.amount,
    v_row.certificate_no,
    COALESCE(v_row.photo_url, ''),
    COALESCE(NULLIF(v_settings.verify_base_url, ''), 'https://wnw-vit.site/donation/verify/?no='),
    COALESCE(NULLIF(v_settings.google_slides_template_id, ''), '1N0OEEhnCdfqn5ohtZa47pUfenVYizdePtXo9vGsVGy4'),
    COALESCE(NULLIF(v_settings.google_drive_folder_id, ''), '1JUTSXLLdR7X5KiV6KINe6Nk85DS-YdYk'),
    COALESCE(NULLIF(v_settings.nikorn_google_slides_template_id, ''), '1aj3h3pMB-Ulz1SuldI-ckBlddfralVwF7sfx0x65cNE'),
    COALESCE(NULLIF(v_settings.nikorn_google_drive_folder_id, ''), '1H_PEfawTOnn7LM4Pi6CSWJ6CYVnTo-iF'),
    COALESCE(NULLIF(v_settings.nikorn_fallback_photo_url, ''), 'https://i.postimg.cc/Kz6vK8gM/Screenshot-2026-10-04-181000.png');
END;
$fn$;

REVOKE ALL ON FUNCTION public.auto_prepare_donation_processing(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_prepare_donation_processing(uuid, uuid) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.auto_complete_donation_processing(uuid, uuid, text, text, text, text, text, text, text, text, text, text);
CREATE FUNCTION public.auto_complete_donation_processing(
  p_id uuid,
  p_auto_process_token uuid,
  p_certificate_pdf_url text DEFAULT '',
  p_certificate_drive_file_id text DEFAULT '',
  p_certificate_image_url text DEFAULT '',
  p_certificate_image_drive_file_id text DEFAULT '',
  p_certificate_generation_status text DEFAULT 'error',
  p_certificate_generation_error text DEFAULT '',
  p_nikorn_image_url text DEFAULT '',
  p_nikorn_image_drive_file_id text DEFAULT '',
  p_nikorn_generation_status text DEFAULT 'error',
  p_nikorn_generation_error text DEFAULT ''
)
RETURNS TABLE(
  certificate_no text,
  certificate_pdf_url text,
  certificate_image_url text,
  nikorn_image_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_row public.donations%ROWTYPE;
  v_cert_status text;
  v_nikorn_status text;
BEGIN
  SELECT d.* INTO v_row
  FROM public.donations d
  WHERE d.id = p_id
    AND d.auto_process_token = p_auto_process_token
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'ไม่พบรายการสำหรับบันทึกผลอัตโนมัติ';
  END IF;

  v_cert_status := CASE WHEN p_certificate_generation_status IN ('not_generated','generating','ready','error') THEN p_certificate_generation_status ELSE 'error' END;
  v_nikorn_status := CASE WHEN p_nikorn_generation_status IN ('not_generated','generating','ready','error') THEN p_nikorn_generation_status ELSE 'error' END;

  UPDATE public.donations d
  SET certificate_pdf_url = COALESCE(p_certificate_pdf_url, ''),
      certificate_drive_file_id = COALESCE(p_certificate_drive_file_id, ''),
      certificate_image_url = COALESCE(p_certificate_image_url, ''),
      certificate_image_drive_file_id = COALESCE(p_certificate_image_drive_file_id, ''),
      certificate_generated_at = CASE WHEN v_cert_status = 'ready' THEN NOW() ELSE d.certificate_generated_at END,
      certificate_generation_status = v_cert_status,
      certificate_generation_error = COALESCE(p_certificate_generation_error, ''),
      nikorn_image_url = COALESCE(p_nikorn_image_url, ''),
      nikorn_image_drive_file_id = COALESCE(p_nikorn_image_drive_file_id, ''),
      nikorn_generated_at = CASE WHEN v_nikorn_status = 'ready' THEN NOW() ELSE d.nikorn_generated_at END,
      nikorn_generation_status = v_nikorn_status,
      nikorn_generation_error = COALESCE(p_nikorn_generation_error, ''),
      auto_processed_at = NOW(),
      auto_process_error = CONCAT_WS(' | ',
        NULLIF(COALESCE(p_certificate_generation_error, ''), ''),
        NULLIF(COALESCE(p_nikorn_generation_error, ''), '')
      ),
      auto_process_token = NULL,
      updated_at = NOW()
  WHERE d.id = p_id
  RETURNING d.* INTO v_row;

  RETURN QUERY
  SELECT v_row.certificate_no, v_row.certificate_pdf_url, v_row.certificate_image_url, v_row.nikorn_image_url;
END;
$fn$;

REVOKE ALL ON FUNCTION public.auto_complete_donation_processing(uuid, uuid, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_complete_donation_processing(uuid, uuid, text, text, text, text, text, text, text, text, text, text) TO anon, authenticated;

-- Supabase จะเป็นคนยิง Web App หลังรายการเปลี่ยนเป็น submitted
CREATE OR REPLACE FUNCTION public.enqueue_donation_auto_processing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_enabled boolean := true;
  v_url text := '';
BEGIN
  IF NEW.submission_state = 'submitted'
     AND OLD.submission_state IS DISTINCT FROM NEW.submission_state
     AND NEW.auto_process_token IS NOT NULL THEN

    SELECT COALESCE(s.auto_process_on_submit, true), COALESCE(BTRIM(s.google_apps_script_url), '')
      INTO v_enabled, v_url
    FROM public.donation_settings s
    WHERE s.id = 1;

    IF v_enabled
       AND v_url ~ '^https://script[.]google[.]com/macros/s/.+/exec([?].*)?$' THEN
      PERFORM net.http_post(
        url := v_url,
        body := jsonb_build_object(
          'action', 'auto_process_submission',
          'donation_id', NEW.id::text,
          'auto_process_token', NEW.auto_process_token::text
        ),
        headers := jsonb_build_object('Content-Type','application/json'),
        timeout_milliseconds := 10000
      );
    ELSE
      UPDATE public.donations
      SET auto_process_error = 'ไม่ได้ enqueue: ปิด auto_process_on_submit หรือ Google Apps Script URL ไม่ถูกต้อง',
          updated_at = NOW()
      WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS donations_auto_process_after_submit ON public.donations;
CREATE TRIGGER donations_auto_process_after_submit
AFTER UPDATE OF submission_state ON public.donations
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_donation_auto_processing();

NOTIFY pgrst, 'reload schema';
COMMIT;
