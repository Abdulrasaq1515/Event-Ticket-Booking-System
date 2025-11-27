const pool = require('../config/database');
const EventRepository = require('../data/EventRepository');
const BookingRepository = require('../data/BookingRepository');
const WaitingListRepository = require('../data/WaitingListRepository');
const { ValidationError, NotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');

class EventService {
    async initialize(name, totalTickets) {
        if (!name || typeof name !== 'string') {
            throw new ValidationError('Event name is required and must be a string');
        }

        if (!totalTickets || typeof totalTickets !== 'number' || totalTickets <= 0) {
            throw new ValidationError('Total tickets must be a positive number');
        }

        const eventId = await EventRepository.create(name, totalTickets);
        const event = await EventRepository.findById(eventId);

        logger.info('EVENT', 'Event initialized', { eventId, name, totalTickets });

        return {
            eventId: event.id,
            name: event.name,
            totalTickets: event.total_tickets,
            availableTickets: event.available_tickets
        };
    }

    async getStatus(eventId) {
        if (!eventId || typeof eventId !== 'number') {
            throw new ValidationError('Valid event ID is required');
        }

        const event = await EventRepository.findById(eventId);
        if (!event) {
            throw new NotFoundError('Event not found');
        }

        const bookedTickets = await BookingRepository.countByEvent(eventId);
        const waitingListCount = await WaitingListRepository.countByEvent(eventId);

        return {
            eventId: event.id,
            name: event.name,
            totalTickets: event.total_tickets,
            availableTickets: event.available_tickets,
            bookedTickets,
            waitingListCount
        };
    }
}

module.exports = new EventService();
