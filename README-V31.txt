WNW V31 — SCHOOL SYSTEM UPGRADE

เพิ่ม 8 ระบบ:
1. /about-60/ รู้จักโรงเรียนใน 60 วินาที
2. /responsibilities/ ระบบฝ่ายงาน / ติดต่อใคร
3. /emergency/ ข้อมูลฉุกเฉิน
4. robots.txt + Manager สร้าง sitemap.xml/robots.txt จาก URL จริง
5. 404.html โรงเรียน
6. Backup / Restore Settings ใน Website Manager
7. Maintenance Mode (Manager / Privacy / Emergency ยังเข้าได้)
8. Error Center + site_error_logs + ตรวจ Donation Apps Script errors

ติดตั้ง:
1) ลากไฟล์ทั้งหมดใน ZIP ไปวางทับ root เว็บตามโครงสร้าง
2) Supabase > SQL Editor > Run WNW-V31-SYSTEM-UPGRADE.sql
3) Ctrl+F5
4) เข้า Website Manager > ระบบเว็บไซต์
5) กด “ใช้ URL ของเว็บที่เปิดอยู่” ตรวจ Public Base URL
6) กดดาวน์โหลด sitemap.xml + robots.txt แล้วนำ 2 ไฟล์นั้นไปวางที่ root เว็บ
   (robots.txt ใน ZIP เป็น starter file เพราะ Sitemap ต้องใช้ URL เต็มจริงของ deployment)

สำคัญ:
- ไม่แตะโฟลเดอร์ donation/ จึงไม่ทับระบบบริจาค Manual ที่ใช้อยู่
- Backup/Restore Settings ไม่รวมข้อมูลนักเรียน ผู้บริจาค ไฟล์ Storage ข่าว บุคลากร หรือผลงานในตารางเฉพาะ
- Error Center ดึง site_error_logs และรายการ Donation ที่สถานะการสร้างไฟล์เป็น error
- Maintenance Mode จะไม่บล็อก /manager/, /privacy/, /emergency/
