# Google Slides Donation Certificate — V15

Template ต้องมี Text Box 4 จุด:

- `{{donor_name}}`
- `{{donation_amount}}`
- `{{certificate_no}}`
- `{{verify_qr}}`

## QR ตรวจสอบ

สร้าง Text Box ใหม่ใน Google Slides แล้วพิมพ์เฉพาะ `{{verify_qr}}` จากนั้นปรับกรอบ Text Box ให้มีขนาดและตำแหน่งเท่ากับ QR ที่ต้องการ ระบบจะลบ Text Box นี้แล้ววาง QR ลงในกรอบเดิมอัตโนมัติ

อย่า Group Text Box `{{verify_qr}}` กับวัตถุอื่น เพื่อให้ระบบแทนด้วยภาพ QR ได้แม่นยำ

QR ของแต่ละใบจะชี้ไปที่:

`https://wnw-vit.site/donation/verify/?no=<certificate_no>`

## Deploy Apps Script

1. เปิด Apps Script เดิม
2. แทน `Code.gs` ด้วยไฟล์ V15
3. Deploy > Manage deployments > Edit
4. เลือก New version
5. Deploy
6. URL `/exec` เดิมใช้ต่อได้

หลัง Deploy เข้า Donation Manager > ใบอนุโมทนาบัตร > “ตรวจ 4 Tag ใน Slides”
