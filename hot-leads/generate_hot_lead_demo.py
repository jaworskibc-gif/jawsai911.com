#!/usr/bin/env python3
"""Publish a premium Shark SuperSite demo from a single JSON lead record.

This script:
1. Renders a lead-specific HTML demo from the premium master template
2. Upserts that lead into `pool-hot-leads-queue.csv`
3. Regenerates `hot-leads/index.html`
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import re
from pathlib import Path


ROOT = Path("/home/shark/jawsai911-site-fixed/hot-leads")
TEMPLATE_PATH = ROOT / "leads" / "_premium-shark-supersite-template.html"
OUTPUT_DIR = ROOT / "leads"
QUEUE_PATH = ROOT / "pool-hot-leads-queue.csv"
INDEX_PATH = ROOT / "index.html"
DEFAULT_POOL_VIDEO_PATH = "assets/pool-before-after.mp4"

CSV_HEADERS = [
    "priority_rank",
    "business_name",
    "city",
    "state",
    "phone",
    "google_rating",
    "google_review_count",
    "priority_tier",
    "priority_score",
    "mockup_status",
    "loom_status",
    "loom_link",
    "text_status",
    "text_copy",
    "call_timing",
    "call_status",
    "call_opening",
    "angle",
    "notes",
    "source",
    "mockup_url",
]

INDEX_HEAD = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pool Hot Leads Mockups | JAWSAI911</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');
*{box-sizing:border-box}
body {
  margin:0;
  font-family:'Inter',sans-serif;
  background:
    radial-gradient(circle at top left, rgba(16,163,184,.10), transparent 24%),
    linear-gradient(180deg, #08131f 0%, #102232 100%);
  color:#edf5fb;
}
.wrap {
  max-width:1280px;
  margin:0 auto;
  padding:28px;
}
.hero {
  background:linear-gradient(135deg, rgba(10,24,36,.95), rgba(15,85,124,.92));
  border:1px solid rgba(170,214,236,.16);
  border-radius:26px;
  padding:32px;
  box-shadow:0 30px 80px rgba(0,0,0,.25);
}
.eyebrow {
  font-size:11px;
  text-transform:uppercase;
  letter-spacing:2px;
  color:#7dd3fc;
  font-weight:800;
}
h1 {
  margin:12px 0 10px;
  font:800 clamp(42px, 7vw, 88px)/.92 'Barlow Condensed',sans-serif;
  text-transform:uppercase;
}
.hero p {
  max-width:760px;
  color:#c8d8e8;
  line-height:1.8;
}
.grid {
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:16px;
  margin-top:18px;
}
.card {
  background:rgba(255,255,255,.05);
  border:1px solid rgba(170,214,236,.16);
  border-radius:20px;
  padding:20px;
  backdrop-filter:blur(10px);
}
.rank {
  font-size:12px;
  font-weight:800;
  letter-spacing:1.4px;
  text-transform:uppercase;
  color:#7dd3fc;
}
.card h2 {
  margin:8px 0 6px;
  font-size:22px;
  line-height:1.2;
}
.meta, .proof, .phone {
  color:#dceaf7;
  font-size:14px;
  margin-top:6px;
}
.phone {
  font-weight:800;
}
.card p {
  color:#a9c0d6;
  line-height:1.7;
  font-size:14px;
  min-height:72px;
}
.actions {
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  margin-top:14px;
}
.actions a {
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding:12px 14px;
  border-radius:999px;
  text-decoration:none;
  font-size:12px;
  text-transform:uppercase;
  font-weight:800;
  letter-spacing:1px;
}
.actions a:first-child {
  background:#7dd3fc;
  color:#082235;
}
.actions a:last-child {
  border:1px solid rgba(170,214,236,.18);
  color:#edf5fb;
}
@media (max-width:980px) {
  .grid { grid-template-columns:1fr; }
  .wrap { padding:14px; }
}
</style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <div class="eyebrow">JAWSAI911 outreach system</div>
      <h1>Pool Hot Lead Mockups</h1>
      <p>Open a lead, send the premium demo, record the Loom, then text the link before the call. This launcher is regenerated from the lead queue so new demos can be published from one input record.</p>
    </section>
    <section class="grid">
"""

INDEX_TAIL = """
    </section>
  </div>
</body>
</html>
"""


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def digits_only(value: str) -> str:
    return "".join(ch for ch in value if ch.isdigit())


def initials_for(value: str) -> str:
    words = re.findall(r"[A-Za-z0-9]+", value)
    return "".join(word[0] for word in words[:2]).upper() or "SS"


