const { initializeApp } = require("firebase/app");
const {
    getFirestore,
    collection,
    query,
    where,
    getDocs,
    addDoc,
} = require("firebase/firestore");


const firebaseConfig = {
    apiKey: "AIzaSyDWr5lA9QgmKZLl5M8ctDKQWqS7yOFn_LY",
    authDomain: "smartclinic-11971.firebaseapp.com",
    projectId: "smartclinic-11971",
    storageBucket: "smartclinic-11971.firebasestorage.app",
    messagingSenderId: "301262646979",
    appId: "1:301262646979:web:6529009c676257565a7c76",
    measurementId: "G-CZ0M6NZFV6"
};

// Initialize the Firebase application and connect to the Firestore database
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


const MAX_CAPACITY_PER_SLOT = 10;

// using clinic id fetch all bookings for that clinic and check the each time slots and count vailable slots and determine its status
exports.getAvailabilityForDate = async (clinicId, dateStr) => {
    // Phase 1: Initialize an array for all 24 hours of the day
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

        //  Query Firestore for active 'booked' documents for this date/clinic
        const queryConstraints = [
            where('date', '==', dateStr),
            where('status', '==', 'booked')
        ];


        if (clinicId && clinicId !== "default") {
            queryConstraints.push(where('clinicId', '==', clinicId));
        }

        const finalQuery = query(bookingsRef, ...queryConstraints);
        const snapshot = await getDocs(finalQuery);

        // If no bookings exist, return the empty baseline slots
        if (snapshot.empty) {
            return slots;
        }

        //  Roll up the booking counts into the corresponding hourly slots
        snapshot.forEach(doc => {
            const booking = doc.data();
            const slot = slots.find(s => s.time === booking.timeSlot);

            if (slot) {
                slot.taken += 1;

                // Dynamically evaluate the status based on remaining capacity
                if (slot.taken >= slot.total) {
                    slot.status = "full";
                } else if (slot.taken >= slot.total - 3) {
                    //  indicates the slot is nearly booked (3 or fewer spots left)
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

// create a booking
exports.createBooking = async (clinicId, dateStr, timeSlot, patientId) => {
    try {
        const bookingsRef = collection(db, 'bookings');

        // Verify current patient does not already have a booking for this specific day
        const duplicateCheckQuery = query(
            bookingsRef,
            where('patientId', '==', patientId),
            where('date', '==', dateStr),
            where('status', '==', 'booked')
        );
        const duplicateSnapshot = await getDocs(duplicateCheckQuery);

        if (!duplicateSnapshot.empty) {
            //    booking error when user already have a booking
            throw new Error("You already have a booking for this day. Try rescheduling or deleting your existing booking before booking again.");
        }

        // verify the chosen slot has not reached its maximum capacity
        const queryConstraints = [
            where('date', '==', dateStr),
            where('timeSlot', '==', timeSlot),
            where('status', '==', 'booked')
        ];

        if (clinicId && clinicId !== "default") {
            queryConstraints.push(where('clinicId', '==', clinicId));
        }

        const capacityQuery = query(bookingsRef, ...queryConstraints);
        const capacitySnapshot = await getDocs(capacityQuery);

        const currentCount = capacitySnapshot.size;

        if (currentCount >= MAX_CAPACITY_PER_SLOT) {
            throw new Error("This slot is full and unavailable.");
        }

        // save booking
        const newBooking = {
            clinicId: clinicId || "default",
            date: dateStr,
            timeSlot: timeSlot,
            patientId: patientId,
            status: "booked", // Successfully booked after passing validation
            createdAt: new Date().toISOString()
        };

        const docRef = await addDoc(bookingsRef, newBooking);

        return {
            id: docRef.id,
            ...newBooking
        };
    } catch (error) {
        console.error("Error creating booking:", error);
        throw error;
    }
};

exports.getBookingsByPatientId = async (patientId) => {
    try {
        const bookingsRef = collection(db, "bookings");

        const q = query(
            bookingsRef,
            where("patientId", "==", patientId),
            where("status", "==", "booked")
        );

        const snapshot = await getDocs(q);

        const bookings = [];

        snapshot.forEach((doc) => {
            bookings.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return bookings;
    } catch (error) {
        console.error("Error fetching bookings by patientId:", error);
        throw error;
    }
};
