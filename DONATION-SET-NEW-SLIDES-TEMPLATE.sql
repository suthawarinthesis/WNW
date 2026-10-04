-- WNW Donation System — switch Google Slides certificate template
-- Safe to run on an existing Donation System installation.

update public.donation_settings
set
  certificate_provider = 'google_slides',
  google_slides_template_id = '1N0OEEhnCdfqn5ohtZa47pUfenVYizdePtXo9vGsVGy4',
  updated_at = now()
where id = 1;

-- If the settings row does not exist yet, create it using the new template.
insert into public.donation_settings (id, certificate_provider, google_slides_template_id, google_drive_folder_id, google_apps_script_url, updated_at)
select
  1,
  'google_slides',
  '1N0OEEhnCdfqn5ohtZa47pUfenVYizdePtXo9vGsVGy4',
  '1JUTSXLLdR7X5KiV6KINe6Nk85DS-YdYk',
  'https://script.google.com/macros/s/AKfycby2RD2z8dMwB3Ajp0JPCPHN_rKFIL1M5IckIN4VyUMG2yNAV_2gW4kWaGjx-49CXECJ4A/exec',
  now()
where not exists (select 1 from public.donation_settings where id = 1);

select id, certificate_provider, google_slides_template_id, google_drive_folder_id, google_apps_script_url
from public.donation_settings
where id = 1;
