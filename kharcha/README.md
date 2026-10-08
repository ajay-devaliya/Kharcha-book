# Kharcha Book

A private expense, income and budget tracker in rupees. Built with Vite and React. Each person who signs up gets their own private data, stored in Supabase. It deploys to Vercel for free.

**What it does**

- Log expenses and income, with automatic category guessing from the note
- Overview with spent, income, saved, savings rate, category breakdown, daily chart, six month trend and plain-language insights
- Monthly budget and a limit for each category, with warnings as you near or pass them
- Recurring entries (rent, salary, subscriptions, EMIs) that add themselves when due
- Import bank or UPI statement CSVs with a preview and duplicate detection
- Export entries to CSV, full JSON backup and restore
- Light and dark theme, works on phones, keyboard shortcut `N` to add an entry

## 1. Create the database (Supabase, free)

1. Sign up at supabase.com and create a new project. Pick a region close to you (Mumbai if offered) and save the database password somewhere.
2. Open **SQL Editor > New query**, paste the whole of `supabase/schema.sql`, and press **Run**. This creates the tables and locks each one so a person can only read and write their own rows.
3. Open **Project Settings > API** and copy the **Project URL** and the **anon public** key. You need both in step 3.
4. Optional: under **Authentication > Providers > Email**, turn off **Confirm email** if you want friends to get in without a confirmation email. Supabase's built-in email sender has a low hourly limit, so this avoids sign-ups getting stuck.

## 2. Put the code on GitHub

Create a new empty repository on GitHub, then in this folder:

```bash
git init
git add .
git commit -m "Kharcha Book"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/kharcha-book.git
git push -u origin main
```

## 3. Deploy on Vercel

1. In Vercel choose **Add New > Project** and import the repository. Vercel detects Vite on its own.
2. Before pressing Deploy, open **Environment Variables** and add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon public key
3. Press **Deploy**. When it finishes you get a link like `https://kharcha-book.vercel.app`.
4. Back in Supabase open **Authentication > URL Configuration**. Set **Site URL** to your Vercel link and add the same link under **Redirect URLs**. Password reset and confirmation emails use this.

Share the link with your friends. Each person creates their own account.

Using the Vercel CLI instead of GitHub also works: `npm i -g vercel`, then `vercel` in this folder, then add the two variables under Project Settings.

## Run it on your computer

```bash
npm install
cp .env.example .env.local   # fill in the two values, or leave them empty
npm run dev
```

With both values empty the app runs in **local mode**: no login, and data stays in that browser. That is handy for trying it out. Use **Try with sample data** on the empty Overview page.

```bash
npm test      # checks the amount, date, CSV import, recurring and backup logic
npm run build # production build into dist/
```

## Things to know

- **Privacy.** Row level security stops one signed-in user from reading another's data. As the owner of the Supabase project, you can still see every row in your own dashboard. Tell friends that, or have each friend run their own copy with their own Supabase project.
- **Free tier limits.** Supabase pauses free projects that see no activity for about a week. If the app stops loading, open the Supabase dashboard and press Restore. Vercel's free plan is for personal, non-commercial use.
- **Amounts** are stored as whole paise, so there are no rounding errors.
- **Recurring entries** are created when the app is opened on or after the due date. Each rule remembers how far it has generated, so an entry you delete by hand does not come back.
- **Importing statements.** The importer reads a header row and detects Date, Description, Amount, Debit, Credit and Dr/Cr columns. Dates are read day first (07/10/2026 is 7 October). Check the preview before importing, because banks format statements differently.

## Project layout

```
supabase/schema.sql      tables and security rules
src/data/                cloud store, browser store, shared state
src/lib/                 pure logic: dates, money, CSV, import, recurring, stats, backup
src/pages/               Overview, Transactions, Budgets, Recurring, Data
src/components/          shell, charts, add-entry sheet, sign-in
tests/lib.test.mjs       unit tests for src/lib
```
