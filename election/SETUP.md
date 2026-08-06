# WhatsApp Group Admin Election Website — Setup & Deployment Guide

A secure, mobile-friendly election web application built with **React (Vite)**, **Tailwind CSS**, and **Supabase (PostgreSQL)**.

---

## Features Implemented

1. **One-Time Private Links**: 64-character cryptographically secure token per voter. Only the SHA-256 hash is stored in the database.
2. **100% Anonymity**: Strict database separation between voters and candidate ballots. No voter ID, voter name, or token exists in the `ballots` table.
3. **Transaction Safety**: Atomic Postgres function (`submit_vote` RPC) with row locking (`FOR UPDATE`) to prevent race conditions, double-clicks, and multi-tab voting.
4. **Admin Dashboard**:
   - Add voter names & generate one-time private voting links
   - One-click copy link & direct share via WhatsApp API
   - View participation status (`Voted` / `Not Voted`) without knowing candidate selections
   - Add candidates & descriptions (photos avoided as requested)
   - Configure election title, start date, and closing date/time
   - Anonymous final vote tally & winner/tie calculation after closing
5. **Voter Flow**:
   - Open link from WhatsApp
   - View candidate list and select candidate
   - Confirmation modal before submission
   - Success message & link permanently marked as used
   - Rate limiting protection (max 5 attempts per token hash in 10 minutes)

---

## Quick Start (Local Setup)

### Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and create a free project.
2. Open your project's **SQL Editor**.
3. Copy the entire contents of `supabase/migrations/001_election_schema.sql` and run it in the SQL Editor.
4. Go to **Project Settings** -> **API** and copy:
   - Project URL
   - `anon` `public` API key

### Step 2: Configure Environment Variables

Create `.env` inside `d:\AI website\election\`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### Step 3: Create Admin Account

In your Supabase Dashboard:
1. Go to **Authentication** -> **Users** -> **Add User** -> **Create User**.
2. Enter your admin email and password.
3. You can now use this email and password to log in at `/admin`.

### Step 4: Run Locally

```bash
cd election
npm run dev
```

Open `http://localhost:5173` (or the port Vite outputs).

---

## Deployment (Vercel)

1. Push your project to GitHub or deploy via Vercel CLI:
```bash
npx vercel
```
2. Set the environment variables in your Vercel project settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Vercel will build the SPA using `npm run build` and route all paths to `index.html` via `vercel.json`.

---

## Security Architecture Summary

- **Token Security**: Raw tokens are generated client-side (`crypto.getRandomValues`) and never stored in plain text anywhere. Only SHA-256 hashes are persisted.
- **SQL Injection**: All operations use parameterized Supabase queries and prepared Postgres RPC functions.
- **XSS & CSRF**: React automatic HTML escaping, HTTPS enforcement, and isolated tokens.
- **No LocalStorage**: Voting state is never cached in `localStorage`.
