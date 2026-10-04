Donation V10 — Delete Donation Record

เพิ่มปุ่มลบรายการบริจาคใน Donation Manager พร้อมยืนยัน 2 ชั้น
- ลบ PDF ใบอนุโมทนาบัตรจาก Google Drive (ถ้ามี)
- ลบสลิปจาก Supabase Storage (ถ้ามี)
- ลบ record จาก public.donations
- ไม่ลด/ย้อนเลข counter ใบอนุโมทนาบัตร เพื่อไม่ให้เลขเอกสารถูกนำกลับมาใช้ซ้ำ

สำคัญ: อัปเดต google-apps-script/Code.gs แล้ว Deploy เป็น New version เพื่อให้ระบบลบ PDF ใน Google Drive ได้
ไม่ต้องรัน SQL เพิ่ม หากติดตั้ง Donation V7+ แล้ว เพราะ schema มี RLS DELETE และ Storage DELETE policy อยู่แล้ว
