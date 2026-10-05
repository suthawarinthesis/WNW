-- WNW Donation V24.1 SAFE PATCH
-- แก้ปัญหา: unterminated dollar-quoted string
-- ไฟล์นี้ตั้งใจหลีกเลี่ยง $fn$ ทั้งหมด
-- ใช้หลัง V23 ได้ทันที และไม่แก้/ลบข้อมูลบริจาคเดิม

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

ALTER TABLE public.donation_settings
  ADD COLUMN IF NOT EXISTS auto_process_on_submit boolean NOT NULL DEFAULT true;

UPDATE public.donation_settings
SET auto_process_on_submit = COALESCE(auto_process_on_submit, true)
WHERE id = 1;

ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS nikorn_image_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS nikorn_image_drive_file_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS nikorn_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS nikorn_generation_status text NOT NULL DEFAULT 'not_generated',
  ADD COLUMN IF NOT EXISTS nikorn_generation_error text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS auto_process_token uuid,
  ADD COLUMN IF NOT EXISTS auto_process_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_process_error text NOT NULL DEFAULT '';

ALTER TABLE public.donations
  DROP CONSTRAINT IF EXISTS donations_nikorn_generation_status_check;

ALTER TABLE public.donations
  ADD CONSTRAINT donations_nikorn_generation_status_check
  CHECK (nikorn_generation_status IN ('not_generated','generating','ready','error'));

DROP FUNCTION IF EXISTS public.enqueue_donation_auto_processing();

CREATE FUNCTION public.enqueue_donation_auto_processing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS '
DECLARE
  v_enabled boolean := true;
  v_url text := '''';
BEGIN
  IF NEW.submission_state = ''submitted''
     AND OLD.submission_state IS DISTINCT FROM NEW.submission_state
     AND NEW.auto_process_token IS NOT NULL THEN

    SELECT COALESCE(s.auto_process_on_submit, true), COALESCE(BTRIM(s.google_apps_script_url), '''')
      INTO v_enabled, v_url
    FROM public.donation_settings s
    WHERE s.id = 1;

    IF v_enabled
       AND v_url ~ ''^https://script[.]google[.]com/macros/s/.+/exec([?].*)?$'' THEN
      PERFORM net.http_post(
        url := v_url,
        body := jsonb_build_object(
          ''action'', ''auto_process_submission'',
          ''donation_id'', NEW.id::text,
          ''auto_process_token'', NEW.auto_process_token::text
        ),
        headers := jsonb_build_object(''Content-Type'', ''application/json''),
        timeout_milliseconds := 120000
      );
    ELSE
      UPDATE public.donations
      SET auto_process_error = ''ไม่ได้ enqueue: ปิด auto_process_on_submit หรือ Google Apps Script URL ไม่ถูกต้อง'',
          updated_at = NOW()
      WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
';

DROP TRIGGER IF EXISTS donations_auto_process_after_submit ON public.donations;

CREATE TRIGGER donations_auto_process_after_submit
AFTER UPDATE OF submission_state ON public.donations
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_donation_auto_processing();

NOTIFY pgrst, 'reload schema';

COMMIT;
