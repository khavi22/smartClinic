import firebase_admin
from firebase_admin import credentials, firestore
import random
from datetime import datetime, timedelta

# Initialize Firebase
try:
    cred = credentials.Certificate('serviceAccountKey.json')
    firebase_admin.initialize_app(cred)
except ValueError:
    pass # App already initialized

db = firestore.client()

def generate_mock_appointments(clinic_id, num_days=60):
    print(f"Generating mock appointments for clinic: {clinic_id}")
    
    start_date = datetime.now() - timedelta(days=num_days)
    batch = db.batch()
    count = 0
    total_generated = 0
    
    # We want to create patterns for the ML to learn:
    # 1. 09:00 - 11:00 are typically very busy.
    # 2. 12:00 - 14:00 are typically less busy (lunch time).
    # 3. 15:00 - 17:00 are moderately busy.
    # 4. Weekends (Saturday/Sunday) are either closed or very quiet.
    
    for day_offset in range(num_days):
        current_date = start_date + timedelta(days=day_offset)
        day_of_week = current_date.weekday() # 0 = Monday, 6 = Sunday
        
        date_str = current_date.strftime("%Y-%m-%d")
        
        # Determine busyness based on day of week
        if day_of_week >= 5: # Weekend
            base_prob = 0.1 # Very quiet on weekends
        else:
            base_prob = 1.0 # Normal weekday
            
        for hour in range(9, 18): # 9 AM to 5 PM
            slot_str = f"{hour:02}:00"
            
            # Determine likelihood of booking based on hour
            prob = 0.5 * base_prob
            if hour in [9, 10, 11]: 
                prob = 0.85 * base_prob
            elif hour in [12, 13, 14]: 
                prob = 0.3 * base_prob
            else: 
                prob = 0.6 * base_prob
            
            # Randomly generate appointments based on probability
            num_appointments = 0
            for _ in range(5): # Simulate max 5 capacity per slot
                if random.random() < prob:
                    num_appointments += 1
                    
            for i in range(num_appointments):
                doc_ref = db.collection('appointments').document()
                batch.set(doc_ref, {
                    'clinicId': clinic_id,
                    'patientId': f"mock_patient_{random.randint(1, 1000)}",
                    'date': date_str,
                    'timeSlot': slot_str,
                    'status': 'COMPLETED',
                    'createdAt': firestore.SERVER_TIMESTAMP,
                    'isMock': True
                })
                count += 1
                total_generated += 1
                
                if count >= 450: # Commit in batches (Firestore limit is 500)
                    batch.commit()
                    batch = db.batch()
                    print(f"Committed {total_generated} mock appointments so far...")
                    count = 0

    if count > 0:
        batch.commit()
        
    print(f"Done! Successfully generated {total_generated} mock appointments.")

if __name__ == "__main__":
    # We use "default" as the clinic ID for this mock setup, or you can change it
    generate_mock_appointments("default", num_days=90)
