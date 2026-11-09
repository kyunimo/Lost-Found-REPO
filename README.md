# STI College Gensan — Campus Lost & Found

React + Vite + Tailwind front end, **Supabase** (free Postgres, login, photo storage) as the backend,
hosted free on **GitHub Pages**.

## User levels
| Role | Can do |
|------|--------|
| **user** (student / faculty / staff) | Sign up, report lost/found items, browse, see suggested matches, submit ownership claims |
| **staff** | Everything above + Admin Panel: approve / reject claims, view all reports and claims |
| **admin** | Everything above + delete reports + Users page (change anyone's role) |

New sign-ups are always `user`. Roles are enforced in the database (Row Level Security + SQL functions), not just hidden in the UI.

## 1. Create the free backend (Supabase)
1. Sign up at supabase.com → **New project** (free plan). Save the database password.
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
3. **Project Settings → API**: copy the **Project URL** and the **anon public key**.
4. (Easier testing) **Authentication → Providers → Email**: turn off "Confirm email". Leave it on for real use.

## 2. Run it on your computer
```bash
npm install
cp .env.example .env      # then paste your URL and anon key into .env
npm run dev
```
Open the printed address, **Sign up**, then make yourself the first admin — SQL Editor:
```sql
update public.profiles set role = 'admin' where email = 'your@email.com';
```
Refresh the page. Use the **Users** page to promote classmates/teachers to `staff`.

## 3. Publish free on GitHub Pages
1. Create a **public** GitHub repo and push this folder to the `main` branch.
2. Repo **Settings → Secrets and variables → Actions → New repository secret**:
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same values as `.env`).
3. Repo **Settings → Pages → Source: GitHub Actions**.
4. Push any change (or Actions → *Deploy to GitHub Pages* → Run workflow). Your site appears at
   `https://<username>.github.io/<repo-name>/`.
5. Supabase → **Authentication → URL Configuration**: set **Site URL** to that address.

## Updating an existing database
If you already ran `schema.sql` before, do **not** run it again. Run
`supabase/migration-002-contacts-and-account-deletion.sql` once instead (SQL Editor → New query → Run).
It adds the 3 contact fields, saved contact settings and account deletion.

## Good to know
- The anon key is meant to be public; security comes from the Row Level Security rules in `schema.sql`.
- Supabase free projects **pause after ~7 days of no activity** — open the dashboard and click *Restore* before your defense.
- Free limits (approx.): 500 MB database, 1 GB photo storage — plenty for a campus demo.
- Matching = category + location + date closeness + text similarity (PostgreSQL `pg_trgm`). It only *suggests*; staff still verify claims.
- Item contact details are hidden in the UI from other users, but are still readable through the API by signed-in users. For production, move contact info into a separate table with stricter rules.
- Phones: compact card list, install-to-home-screen (PWA manifest in `public/`), lists refresh when you switch back to the app.
- Dark mode: toggle in the header (or Profile → Appearance). Colours are defined at the bottom of `src/index.css`.
- Not yet built (listed in the proposal scope): email/in-app notifications.
- Deleting an account also deletes that person's reports (with photos), claims on those reports, and their own claims. Admins can delete any account from the Users page; the only admin can't delete themselves.
