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

# Global model variable
model = None

def fetch_data_and_train():
    global model
    print("Fetching data from Firebase...")
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
        print("No data found!")
        return False
        
    df = pd.DataFrame(data)
    
    # We want to predict "busyness" (number of appointments in a slot)
    # Group by day_of_week and hour to get the count
    busyness_df = df.groupby(['day_of_week', 'hour']).size().reset_index(name='appointment_count')
    
    # Features: day_of_week, hour
    X = busyness_df[['day_of_week', 'hour']]
    y = busyness_df['appointment_count']
    
    # Train model
    print("Training Random Forest Regressor...")
    model = RandomForestRegressor(n_estimators=50, random_state=42)
    model.fit(X, y)
    print("Model trained successfully!")
    return True

# Train the model on startup
fetch_data_and_train()

@app.route('/train', methods=['POST'])
def train_endpoint():
    success = fetch_data_and_train()
    if success:
        return jsonify({"message": "Model retrained successfully"}), 200
    else:
        return jsonify({"error": "Failed to train model, no data"}), 500

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
        
    # Generate predictions for all possible hours (9 to 17)
    hours = list(range(9, 18))
    X_pred = pd.DataFrame({
        'day_of_week': [day_of_week] * len(hours),
        'hour': hours
    })
    
    predictions = model.predict(X_pred)
    
    # Combine hours and predictions
    slots = []
    for i, hour in enumerate(hours):
        slot_str = f"{hour:02}:00"
        slots.append({
            "timeSlot": slot_str,
            "predicted_load": float(predictions[i])
        })
        
    # Sort slots by predicted load (lowest load = highly recommended)
    slots.sort(key=lambda x: x['predicted_load'])
    
    # Add a "recommended" boolean to the top 3 slots
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
        
    results = {}
    hours = list(range(9, 18))
    
    for i in range(delta + 1):
        # We can just use standard timedelta
        from datetime import timedelta
        curr_date = start_date + timedelta(days=i)
        day_of_week = curr_date.weekday()
        curr_date_str = curr_date.strftime("%Y-%m-%d")
        
        X_pred = pd.DataFrame({
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

if __name__ == '__main__':
    # Run on port 5001 so it doesn't conflict with Node on 3000
    app.run(port=5001, debug=True)
