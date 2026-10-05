WNW Donation V23 — Backend Auto Process

สิ่งที่เปลี่ยน:
- หลังผู้บริจาคกดส่ง Supabase trigger จะเรียก Google Apps Script เอง
- ไม่พึ่ง browser / hidden iframe / การเปิด Manager
- ระบบเปลี่ยนสถานะเป็น verified อัตโนมัติ ออกเลขใบ สร้างใบอนุโมทนาบัตร และภาพ พม.นิกร
- แก้ Code.gs ไม่ใช้ sb_publishable key เป็น Bearer JWT สำหรับ public RPC

ติดตั้ง:
1) รัน DONATION-V23-BACKEND-AUTO-PROCESS.sql
2) แทน google-apps-script/Code.gs แล้ว Deploy > Manage deployments > Edit > New version > Deploy
3) ลาก donation/form/form.js ทับไฟล์เดิม
4) ทดสอบบริจาคใหม่ 1 รายการ แล้วรอประมาณ 5–20 วินาที จากนั้นรีเฟรชประวัติ/Manager

HTML ไม่ต้องแก้
