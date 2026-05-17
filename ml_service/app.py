import threading
import time
import firebase_admin
from firebase_admin import credentials, firestore
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
import numpy as np
from datetime import datetime
import os
import json
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app) # Allow Node backend to call this

# Initialize Firebase
try:
    cred_json = os.environ.get('FIREBASE_CREDENTIALS_JSON')
    if cred_json:
        # Load from environment variable (Production)
        cred_dict = json.loads(cred_json)
        cred = credentials.Certificate(cred_dict)
    else:
        # Load from local file (Development)
        cred = credentials.Certificate('serviceAccountKey.json')
    
    firebase_admin.initialize_app(cred)
except ValueError:
    pass # App already initialized

db = firestore.client()

# Global variables for models and mapping
model = None
waittime_model = None
clinic_mapping = {}
service_mapping = {}

def predict_consultation_duration(clinic_id, day_of_week, hour, service_id, priority):
    global waittime_model, clinic_mapping, service_mapping
    if waittime_model is None:
        return 15.0 # fallback
        
    clinic_code = clinic_mapping.get(clinic_id, 0)
    service_code = service_mapping.get(service_id, 0)
    
    X_pred = pd.DataFrame({
        'clinic_code': [clinic_code],
        'day_of_week': [day_of_week],
        'hour': [hour],
        'service_code': [service_code],
        'priority': [priority]
    })
    
    pred = waittime_model.predict(X_pred)[0]
    return float(pred)

def fetch_data_and_train():
    global model, waittime_model, clinic_mapping, service_mapping
    print("Fetching data from Firebase...")
    
    # 1. Train busyness model
    docs = db.collection('appointments').limit(10000).stream()
    data = []
    for doc in docs:
        d = doc.to_dict()
        if 'date' in d and 'timeSlot' in d:
            try:
                date_obj = datetime.strptime(d['date'], "%Y-%m-%d")
                hour = int(d['timeSlot'].split(':')[0])
                day_of_week = date_obj.weekday()
                data.append({
                    'day_of_week': day_of_week,
                    'hour': hour,
                    'clinicId': d.get('clinicId', 'default')
                })
            except Exception as e:
                pass
                
    if not data:
        print("No appointment data found, generating synthetic baseline...")
        # Synthetic baseline to prevent empty model training crash
        for clinic in ['default', 'clinic-1']:
            for day in range(7):
                for hour in range(9, 18):
                    data.append({
                        'day_of_week': day,
                        'hour': hour,
                        'clinicId': clinic
                    })
        
    df = pd.DataFrame(data)
    
    # Map clinicId to integers for the model
    df['clinic_code'], unique_clinics = pd.factorize(df['clinicId'])
    clinic_mapping = {name: i for i, name in enumerate(unique_clinics)}
    
    # Group by clinic, day_of_week and hour to get the count
    busyness_df = df.groupby(['clinic_code', 'day_of_week', 'hour']).size().reset_index(name='appointment_count')
    
    # Features: clinic_code, day_of_week, hour
    X = busyness_df[['clinic_code', 'day_of_week', 'hour']]
    y = busyness_df['appointment_count']
    
    print("Training Random Forest Regressor for busyness with Clinic support...")
    model = RandomForestRegressor(n_estimators=50, random_state=42)
    model.fit(X, y)
    print("Busyness model trained successfully!")

    # 2. Train wait-time model
    print("Fetching completed queue items from Firebase...")
    queue_data = []
    try:
        queue_docs = db.collection_group('queueItems').where('status', '==', 'COMPLETE').limit(10000).stream()
        for doc in queue_docs:
            d = doc.to_dict()
            if 'date' in d and 'timeSlot' in d and 'actualDuration' in d:
                try:
                    date_obj = datetime.strptime(d['date'], "%Y-%m-%d")
                    hour = int(d['timeSlot'].split(':')[0])
                    day_of_week = date_obj.weekday()
                    
                    queue_data.append({
                        'day_of_week': day_of_week,
                        'hour': hour,
                        'clinicId': d.get('clinicId', 'default'),
                        'serviceId': d.get('serviceId', 'default'),
                        'priority': int(d.get('priority', 0)),
                        'actualDuration': float(d['actualDuration'])
                    })
                except Exception as e:
                    pass
    except Exception as e:
        print(f"Error fetching from Firestore group collection: {e}")

    # Inject realistic baseline synthetic data if insufficient
    if len(queue_data) < 10:
        print("Insufficient historical completed queue items, injecting synthetic baselines...")
        for clinic in ['default', 'clinic-1']:
            for service in ['default', 'service-1', 'service-2']:
                for day in range(7):
                    for hour in [9, 11, 14, 16]:
                        queue_data.append({
                            'day_of_week': day,
                            'hour': hour,
                            'clinicId': clinic,
                            'serviceId': service,
                            'priority': 0,
                            'actualDuration': 15.0 if service == 'default' else (30.0 if service == 'service-1' else 45.0)
                        })

    q_df = pd.DataFrame(queue_data)
    
    # Map clinicId to integers using same clinic_mapping
    q_df['clinic_code'] = q_df['clinicId'].map(lambda x: clinic_mapping.get(x, 0))
    
    # Map serviceId to integers
    q_df['service_code'], unique_services = pd.factorize(q_df['serviceId'])
    service_mapping = {name: i for i, name in enumerate(unique_services)}
    
    X_q = q_df[['clinic_code', 'day_of_week', 'hour', 'service_code', 'priority']]
    y_q = q_df['actualDuration']
    
    print("Training Random Forest Regressor for consultation durations...")
    waittime_model = RandomForestRegressor(n_estimators=50, random_state=42)
    waittime_model.fit(X_q, y_q)
    print("Wait-time model trained successfully!")
    
    return True

