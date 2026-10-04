WNW Donation V17 — เพิ่มการสร้าง "ภาพใบอนุโมทนาบัตร" อัตโนมัติจาก Google Slides

สิ่งที่เพิ่ม:
1) ตอนตรวจสอบ/ยืนยัน ระบบจะสร้างทั้ง PDF และภาพ PNG อัตโนมัติ
2) Manager กดสร้างใบใหม่ได้ และเปิดดูได้ทั้ง PDF/ภาพ
3) หน้า verify / history / donors รองรับปุ่มดูภาพใบอนุโมทนาบัตร
4) เมื่อลบรายการ ระบบพยายามลบทั้งไฟล์ PDF และไฟล์ภาพใน Google Drive

วิธีอัปเดต:
- อัปโหลดไฟล์เว็บไซต์ชุดนี้ทับของเดิม
- นำไฟล์ google-apps-script/Code.gs หรือ WNW-DONATION-Code-V17-CERTIFICATE-IMAGE.gs ไปแทนใน Google Apps Script แล้ว Deploy Web App ใหม่
- รันไฟล์ DONATION-V17-CERTIFICATE-IMAGE-UPGRADE.sql ใน Supabase SQL Editor 1 ครั้ง

หมายเหตุ:
- ภาพใบอนุโมทนาบัตรจะสร้างเป็น PNG จากสไลด์หน้าแรกของ Template
- ถ้า Template มีหลายหน้า ระบบจะใช้หน้าแรกเป็นใบอนุโมทนาบัตร
