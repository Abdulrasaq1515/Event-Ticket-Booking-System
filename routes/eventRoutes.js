const express = require('express');
const EventController = require('../controllers/EventController');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);

router.post('/initialize', EventController.initialize.bind(EventController));
router.post('/book', EventController.book.bind(EventController));
router.post('/cancel', EventController.cancel.bind(EventController));
router.get('/status/:eventId', EventController.getStatus.bind(EventController));

module.exports = router;