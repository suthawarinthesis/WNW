V24.1 SAFE FIX
1) รัน DONATION-V24-1-SAFE-PATCH.sql ใน Supabase SQL Editor โดยไม่เลือกเฉพาะบางบรรทัด
2) ใช้ google-apps-script/Code.gs แทนตัวเดิม แล้ว Deploy > New version
3) ใช้ donation/history/history.js ทับตัวเดิม
4) Ctrl+F5
หมายเหตุ: SQL ตัวนี้ไม่มี $fn$ จึงแก้ error unterminated dollar-quoted string
