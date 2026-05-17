"""
SmartClinic ML Service — Wait-Time Prediction
==============================================
Endpoints:
  GET  /health                  → liveness + model readiness
  POST /train                   → manual retrain trigger
  GET  /predict                 → hourly busyness predictions for a date
  GET  /predict-range           → busyness predictions over a date range
  GET  /predict-waittime        → estimated wait time for a patient booking

Models:
  - busyness_model : GradientBoostingRegressor
      Predicts expected appointment count for (clinic, day, hour).
  - duration_model : GradientBoostingRegressor
      Predicts consultation duration for (clinic, service, day, hour, priority).

Persistence:
  Models are saved to disk (models/) after each training run so that a
  cold restart can serve predictions immediately without re-fetching Firestore.
"""

import os
import json
import time
import pickle
import threading
import logging
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import cross_val_score
from sklearn.metrics import mean_absolute_error
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

# ─── Setup ────────────────────────────────────────────────────────────────────

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("smartclinic_ml")

app = Flask(__name__)
CORS(app)

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODEL_DIR, exist_ok=True)

BUSYNESS_MODEL_PATH  = os.path.join(MODEL_DIR, "busyness_model.pkl")
DURATION_MODEL_PATH  = os.path.join(MODEL_DIR, "duration_model.pkl")
MAPPINGS_PATH        = os.path.join(MODEL_DIR, "mappings.json")

# ─── Firebase Init ────────────────────────────────────────────────────────────

try:
    cred_json = os.environ.get("FIREBASE_CREDENTIALS_JSON")
    if cred_json:
        cred = credentials.Certificate(json.loads(cred_json))
    else:
        cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred)
except ValueError:
    pass  # already initialized

db = firestore.client()

# ─── Global State ─────────────────────────────────────────────────────────────

busyness_model  = None
duration_model  = None
clinic_mapping  = {}
service_mapping = {}
last_trained_at = None
training_lock   = threading.Lock()

# ─── Constants ────────────────────────────────────────────────────────────────

DEFAULT_CONSULT_MINUTES  = 20.0
RETRAIN_INTERVAL_SECONDS = 3600        # 1 hour
MIN_QUEUE_SAMPLES        = 20          # minimum real records before skipping synthetic fill
BUSYNESS_SYNTHETIC_FILL  = 15         # minimum appointment records to train busyness model

# ─── Feature Engineering ──────────────────────────────────────────────────────

def encode_time_features(day_of_week: int, hour: int) -> dict:
    """Return cyclic sine/cosine encodings for day and hour."""
    return {
        "day_sin":  np.sin(2 * np.pi * day_of_week / 7),
        "day_cos":  np.cos(2 * np.pi * day_of_week / 7),
        "hour_sin": np.sin(2 * np.pi * hour / 24),
        "hour_cos": np.cos(2 * np.pi * hour / 24),
        "is_morning":  int(hour < 12),
        "is_afternoon": int(12 <= hour < 17),
        "is_weekend":  int(day_of_week >= 5),
    }

BUSYNESS_FEATURES = [
    "clinic_code", "day_of_week", "hour",
    "day_sin", "day_cos", "hour_sin", "hour_cos",
    "is_morning", "is_afternoon", "is_weekend",
]

DURATION_FEATURES = [
    "clinic_code", "service_code", "day_of_week", "hour", "priority",
    "day_sin", "day_cos", "hour_sin", "hour_cos",
    "is_morning", "is_afternoon", "is_weekend",
]

def build_busyness_row(clinic_code: int, day: int, hour: int) -> dict:
    row = {"clinic_code": clinic_code, "day_of_week": day, "hour": hour}
    row.update(encode_time_features(day, hour))
    return row

def build_duration_row(clinic_code: int, service_code: int, day: int, hour: int, priority: int) -> dict:
    row = {
        "clinic_code": clinic_code,
        "service_code": service_code,
        "day_of_week": day,
        "hour": hour,
        "priority": priority,
    }
    row.update(encode_time_features(day, hour))
    return row

