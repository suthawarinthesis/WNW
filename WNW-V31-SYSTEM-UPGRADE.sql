-- WNW V31 SCHOOL SYSTEM UPGRADE
-- 60-second guide / responsibilities / emergency / maintenance / error logs / SEO settings
-- ไม่ลบข้อมูลเดิม

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- 1) Error log table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'website',
  level text NOT NULL DEFAULT 'error',
  message text NOT NULL,
  page_url text,
  user_agent text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz
);

ALTER TABLE public.site_error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_error_logs_admin_read" ON public.site_error_logs;
CREATE POLICY "site_error_logs_admin_read"
ON public.site_error_logs
FOR SELECT
TO authenticated
USING (public.is_site_admin());

DROP POLICY IF EXISTS "site_error_logs_admin_update" ON public.site_error_logs;
CREATE POLICY "site_error_logs_admin_update"
ON public.site_error_logs
FOR UPDATE
TO authenticated
USING (public.is_site_admin())
WITH CHECK (public.is_site_admin());

DROP POLICY IF EXISTS "site_error_logs_admin_delete" ON public.site_error_logs;
CREATE POLICY "site_error_logs_admin_delete"
ON public.site_error_logs
FOR DELETE
TO authenticated
USING (public.is_site_admin());

CREATE OR REPLACE FUNCTION public.log_site_error_v1(
  p_source text,
  p_level text,
  p_message text,
  p_page_url text DEFAULT '',
  p_user_agent text DEFAULT '',
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source text := left(coalesce(nullif(btrim(p_source),''),'website'),120);
  v_level text := CASE WHEN p_level IN ('info','warning','error','critical') THEN p_level ELSE 'error' END;
  v_message text := left(coalesce(nullif(btrim(p_message),''),'Unknown error'),1000);
  v_page text := left(coalesce(p_page_url,''),1000);
BEGIN
  -- deduplicate identical events within 10 minutes
  IF EXISTS (
    SELECT 1 FROM public.site_error_logs
    WHERE created_at > now() - interval '10 minutes'
      AND source = v_source
      AND message = v_message
      AND page_url = v_page
  ) THEN
    RETURN true;
  END IF;

  INSERT INTO public.site_error_logs(source,level,message,page_url,user_agent,meta)
  VALUES (v_source,v_level,v_message,v_page,left(coalesce(p_user_agent,''),500),coalesce(p_meta,'{}'::jsonb));
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.log_site_error_v1(text,text,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_site_error_v1(text,text,text,text,text,jsonb) TO anon, authenticated;

-- ------------------------------------------------------------
-- 2) Extend site settings without removing existing keys
-- ------------------------------------------------------------
INSERT INTO public.site_settings (id,data,updated_at)
VALUES (1,'{}'::jsonb,now())
ON CONFLICT (id) DO NOTHING;

UPDATE public.site_settings
SET data =
  coalesce(data,'{}'::jsonb)
  || jsonb_build_object(
    'seo', coalesce(data->'seo','{}'::jsonb) || jsonb_build_object(
      'publicBaseUrl', coalesce(data->'seo'->>'publicBaseUrl',''),
      'schoolDescription', 'โรงเรียนวัดหนองแวงวิทยา โรงเรียนพระปริยัติธรรม แผนกธรรม บาลี และสามัญศึกษา ณ วัดหนองแวงพระอารามหลวง จังหวัดขอนแก่น'
    ),
    'siteMaintenance', coalesce(data->'siteMaintenance','{}'::jsonb) || jsonb_build_object(
      'enabled', false,
      'title', coalesce(data->'siteMaintenance'->>'title','เว็บไซต์กำลังปรับปรุง'),
      'message', coalesce(data->'siteMaintenance'->>'message','ขออภัยในความไม่สะดวก โรงเรียนกำลังปรับปรุงระบบเพื่อให้บริการได้ดียิ่งขึ้น')
    ),
    'school60', coalesce(data->'school60','{}'::jsonb) || jsonb_build_object(
      'headline','รู้จักโรงเรียนวัดหนองแวงวิทยาใน 60 วินาที',
      'summary','โรงเรียนพระปริยัติธรรมสำหรับสามเณร เรียนทั้งธรรม บาลี และวิชาสามัญ ควบคู่การพัฒนาคุณธรรมและความรู้',
      'dhamma','แผนกธรรม — เรียนนักธรรมและหลักธรรมทางพระพุทธศาสนา เพื่อสร้างพื้นฐานการปฏิบัติและการดำเนินชีวิต',
      'pali','แผนกบาลี — เน้นภาษาบาลีและพระปริยัติธรรม เป็นหนึ่งในจุดเด่นสำคัญของโรงเรียน',
      'general','แผนกสามัญ — เรียนรายวิชาสามัญควบคู่กับการศึกษาพระปริยัติธรรม เพื่อศึกษาต่อในระดับที่สูงขึ้นได้',
      'cost','บวชเรียนฟรี ไม่มีค่าใช้จ่าย',
      'highlight','เด่นด้านพระปริยัติธรรมและภาษาบาลี พร้อมบรรยากาศการเรียนรู้ภายในวัดหนองแวงพระอารามหลวง',
      'venue','วัดหนองแวงพระอารามหลวง 593 ถ.กลางเมือง อ.เมือง จ.ขอนแก่น 40000',
      'applyOnlineUrl','./admission/',
      'applyOnsite','สมัครออนไซต์ได้ที่โรงเรียนวัดหนองแวงวิทยา ภายในวัดหนองแวงพระอารามหลวง'
    )
  ),
updated_at=now()
WHERE id=1;

-- Insert defaults only when arrays are missing
UPDATE public.site_settings
SET data = jsonb_set(
  data,
  '{responsibilities}',
  CASE WHEN jsonb_typeof(data->'responsibilities')='array' THEN data->'responsibilities' ELSE
    jsonb_build_array(
      jsonb_build_object('title','งานทะเบียน','description','ทะเบียนนักเรียน เอกสารรับรอง และข้อมูลประวัติการศึกษา','contactName','งานทะเบียนโรงเรียน','phone','043-320-171','email','','published',true),
      jsonb_build_object('title','งานวัดผล','description','ผลการเรียน การสอบ และเอกสารผลการศึกษา','contactName','งานวัดผลและประเมินผล','phone','043-320-171','email','','published',true),
      jsonb_build_object('title','งานประชาสัมพันธ์','description','ข่าวสาร เว็บไซต์ สื่อประชาสัมพันธ์ และการประสานข้อมูล','contactName','งานประชาสัมพันธ์','phone','043-320-171','email','','published',true),
      jsonb_build_object('title','งานทุนและสวัสดิการ','description','ทุนการศึกษา การสนับสนุนสามเณร และการประสานผู้สนับสนุน','contactName','งานทุนและสวัสดิการ','phone','043-320-171','email','','published',true)
    ) END,
  true
)
WHERE id=1;

UPDATE public.site_settings
SET data = jsonb_set(
  data,
  '{emergencyContacts}',
  CASE WHEN jsonb_typeof(data->'emergencyContacts')='array' THEN data->'emergencyContacts' ELSE
    jsonb_build_array(
      jsonb_build_object('label','การแพทย์ฉุกเฉิน','phone','1669','note','สายด่วนการแพทย์ฉุกเฉิน','icon','ambulance','published',true),
      jsonb_build_object('label','เหตุด่วนเหตุร้าย','phone','191','note','สายด่วนตำรวจ','icon','badge-alert','published',true),
      jsonb_build_object('label','โรงพยาบาลขอนแก่น','phone','043-009-900','note','โรงพยาบาลรัฐ เปิดบริการฉุกเฉิน 24 ชั่วโมง','icon','hospital','published',true),
      jsonb_build_object('label','สถานีตำรวจภูธรเมืองขอนแก่น','phone','043-221-162','note','เปิดบริการ 24 ชั่วโมง','icon','shield','published',true),
      jsonb_build_object('label','สายด่วนผู้อำนวยการ','phone','084-028-6034','note','โรงเรียนวัดหนองแวงวิทยา','icon','phone-call','published',true),
      jsonb_build_object('label','วัดหนองแวงพระอารามหลวง','phone','063-746-8650','note','สถานที่ตั้งโรงเรียน','icon','landmark','published',true)
    ) END,
  true
)
WHERE id=1;

NOTIFY pgrst, 'reload schema';

SELECT data->'siteMaintenance' AS maintenance,
       jsonb_array_length(coalesce(data->'responsibilities','[]'::jsonb)) AS responsibilities_count,
       jsonb_array_length(coalesce(data->'emergencyContacts','[]'::jsonb)) AS emergency_count
FROM public.site_settings WHERE id=1;
