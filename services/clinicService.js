const axios = require('axios');
const { db, admin } = require("./config/firebase");
const { v4: uuidv4 } = require("uuid");

require('dotenv').config();

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!GOOGLE_API_KEY) {
    console.warn("GOOGLE_MAPS_API_KEY is not set in environment variables");
}

exports.searchClinics = async (query) => {
    if (!GOOGLE_API_KEY) {
        throw new Error("GOOGLE_API_KEY is not configured");
    }

    const response = await axios.post(
        "https://places.googleapis.com/v1/places:searchText",
        { textQuery: query },
        {
            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": GOOGLE_API_KEY,
                "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.id"
            }
        }
    );

    return response.data.places || [];
};

exports.updateClinicSlotCapacity = async (clinicId, slotCapacity) => {
    try {
        if (!clinicId || clinicId === "default") {
            throw new Error("Invalid clinic ID.");
        }

        if (!Number.isInteger(slotCapacity) || slotCapacity < 1) {
            throw new Error("Slot capacity must be a positive integer.");
        }

        const clinicRef = db.collection("clinics").doc(clinicId);
        const clinicDoc = await clinicRef.get();

        if (!clinicDoc.exists) {
            throw new Error("Clinic not found.");
        }

        await clinicRef.update({
            slotCapacity,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { clinicId, slotCapacity };
    } catch (error) {
        console.error("Error updating slot capacity:", error);
        throw error;
    }
};



exports.getStaffUtilisationData = async (clinicId, startDate, endDate) => {
    // Fetch clinic info
    const clinicDoc = await db.collection("clinics").doc(clinicId).get();
    const clinicName = clinicDoc.exists ? (clinicDoc.data().clinicName || "Clinic") : "Clinic";

    // Generate date range
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split("T")[0]);
    }

    // Fetch all staff for clinic
    const staffSnapshot = await db.collection("staff")
        .where("clinicId", "==", clinicId)
        .where("approvalStatus", "==", "approved")
        .get();

    const staffMap = {};
    staffSnapshot.forEach(doc => {
        const s = doc.data();
        staffMap[s.uid] = {
            uid: s.uid,
            fullName: s.fullName,
            email: s.email,
            patientsHandled: 0,
            consultationsCompleted: 0,
            hourlyActivity: Array(24).fill(0),
            availability: [],
            consultationTimes: []
        };
    });

    // Fetch queue data for each date
    for (const date of dates) {
        const patientsSnapshot = await db
            .collection("clinics").doc(clinicId)
            .collection("queues").doc(date)
            .collection("patients")
            .get();

        patientsSnapshot.forEach(doc => {
            const p = doc.data();
            const staffUid = p.updatedBy || p.addedBy;
            if (!staffUid || !staffMap[staffUid]) return;

            staffMap[staffUid].patientsHandled += 1;

            if (p.status === "COMPLETE") {
                staffMap[staffUid].consultationsCompleted += 1;
            }

            if (p.updatedAt) {
                const hour = p.updatedAt.toDate
                    ? p.updatedAt.toDate().getHours()
                    : new Date(p.updatedAt).getHours();
                staffMap[staffUid].hourlyActivity[hour] += 1;
                staffMap[staffUid].consultationTimes.push({ date, hour, status: p.status });
            }
        });

        // Fetch availability for each staff member for this date
        for (const uid of Object.keys(staffMap)) {
            const staffDoc = await db.collection("staff").doc(uid).get();
            if (!staffDoc.exists) continue;
            const availability = staffDoc.data().Staff_Availability?.[date];
            if (availability) {
                staffMap[uid].availability.push({ date, ...availability });
            }
        }
    }

    const staffList = Object.values(staffMap);
    const totalPatients = staffList.reduce((sum, s) => sum + s.patientsHandled, 0);

    return {
        staffList: staffList.map(s => ({
            ...s,
            workloadShare: totalPatients > 0
                ? Math.round((s.patientsHandled / totalPatients) * 100)
                : 0
        })),
        totalPatients,
        dateRange: { startDate, endDate },
        clinicName
    };
};