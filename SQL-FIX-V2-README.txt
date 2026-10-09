ACADEMIC / ACTIVITIES SQL FIX V2

1) Open Supabase > SQL Editor.
2) Run: supabase/academic-activities-personnel-upgrade.sql
3) The script is safe to rerun.
4) At the bottom, the result should list these tables:
   - academic_posts
   - academic_files
   - student_activity_posts
   - student_activity_images
   and personnel columns:
   - naktham_level
   - pali_level

Key fix: anonymous public-read policies no longer call is_site_admin().
