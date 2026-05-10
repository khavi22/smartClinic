const express = require("express");
const router = express.Router();
const queueController = require("../Controllers/queueController");

// Get queue (this will ALSO add today's appointments)
router.get("/:clinicId", queueController.getQueue);
router.get("/:clinicId/available-slots", queueController.getAvailableQueueSlots);
router.post("/:clinicId", queueController.addQueueItem);
router.post("/:clinicId/start-consultation", queueController.startConsultation);
router.post("/:clinicId/complete-consultation", queueController.completeConsultation);
router.patch("/:clinicId/:queueItemId/reschedule", queueController.rescheduleQueueItem);
router.patch("/:clinicId/:queueItemId", queueController.updateQueueItemStatus);
router.delete("/:clinicId/:queueItemId", queueController.removeQueueItem);

module.exports = router;
