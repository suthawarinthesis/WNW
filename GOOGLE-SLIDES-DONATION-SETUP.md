# ตั้งค่า Google Slides สำหรับระบบใบอนุโมทนาบัตร

ตั้งค่าไว้แล้ว:
- Template: https://docs.google.com/presentation/d/180GXEdZA9C1VCdmqp9qA0-tK17SHG93s0ZsLpS8ZuY8/edit
- Output folder: https://drive.google.com/drive/folders/1JUTSXLLdR7X5KiV6KINe6Nk85DS-YdYk
- Supabase: โปรเจกต์เดิมของโรงเรียน

## Tag ที่ต้องมีใน Google Slides
`{{donor_name}}`  `{{donation_amount}}`  `{{certificate_no}}`

Tag ต้องเป็นข้อความใน Text Box จริง ห้ามแปลงเป็นรูปภาพ ระบบจะ Replace Tag เดิม ไม่ได้วางทับ จึงไม่เกิดตัวหนังสือซ้อน

## ทำครั้งเดียว: Deploy Google Apps Script
1. เปิด https://script.google.com/ ด้วยบัญชีที่แก้ Google Slides และโฟลเดอร์ Drive ข้างต้นได้
2. New project
3. เปิด Code.gs แล้ววางโค้ดจาก `google-apps-script/Code.gs`
4. Deploy → New deployment → Web app
5. Execute as: **Me**
6. Who has access: **Anyone**
7. กดยืนยันสิทธิ์ Google Drive / Google Slides / external request
8. คัดลอก Web App URL ที่ลงท้าย `/exec`

## Supabase
รัน `DONATION-GOOGLE-SLIDES-UPGRADE.sql` ใน SQL Editor หนึ่งครั้ง

## เชื่อมใน Website Manager
เข้า `/donation/manager/` → ใบอนุโมทนาบัตร
- Template และ Folder ใส่ไว้ให้แล้ว
- วาง Apps Script `/exec` URL
- กด “บันทึกการเชื่อมต่อ”
- กด “ตรวจ 3 Tag ใน Slides”

เมื่อ Tag ครบ ระบบจะทำงานแบบ:
ตรวจสลิป → ยืนยัน → Supabase ออกเลขใบ → Google Slides Replace Tag → Export PDF → เก็บ PDF ใน Drive → บันทึกลิงก์กลับ Supabase → ผู้บริจาคดาวน์โหลดจากหน้าประวัติ/หน้าตรวจสอบได้

หากสร้าง PDF ล้มเหลว เลขใบยังคงเดิมและ Manager กด “สร้างใบจาก Google Slides” ซ้ำได้ โดยไม่ออกเลขใหม่

### สิทธิ์ไฟล์
Apps Script จะพยายามตั้ง PDF เป็น “ทุกคนที่มีลิงก์สามารถดูได้” หาก Google Workspace ปิดการแชร์ภายนอก จะต้องปรับนโยบายหรือแชร์ไฟล์ด้วยวิธีขององค์กรก่อนผู้บริจาคภายนอกจะเปิด PDF ได้


## Donation V3 — Web App URL preconfigured

แพ็กเกจ V3 ฝัง Google Apps Script Web App URL นี้ไว้เป็นค่าเริ่มต้นแล้ว:

`https://script.google.com/macros/s/AKfycby2RD2z8dMwB3Ajp0JPCPHN_rKFIL1M5IckIN4VyUMG2yNAV_2gW4kWaGjx-49CXECJ4A/exec`

หน้า Donation Manager จะใช้ URL นี้โดยอัตโนมัติแม้ค่า `google_apps_script_url` ใน Supabase ยังว่างอยู่ และเมื่อกดบันทึกการเชื่อมต่อ URL จะถูกบันทึกลง `donation_settings` ด้วย