def continuous_learning():
    while True:
        time.sleep(3600) # Wait 1 hour
        try:
            print("Running scheduled background retraining...")
            fetch_data_and_train()
        except Exception as e:
            print(f"Background training failed: {e}")

# Train the models on startup
fetch_data_and_train()

# Start background retraining thread
thread = threading.Thread(target=continuous_learning, daemon=True)
thread.start()

@app.route('/train', methods=['POST'])
def train_endpoint():
    success = fetch_data_and_train()
    if success:
        return jsonify({"message": "Models retrained successfully"}), 200
    else:
        return jsonify({"error": "Failed to train models, no data"}), 500

@app.route('/predict', methods=['GET'])
def predict_endpoint():
    if model is None:
        return jsonify({"error": "Model not trained yet"}), 500
        
    date_str = request.args.get('date')
    if not date_str:
        return jsonify({"error": "Missing date parameter"}), 400
        
    try:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
        day_of_week = date_obj.weekday()
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400
        
    clinic_id = request.args.get('clinicId', 'default')
    clinic_code = clinic_mapping.get(clinic_id, 0)
    
    # Generate predictions for all possible hours (9 to 17)
    hours = list(range(9, 18))
    X_pred = pd.DataFrame({
        'clinic_code': [clinic_code] * len(hours),
        'day_of_week': [day_of_week] * len(hours),
        'hour': hours
    })
    
    predictions = model.predict(X_pred)
    
    slots = []
    for i, hour in enumerate(hours):
        slot_str = f"{hour:02}:00"
        slots.append({
            "timeSlot": slot_str,
            "predicted_load": float(predictions[i])
        })
        
    slots.sort(key=lambda x: x['predicted_load'])
    
    for i, slot in enumerate(slots):
        slot['recommended'] = i < 3
        
    return jsonify({
        "date": date_str,
        "predictions": slots
    })