# ─── Model Persistence ────────────────────────────────────────────────────────

def save_models():
    try:
        with open(BUSYNESS_MODEL_PATH, "wb") as f:
            pickle.dump(busyness_model, f)
        with open(DURATION_MODEL_PATH, "wb") as f:
            pickle.dump(duration_model, f)
        with open(MAPPINGS_PATH, "w") as f:
            json.dump({"clinic_mapping": clinic_mapping, "service_mapping": service_mapping}, f)
        log.info("Models saved to disk.")
    except Exception as e:
        log.warning(f"Could not save models: {e}")

def load_models():
    global busyness_model, duration_model, clinic_mapping, service_mapping, last_trained_at
    try:
        if all(os.path.exists(p) for p in [BUSYNESS_MODEL_PATH, DURATION_MODEL_PATH, MAPPINGS_PATH]):
            with open(BUSYNESS_MODEL_PATH, "rb") as f:
                busyness_model = pickle.load(f)
            with open(DURATION_MODEL_PATH, "rb") as f:
                duration_model = pickle.load(f)
            with open(MAPPINGS_PATH) as f:
                m = json.load(f)
                clinic_mapping  = m.get("clinic_mapping", {})
                service_mapping = m.get("service_mapping", {})
            last_trained_at = datetime.fromtimestamp(os.path.getmtime(BUSYNESS_MODEL_PATH))
            log.info(f"Models loaded from disk (trained at {last_trained_at}).")
            return True
    except Exception as e:
        log.warning(f"Could not load saved models: {e}")
    return False

# ─── Synthetic Baselines ──────────────────────────────────────────────────────

def synthetic_appointments():
    """Generate enough synthetic appointment rows to bootstrap the busyness model."""
    rows = []
    for clinic in ["default", "clinic-a", "clinic-b"]:
        for day in range(7):
            # Weekend is quiet
            intensity = 0.3 if day >= 5 else 1.0
            for hour in range(8, 18):
                # Morning peak, lunch dip, afternoon moderate
                base = 6 if hour in (9, 10, 11) else (2 if hour in (12, 13) else 4)
                count = max(1, round(base * intensity))
                for _ in range(count):
                    rows.append({"clinicId": clinic, "day_of_week": day, "hour": hour})
    return rows

def synthetic_queue_items(clinic_mapping_ref):
    """Generate synthetic completed queue items for the duration model."""
    rows = []
    service_durations = {
        "general":      20,
        "dental":       45,
        "vaccination":  10,
        "chronic":      30,
        "mental":       60,
        "default":      20,
    }
    for clinic in ["default", "clinic-a", "clinic-b"]:
        for service, base_dur in service_durations.items():
            for day in range(7):
                for hour in range(8, 18):
                    for priority in [0, 1, 2]:
                        # Add natural variance
                        variance = np.random.normal(0, base_dur * 0.15)
                        duration = max(5.0, base_dur + variance)
                        rows.append({
                            "clinicId":      clinic,
                            "serviceId":     service,
                            "day_of_week":   day,
                            "hour":          hour,
                            "priority":      priority,
                            "actualDuration": round(duration, 1),
                        })
    return rows

# ─── Training ─────────────────────────────────────────────────────────────────

