# Arron Hub Supabase Setup

This turns `arron-hub.html` into a real shared workspace using Supabase's free plan.

## What you get

- Shared Arron to-do list across devices
- Shared scripts, appointments, training videos, dispositions, deals, and deposits
- No spreadsheet required

## Supabase setup

1. Create a Supabase account.
2. Create a new project on the `Free` plan.
3. In Supabase, open the `SQL Editor`.
4. Run the SQL from [`supabase-arron-hub-schema.sql`](/home/shark/jawsai911-site-fixed/supabase-arron-hub-schema.sql:1).
5. In Supabase, open `Project Settings -> API`.
6. Copy:
   - `Project URL`
   - `anon public` key
7. Open [`hub-config.js`](/home/shark/jawsai911-site-fixed/hub-config.js:1).
8. Paste those values into:

```js
supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
supabaseAnonKey: 'YOUR_ANON_PUBLIC_KEY'
```

9. Redeploy the site.

## How it works

- When `supabaseUrl` and `supabaseAnonKey` are blank, the page stays in local browser-only mode.
- Once both are set, `arron-hub.html` reads and writes the shared `arron` workspace from Supabase.
- You can assign tasks at night, and Arron can sign in later and see them on his own device.

## Important note

This is one shared Arron workspace, not separate per-user private accounts.
