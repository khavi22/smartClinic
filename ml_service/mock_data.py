"""
SmartClinic Mock Data Generator
================================
Generates realistic historical data in Firestore for ML model training:
  1. appointments  — past 90 days, per-clinic, with realistic busyness patterns
  2. queueItems    — completed consultations with actualDuration, serviceId, priority

Usage:
    cd ml_service
    python mock_data.py --clinic <clinicId> [--days 90]

Flags:
    --clinic   Firestore clinic document ID  (required)
    --days     How many days of history to generate (default: 90)
    --skip-appointments   Skip generating appointments
    --skip-queue          Skip generating queue items
    --clean               Delete existing mock data for the clinic first
"""

import argparse
import random
import sys
from datetime import datetime, timedelta, timezone
import firebase_admin
from firebase_admin import credentials, firestore

# ─── Firebase Init ─────────────────────────────────────────────────────────────

try:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred)
except ValueError:
    pass  # already initialized

db = firestore.client()


# ─── Clinic profile ────────────────────────────────────────────────────────────

SERVICES = [
    {"id": "general",     "name": "General Consultation",        "duration": 20},
    {"id": "dental",      "name": "Dental Cleaning & Check-up",  "duration": 45},
    {"id": "vaccination", "name": "Vaccination",                 "duration": 10},
    {"id": "chronic",     "name": "Chronic Disease Management",  "duration": 30},
    {"id": "mental",      "name": "Mental Health Counselling",   "duration": 60},
]

# Hour → relative busyness weight (higher = more appointments)
HOUR_WEIGHTS = {
    8:  0.40, 9:  0.90, 10: 1.00, 11: 0.85,
    12: 0.30, 13: 0.25, 14: 0.65, 15: 0.75,
    16: 0.70, 17: 0.45,
}

MAX_PER_SLOT = 10   # Firestore capacity per slot


# ─── Helpers ──────────────────────────────────────────────────────────────────

def batch_commit(db, ops, batch_ref, count_ref):
    """Helper to stay under Firestore 500-op batch limit."""
    pass  # inline below


def delete_mock_data(clinic_id: str):
    """Remove previously generated mock records for this clinic."""
    print(f"Cleaning existing mock data for clinic '{clinic_id}'...")

    # Delete mock appointments
    appt_batch = db.batch()
    cnt = 0
    for doc in db.collection("appointments").where("clinicId", "==", clinic_id).where("isMock", "==", True).stream():
        appt_batch.delete(doc.reference)
        cnt += 1
        if cnt % 400 == 0:
            appt_batch.commit()
            appt_batch = db.batch()
    if cnt % 400 != 0:
        appt_batch.commit()
    print(f"  Deleted {cnt} mock appointments.")

    # Queue items are nested; iterate queues subcollection
    queues_ref = db.collection("clinics").document(clinic_id).collection("queues")
    for queue_doc in queues_ref.stream():
        q_batch = db.batch()
        qcnt = 0
        for item in queue_doc.reference.collection("queueItems").where("isMock", "==", True).stream():
            q_batch.delete(item.reference)
            qcnt += 1
            if qcnt % 400 == 0:
                q_batch.commit()
                q_batch = db.batch()
        if qcnt % 400 != 0:
            q_batch.commit()
    print("  Mock queue items deleted.")


# ─── Appointment Generator ────────────────────────────────────────────────────

def generate_appointments(clinic_id: str, num_days: int):
    print(f"\n[Appointments] Generating {num_days} days of data for clinic '{clinic_id}'...")
    start_date = datetime.now() - timedelta(days=num_days)
    batch = db.batch()
    count = 0
    total = 0

    for day_offset in range(num_days):
        curr_date = start_date + timedelta(days=day_offset)
        day_of_week = curr_date.weekday()   # 0 = Mon, 6 = Sun
        date_str = curr_date.strftime("%Y-%m-%d")

        # Weekend is much quieter
        day_scale = 0.15 if day_of_week >= 5 else 1.0

        for hour, weight in HOUR_WEIGHTS.items():
            slot_str = f"{hour:02d}:00 - {hour+1:02d}:00"
            num_appts = round(MAX_PER_SLOT * weight * day_scale * random.uniform(0.6, 1.0))
            num_appts = max(0, min(num_appts, MAX_PER_SLOT))

            for _ in range(num_appts):
                service = random.choice(SERVICES)
                status = random.choices(
                    ["booked", "cancelled", "completed"],
                    weights=[0.60, 0.15, 0.25]
                )[0]
                doc_ref = db.collection("appointments").document()
                batch.set(doc_ref, {
                    "clinicId":        clinic_id,
                    "patientId":       f"mock_patient_{random.randint(1, 5000)}",
                    "date":            date_str,
                    "timeSlot":        slot_str,
                    "status":          status,
                    "serviceId":       service["id"],
                    "serviceName":     service["name"],
                    "serviceDuration": service["duration"],
                    "isMock":          True,
                    "createdAt":       firestore.SERVER_TIMESTAMP,
                })
                count += 1
                total += 1

                if count >= 450:
                    batch.commit()
                    batch = db.batch()
                    print(f"  Committed {total} appointments...")
                    count = 0

    if count > 0:
        batch.commit()
    print(f"[Appointments] Done — {total} records written.")
    return total


