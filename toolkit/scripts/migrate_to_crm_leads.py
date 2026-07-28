#!/usr/bin/env python3
"""Backfill crm_leads / crm_calls / crm_tasks from legacy JAWSAI911 tables.

Usage:
  python3 migrate_to_crm_leads.py

Requirements:
  - Set SUPABASE_URL
  - Set SUPABASE_SERVICE_ROLE_KEY

This script is idempotent enough for initial migration work:
  - matches existing crm_leads by normalized phone, then by client_id + full_name
  - inserts missing crm_calls from legacy calls
  - inserts open crm_tasks from legacy workflow_tasks and follow-up dates
"""

from __future__ import annotations

import os
from collections import defaultdict
from datetime import datetime, timezone

import requests


SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


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


def get_json(path: str, params: dict[str, str] | None = None) -> list[dict]:
    res = requests.get(f"{SUPABASE_URL}/rest/v1/{path}", headers=headers(), params=params, timeout=30)
    res.raise_for_status()
    return res.json()


def post_json(path: str, payload: list[dict] | dict, prefer: str = "return=representation") -> list[dict]:
    h = headers()
    h["Prefer"] = prefer
    res = requests.post(f"{SUPABASE_URL}/rest/v1/{path}", headers=h, json=payload, timeout=30)
    res.raise_for_status()
    return res.json() if res.text else []


def patch_json(path: str, payload: dict, params: dict[str, str]) -> list[dict]:
    res = requests.patch(f"{SUPABASE_URL}/rest/v1/{path}", headers=headers(), params=params, json=payload, timeout=30)
    res.raise_for_status()
    return res.json() if res.text else []


def normalize_phone(value: str | None) -> str:
    return "".join(ch for ch in (value or "") if ch.isdigit())


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


LEGACY_TO_STATUS = {
    "new": "new",
    "contacted": "contacted",
    "video_sent": "warm",
    "scheduled": "booked",
    "won": "closed_won",
    "lost": "closed_lost",
}


CALL_OUTCOME_TO_STATUS = {
    "no_answer": "contacted",
    "voicemail": "contacted",
    "spoke": "warm",
    "scheduled": "booked",
    "not_interested": "closed_lost",
    "won": "closed_won",
}


def fetch_lookup() -> tuple[dict[str, dict], dict[tuple[str, str], dict]]:
    rows = get_json("crm_leads", params={"select": "*", "limit": "10000"})
    by_phone: dict[str, dict] = {}
    by_name: dict[tuple[str, str], dict] = {}
    for row in rows:
        phone = normalize_phone(row.get("phone"))
        if phone:
            by_phone[phone] = row
        by_name[(str(row.get("client_id") or ""), str(row.get("full_name") or "").strip().lower())] = row
    return by_phone, by_name


def upsert_lead(by_phone: dict[str, dict], by_name: dict[tuple[str, str], dict], payload: dict) -> dict:
    phone_key = normalize_phone(payload.get("phone"))
    name_key = (str(payload.get("client_id") or ""), str(payload.get("full_name") or "").strip().lower())
    existing = by_phone.get(phone_key) if phone_key else None
    if not existing:
        existing = by_name.get(name_key)

    if existing:
        merged = {
            "full_name": existing.get("full_name") or payload["full_name"],
            "phone": existing.get("phone") or payload.get("phone"),
            "company": existing.get("company") or payload.get("company"),
            "city": existing.get("city") or payload.get("city"),
            "state": existing.get("state") or payload.get("state") or "FL",
            "status": payload.get("status") or existing.get("status") or "new",
            "source": existing.get("source") or payload.get("source"),
            "client_id": existing.get("client_id") or payload.get("client_id"),
            "notes": "\n".join(part for part in [existing.get("notes") or "", payload.get("notes") or ""] if part).strip() or None,
            "updated_at": iso_now(),
        }
        patch_json("crm_leads", merged, {"id": f"eq.{existing['id']}"})
        existing.update(merged)
        return existing

    inserted = post_json("crm_leads", payload)[0]
    phone_key = normalize_phone(inserted.get("phone"))
    if phone_key:
        by_phone[phone_key] = inserted
    by_name[name_key] = inserted
    return inserted


