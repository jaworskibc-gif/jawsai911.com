# Hot Leads Demo Flow

Use the premium template as the only starting point for new text-message demos.

## Fastest Flow

1. Start with a minimal seed JSON like [sample-lead-seed.json](/home/shark/jawsai911-site-fixed/hot-leads/sample-lead-seed.json)
2. Enrich it:

```bash
python3 /home/shark/jawsai911-site-fixed/hot-leads/enrich_hot_lead.py /path/to/lead-seed.json
```

3. Publish it:

```bash
python3 /home/shark/jawsai911-site-fixed/hot-leads/generate_hot_lead_demo.py /path/to/lead-seed.enriched.json
```

The publish step will:
- generate the demo page
- upsert the queue CSV
- rebuild the hot-leads launcher page

## Quick Swap Flow

If you just want to swap one company out for another and keep the same demo system:

1. Copy [quick-swap-template.json](/home/shark/jawsai911-site-fixed/hot-leads/quick-swap-template.json)
2. Fill in only:
   - `business_name`
   - `city`
   - `phone_display`
   - `rating`
   - `review_count`
   - `website_url`
   - `gallery_images`
   - `review_quotes`
3. Publish it:

```bash
python3 /home/shark/jawsai911-site-fixed/hot-leads/quick_swap_demo.py /path/to/company.json
```

By default, pool demos will look for one shared transformation clip at:

```text
/home/shark/jawsai911-site-fixed/hot-leads/assets/pool-before-after.mp4
```

If you keep the same clip there, every new pool demo will reuse it automatically.

Optional:

```bash
python3 /home/shark/jawsai911-site-fixed/hot-leads/quick_swap_demo.py /path/to/company.json --write-full-record
```

That writes the fully expanded JSON next to your input, then publishes the page.

## Full Input

Fill out a JSON record shaped like [sample-lead-input.json](/home/shark/jawsai911-site-fixed/hot-leads/sample-lead-input.json).

Required fields:

- `business_name`
- `city`
- `state`
- `phone_display`
- `rating`
- `review_count`
- `text_line`
- `call_script`
- `review_quotes` with exactly 3 entries
- `gallery_images` with at least 3 image URLs

## Publish Directly

Run:

```bash
python3 /home/shark/jawsai911-site-fixed/hot-leads/generate_hot_lead_demo.py /path/to/lead.json
```

That will output a ready-to-open HTML demo page under:

```text
/home/shark/jawsai911-site-fixed/hot-leads/leads/
```

## Intent

This flow is designed to make one strong premium page per lead, not another wave of thin cookie-cutter mockups. Keep the visual direction close to the `Liquid Luxe` reference unless you have a better reason not to.
