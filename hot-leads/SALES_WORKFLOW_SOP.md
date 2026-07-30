# Pool SuperSite Sales Workflow SOP

## Purpose

This is the working process for turning raw pool-company leads into send-ready JAWSAI911 SuperSite demos for the sales team.

## Workflow

1. Bryan gets the raw leads.
2. Bryan sends the leads to Grok.
3. Grok verifies and returns:
   - business name
   - phone number
   - city / location
   - rating
   - review count
   - source links where available
4. Codex takes the verified lead set and either:
   - builds the SuperSite demo page, or
   - gets the lead fully prepared to drop into the Smart Site demo template
5. Codex adds:
   - company name
   - phone
   - city
   - rating
   - review count
   - photos
   - review snippets
   - shared pool transformation video
   - SuperSite copy and CTA structure
6. Codex places the finished lead into the hub:
   - generated HTML demo page
   - source JSON file
   - queue entry
   - sales SOP page / send order
7. Sales opens the hub, grabs the demo, records the quick Loom, sends the link to the prospect, and works follow-up.

## Output Standard

Each lead should end in one of two states:

- `Send-ready`
  Meaning the page has usable review proof, photos, and is ready for sales to send immediately.

- `Needs review cleanup`
  Meaning the page exists and is usable, but review snippets and/or photo swaps should be tightened before send-out if time allows.

## Hub Locations

- Sales SOP page:
  `/home/shark/jawsai911-site-fixed/hot-leads/sales-sop.html`

- Demo launcher:
  `/home/shark/jawsai911-site-fixed/hot-leads/index.html`

- Lead queue:
  `/home/shark/jawsai911-site-fixed/hot-leads/pool-hot-leads-queue.csv`

- Real lead source files:
  `/home/shark/jawsai911-site-fixed/hot-leads/real-leads-21-30/`

## Codex Responsibility

When verified leads come in, the Codex step is:

1. convert the verified lead into the SuperSite input file
2. add photos and reviews where available
3. generate the HTML demo
4. update the queue and launcher
5. place the lead into the hub SOP so sales can move fast

## Sales Responsibility

1. open the SOP page
2. start with the `Send-ready` set
3. record the short Loom
4. send the demo link
5. follow up with the saved text / call angle