# ─── Queue Item Generator ─────────────────────────────────────────────────────

def generate_queue_items(clinic_id: str, num_days: int):
    """
    Generates COMPLETE queue items with realistic actualDuration values.
    These are stored at: clinics/{clinicId}/queues/{date}/queueItems/{appointmentId}
    """
    print(f"\n[Queue Items] Generating {num_days} days of completed consultations...")
    start_date = datetime.now() - timedelta(days=num_days)
    batch = db.batch()
    count = 0
    total = 0

    queue_number = 1

    for day_offset in range(num_days):
        curr_date = start_date + timedelta(days=day_offset)
        day_of_week = curr_date.weekday()
        date_str = curr_date.strftime("%Y-%m-%d")

        # Skip weekends with high probability
        if day_of_week >= 5 and random.random() > 0.1:
            continue

        day_scale = 0.15 if day_of_week >= 5 else 1.0

        for hour, weight in HOUR_WEIGHTS.items():
            num_consultations = round(8 * weight * day_scale * random.uniform(0.5, 1.0))
            num_consultations = max(0, num_consultations)

            for i in range(num_consultations):
                service = random.choice(SERVICES)
                priority = random.choices([0, 1, 2], weights=[0.7, 0.2, 0.1])[0]
                base_dur = service["duration"]

                # Higher priority = slightly shorter wait through the queue
                # Morning is slightly faster (less complex cases early)
                hour_factor = 1.0 + (0.1 if hour >= 14 else 0.0)

                # Add realistic noise
                actual_dur = max(5.0, base_dur * hour_factor + random.gauss(0, base_dur * 0.2))
                actual_dur = round(min(actual_dur, 120.0), 1)

                # Simulate consultation start/end times
                start_min = random.randint(0, 55)
                started_at = curr_date.replace(hour=hour, minute=start_min, second=0,
                                                microsecond=0, tzinfo=timezone.utc)
                completed_at = started_at + timedelta(minutes=actual_dur)

                doc_id = f"mock_{date_str}_{hour}_{i}_{random.randint(1000, 9999)}"
                slot_str = f"{hour:02d}:00 - {hour+1:02d}:00"

                doc_ref = (
                    db.collection("clinics").document(clinic_id)
                    .collection("queues").document(date_str)
                    .collection("queueItems").document(doc_id)
                )
                batch.set(doc_ref, {
                    "appointmentId":         f"appt_{doc_id}",
                    "clinicId":              clinic_id,
                    "patientId":             f"mock_patient_{random.randint(1, 5000)}",
                    "patientName":           f"Mock Patient {random.randint(1, 500)}",
                    "date":                  date_str,
                    "timeSlot":              slot_str,
                    "appointmentTime":       slot_str,
                    "serviceId":             service["id"],
                    "serviceName":           service["name"],
                    "serviceDuration":       service["duration"],
                    "status":                "COMPLETE",
                    "priority":              priority,
                    "queueNumber":           queue_number,
                    "assignedStaffId":       f"mock_staff_{random.randint(1, 5)}",
                    "consultationStartedAt": started_at,
                    "consultationCompletedAt": completed_at,
                    "actualDuration":        actual_dur,
                    "isMock":                True,
                    "createdAt":             firestore.SERVER_TIMESTAMP,
                })
                count += 1
                total += 1
                queue_number += 1

                if count >= 450:
                    batch.commit()
                    batch = db.batch()
                    print(f"  Committed {total} queue items...")
                    count = 0

    if count > 0:
        batch.commit()
    print(f"[Queue Items] Done — {total} records written.")
    return total


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SmartClinic mock data generator")
    parser.add_argument("--clinic",  required=True, help="Firestore clinic document ID")
    parser.add_argument("--days",    type=int, default=90, help="Days of history to generate (default: 90)")
    parser.add_argument("--skip-appointments", action="store_true")
    parser.add_argument("--skip-queue",        action="store_true")
    parser.add_argument("--clean",             action="store_true", help="Delete existing mock data first")
    args = parser.parse_args()

    if args.clean:
        delete_mock_data(args.clinic)

    appt_total  = 0
    queue_total = 0

    if not args.skip_appointments:
        appt_total = generate_appointments(args.clinic, args.days)

    if not args.skip_queue:
        queue_total = generate_queue_items(args.clinic, args.days)

    print(f"\n✅ Mock data generation complete:")
    print(f"   Appointments : {appt_total}")
    print(f"   Queue items  : {queue_total}")
    print(f"\nNow retrain the model:")
    print(f"   curl -X POST http://localhost:5001/train")