def fetch_data_and_train() -> bool:
    global busyness_model, duration_model, clinic_mapping, service_mapping, last_trained_at

    with training_lock:
        log.info("=== Starting model training ===")

        # ── 1. Busyness model ─────────────────────────────────────────────────
        log.info("Fetching appointments from Firestore...")
        appt_rows = []
        try:
            docs = db.collection("appointments").limit(15000).stream()
            for doc in docs:
                d = doc.to_dict()
                if not d.get("date") or not d.get("timeSlot"):
                    continue
                try:
                    date_obj   = datetime.strptime(d["date"], "%Y-%m-%d")
                    hour       = int(d["timeSlot"].split(":")[0])
                    day_of_week = date_obj.weekday()
                    appt_rows.append({
                        "clinicId":    d.get("clinicId", "default"),
                        "day_of_week": day_of_week,
                        "hour":        hour,
                    })
                except Exception:
                    pass
        except Exception as e:
            log.warning(f"Error fetching appointments: {e}")

        use_synthetic_appts = len(appt_rows) < BUSYNESS_SYNTHETIC_FILL
        if use_synthetic_appts:
            log.info(f"Only {len(appt_rows)} real appointments — augmenting with synthetic baseline.")
            appt_rows.extend(synthetic_appointments())

        appt_df = pd.DataFrame(appt_rows)
        appt_df["clinic_code"], unique_clinics = pd.factorize(appt_df["clinicId"])
        clinic_mapping = {name: int(i) for i, name in enumerate(unique_clinics)}

        busyness_df = (
            appt_df.groupby(["clinic_code", "day_of_week", "hour"])
            .size()
            .reset_index(name="appointment_count")
        )

        # Enrich with cyclic features
        time_feats = busyness_df.apply(
            lambda r: pd.Series(encode_time_features(int(r["day_of_week"]), int(r["hour"]))),
            axis=1,
        )
        busyness_df = pd.concat([busyness_df, time_feats], axis=1)

        X_b = busyness_df[BUSYNESS_FEATURES]
        y_b = busyness_df["appointment_count"]

        log.info(f"Training busyness model on {len(X_b)} rows ({'' if not use_synthetic_appts else 'synthetic + '}real data)...")
        busyness_model = GradientBoostingRegressor(
            n_estimators=200, max_depth=4, learning_rate=0.05,
            subsample=0.8, random_state=42
        )
        busyness_model.fit(X_b, y_b)
        if len(X_b) >= 20:
            cv_mae = -cross_val_score(busyness_model, X_b, y_b, cv=3, scoring="neg_mean_absolute_error").mean()
            log.info(f"Busyness model CV MAE: {cv_mae:.2f} appointments/slot")
        log.info("Busyness model trained ✓")

        # ── 2. Duration model ─────────────────────────────────────────────────
        log.info("Fetching completed queue items from Firestore...")
        queue_rows = []
        try:
            q_docs = (
                db.collection_group("queueItems")
                .where("status", "==", "COMPLETE")
                .limit(15000)
                .stream()
            )
            for doc in q_docs:
                d = doc.to_dict()
                if not (d.get("date") and d.get("timeSlot") and d.get("actualDuration")):
                    continue
                try:
                    date_obj    = datetime.strptime(d["date"], "%Y-%m-%d")
                    hour        = int(d["timeSlot"].split(":")[0])
                    day_of_week = date_obj.weekday()
                    queue_rows.append({
                        "clinicId":      d.get("clinicId", "default"),
                        "serviceId":     d.get("serviceId", "default"),
                        "day_of_week":   day_of_week,
                        "hour":          hour,
                        "priority":      int(d.get("priority", 0)),
                        "actualDuration": float(d["actualDuration"]),
                    })
                except Exception:
                    pass
        except Exception as e:
            log.warning(f"Error fetching queue items: {e}")

        use_synthetic_queue = len(queue_rows) < MIN_QUEUE_SAMPLES
        if use_synthetic_queue:
            log.info(f"Only {len(queue_rows)} real queue records — augmenting with synthetic baseline.")
            queue_rows.extend(synthetic_queue_items(clinic_mapping))

        q_df = pd.DataFrame(queue_rows)
        q_df["clinic_code"]  = q_df["clinicId"].map(lambda x: clinic_mapping.get(x, 0))
        q_df["service_code"], unique_services = pd.factorize(q_df["serviceId"])
        service_mapping = {name: int(i) for i, name in enumerate(unique_services)}

        time_feats_q = q_df.apply(
            lambda r: pd.Series(encode_time_features(int(r["day_of_week"]), int(r["hour"]))),
            axis=1,
        )
        q_df = pd.concat([q_df, time_feats_q], axis=1)

        # Clamp outlier durations (cap at 120 min)
        q_df["actualDuration"] = q_df["actualDuration"].clip(1, 120)

        X_d = q_df[DURATION_FEATURES]
        y_d = q_df["actualDuration"]

        log.info(f"Training duration model on {len(X_d)} rows ({'' if not use_synthetic_queue else 'synthetic + '}real data)...")
        duration_model = GradientBoostingRegressor(
            n_estimators=200, max_depth=4, learning_rate=0.05,
            subsample=0.8, random_state=42
        )
        duration_model.fit(X_d, y_d)
        if len(X_d) >= 20:
            cv_mae = -cross_val_score(duration_model, X_d, y_d, cv=3, scoring="neg_mean_absolute_error").mean()
            log.info(f"Duration model CV MAE: {cv_mae:.2f} minutes")
        log.info("Duration model trained ✓")

        last_trained_at = datetime.now()
        save_models()

        log.info("=== Training complete ===")
        return True


