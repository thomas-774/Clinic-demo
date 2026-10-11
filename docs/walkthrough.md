# Demo walkthrough (D-13)

The source app's walkthrough (`E:\claude DR SaaS\docs\walkthrough.md`), run on the demo. Done on 2026-10-12 against a production build (`npm run build && npm run preview`), in English and in Arabic, at 1280 px in headless Chrome.

## The demo data

**Reset demo data** (or a first visit) builds the seed around the current moment:

- the doctor (`01000000000`), the assistant (`01100000000`) and 30 patients (`01020000001` … `01020000030`), all with the password `password`;
- the past 30 days of appointments, visits and payments (paid in full, part-paid, later installments), no-shows, cancellations and walk-ins;
- today's evening bookings and up to 8 bookings over the next 7 days, at most one per patient. The demo patient (`01020000001`) has none, so they can book at once;
- the drug catalogue and 4 prescriptions.

Each browser has its own copy in `localStorage`; nothing is shared between visitors.

## Steps and results

Run on Monday 12 October 2026 (clinic hours 17:00–21:00, 45-minute slots).

| # | Who | Step | Result (English and Arabic) |
| --- | --- | --- | --- |
| 0 | Doctor | **Enter as Doctor**, **Reset demo data** → **Reset**, open **Dashboard** | Today: Visits **0**, Revenue **EGP 0.00**; Outstanding **EGP 21,065.00** |
| 1 | Patient | Switch role → **Patient**, **Book**, today, **19:15**, **Book this time** | Booked; the patient's 19:15 appointment shows in today's queue |
| 2 | Assistant | Switch role → **Assistant**, **Today**, the patient's row → **Arrived** | Status Checked in |
| 3 | Doctor | Switch role → **Doctor**, **Schedule**, the patient's row → **Start visit**; work done, **Total cost** 1500, **Amount paid now** 1000 | The form shows **Remaining EGP 500.00** in red; **Save visit** completes the appointment |
| 4 | Patient | Switch role → **Patient**, **Home** | Remaining balance **EGP 1,625.00** = 1,125.00 owed from older visits + **500.00** for the visit of 12 Oct |
| 5 | Assistant | **Patients** → the patient → visit of 12 Oct → **Add payment** 500 → **Save payment** | The visit is Paid |
| 6 | Patient | **Home** | Balance back to **EGP 1,125.00**; the 12 Oct visit is gone from the unpaid list |
| 7 | Doctor | **Dashboard** | Today: Visits **1** (+1), Revenue **EGP 1,500.00** (+1500: both payments count on the visit's date); Outstanding **EGP 21,065.00** (unchanged) |
| 8 | Doctor | **Reset demo data** → **Reset** | Back to step 0: Visits 0, Revenue 0.00, the 19:15 booking gone |

All numbers match the source walkthrough's expectations.

The prescription step (a catalogue drug linked to the visit) and a newly registered patient booking (instead of the demo patient) are checked by the automated version of this walkthrough, `frontend/src/demo/walkthrough.test.js`. It runs the same steps through the API calls the pages make, in both languages, and also checks the patient's balance, the daily revenue for the visit's date, and that Reset brings back the starting numbers.

## Notes

- **Seed timing:** the seed depends on the time of the reset. Before 17:00 today's slots are bookings; after a slot has started, it is a seen visit. So the numbers in step 0 change during the day, but the differences in steps 4–7 do not.
- **Queue layout:** on the assistant's **Today** page at 1280 px, the "Booked" badge overlaps long patient names in the two-column queue. That page is unchanged from the source app.
- **Data loss on a hard kill:** a browser that is killed rather than closed may not have written its last `localStorage` changes to disk. Normal closing keeps them.
