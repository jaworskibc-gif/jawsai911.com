#!/usr/bin/env python3
"""Build and publish a premium demo from a minimal company swap JSON."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from enrich_hot_lead import build_default_copy, initials_for
from generate_hot_lead_demo import DEFAULT_POOL_VIDEO_PATH, publish_record


def build_record(swap: dict) -> dict:
    required = [
        "business_name",
        "city",
        "phone_display",
        "rating",
        "review_count",
        "website_url",
        "gallery_images",
        "review_quotes",
    ]
    missing = [key for key in required if not swap.get(key)]
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}")

    gallery_images = swap["gallery_images"]
    if len(gallery_images) < 3:
        raise ValueError("gallery_images must contain at least 3 image URLs")

    review_quotes = swap["review_quotes"]
    if len(review_quotes) != 3:
        raise ValueError("review_quotes must contain exactly 3 reviews")

    defaults = build_default_copy(swap)
    website_url = swap["website_url"]
    source_urls = swap.get("source_urls") or [website_url]
    source_labels = swap.get("source_labels") or ["Business Website", "Google Business Profile"]
    source_urls = (source_urls + [website_url, "#"])[:2]
    source_labels = (source_labels + ["Source 1", "Source 2"])[:2]

    record = {
        "business_name": swap["business_name"],
        "city": swap["city"],
        "state": swap.get("state", "FL"),
        "phone_display": swap["phone_display"],
        "rating": str(swap["rating"]),
        "review_count": str(swap["review_count"]),
        "priority_rank": swap.get("priority_rank", ""),
        "priority_tier": swap.get("priority_tier", "A"),
        "priority_score": swap.get("priority_score", ""),
        "website_url": website_url,
        "source_urls": source_urls,
        "source_labels": source_labels,
        "hero_image_url": swap.get("hero_image_url") or gallery_images[0],
        "gallery_images": gallery_images[:3],
        "video_url": swap.get("video_url", DEFAULT_POOL_VIDEO_PATH),
        "video_poster_url": swap.get("video_poster_url") or gallery_images[0],
        "review_quotes": review_quotes,
        "initials": swap.get("initials", initials_for(swap["business_name"])),
        **defaults,
    }

    override_keys = [
        "eyebrow",
        "headline_line_1",
        "headline_line_2",
        "hero_subtext",
        "trust_stat",
        "trust_label",
        "pitch_headline",
        "pitch_body",
        "text_line",
        "call_script",
        "section_title",
        "section_copy",
        "gallery_caption_title",
        "gallery_caption_body",
        "video_section_label",
        "video_section_title",
        "video_section_body",
        "why_cards",
        "process_bodies",
        "cta_title",
        "cta_body",
        "footer_note",
        "photo_source_note",
        "loom_angle",
    ]
    for key in override_keys:
        if key in swap:
            record[key] = swap[key]

    return record


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="Path to the minimal company swap JSON")
    parser.add_argument("--output", help="Explicit output path for the generated HTML")
    parser.add_argument("--write-full-record", action="store_true", help="Write the expanded full JSON next to the input")
    args = parser.parse_args()

    swap = json.loads(Path(args.input).read_text(encoding="utf-8"))
    record = build_record(swap)

    if args.write_full_record:
        full_record_path = Path(args.input).with_name(Path(args.input).stem + ".full.json")
        full_record_path.write_text(json.dumps(record, indent=2), encoding="utf-8")
        print(full_record_path)

    output_path, queue_path, index_path = publish_record(record, args.output)
    print(output_path)
    print(queue_path)
    print(index_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