# ─── Prediction Helpers ───────────────────────────────────────────────────────

def predict_busyness(clinic_id: str, day: int, hour: int) -> float:
    if busyness_model is None:
        return 3.0
    row = build_busyness_row(clinic_mapping.get(clinic_id, 0), day, hour)
    X = pd.DataFrame([row])[BUSYNESS_FEATURES]
    return max(0.0, float(busyness_model.predict(X)[0]))


def predict_duration(clinic_id: str, service_id: str, day: int, hour: int, priority: int) -> float:
    if duration_model is None:
        return DEFAULT_CONSULT_MINUTES
    row = build_duration_row(
        clinic_mapping.get(clinic_id, 0),
        service_mapping.get(service_id, service_mapping.get("default", 0)),
        day, hour, priority
    )
    X = pd.DataFrame([row])[DURATION_FEATURES]
    return max(1.0, float(duration_model.predict(X)[0]))


def get_live_queue(clinic_id: str, date_str: str):
    """Fetch today's queue items from Firestore. Returns list of dicts or []."""
    try:
        docs = (
            db.collection("clinics").document(clinic_id)
            .collection("queues").document(date_str)
            .collection("queueItems")
            .stream()
        )
        return [doc.to_dict() for doc in docs]
    except Exception as e:
        log.warning(f"Error fetching live queue for {clinic_id}: {e}")
        return []


def compute_live_wait(queue_items: list, clinic_id: str, day: int, hour: int) -> tuple[float, int]:
    """
    Compute total wait time from the live queue, accounting for:
      - IN_CONSULTATION patients: remaining = predicted_duration - elapsed
      - WAITING patients: each adds their predicted consultation duration
    Returns (total_wait_minutes, active_consultation_count).
    """
    active = [q for q in queue_items if q.get("status") == "IN_CONSULTATION"]
    waiting = [q for q in queue_items if q.get("status") == "WAITING"]
    now = datetime.now()
    total = 0.0

    # Remaining time for patients already in consultation
    for q in active:
        q_service  = q.get("serviceId", "default")
        q_priority = int(q.get("priority", 0))
        q_hour     = hour
        try:
            q_hour = int(str(q.get("timeSlot", "09:00")).split(":")[0])
        except Exception:
            pass
        pred_dur = predict_duration(clinic_id, q_service, day, q_hour, q_priority)

        # Subtract already-elapsed consultation time
        started = q.get("consultationStartedAt")
        elapsed = 0.0
        if started:
            try:
                if hasattr(started, "timestamp"):          # Firestore Timestamp
                    started_dt = started.astimezone(None)
                    elapsed = (now - started_dt.replace(tzinfo=None)).total_seconds() / 60
                else:
                    started_dt = datetime.fromisoformat(str(started).replace("Z", "+00:00"))
                    elapsed = (datetime.now(started_dt.tzinfo) - started_dt).total_seconds() / 60
            except Exception:
                pass
        total += max(1.0, pred_dur - elapsed)

    # Time for each waiting patient ahead
    for q in waiting:
        q_service  = q.get("serviceId", "default")
        q_priority = int(q.get("priority", 0))
        q_hour     = hour
        try:
            q_hour = int(str(q.get("appointmentTime", q.get("timeSlot", "09:00"))).split(":")[0])
        except Exception:
            pass
        total += predict_duration(clinic_id, q_service, day, q_hour, q_priority)

    return total, len(active)


