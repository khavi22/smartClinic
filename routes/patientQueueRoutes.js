const express = require("express");
const router = express.Router();
const { getMyNextQueue } = require("../Controllers/patientQueueController");


router.get("/:patientId", getMyNextQueue);

module.exports = router;