#!/usr/bin/env python3
"""Import salon outreach leads into JAWSAI911 CRM with Smart Site demo data.

Expected input: CSV exported from the lead sheet with columns like:
  Business Name
  Category
  City
  Phone
  Address
  Review Notes
  Website Status
  Demo Link
  Pitch Angle
  Status

Default behavior mirrors the existing SOP:
  - only rows marked Ready are imported
  - category selects the correct Smart Site demo
  - lead notes carry review / website / pitch context
  - smart_site_demo is preloaded on the CRM lead

Usage:
  export SUPABASE_URL=...
  export SUPABASE_SERVICE_ROLE_KEY=...
  python3 import_salon_leads.py \
    --csv /path/to/salon_leads.csv \
    --client-id <uuid-or-client-id>
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests


SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
CLIENTS_TABLE = "clients"
CRM_LEADS_TABLE = "crm_leads"
CRM_TASKS_TABLE = "crm_tasks"

OFFER_URL = "https://jawsai911.com/salon-supersite.html"
PROBLEMS_URL = "https://jawsai911.com/salon-supersite.html#problems"
SALES_SCRIPT_URL = "https://jawsai911.com/sales-script.html"

DEMO_MAP = {
    "barber": {
        "label": "Rivet Fade Co. Demo",
        "public_url": "https://jawsai911.com/demos/rivet-fade/index.html",
        "command_url": "https://jawsai911.com/demos/rivet-fade/command.html",
        "demo_type": "Rivet",
    },
    "nail": {
        "label": "Softline Studio Demo",
        "public_url": "https://jawsai911.com/demos/softline-nails/index.html",
        "command_url": "https://jawsai911.com/demos/softline-nails/command.html",
        "demo_type": "Softline",
    },
    "hair": {
        "label": "Lumina Desk Demo",
        "public_url": "https://jawsai911.com/lumina-desk/",
        "command_url": "https://jawsai911.com/lumina-desk/command.html",
        "demo_type": "Lumina",
    },
}


def require_env() -> None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise SystemExit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.")


def headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def get_json(path: str, params: dict[str, str] | None = None) -> list[dict[str, Any]]:
    res = requests.get(f"{SUPABASE_URL}/rest/v1/{path}", headers=headers(), params=params, timeout=30)
    res.raise_for_status()
    return res.json()


def post_json(path: str, payload: list[dict[str, Any]] | dict[str, Any], prefer: str = "return=representation") -> list[dict[str, Any]]:
    h = headers()
    h["Prefer"] = prefer
    res = requests.post(f"{SUPABASE_URL}/rest/v1/{path}", headers=h, json=payload, timeout=30)
    res.raise_for_status()
    return res.json() if res.text else []


def patch_json(path: str, payload: dict[str, Any], params: dict[str, str]) -> list[dict[str, Any]]:
    res = requests.patch(f"{SUPABASE_URL}/rest/v1/{path}", headers=headers(), params=params, json=payload, timeout=30)
    res.raise_for_status()
    return res.json() if res.text else []


def normalize_phone(value: str | None) -> str:
    return "".join(ch for ch in (value or "") if ch.isdigit())


def normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.strip().lower())


def title_key(value: str | None) -> str:
    return normalize_key(value or "")


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def status_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def truthy_status(value: str | None, expected: str) -> bool:
    return title_key(value) == title_key(expected)


def split_note_lines(parts: list[str | None]) -> str | None:
    cleaned = [str(part).strip() for part in parts if str(part or "").strip()]
    return "\n".join(cleaned) if cleaned else None


def parse_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise SystemExit(f"No headers found in {path}")

        mapped_fields = {normalize_key(name): name for name in reader.fieldnames}
        required = ["businessname", "category", "city", "status"]
        missing = [field for field in required if field not in mapped_fields]
        if missing:
            raise SystemExit(f"Missing required columns: {', '.join(missing)}")

        rows: list[dict[str, str]] = []
        for row in reader:
            rows.append({(key or "").strip(): (value or "").strip() for key, value in row.items()})
        return rows


def category_key(value: str | None) -> str:
    lowered = title_key(value)
    if lowered.startswith("barber"):
        return "barber"
    if lowered.startswith("nail"):
        return "nail"
    if lowered.startswith("hair"):
        return "hair"
    return lowered


@dataclass
class LeadRecord:
    business_name: str
    category: str
    city: str
    phone: str
    address: str
    review_notes: str
    website_status: str
    pitch_angle: str
    status: str
    demo_link_raw: str


def to_lead_record(row: dict[str, str]) -> LeadRecord:
    lookup = {normalize_key(key): value for key, value in row.items()}
    return LeadRecord(
        business_name=lookup.get("businessname", ""),
        category=lookup.get("category", ""),
        city=lookup.get("city", ""),
        phone=lookup.get("phone", ""),
        address=lookup.get("address", ""),
        review_notes=lookup.get("reviewnotes", ""),
        website_status=lookup.get("websitestatus", ""),
        pitch_angle=lookup.get("pitchangle", ""),
        status=lookup.get("status", ""),
        demo_link_raw=lookup.get("demolink", ""),
    )


def resolve_demo(category: str, raw_value: str) -> dict[str, str]:
    demo = DEMO_MAP.get(category_key(category))
    if not demo:
        raise ValueError(f"Unsupported category: {category}")

    if raw_value:
        raw_key = title_key(raw_value)
        for candidate in DEMO_MAP.values():
            if title_key(candidate["demo_type"]) == raw_key:
                demo = candidate
                break
    return demo


def fetch_client_id(client_id: str | None, client_name: str | None) -> str:
    if client_id:
        return str(client_id)
    if not client_name:
        raise SystemExit("Provide --client-id or --client-name.")

    existing = get_json(CLIENTS_TABLE, params={"select": "id,name", "name": f"eq.{client_name}", "limit": "1"})
    if existing:
        return str(existing[0]["id"])

    created = post_json(CLIENTS_TABLE, {"name": client_name})[0]
    return str(created["id"])


def fetch_lookup(client_id: str) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    rows = get_json(CRM_LEADS_TABLE, params={"select": "*", "client_id": f"eq.{client_id}", "limit": "10000"})
    by_phone: dict[str, dict[str, Any]] = {}
    by_name: dict[str, dict[str, Any]] = {}
    for row in rows:
        phone = normalize_phone(row.get("phone"))
        if phone:
            by_phone[phone] = row
        by_name[str(row.get("full_name") or "").strip().lower()] = row
    return by_phone, by_name


def build_smart_site_demo(record: LeadRecord, demo: dict[str, str], import_note: str | None) -> dict[str, Any]:
    note_lines = [
        f"{demo['demo_type']} demo matched for {record.category}.",
        import_note,
        f"Offer: {OFFER_URL}",
        f"Problems: {PROBLEMS_URL}",
        f"Sales script: {SALES_SCRIPT_URL}",
        f"Command hub: {demo['command_url']}",
    ]
    return {
        "name": demo["label"],
        "url": demo["public_url"],
        "status": "ready" if truthy_status(record.status, "Ready") else "draft",
        "notes": split_note_lines(note_lines),
        "command_url": demo["command_url"],
        "offer_url": OFFER_URL,
        "sales_script_url": SALES_SCRIPT_URL,
        "last_updated_at": status_timestamp(),
    }


def build_custom_fields(record: LeadRecord, demo: dict[str, str]) -> dict[str, Any]:
    google_proof = {
        "review_notes": record.review_notes or None,
        "photo_status": "lookup_pending",
        "lookup_status": "pending_google_lookup",
    }
    return {
        "industry": "salon",
        "category": record.category or None,
        "address": record.address or None,
        "website_status": record.website_status or None,
        "pitch_angle": record.pitch_angle or None,
        "lead_sheet_status": record.status or None,
        "demo_type": demo["demo_type"],
        "command_hub_url": demo["command_url"],
        "offer_url": OFFER_URL,
        "problems_url": PROBLEMS_URL,
        "sales_script_url": SALES_SCRIPT_URL,
        "google_proof": google_proof,
        "smart_site_demo": build_smart_site_demo(record, demo, record.review_notes or None),
    }


def build_lead_notes(record: LeadRecord, demo: dict[str, str]) -> str | None:
    return split_note_lines([
        f"Salon lead import on {datetime.now().date().isoformat()}",
        f"Category: {record.category}",
        f"City: {record.city}",
        f"Address: {record.address}" if record.address else None,
        f"Website status: {record.website_status}" if record.website_status else None,
        f"Pitch angle: {record.pitch_angle}" if record.pitch_angle else None,
        f"Review notes: {record.review_notes}" if record.review_notes else None,
        f"Demo: {demo['public_url']}",
        f"Command hub: {demo['command_url']}",
    ])


def upsert_lead(
    client_id: str,
    by_phone: dict[str, dict[str, Any]],
    by_name: dict[str, dict[str, Any]],
    record: LeadRecord,
    default_owner: str | None,
) -> tuple[str, bool]:
    demo = resolve_demo(record.category, record.demo_link_raw)
    phone_key = normalize_phone(record.phone)
    name_key = record.business_name.strip().lower()
    existing = by_phone.get(phone_key) if phone_key else None
    if not existing:
        existing = by_name.get(name_key)

    custom_fields = build_custom_fields(record, demo)
    notes = build_lead_notes(record, demo)
    payload: dict[str, Any] = {
        "full_name": record.business_name,
        "phone": record.phone or None,
        "company": record.business_name,
        "city": record.city or None,
        "state": "FL",
        "status": "new",
        "source": "salon_import",
        "assigned_to": default_owner or None,
        "client_id": client_id,
        "notes": notes,
        "tags": ["salon", category_key(record.category), title_key(record.status) or "unmarked"],
        "custom_fields": custom_fields,
        "next_follow_up_at": iso_now() if truthy_status(record.status, "Ready") and record.phone else None,
    }

    if existing:
        update_payload = {
            "phone": payload["phone"] or existing.get("phone") or None,
            "company": payload["company"] or existing.get("company") or None,
            "city": payload["city"] or existing.get("city") or None,
            "status": existing.get("status") or payload["status"],
            "source": existing.get("source") or payload["source"],
            "assigned_to": payload["assigned_to"] or existing.get("assigned_to") or None,
            "notes": split_note_lines([existing.get("notes"), payload["notes"]]),
            "tags": existing.get("tags") or payload["tags"],
            "custom_fields": {**(existing.get("custom_fields") or {}), **custom_fields},
            "next_follow_up_at": existing.get("next_follow_up_at") or payload["next_follow_up_at"],
        }
        patch_json(CRM_LEADS_TABLE, update_payload, {"id": f"eq.{existing['id']}"})
        existing.update(update_payload)
        return str(existing["id"]), False

    inserted = post_json(CRM_LEADS_TABLE, payload)[0]
    if phone_key:
        by_phone[phone_key] = inserted
    by_name[name_key] = inserted
    return str(inserted["id"]), True


def ensure_task(lead_id: str, record: LeadRecord) -> None:
    if not truthy_status(record.status, "Ready") or not record.phone:
        return

    title = "Send salon Smart Site demo"
    existing = get_json(
        CRM_TASKS_TABLE,
        params={
            "select": "id,title,status",
            "lead_id": f"eq.{lead_id}",
            "title": f"eq.{title}",
            "status": "eq.open",
            "limit": "1",
        },
    )
    if existing:
        return

    post_json(
        CRM_TASKS_TABLE,
        {
            "lead_id": lead_id,
            "title": title,
            "due_at": iso_now(),
            "status": "open",
            "task_type": "text",
            "created_at": iso_now(),
        },
        prefer="return=minimal",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", required=True, help="Path to CSV exported from the salon lead sheet.")
    parser.add_argument("--client-id", help="Existing CRM client id.")
    parser.add_argument("--client-name", help="CRM client name. Created if missing.")
    parser.add_argument("--owner", help="Default rep / owner to assign.")
    parser.add_argument(
        "--include-needs-phone",
        action="store_true",
        help="Also import rows not marked Ready.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and print the import payload summary without writing to Supabase.",
    )
    args = parser.parse_args()

    require_env()
    csv_path = Path(args.csv).expanduser().resolve()
    if not csv_path.exists():
        raise SystemExit(f"CSV not found: {csv_path}")

    rows = [to_lead_record(row) for row in parse_csv(csv_path)]
    eligible = [
        row for row in rows
        if truthy_status(row.status, "Ready") or args.include_needs_phone
    ]

    if not eligible:
        print("No eligible rows found.")
        return 0

    if args.dry_run:
        preview = []
        for row in eligible:
            demo = resolve_demo(row.category, row.demo_link_raw)
            preview.append(
                {
                    "business_name": row.business_name,
                    "category": row.category,
                    "city": row.city,
                    "phone": row.phone,
                    "status": row.status,
                    "demo_url": demo["public_url"],
                    "command_url": demo["command_url"],
                }
            )
        print(json.dumps(preview, indent=2))
        return 0

    client_id = fetch_client_id(args.client_id, args.client_name)
    by_phone, by_name = fetch_lookup(client_id)

    created = 0
    updated = 0
    for row in eligible:
        lead_id, inserted = upsert_lead(client_id, by_phone, by_name, row, args.owner)
        ensure_task(lead_id, row)
        if inserted:
            created += 1
        else:
            updated += 1

    print(f"Imported salon leads into client {client_id}: created={created}, updated={updated}, total={len(eligible)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