# ─── Background Retraining ────────────────────────────────────────────────────

def continuous_learning():
    while True:
        time.sleep(RETRAIN_INTERVAL_SECONDS)
        try:
            log.info("Running scheduled background retraining...")
            fetch_data_and_train()
        except Exception as e:
            log.error(f"Background training failed: {e}")


# ─── Startup ──────────────────────────────────────────────────────────────────

# Try loading persisted models first; fall back to training fresh
if not load_models():
    log.info("No saved models found — training from scratch...")
    try:
        fetch_data_and_train()
    except Exception as e:
        log.error(f"Initial training failed: {e}")

threading.Thread(target=continuous_learning, daemon=True).start()


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    ready = busyness_model is not None and duration_model is not None
    return jsonify({
        "status": "ok" if ready else "warming_up",
        "modelsReady": ready,
        "lastTrainedAt": last_trained_at.isoformat() if last_trained_at else None,
        "clinicsKnown": len(clinic_mapping),
        "servicesKnown": len(service_mapping),
    }), 200 if ready else 503


@app.route("/train", methods=["POST"])
def train_endpoint():
    try:
        fetch_data_and_train()
        return jsonify({
            "message": "Models retrained successfully",
            "lastTrainedAt": last_trained_at.isoformat() if last_trained_at else None,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/predict", methods=["GET"])
def predict_endpoint():
    if busyness_model is None:
        return jsonify({"error": "Model not ready"}), 503

    date_str  = request.args.get("date")
    clinic_id = request.args.get("clinicId", "default")

    if not date_str:
        return jsonify({"error": "Missing date parameter"}), 400
    try:
        date_obj    = datetime.strptime(date_str, "%Y-%m-%d")
        day_of_week = date_obj.weekday()
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    hours = list(range(8, 18))
    slots = []
    for hour in hours:
        load = predict_busyness(clinic_id, day_of_week, hour)
        slots.append({
            "timeSlot":       f"{hour:02d}:00",
            "predicted_load": round(load, 2),
        })

    # Mark the 3 least busy as recommended
    slots_sorted = sorted(slots, key=lambda s: s["predicted_load"])
    recommended  = {s["timeSlot"] for s in slots_sorted[:3]}
    for s in slots:
        s["recommended"] = s["timeSlot"] in recommended

    return jsonify({"date": date_str, "clinicId": clinic_id, "predictions": slots})


@app.route("/predict-range", methods=["GET"])
def predict_range_endpoint():
    if busyness_model is None:
        return jsonify({"error": "Model not ready"}), 503

    start_str = request.args.get("startDate")
    end_str   = request.args.get("endDate")
    clinic_id = request.args.get("clinicId", "default")

    if not start_str or not end_str:
        return jsonify({"error": "Missing startDate or endDate"}), 400
    try:
        start_date = datetime.strptime(start_str, "%Y-%m-%d")
        end_date   = datetime.strptime(end_str,   "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    delta = (end_date - start_date).days
    if delta < 0 or delta > 30:
        return jsonify({"error": "Date range must be 0-30 days"}), 400

    results = {}
    hours = list(range(8, 18))

    for i in range(delta + 1):
        curr = start_date + timedelta(days=i)
        day  = curr.weekday()
        dstr = curr.strftime("%Y-%m-%d")
        slots = []
        for hour in hours:
            load = predict_busyness(clinic_id, day, hour)
            slots.append({"timeSlot": f"{hour:02d}:00", "predicted_load": round(load, 2)})

        top3 = {s["timeSlot"] for s in sorted(slots, key=lambda s: s["predicted_load"])[:3]}
        for s in slots:
            s["recommended"] = s["timeSlot"] in top3
        results[dstr] = slots

    return jsonify({"startDate": start_str, "endDate": end_str, "clinicId": clinic_id, "predictionsByDate": results})


@app.route("/predict-waittime", methods=["GET"])
def predict_waittime_endpoint():
    if busyness_model is None or duration_model is None:
        return jsonify({"error": "Models not ready yet. Check /health."}), 503

    clinic_id    = request.args.get("clinicId")
    date_str     = request.args.get("date")
    time_slot    = request.args.get("timeSlot", "09:00")
    service_id   = request.args.get("serviceId", "default")
    priority_str = request.args.get("priority", "0")

    if not clinic_id or not date_str:
        return jsonify({"error": "clinicId and date are required"}), 400

    try:
        priority = int(priority_str)
    except ValueError:
        priority = 0

    try:
        date_obj    = datetime.strptime(date_str, "%Y-%m-%d")
        day_of_week = date_obj.weekday()
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    try:
        hour = int(str(time_slot).split(":")[0])
    except Exception:
        hour = 9

    today_str = datetime.now().strftime("%Y-%m-%d")
    is_today  = date_str == today_str

    # ── Live queue path (today only) ──────────────────────────────────────────
    used_live_queue    = False
    live_queue_count   = 0
    active_count       = 0
    final_wait_time    = 0.0

    if is_today:
        queue_items = get_live_queue(clinic_id, date_str)
        live_queue_count = len(queue_items)

        if queue_items:
            used_live_queue = True
            live_wait, active_count = compute_live_wait(queue_items, clinic_id, day_of_week, hour)
            final_wait_time = live_wait

    # ── ML-predicted path (future dates, or today with empty queue) ───────────
    if not used_live_queue or final_wait_time == 0.0:
        predicted_patients = predict_busyness(clinic_id, day_of_week, hour)
        avg_duration       = predict_duration(clinic_id, service_id, day_of_week, hour, priority)
        # Estimate: each patient ahead of you adds their consultation time.
        # We assume 1 consultation room by default; the queue depth drives wait.
        final_wait_time = max(0.0, predicted_patients * avg_duration)

    # ── Confidence range (±15% with a floor at ±3 min) ───────────────────────
    margin          = max(3.0, final_wait_time * 0.15)
    wait_time_min   = max(0, round(final_wait_time - margin))
    wait_time_max   = round(final_wait_time + margin)
    estimated_total = round(final_wait_time)

    # ── Human-friendly label ──────────────────────────────────────────────────
    if estimated_total <= 5:
        wait_label = "Very short wait"
    elif estimated_total <= 15:
        wait_label = "Short wait"
    elif estimated_total <= 30:
        wait_label = "Moderate wait"
    elif estimated_total <= 60:
        wait_label = "Long wait"
    else:
        wait_label = "Very long wait — consider another time"

    return jsonify({
        "clinicId":          clinic_id,
        "date":              date_str,
        "timeSlot":          time_slot,
        "serviceId":         service_id,
        "priority":          priority,
        "isToday":           is_today,
        "usedLiveQueue":     used_live_queue,
        "liveQueueCount":    live_queue_count,
        "activeConsultations": active_count,
        "estimatedWaitTime": estimated_total,
        "waitTimeRange":     f"{wait_time_min}-{wait_time_max} mins",
        "waitLabel":         wait_label,
    })


if __name__ == "__main__":
    app.run(port=5001, debug=False)
