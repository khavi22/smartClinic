const { initializeApp } = require("firebase/app");
const { getFirestore, collection, query, where, getDocs } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyDWr5lA9QgmKZLl5M8ctDKQWqS7yOFn_LY",
  authDomain: "smartclinic-11971.firebaseapp.com",
  projectId: "smartclinic-11971",
  storageBucket: "smartclinic-11971.firebasestorage.app",
  messagingSenderId: "301262646979",
  appId: "1:301262646979:web:6529009c676257565a7c76",
  measurementId: "G-CZ0M6NZFV6"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const MAX_CAPACITY_PER_SLOT = 10;

/**
 * Dynamically computes availability by rolling up bookings for a given date and clinic
 * using the standard Firebase Web SDK.
 */
exports.getAvailabilityForDate = async (clinicId, dateStr) => {
    // Generate 24 hourly slots
    const slots = [];
    
    for (let hour = 0; hour < 24; hour++) {
        const start = hour.toString().padStart(2, '0') + ":00";
        const end = ((hour + 1) % 24).toString().padStart(2, '0') + ":00";
        const timeSlotString = `${start} - ${end}`;
        
        slots.push({
            id: hour,
            time: timeSlotString,
            total: MAX_CAPACITY_PER_SLOT,
            taken: 0,
            status: "available"
        });
    }

    try {
        const bookingsRef = collection(db, 'bookings');
        
        // Build the query constraints
        const queryConstraints = [
            where('date', '==', dateStr),
            where('status', '==', 'booked')
        ];
        
        // If clincId filtering is enabled
        if (clinicId && clinicId !== "default") {
            queryConstraints.push(where('clinicId', '==', clinicId));
        }

        // Execute query
        const finalQuery = query(bookingsRef, ...queryConstraints);
        const snapshot = await getDocs(finalQuery);

        if (snapshot.empty) {
            return slots; 
        }

        snapshot.forEach(doc => {
            const booking = doc.data();
            const slot = slots.find(s => s.time === booking.timeSlot);
            
            if (slot) {
                slot.taken += 1;
                
                // Re-evaluate status
                if (slot.taken >= slot.total) {
                    slot.status = "full";
                } else if (slot.taken >= slot.total - 3) {
                    slot.status = "limited";
                } else {
                    slot.status = "available";
                }
            }
        });

        return slots;
    } catch (error) {
        console.error("Error reading bookings from Firestore:", error);
        throw error;
    }
};
