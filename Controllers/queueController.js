const {
    getQueue,
    startConsultation,
    completeConsultation,
    addQueueItem,
    getAvailableQueueSlots,
    rescheduleQueueItem,
    updateQueueItemStatus,
    removeQueueItem,
    addTodaysAppointmentsToQueue
} = require("../services/queueService");
const emailService = require("../services/emailService");

// Pulls a usable email address from the different queue item shapes that can
// come from manual queue entries, appointments, or enriched patient profiles.
const getQueuePatientEmail = (queueItem) =>
    queueItem?.patientEmail ||
    queueItem?.email ||
    queueItem?.patient?.email ||
    null;

// Picks the best display name available for queue notification emails.
const getQueuePatientName = (queueItem) =>
    queueItem?.patientName ||
    queueItem?.fullName ||
    queueItem?.name ||
    "there";

// Sends a queue status email when the queue item contains a patient email.
// Missing emails are logged but do not block the queue update.
const sendQueueStatusUpdateEmail = async (queueItem) => {
    const patientEmail = getQueuePatientEmail(queueItem);

    if (!patientEmail) {
        console.warn(`No email found for queueItemId: ${queueItem?.queueItemId || "unknown"}`);
        return;
    }

    await emailService.sendQueueStatusUpdate(
        patientEmail,
        getQueuePatientName(queueItem),
        queueItem.clinicName,
        queueItem.status,
        queueItem.date,
        queueItem.timeSlot || queueItem.appointmentTime
    );
};

// GET /api/queue/:clinicId
// Syncs today's booked appointments into the clinic queue, then returns the
// queue grouped by status for staff dashboards and waiting-room displays.
exports.getQueue = async (req, res) => {
  try {
    const { clinicId } = req.params;

    if (!clinicId) {
      return res.status(400).json({ success: false, message: "clinicId is required" });
    }

    await addTodaysAppointmentsToQueue(clinicId);

    const queue = await getQueue(clinicId);

    res.status(200).json({
      success: true,
      queue
    });
  } catch (error) {
    console.error("Error fetching queue:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch queue",
      error: error.message
    });
  }
};

// POST /api/queue/:clinicId
// Adds a walk-in/manual patient to today's queue after slot capacity checks.
exports.addQueueItem = async (req, res) => {
    try {
        const { clinicId } = req.params;

        if (!clinicId) {
            return res.status(400).json({ success: false, message: "clinicId is required" });
        }

        const queueItem = await addQueueItem(clinicId, req.body || {});

        res.status(201).json({
            success: true,
            queueItem
        });
    } catch (error) {
        console.error("Error adding queue item:", error);

        if (
            error.message === "patientName or patientId is required" ||
            error.message === "Selected time is outside clinic operating hours." ||
            error.message === "This slot is full." ||
            error.message === "This time slot is no longer available." ||
            error.message === "The clinic is fully booked for today."
        ) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to add patient to queue",
            error: error.message
        });
    }
};

// GET /api/queue/:clinicId/available-slots
// Returns same-day queue slots that are still open, optionally excluding one
// queue item when calculating reschedule availability.
exports.getAvailableQueueSlots = async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { date, queueItemId } = req.query;

        if (!clinicId) {
            return res.status(400).json({ success: false, message: "clinicId is required" });
        }

        const slots = await getAvailableQueueSlots(clinicId, date, queueItemId);

        res.status(200).json({
            success: true,
            slots
        });
    } catch (error) {
        console.error("Error fetching available queue slots:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch available queue slots",
            error: error.message
        });
    }
};

// PATCH /api/queue/:clinicId/:queueItemId/reschedule
// Moves a waiting queue item to another available slot and keeps the linked
// appointment time in sync when the queue item came from a booking.
exports.rescheduleQueueItem = async (req, res) => {
    try {
        const { clinicId, queueItemId } = req.params;
        const { timeSlot, staffId } = req.body;

        if (!clinicId) {
            return res.status(400).json({ success: false, message: "clinicId is required" });
        }
        if (!queueItemId) {
            return res.status(400).json({ success: false, message: "queueItemId is required" });
        }
        if (!timeSlot) {
            return res.status(400).json({ success: false, message: "timeSlot is required" });
        }

        const queueItem = await rescheduleQueueItem(clinicId, queueItemId, timeSlot, staffId);

        res.status(200).json({
            success: true,
            queueItem
        });
    } catch (error) {
        console.error("Error rescheduling queue item:", error);

        if (
            error.message === "Queue item not found" ||
            error.message === "Cannot reschedule a missed or complete queue item" ||
            error.message === "Selected time is outside clinic operating hours." ||
            error.message === "This slot is full." ||
            error.message === "This time slot is no longer available." ||
            error.message === "The clinic is fully booked for today."
        ) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to reschedule queue item",
            error: error.message
        });
    }
};

// PATCH /api/queue/:clinicId/:queueItemId
// Updates a queue item status, mirrors complete/missed states to the linked
// appointment, and sends a best-effort status email.
exports.updateQueueItemStatus = async (req, res) => {
    try {
        const { clinicId, queueItemId } = req.params;
        const { status, updatedBy } = req.body;

        if (!clinicId) {
            return res.status(400).json({ success: false, message: "clinicId is required" });
        }
        if (!queueItemId) {
            return res.status(400).json({ success: false, message: "queueItemId is required" });
        }
        if (!status) {
            return res.status(400).json({ success: false, message: "status is required" });
        }

        const queueItem = await updateQueueItemStatus(clinicId, queueItemId, status, updatedBy);

        try {
            await sendQueueStatusUpdateEmail(queueItem);
        } catch (emailError) {
            console.error("Failed to send queue status email:", emailError);
        }

        res.status(200).json({
            success: true,
            queueItem
        });
    } catch (error) {
        console.error("Error updating queue item status:", error);

        if (
            error.message === "Invalid queue status" ||
            error.message === "Queue item not found" ||
            error.message === "Cannot update a missed or complete queue item"
        ) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to update queue item status",
            error: error.message
        });
    }
};

