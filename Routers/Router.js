const express = require('express');
const userCollector = require('../Controllers/userCollectorController');
const mailSender = require('../Controllers/mailSenderController');
const serverAwake = require('../Controllers/serverAwakeFile');

const router = express.Router();

router.get("/collectUsers", userCollector.sender);

router.get('/sendMail', mailSender.mailSender);

router.get('/ping', serverAwake.ping);

module.exports = router;