def normalize_record(record: dict) -> dict:
    business_name = record["business_name"]
    phone_display = record["phone_display"]
    source_urls = record.get("source_urls", [])
    if len(source_urls) < 2:
        source_urls = (source_urls + [record.get("website_url", "#"), "#"])[:2]

    review_quotes = record.get("review_quotes", [])
    if len(review_quotes) != 3:
        raise ValueError("record.review_quotes must contain exactly 3 review objects")

    gallery_images = record.get("gallery_images", [])
    if len(gallery_images) < 3:
        raise ValueError("record.gallery_images must contain at least 3 image URLs")

    hero_image_url = record.get("hero_image_url") or gallery_images[0]
    website_url = record.get("website_url", source_urls[0])

    normalized = {
        "BUSINESS_NAME": business_name,
        "CITY": record["city"],
        "STATE": record.get("state", "FL"),
        "PHONE_DISPLAY": phone_display,
        "PHONE_DIGITS": digits_only(phone_display),
        "INITIALS": record.get("initials") or initials_for(business_name),
        "EYEBROW": record["eyebrow"],
        "HEADLINE_LINE_1": record["headline_line_1"],
        "HEADLINE_LINE_2": record["headline_line_2"],
        "HERO_SUBTEXT": record["hero_subtext"],
        "RATING": str(record["rating"]),
        "REVIEW_COUNT": str(record["review_count"]),
        "TRUST_STAT": record["trust_stat"],
        "TRUST_LABEL": record["trust_label"],
        "WEBSITE_URL": website_url,
        "PITCH_HEADLINE": record["pitch_headline"],
        "PITCH_BODY": record["pitch_body"],
        "TEXT_LINE": record["text_line"],
        "CALL_SCRIPT": record["call_script"],
        "SOURCE_URL_1": source_urls[0],
        "SOURCE_URL_2": source_urls[1],
        "SOURCE_LABEL_1": record.get("source_labels", ["Source 1", "Source 2"])[0],
        "SOURCE_LABEL_2": record.get("source_labels", ["Source 1", "Source 2"])[1],
        "SECTION_TITLE": record["section_title"],
        "SECTION_COPY": record["section_copy"],
        "GALLERY_CAPTION_TITLE": record["gallery_caption_title"],
        "GALLERY_CAPTION_BODY": record["gallery_caption_body"],
        "VIDEO_SECTION_LABEL": record.get("video_section_label", ""),
        "VIDEO_SECTION_TITLE": record.get("video_section_title", ""),
        "VIDEO_SECTION_BODY": record.get("video_section_body", ""),
        "VIDEO_URL": record.get("video_url", DEFAULT_POOL_VIDEO_PATH),
        "VIDEO_POSTER_URL": record.get("video_poster_url", hero_image_url),
        "WHY_TITLE_1": record["why_cards"][0]["title"],
        "WHY_BODY_1": record["why_cards"][0]["body"],
        "WHY_TITLE_2": record["why_cards"][1]["title"],
        "WHY_BODY_2": record["why_cards"][1]["body"],
        "WHY_TITLE_3": record["why_cards"][2]["title"],
        "WHY_BODY_3": record["why_cards"][2]["body"],
        "REVIEW_QUOTE_1": review_quotes[0]["quote"],
        "REVIEW_AUTHOR_1": review_quotes[0]["author"],
        "REVIEW_SOURCE_1": review_quotes[0]["source"],
        "REVIEW_QUOTE_2": review_quotes[1]["quote"],
        "REVIEW_AUTHOR_2": review_quotes[1]["author"],
        "REVIEW_SOURCE_2": review_quotes[1]["source"],
        "REVIEW_QUOTE_3": review_quotes[2]["quote"],
        "REVIEW_AUTHOR_3": review_quotes[2]["author"],
        "REVIEW_SOURCE_3": review_quotes[2]["source"],
        "PROCESS_BODY_1": record["process_bodies"][0],
        "PROCESS_BODY_2": record["process_bodies"][1],
        "PROCESS_BODY_3": record["process_bodies"][2],
        "CTA_TITLE": record["cta_title"],
        "CTA_BODY": record["cta_body"],
        "FOOTER_NOTE": record["footer_note"],
        "PHOTO_SOURCE_NOTE": record["photo_source_note"],
        "LOOM_ANGLE": record["loom_angle"],
        "HERO_IMAGE_URL": hero_image_url,
        "GALLERY_IMAGE_1": gallery_images[0],
        "GALLERY_IMAGE_2": gallery_images[1],
        "GALLERY_IMAGE_3": gallery_images[2],
    }
    return normalized


def render_template(template: str, replacements: dict) -> str:
    output = template
    for key, value in replacements.items():
        output = output.replace(f"{{{{{key}}}}}", html.escape(str(value), quote=True))

    unreplaced = sorted(set(re.findall(r"\{\{[A-Z0-9_]+\}\}", output)))
    if unreplaced:
        raise ValueError(f"Template still has unreplaced tokens: {', '.join(unreplaced)}")
    return output