// DELETE /api/queue/:clinicId/:queueItemId
// Deletes a queue item from today's queue.
exports.removeQueueItem = async (req, res) => {
    try {
        const { clinicId, queueItemId } = req.params;

        if (!clinicId) {
            return res.status(400).json({ success: false, message: "clinicId is required" });
        }
        if (!queueItemId) {
            return res.status(400).json({ success: false, message: "queueItemId is required" });
        }

        const queueItem = await removeQueueItem(clinicId, queueItemId);

        res.status(200).json({
            success: true,
            queueItem
        });
    } catch (error) {
        console.error("Error removing queue item:", error);

        if (error.message === "Queue item not found") {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to remove queue item",
            error: error.message
        });
    }
};

// POST /api/queue/:clinicId/start-consultation
// Moves a waiting patient into consultation for a staff member, enforcing that
// one staff member cannot consult multiple patients at the same time.
exports.startConsultation = async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { queueItemId, staffId } = req.body;
 
        if (!clinicId) {
            return res.status(400).json({ success: false, message: "clinicId is required" });
        }
        if (!queueItemId) {
            return res.status(400).json({ success: false, message: "queueItemId is required" });
        }
        if (!staffId) {
            return res.status(400).json({ success: false, message: "staffId is required" });
        }
 
        const queueItem = await startConsultation(clinicId, queueItemId, staffId);
 
        res.status(200).json({ success: true, queueItem });
    } catch (error) {
        console.error("Error starting consultation:", error);
 
        if (
            error.message === "Patient is not in WAITING status" ||
            error.message === "Staff member already has a patient IN_CONSULTATION"
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid status transition",
                error: error.message,
            });
        }
 
        res.status(500).json({
            success: false,
            message: "Failed to start consultation",
            error: error.message,
        });
    }
};

// POST /api/queue/:clinicId/complete-consultation
// Completes an active consultation, calculates its duration, and returns the
// next waiting patient so the UI can guide staff to the next action.
exports.completeConsultation = async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { queueItemId, staffId } = req.body;

        if (!clinicId) {
            return res.status(400).json({ success: false, message: "clinicId is required" });
        }
        if (!queueItemId) {
            return res.status(400).json({ success: false, message: "queueItemId is required" });
        }
        if (!staffId) {
            return res.status(400).json({ success: false, message: "staffId is required" });
        }

        const result = await completeConsultation(clinicId, queueItemId, staffId);

        res.status(200).json({
            success: true,
            completed: result.completed,
            nextPatient: result.nextPatient
        });
    } catch (error) {
        console.error("Error completing consultation:", error);

        if (
            error.message === "Patient is not IN_CONSULTATION" ||
            error.message === "Queue item not found"
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid status transition",
                error: error.message,
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to complete consultation",
            error: error.message,
        });
    }
};

// GET /api/queue/:clinicId/predict-waittime
// Gets an ML wait-time estimate when the Python service is available, or falls
// back to a simple live-queue heuristic when it is not.
exports.predictWaitTime = async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { date, timeSlot, serviceId, priority } = req.query;

        if (!clinicId) {
            return res.status(400).json({ success: false, message: "clinicId is required" });
        }

        const mlBaseUrl = process.env.ML_SERVICE_URL;
        if (mlBaseUrl) {
            try {
                const params = new URLSearchParams({
                    clinicId,
                    date: date || new Date().toISOString().split('T')[0],
                    timeSlot: timeSlot || "09:00",
                    serviceId: serviceId || "default",
                    priority: priority || "0"
                });

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 1200);

                const mlRes = await fetch(`${mlBaseUrl}/predict-waittime?${params.toString()}`, {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                if (mlRes.ok) {
                    const data = await mlRes.json();
                    return res.status(200).json({
                        success: true,
                        estimatedWaitTime:    data.estimatedWaitTime,
                        waitTimeRange:        data.waitTimeRange,
                        waitLabel:            data.waitLabel,
                        usedLiveQueue:        data.usedLiveQueue,
                        liveQueueCount:       data.liveQueueCount,
                        activeConsultations:  data.activeConsultations,
                        isToday:              data.isToday,
                    });
                }
            } catch (mlError) {
                console.warn("ML Wait Time Service unavailable, falling back to database heuristics:", mlError.message);
            }
        }

        const { getQueue } = require("../services/queueService");
        const queueObj = await getQueue(clinicId);
        
        let waitingCount = 0;
        let activeCount = 0;
        
        if (queueObj) {
            waitingCount = Array.isArray(queueObj.WAITING) ? queueObj.WAITING.length : 0;
            activeCount = Array.isArray(queueObj.IN_CONSULTATION) ? queueObj.IN_CONSULTATION.length : 0;
        }

        const estWait = (activeCount * 10) + (waitingCount * 15);
        const minWait = Math.max(0, estWait - 5);
        const maxWait = estWait + 5;

        res.status(200).json({
            success: true,
            estimatedWaitTime: estWait,
            waitTimeRange: `${minWait}-${maxWait} mins`,
            usedLiveQueue: true,
            isToday: true,
            fallback: true
        });

    } catch (error) {
        console.error("Error predicting wait time:", error);
        res.status(500).json({
            success: false,
            message: "Failed to predict wait time",
            error: error.message
        });
    }
};





