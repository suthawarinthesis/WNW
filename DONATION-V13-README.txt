WNW Donation V13

Changes:
1) Dashboard donor count now counts unique normalized donor names instead of history_code.
2) Donation Manager approval is one flow: verify -> issue certificate number -> generate Google Slides PDF automatically.
3) Manual PDF button is hidden during normal success and appears only as a retry when a certificate number exists but no PDF is ready.

Upgrade:
Run DONATION-V13-DONOR-COUNT-AUTO-CERT.sql once, then upload the V13 website files. No Apps Script redeploy is required.
