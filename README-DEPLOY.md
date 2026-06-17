# JAWSAI911 Site Fixes

This folder is a fixed deploy-ready copy of the current live GitHub Pages site.

## What Changed

- Repositioned the homepage toward practical AI workflow automation for local businesses.
- Added a real homepage `h1` for SEO/accessibility.
- Changed the primary CTA from a hard demo pitch to a lower-friction workflow review.
- Replaced the broken `/api/demo-request` form call with a `mailto:` request flow to `Bryan@jawsai911.com`.
- Replaced the public Gmail address with `Bryan@jawsai911.com`.
- Added `CNAME` for `jawsai911.com`.

## Critical GitHub Pages HTTPS Fix

The live site currently serves HTTP, but `https://jawsai911.com` returns a certificate for `*.github.io`.

After deploying these files to the GitHub Pages repo:

1. Go to the repo on GitHub.
2. Open Settings -> Pages.
3. Confirm Custom domain is `jawsai911.com`.
4. Save the domain and wait for DNS check to pass.
5. Enable "Enforce HTTPS".

DNS should point the apex domain to GitHub Pages:

- `A 185.199.108.153`
- `A 185.199.109.153`
- `A 185.199.110.153`
- `A 185.199.111.153`

Optional `www`:

- `CNAME <github-username>.github.io`

Replace `<github-username>` with the actual GitHub Pages owner.
