const EventService = require('../services/EventService');
const BookingService = require('../services/BookingService');

class EventController {
    async initialize(req, res, next) {
        try {
            const { name, totalTickets } = req.body;
            const event = await EventService.initialize(name, totalTickets);

            res.status(201).json(event);
        } catch (error) {
            next(error);
        }
    }

    async book(req, res, next) {
        try {
            const { eventId, userId } = req.body;
            const result = await BookingService.book(eventId, userId);

            const statusCode = result.bookingId ? 201 : 200;
            res.status(statusCode).json(result);
        } catch (error) {
            next(error);
        }
    }

    async cancel(req, res, next) {
        try {
            const { bookingId } = req.body;
            const result = await BookingService.cancel(bookingId);

            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }

    async getStatus(req, res, next) {
        try {
            const eventId = parseInt(req.params.eventId);
            const status = await EventService.getStatus(eventId);

            res.status(200).json(status);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new EventController();