def migrate_pipeline_leads(by_phone: dict[str, dict], by_name: dict[tuple[str, str], dict]) -> None:
    rows = get_json("pipeline_leads", params={"select": "*", "limit": "10000"})
    for row in rows:
        upsert_lead(by_phone, by_name, {
            "full_name": row.get("name") or "Unknown Lead",
            "phone": row.get("phone"),
            "company": row.get("name"),
            "city": None,
            "state": "FL",
            "status": LEGACY_TO_STATUS.get(row.get("stage"), "new"),
            "source": "pipeline",
            "assigned_to": None,
            "client_id": str(row.get("client_id") or ""),
            "notes": row.get("notes"),
            "created_at": row.get("created_at") or iso_now(),
            "updated_at": iso_now(),
        })


def migrate_calls(by_phone: dict[str, dict], by_name: dict[tuple[str, str], dict]) -> None:
    rows = get_json("calls", params={"select": "*", "limit": "10000"})
    seen = {(row["lead_id"], row["outcome"], row["called_at"]) for row in get_json("crm_calls", params={"select": "lead_id,outcome,called_at", "limit": "10000"})}
    for row in rows:
        lead = upsert_lead(by_phone, by_name, {
            "full_name": row.get("lead_name") or "Unknown Lead",
            "phone": row.get("phone"),
            "company": row.get("lead_name"),
            "city": None,
            "state": "FL",
            "status": CALL_OUTCOME_TO_STATUS.get(row.get("outcome"), "contacted"),
            "source": "call_tracker",
            "assigned_to": None,
            "client_id": str(row.get("client_id") or ""),
            "notes": row.get("notes"),
            "last_call_at": row.get("logged_at") or row.get("created_at") or iso_now(),
            "last_call_outcome": row.get("outcome"),
            "call_attempts": 1,
            "next_follow_up_at": row.get("follow_up_date"),
            "created_at": row.get("created_at") or iso_now(),
            "updated_at": iso_now(),
        })
        called_at = row.get("logged_at") or row.get("created_at") or iso_now()
        key = (lead["id"], row.get("outcome"), called_at)
        if key not in seen:
            post_json("crm_calls", {
                "lead_id": lead["id"],
                "outcome": row.get("outcome") or "no_answer",
                "notes": row.get("notes"),
                "duration_seconds": None,
                "called_at": called_at,
                "called_by": None,
            }, prefer="return=minimal")
            seen.add(key)


def migrate_tasks(by_phone: dict[str, dict], by_name: dict[tuple[str, str], dict]) -> None:
    rows = get_json("workflow_tasks", params={"select": "*", "limit": "10000"})
    existing = {(row["lead_id"], row["title"], row.get("due_at")) for row in get_json("crm_tasks", params={"select": "lead_id,title,due_at", "limit": "10000"})}
    for row in rows:
        lead = upsert_lead(by_phone, by_name, {
            "full_name": row.get("lead_name") or "Unknown Lead",
            "phone": None,
            "company": row.get("lead_name"),
            "city": None,
            "state": "FL",
            "status": "contacted",
            "source": "workflow",
            "assigned_to": None,
            "client_id": str(row.get("client_id") or ""),
            "notes": None,
            "created_at": row.get("created_at") or iso_now(),
            "updated_at": iso_now(),
        })
        due_at = row.get("due_date")
        key = (lead["id"], row.get("script") or row.get("workflow_name") or "Follow-up", due_at)
        if key not in existing:
            post_json("crm_tasks", {
                "lead_id": lead["id"],
                "title": row.get("script") or row.get("workflow_name") or "Follow-up",
                "due_at": due_at,
                "status": "done" if row.get("done") else "open",
                "task_type": row.get("type") or "task",
                "created_at": row.get("created_at") or iso_now(),
            }, prefer="return=minimal")
            existing.add(key)


def main() -> int:
    require_env()
    by_phone, by_name = fetch_lookup()
    migrate_pipeline_leads(by_phone, by_name)
    migrate_calls(by_phone, by_name)
    migrate_tasks(by_phone, by_name)
    print("crm lead migration complete")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
