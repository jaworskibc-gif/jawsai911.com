#!/usr/bin/env python3
"""Enrich a minimal hot lead seed into a publish-ready demo JSON.

This script does not try to scrape Google directly.
It pulls from source URLs you provide, extracts likely review snippets,
image URLs, and basic metadata, then builds a full JSON document that can
be fed into `generate_hot_lead_demo.py`.
"""

from __future__ import annotations

import argparse
import html
import json
import re
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests


DEFAULT_IMAGES = [
    "https://static.wixstatic.com/media/5783dd_d08ab5779bb94aa8a1ef267797fbb98d~mv2.jpg/v1/fill/w_980,h_653,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/5783dd_d08ab5779bb94aa8a1ef267797fbb98d~mv2.jpg",
    "https://static.wixstatic.com/media/5783dd_6833d145d1a9490f89e8489f6a9d510cf000.jpg/v1/fill/w_300,h_534,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/5783dd_6833d145d1a9490f89e8489f6a9d510cf000.jpg",
    "https://static.wixstatic.com/media/5783dd_3789615726494420879f9d2fc15d2adff000.jpg/v1/fill/w_300,h_534,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/5783dd_3789615726494420879f9d2fc15d2adff000.jpg",
    "https://static.wixstatic.com/media/939ab2_52a156cf9bbe47f293f906b291a602dff000.jpg/v1/fill/w_300,h_534,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/939ab2_52a156cf9bbe47f293f906b291a602dff000.jpg",
]


def fetch(url: str) -> str:
    response = requests.get(
        url,
        timeout=20,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
            )
        },
    )
    response.raise_for_status()
    return response.text