@app.route('/predict-range', methods=['GET'])
def predict_range_endpoint():
    if model is None:
        return jsonify({"error": "Model not trained yet"}), 500
        
    start_date_str = request.args.get('startDate')
    end_date_str = request.args.get('endDate')
    clinic_id = request.args.get('clinicId')
    
    if not start_date_str or not end_date_str:
        return jsonify({"error": "Missing startDate or endDate parameter"}), 400
        
    try:
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
        end_date = datetime.strptime(end_date_str, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400
        
    delta = (end_date - start_date).days
    if delta < 0 or delta > 30:
        return jsonify({"error": "Invalid date range (max 30 days)"}), 400
        
    clinic_code = clinic_mapping.get(clinic_id, 0)
    
    results = {}
    hours = list(range(9, 18))
    
    for i in range(delta + 1):
        from datetime import timedelta
        curr_date = start_date + timedelta(days=i)
        day_of_week = curr_date.weekday()
        curr_date_str = curr_date.strftime("%Y-%m-%d")
        
        X_pred = pd.DataFrame({
            'clinic_code': [clinic_code] * len(hours),
            'day_of_week': [day_of_week] * len(hours),
            'hour': hours
        })
        
        predictions = model.predict(X_pred)
        
        slots = []
        for j, hour in enumerate(hours):
            slot_str = f"{hour:02}:00"
            slots.append({
                "timeSlot": slot_str,
                "predicted_load": float(predictions[j])
            })
            
        slots.sort(key=lambda x: x['predicted_load'])
        for j, slot in enumerate(slots):
            slot['recommended'] = j < 3
            
        results[curr_date_str] = slots
        
    return jsonify({
        "startDate": start_date_str,
        "endDate": end_date_str,
        "predictionsByDate": results
    })

@app.route('/predict-waittime', methods=['GET'])
def predict_waittime_endpoint():
    global model, waittime_model, clinic_mapping, service_mapping
    if model is None or waittime_model is None:
        return jsonify({"error": "Models not trained yet"}), 500
        
    clinic_id = request.args.get('clinicId')
    date_str = request.args.get('date')
    time_slot = request.args.get('timeSlot', '09:00')
    service_id = request.args.get('serviceId', 'default')
    priority_str = request.args.get('priority', '0')
    
    if not clinic_id or not date_str:
        return jsonify({"error": "Missing clinicId or date parameter"}), 400
        
    try:
        priority = int(priority_str)
    except ValueError:
        priority = 0
        
    try:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
        day_of_week = date_obj.weekday()
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400
        
    try:
        hour = int(time_slot.split(':')[0])
    except:
        hour = 9
        
    # Check if today
    today_str = datetime.now().strftime("%Y-%m-%d")
    is_today = (date_str == today_str)
    
    # 1. Try to get live queue if requested for today
    live_wait_time = 0.0
    queue_items_count = 0
    used_live_queue = False
    
    if is_today:
        queue_items = []
        try:
            docs = db.collection('clinics').document(clinic_id).collection('queues').document(date_str).collection('queueItems').stream()
            for doc in docs:
                queue_items.append(doc.to_dict())
            queue_items_count = len(queue_items)
        except Exception as e:
            print(f"Error fetching live queue: {e}")
            
        if queue_items:
            used_live_queue = True
            active_consultations = [q for q in queue_items if q.get('status') == 'IN_CONSULTATION']
            waiting_patients = [q for q in queue_items if q.get('status') == 'WAITING']
            
            # Sum up in-consultation remaining times
            for q in active_consultations:
                q_service_id = q.get('serviceId', 'default')
                q_priority = int(q.get('priority', 0))
                q_hour = hour
                try:
                    q_hour = int(q.get('timeSlot', '09:00').split(':')[0])
                except:
                    pass
                pred_dur = predict_consultation_duration(clinic_id, day_of_week, q_hour, q_service_id, q_priority)
                
                # Subtract elapsed time if available
                started_at = q.get('consultationStartedAt')
                elapsed = 0.0
                if started_at:
                    if isinstance(started_at, datetime):
                        elapsed = (datetime.now(started_at.tzinfo) - started_at).total_seconds() / 60.0
                    else:
                        try:
                            started_dt = datetime.fromisoformat(str(started_at).replace('Z', '+00:00'))
                            elapsed = (datetime.now(started_dt.tzinfo) - started_dt).total_seconds() / 60.0
                        except:
                            pass
                remaining = max(1.0, pred_dur - elapsed)
                live_wait_time += remaining
                
            # Sum up waiting patients ahead
            for q in waiting_patients:
                q_service_id = q.get('serviceId', 'default')
                q_priority = int(q.get('priority', 0))
                q_hour = hour
                try:
                    q_hour = int(q.get('timeSlot', '09:00').split(':')[0])
                except:
                    pass
                pred_dur = predict_consultation_duration(clinic_id, day_of_week, q_hour, q_service_id, q_priority)
                live_wait_time += pred_dur
                
    # 2. Predicted wait time based on typical busyness
    clinic_code = clinic_mapping.get(clinic_id, 0)
    X_busyness = pd.DataFrame({
        'clinic_code': [clinic_code],
        'day_of_week': [day_of_week],
        'hour': [hour]
    })
    
    predicted_patients = float(model.predict(X_busyness)[0])
    service_duration = predict_consultation_duration(clinic_id, day_of_week, hour, service_id, priority)
    predicted_wait_time = max(5.0, predicted_patients * service_duration)
    
    final_wait_time = live_wait_time if (used_live_queue and live_wait_time > 0.0) else predicted_wait_time
    
    wait_time_min = max(0, round(final_wait_time * 0.8))
    wait_time_max = round(final_wait_time * 1.2)
    
    return jsonify({
        "clinicId": clinic_id,
        "date": date_str,
        "timeSlot": time_slot,
        "serviceId": service_id,
        "priority": priority,
        "isToday": is_today,
        "usedLiveQueue": used_live_queue,
        "liveQueueCount": queue_items_count,
        "estimatedWaitTime": round(final_wait_time),
        "waitTimeRange": f"{wait_time_min}-{wait_time_max} mins"
    })

if __name__ == '__main__':
    # Run on port 5001 so it doesn't conflict with Node on 3000
    app.run(port=5001, debug=True)
