DONATION V15 — Giving As / Period Stats / Campaign Prefix / Verify QR

ติดตั้งจาก V14:
1) รัน DONATION-V15-GIVING-STATS-PREFIX-QR-UPGRADE.sql ใน Supabase SQL Editor เพียงครั้งเดียว
2) อัปโหลดไฟล์เว็บไซต์ V15 ทับของเดิม
3) Google Apps Script: นำ google-apps-script/Code.gs ไปแทนของเดิม แล้ว Deploy > Manage deployments > Edit > New version > Deploy
4) Google Slides Template: เพิ่ม Text Box แยกที่มีข้อความ {{verify_qr}} ไว้ตรงตำแหน่งที่ต้องการให้ QR ปรากฏ
5) เข้า Donation Manager > ใบอนุโมทนาบัตร > กด “ตรวจ 4 Tag ใน Slides”

Tags ที่ต้องมี:
{{donor_name}}
{{donation_amount}}
{{certificate_no}}
{{verify_qr}}

ฟีเจอร์ V15:
- ร่วมบุญในนาม: บุคคล / ครอบครัว / ร้านค้า / บริษัท / คณะศิษย์เก่า / คณะเจ้าภาพ
- เลือกโครงการ/งานก่อนส่ง โดยแต่ละงานมี Prefix เลขใบของตัวเอง
- Dashboard ดู วันนี้ / เดือนนี้ / ปีนี้ / ทั้งหมด พร้อมยอดเงิน จำนวนผู้บริจาค และจำนวนรายการ
- QR บนใบอนุโมทนาบัตรเปิดหน้า https://wnw-vit.site/donation/verify/?no=<เลขใบ>
- Manager จัดการงาน/Prefix แบบ No-code ใน “ตั้งค่าหน้าบริจาค”

หมายเหตุ:
- รายการเก่าไม่ถูกลบ และเลขใบเดิมยังคงเดิม
- Counter ใหม่ถูก seed จากเลขใบเดิม เพื่อไม่ออกเลขซ้ำเมื่อ Prefix ตรงกัน
- Prefix ของแต่ละงานควรไม่ซ้ำ เช่น WNW, REUNION, SCHOLAR
