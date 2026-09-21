# โรงเรียนวัดหนองแวงวิทยา — GitHub Pages + Supabase CMS

เวอร์ชันนี้คงหน้าเว็บหลักจากไฟล์ต้นฉบับ และเพิ่มระบบจัดการแบบแยก Subweb โดยออกแบบให้ deploy เป็น Static Site บน GitHub Pages และใช้ Supabase เป็นฐานข้อมูล/Auth/Storage

## โครงสร้าง

- `index.html` — เว็บไซต์หลัก (ดีไซน์เดิม + ครู Search/Filter + latest achievements 3 รายการ)
- `manager/index.html` — ระบบ Manager ล็อกอินและแก้ข้อมูล
- `manager/manager.js` — Logic ของ Manager
- `achievements/index.html` — Subweb ผลงานแห่งความภาคภูมิใจทั้งหมด
- `achievements/achievements.js` — โหลด/ค้นหา/กรองผลงาน
- `assets/app-config.js` — ใส่ Supabase Project URL + anon/publishable key ที่นี่
- `assets/default-data.json` — ข้อมูล fallback จาก HTML เดิม
- `supabase/setup.sql` — สร้างฐานข้อมูล, RLS, Storage, seed ข้อมูล

## ตั้งค่า Supabase

1. สร้าง Supabase Project
2. ไปที่ **SQL Editor** แล้วรัน `supabase/setup.sql`
3. ไปที่ **Authentication > Users** แล้วสร้างผู้ใช้ Manager ด้วย Email/Password
4. กลับไป SQL Editor แล้วรันคำสั่งนี้ โดยเปลี่ยนอีเมลเป็นบัญชี Manager:

```sql
insert into public.site_admins (user_id)
select id from auth.users where email = 'YOUR_ADMIN_EMAIL@example.com'
on conflict (user_id) do nothing;
```

5. ไปที่ **Project Settings / API** แล้วคัดลอก Project URL และ `anon` / publishable key
6. `assets/app-config.js` ถูกตั้งค่า Supabase Project URL + publishable key ให้แล้ว หากย้าย Project ค่อยเปลี่ยนค่าตรงนี้:

```js
window.SCHOOL_APP_CONFIG = {
  SUPABASE_URL: 'https://pcapjltgscofrgfcvdkm.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_…', // publishable key ของโปรเจกต์นี้
  STORAGE_BUCKET: 'site-media'
};
```

> ห้ามใส่ `service_role` key ใน GitHub Pages เพราะผู้เยี่ยมชมสามารถดู source code ได้

## Deploy บน GitHub Pages

1. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ไปยัง root ของ repository
2. GitHub > **Settings > Pages**
3. Deploy from branch: `main` / root
4. URL จะเป็นประมาณ `https://USERNAME.github.io/REPOSITORY/`
5. Manager: `https://USERNAME.github.io/REPOSITORY/manager/`
6. ผลงานทั้งหมด: `https://USERNAME.github.io/REPOSITORY/achievements/`

Relative links ถูกใช้ไว้แล้ว จึงรองรับ GitHub Project Pages ที่มี `/REPOSITORY/` อยู่ใน URL

## Manager ทำอะไรได้บ้าง

- โลโก้ / ชื่อโรงเรียน / ข้อมูลติดต่อ
- จำนวนสามเณรนักเรียน และจำนวนบุคลากร
- ผู้อำนวยการและรูป
- Intro page / ประกาศด่วน
- Welcome image / Promo banners พร้อมอัปโหลดภาพ
- เพิ่ม/ลบ/แก้ไข ผู้บริหาร ครู และครูพิเศษ พร้อมอัปโหลดภาพ
- ประวัติโรงเรียน / Social / Maps / บาลีวันละคำ / พุทธสุภาษิต
- ข่าวและกิจกรรม
- ผลงานแห่งความภาคภูมิใจแบบ CRUD แยกตาราง
- Advanced JSON สำหรับข้อมูลทุกส่วนที่ยังไม่มีฟอร์มเฉพาะ

## พฤติกรรม “ผลงานแห่งความภาคภูมิใจ”

Manager บันทึกผลงานใหม่ลงตาราง `achievements` และมี `created_at` อัตโนมัติ หน้าเว็บหลัก query เฉพาะรายการ `published = true` โดยเรียง `created_at DESC` และแสดง **3 รายการล่าสุด** ส่วนปุ่ม **ดูเพิ่มเติม** เปิด Subweb `/achievements/` เพื่อดูทั้งหมด

## Security

- หน้าเว็บสาธารณะอ่าน `site_settings` และผลงานที่ publish ได้
- การเขียน/แก้/ลบตรวจ `site_admins` ผ่าน RLS
- Manager ใช้ Supabase Auth Email/Password
- Storage `site-media` อ่านภาพได้สาธารณะ แต่อัปโหลด/แก้/ลบได้เฉพาะ Site Admin
- ไม่ต้องและไม่ควรใช้ `service_role` บน frontend
