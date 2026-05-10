const {
    getQueue,
    startConsultation,
    completeConsultation,
    addQueueItem,
    updateQueueItemStatus,
    removeQueueItem,
    addTodaysAppointmentsToQueue
} = require("../services/queueService");

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