def load_rows() -> list[dict]:
    if not QUEUE_PATH.exists():
        return []
    with QUEUE_PATH.open(newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def write_rows(rows: list[dict]) -> None:
    with QUEUE_PATH.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=CSV_HEADERS)
        writer.writeheader()
        writer.writerows(rows)


def safe_int(value: str, default: int) -> int:
    try:
        return int(str(value).strip())
    except Exception:
        return default


def build_row(record: dict, output_path: Path, existing: dict | None, position: int) -> dict:
    row = {key: "" for key in CSV_HEADERS}
    if existing:
        row.update(existing)

    source_url = record.get("source_urls", [record.get("website_url", "#")])[0]
    row.update(
        {
            "priority_rank": str(record.get("priority_rank", existing.get("priority_rank") if existing else position)),
            "business_name": record["business_name"],
            "city": record["city"],
            "state": record.get("state", "FL"),
            "phone": record["phone_display"],
            "google_rating": str(record["rating"]),
            "google_review_count": str(record["review_count"]),
            "priority_tier": record.get("priority_tier", existing.get("priority_tier") if existing else "A"),
            "priority_score": str(record.get("priority_score", existing.get("priority_score") if existing else "")),
            "mockup_status": "ready",
            "loom_status": existing.get("loom_status", "todo") if existing else "todo",
            "loom_link": existing.get("loom_link", "") if existing else "",
            "text_status": existing.get("text_status", "todo") if existing else "todo",
            "text_copy": record["text_line"],
            "call_timing": record.get("call_timing", existing.get("call_timing") if existing else "1-2 hours after text or next day"),
            "call_status": existing.get("call_status", "todo") if existing else "todo",
            "call_opening": record["call_script"],
            "angle": record.get("angle", record["pitch_headline"]),
            "notes": record.get("notes", record["loom_angle"]),
            "source": source_url,
            "mockup_url": f"leads/{output_path.name}",
        }
    )
    return row


def render_index_card(row: dict) -> str:
    rank = html.escape(str(row.get("priority_rank") or ""))
    tier = html.escape(str(row.get("priority_tier") or ""))
    name = html.escape(str(row.get("business_name") or ""))
    city = html.escape(str(row.get("city") or ""))
    state = html.escape(str(row.get("state") or ""))
    rating = html.escape(str(row.get("google_rating") or ""))
    review_count = html.escape(str(row.get("google_review_count") or ""))
    phone = html.escape(str(row.get("phone") or ""))
    text_copy = html.escape(str(row.get("text_copy") or ""))
    mockup_url = html.escape(str(row.get("mockup_url") or "#"))
    source = html.escape(str(row.get("source") or "#"))
    return f"""
            <article class="card">
              <div class="rank">#{rank} · Tier {tier}</div>
              <h2>{name}</h2>
              <div class="meta">{city}, {state}</div>
              <div class="proof">{rating} stars · {review_count} reviews</div>
              <div class="phone">{phone}</div>
              <p>{text_copy}</p>
              <div class="actions">
                <a href="{mockup_url}">Open mockup</a>
                <a href="{source}">Source</a>
              </div>
            </article>
"""


def regenerate_index(rows: list[dict]) -> None:
    rows = sorted(rows, key=lambda row: safe_int(row.get("priority_rank", ""), 9999))
    cards = "".join(render_index_card(row) for row in rows)
    INDEX_PATH.write_text(INDEX_HEAD + cards + INDEX_TAIL, encoding="utf-8")


def upsert_row(rows: list[dict], record: dict, output_path: Path) -> list[dict]:
    existing_index = next((idx for idx, row in enumerate(rows) if row.get("business_name") == record["business_name"]), None)
    existing = rows[existing_index] if existing_index is not None else None
    fallback_position = len(rows) + 1
    row = build_row(record, output_path, existing, fallback_position)

    if existing_index is None:
      rows.append(row)
    else:
      rows[existing_index] = row

    rows.sort(key=lambda item: safe_int(item.get("priority_rank", ""), 9999))
    return rows


def publish_record(record: dict, output: str | Path | None = None) -> tuple[Path, Path, Path]:
    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    replacements = normalize_record(record)

    output_path = Path(output) if output else OUTPUT_DIR / f"{slugify(record['business_name'])}.html"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    output_html = render_template(template, replacements)
    output_path.write_text(output_html, encoding="utf-8")

    rows = load_rows()
    rows = upsert_row(rows, record, output_path)
    write_rows(rows)
    regenerate_index(rows)
    return output_path, QUEUE_PATH, INDEX_PATH


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="Path to the lead JSON file")
    parser.add_argument("--output", help="Explicit output path for the generated HTML")
    args = parser.parse_args()

    record = json.loads(Path(args.input).read_text(encoding="utf-8"))
    output_path, queue_path, index_path = publish_record(record, args.output)

    print(output_path)
    print(queue_path)
    print(index_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
