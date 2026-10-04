WNW Donation V14 — Manager Donor Count Fix

แก้หน้า Donation Manager > ประวัติย้อนหลัง:
- รายการทั้งหมด = จำนวนรายการบริจาคทั้งหมด
- ผู้บริจาคทั้งหมด = จำนวนชื่อผู้บริจาคที่ไม่ซ้ำกัน
- ศิษย์เก่า = จำนวนชื่อศิษย์เก่าที่ไม่ซ้ำกัน

ตัวนับจะใช้ certificate_name_override หากมี มิฉะนั้นใช้ display_name
ไม่ใช้ history_code ในการนับบุคคลอีกต่อไป

ไม่ต้องรัน SQL เพิ่ม หากติดตั้ง Donation V13 SQL แล้ว
