DONATION V11 — Alumni + Photo Link + Full History

เพิ่ม:
1) Donation Manager > แท็บ "ประวัติย้อนหลัง" สำหรับรายการบริจาคทั้งหมด
2) ฟอร์มผู้บริจาค > ติ๊ก "เป็นศิษย์เก่า" และเลือกรุ่น 1–50
3) ฟอร์มผู้บริจาค > รูปภาพใช้ URL เท่านั้น รองรับ Google Drive share link
4) มีหมายเหตุแนะนำใช้ Google Drive เพื่อประหยัดพื้นที่จัดเก็บของระบบ
5) แสดงรูปใน Donation Manager, modal ตรวจสอบ และหน้าประวัติของผู้บริจาค
6) Google Drive URL จะถูกแปลงเป็น thumbnail สำหรับแสดงผลอัตโนมัติ (ไฟล์ต้องแชร์แบบทุกคนที่มีลิงก์ดูได้)

สำหรับระบบ Donation V7/V8/V9/V10 ที่ติดตั้งฐานข้อมูลแล้ว:
- รันไฟล์ DONATION-V11-ALUMNI-PHOTO-HISTORY-UPGRADE.sql เพียงไฟล์เดียว
- ไม่ต้องรัน DONATION-CLEAN-INSTALL.sql ซ้ำ

ฟิลด์ใหม่ใน public.donations:
- photo_url text
- is_alumni boolean
- alumni_batch text

RPC ใหม่:
- set_donation_profile_extras(...)
- get_donation_history_v2(text)