def clean_space(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def strip_tags(value: str) -> str:
    return clean_space(re.sub(r"<[^>]+>", " ", value))


def title_case_words(value: str) -> str:
    return " ".join(word.capitalize() for word in re.split(r"\s+", value.strip()) if word)


def initials_for(value: str) -> str:
    words = re.findall(r"[A-Za-z0-9]+", value)
    return "".join(word[0] for word in words[:2]).upper() or "SS"


def find_meta_images(raw: str, base_url: str) -> list[str]:
    urls: list[str] = []
    patterns = [
        r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)["\']',
        r'"image"\s*:\s*"([^"]+)"',
    ]
    for pattern in patterns:
        for match in re.findall(pattern, raw, flags=re.I):
            url = urljoin(base_url, html.unescape(match))
            if url not in urls:
                urls.append(url)
    return urls


def find_json_ld_reviews(raw: str) -> list[dict]:
    reviews: list[dict] = []
    scripts = re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', raw, flags=re.I | re.S)
    for script in scripts:
        script = script.strip()
        if not script:
            continue
        try:
            data = json.loads(script)
        except Exception:
            continue
        stack = data if isinstance(data, list) else [data]
        while stack:
            item = stack.pop()
            if isinstance(item, dict):
                if "review" in item:
                    review_data = item["review"]
                    if isinstance(review_data, list):
                        stack.extend(review_data)
                    else:
                        stack.append(review_data)
                body = item.get("reviewBody")
                if body:
                    author = item.get("author", {})
                    if isinstance(author, dict):
                        author = author.get("name", "Customer")
                    reviews.append(
                        {
                            "quote": clean_space(str(body)),
                            "author": clean_space(str(author)) or "Customer",
                            "source": "Review excerpt pulled from structured data.",
                        }
                    )
                stack.extend(v for v in item.values() if isinstance(v, (dict, list)))
            elif isinstance(item, list):
                stack.extend(item)
    return reviews


def find_blockquote_reviews(raw: str) -> list[dict]:
    reviews: list[dict] = []
    blocks = re.findall(r"<blockquote[^>]*>(.*?)</blockquote>", raw, flags=re.I | re.S)
    for block in blocks:
        quote = strip_tags(block)
        if len(quote) < 35:
            continue
        reviews.append(
            {
                "quote": quote,
                "author": "Customer",
                "source": "Review-style quote pulled from page content.",
            }
        )
    return reviews


def find_text_reviews(raw: str) -> list[dict]:
    reviews: list[dict] = []
    text = strip_tags(raw)
    sentences = re.split(r"(?<=[.!?])\s+", text)
    keywords = ("responsive", "professional", "honest", "knowledgeable", "amazing", "great", "recommend")
    for sentence in sentences:
        sentence = clean_space(sentence)
        if len(sentence) < 45 or len(sentence) > 220:
            continue
        lowered = sentence.lower()
        if any(word in lowered for word in keywords):
            reviews.append(
                {
                    "quote": sentence,
                    "author": "Customer",
                    "source": "Review-like excerpt pulled heuristically from page text.",
                }
            )
    return reviews


def unique_reviews(candidates: list[dict], limit: int = 3) -> list[dict]:
    seen = set()
    output: list[dict] = []
    for review in candidates:
        quote = review["quote"].strip()
        key = quote.lower()
        if key in seen:
            continue
        seen.add(key)
        output.append(review)
        if len(output) >= limit:
            break
    return output


def infer_website_url(source_urls: list[str]) -> str:
    for url in source_urls:
        if "verifiedpoolpros.com" not in url and "buildzoom.com" not in url and "porch.com" not in url:
            return url
    return source_urls[0] if source_urls else "#"


def build_default_copy(seed: dict) -> dict:
    business_name = seed["business_name"]
    city = seed["city"]
    rating = seed["rating"]
    review_count = seed["review_count"]
    return {
        "eyebrow": seed.get("eyebrow", "Luxury Backyard Demo"),
        "headline_line_1": seed.get("headline_line_1", "Design the backyard they already"),
        "headline_line_2": seed.get("headline_line_2", "deserve."),
        "hero_subtext": seed.get(
            "hero_subtext",
            "This is the text-message demo version: premium look, visible trust, and a clean path to quote. "
            "Instead of a thin listing, homeowners land on a site that feels established, expensive, and ready to book.",
        ),
        "trust_stat": seed.get("trust_stat", "5.0"),
        "trust_label": seed.get("trust_label", "Local Reputation"),
        "pitch_headline": seed.get("pitch_headline", f"{review_count} reviews. {rating} stars. No premium front door."),
        "pitch_body": seed.get(
            "pitch_body",
            "Lead with the proof they already earned, then show how the same reputation could be packaged into something "
            "that feels like a real design-build brand instead of another contractor listing.",
        ),
        "text_line": seed.get(
            "text_line",
            f"{review_count} reviews at {rating} and no website. 30-sec SuperSite demo for {business_name}.",
        ),
        "call_script": seed.get(
            "call_script",
            f"Hey, this is Bryan with JAWSAI. {business_name} is sitting at {rating} with {review_count} reviews. "
            "Strong reputation, nothing converting it online. I built a quick demo - reviews up front, after-hours lead capture, "
            "follow-up so quotes don't go cold. 30 seconds.",
        ),
        "section_title": seed.get("section_title", "Show them a site that feels premium before they ever pick up."),
        "section_copy": seed.get(
            "section_copy",
            "This demo follows the same luxury-pool idea: strong hero image, elegant type, review proof, and a quote path "
            "that feels more like a premium brand than a local directory page.",
        ),
        "gallery_caption_title": seed.get("gallery_caption_title", "Luxury pool positioning, not commodity contractor energy."),
        "gallery_caption_body": seed.get(
            "gallery_caption_body",
            "Use the Loom to frame this as a concept: better first impression, stronger trust, and a cleaner way "
            "to convert quote traffic that currently dies after hours.",
        ),
        "why_cards": seed.get(
            "why_cards",
            [
                {
                    "title": "Reviews up front",
                    "body": "The rating and review count are in the hero immediately so a homeowner sees trust before they start comparing quotes.",
                },
                {
                    "title": "After-hours capture",
                    "body": "The pitch is not just aesthetics. It is a digital front door that catches nighttime demand and moves it into follow-up instead of losing it.",
                },
                {
                    "title": "Luxury brand framing",
                    "body": "The whole page positions the company as a design-driven backyard builder, which is a better pricing conversation than looking like a generic service listing.",
                },
            ],
        ),
        "process_bodies": seed.get(
            "process_bodies",
            [
                "Send this page link with the short line. Let the page do the heavy lifting before the call even starts.",
                "Walk the hero, the review proof, and the quote path in under a minute. Focus on what this changes for after-hours leads and trust.",
                "The pitch is simple: the business already earned the reputation. The site should finally look like it.",
            ],
        ),
        "cta_title": seed.get("cta_title", "This is the template to clone."),
        "cta_body": seed.get(
            "cta_body",
            "Keep the layout, keep the premium pool photography, and just swap business name, phone, city, and review proof. "
            "That is stronger than sending thin pages that feel disposable.",
        ),
        "footer_note": seed.get(
            "footer_note",
            "Reference direction: Liquid Luxe hero and luxury-pool positioning. Images may be generic premium pool photos unless better business-specific assets are available.",
        ),
        "photo_source_note": seed.get(
            "photo_source_note",
            "Use generic premium pool imagery by default. Swap to business-specific Google profile photos only when they are strong enough to help.",
        ),
        "loom_angle": seed.get(
            "loom_angle",
            "Lead with premium positioning, review proof, and after-hours conversion instead of talking about a generic website redesign.",
        ),
    }


def enrich(seed: dict) -> dict:
    source_urls = seed.get("source_urls", [])
    website_url = seed.get("website_url") or infer_website_url(source_urls)
    pages: list[tuple[str, str]] = []
    image_urls: list[str] = []
    review_candidates: list[dict] = []

    for url in [website_url, *source_urls]:
        if not url or url == "#":
            continue
        try:
            raw = fetch(url)
        except Exception:
            continue
        pages.append((url, raw))
        for image in find_meta_images(raw, url):
            if image not in image_urls:
                image_urls.append(image)
        review_candidates.extend(find_json_ld_reviews(raw))
        review_candidates.extend(find_blockquote_reviews(raw))
        review_candidates.extend(find_text_reviews(raw))

    reviews = unique_reviews(review_candidates, 3)
    while len(reviews) < 3:
        reviews.append(
            {
                "quote": f"Paste a real review snippet for {seed['business_name']} here before sending.",
                "author": "Customer",
                "source": "Manual fallback needed.",
            }
        )

    chosen_images = image_urls[:4]
    while len(chosen_images) < 4:
        chosen_images.append(DEFAULT_IMAGES[len(chosen_images)])

    copy = build_default_copy(seed)
    business_name = seed["business_name"]
    city = seed["city"]

    output = {
        "business_name": business_name,
        "city": city,
        "state": seed.get("state", "FL"),
        "phone_display": seed["phone_display"],
        "rating": seed["rating"],
        "review_count": seed["review_count"],
        "priority_rank": seed.get("priority_rank", ""),
        "priority_tier": seed.get("priority_tier", "A"),
        "priority_score": seed.get("priority_score", ""),
        "source_urls": source_urls or ([website_url] if website_url else []),
        "source_labels": seed.get(
            "source_labels",
            [title_case_words(urlparse(url).netloc.replace("www.", "").split(".")[0]) for url in (source_urls or [website_url])[:2]],
        ),
        "website_url": website_url,
        "hero_image_url": chosen_images[0],
        "gallery_images": chosen_images[1:4],
        "review_quotes": reviews,
        "initials": seed.get("initials", initials_for(business_name)),
        **copy,
    }
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="Path to minimal seed JSON")
    parser.add_argument("--output", help="Path to enriched JSON output")
    args = parser.parse_args()

    seed = json.loads(Path(args.input).read_text(encoding="utf-8"))
    enriched = enrich(seed)

    output_path = Path(args.output) if args.output else Path(args.input).with_name(Path(args.input).stem + ".enriched.json")
    output_path.write_text(json.dumps(enriched, indent=2), encoding="utf-8")
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
