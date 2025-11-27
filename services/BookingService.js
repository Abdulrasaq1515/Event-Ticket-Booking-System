const pool = require('../config/database');
const EventRepository = require('../data/EventRepository');
const BookingRepository = require('../data/BookingRepository');
const WaitingListRepository = require('../data/WaitingListRepository');
const { ValidationError, NotFoundError, ConflictError } = require('../utils/errors');
const logger = require('../utils/logger');

class BookingService {
    async book(eventId, userId) {
        if (!eventId || typeof eventId !== 'number') {
            throw new ValidationError('Valid event ID is required');
        }

        if (!userId || typeof userId !== 'number') {
            throw new ValidationError('Valid user ID is required');
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            const event = await EventRepository.findByIdForUpdate(eventId, connection);
            if (!event) {
                await connection.rollback();
                throw new NotFoundError('Event not found');
            }

            const existingBooking = await BookingRepository.findActiveByEventAndUser(
                eventId,
                userId,
                connection
            );
            if (existingBooking) {
                await connection.rollback();
                throw new ConflictError('User already has a booking for this event');
            }

            const existingWaitingList = await WaitingListRepository.findByEventAndUser(
                eventId,
                userId,
                connection
            );
            if (existingWaitingList) {
                await connection.rollback();
                throw new ConflictError('User is already on the waiting list for this event');
            }

            if (event.available_tickets > 0) {
                const bookingId = await BookingRepository.create(eventId, userId, connection);
                await EventRepository.decrementAvailableTickets(eventId, connection);

                await connection.commit();

                logger.info('BOOKING', 'Ticket booked successfully', {
                    bookingId,
                    eventId,
                    userId
                });

                return {
                    bookingId,
                    eventId,
                    userId,
                    status: 'confirmed'
                };
            } else {
                const waitingList = await WaitingListRepository.add(eventId, userId, connection);

                await connection.commit();

                logger.info('BOOKING', 'User added to waiting list', {
                    waitingListId: waitingList.id,
                    eventId,
                    userId,
                    position: waitingList.position
                });

                return {
                    waitingListId: waitingList.id,
                    eventId,
                    userId,
                    position: waitingList.position,
                    message: 'Event is sold out. You have been added to the waiting list.'
                };
            }
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async cancel(bookingId) {
        if (!bookingId || typeof bookingId !== 'number') {
            throw new ValidationError('Valid booking ID is required');
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            const booking = await BookingRepository.findByIdForUpdate(bookingId, connection);
            if (!booking) {
                await connection.rollback();
                throw new NotFoundError('Booking not found');
            }

            if (booking.status === 'cancelled') {
                await connection.rollback();
                throw new ConflictError('Booking is already cancelled');
            }

            await BookingRepository.cancel(bookingId, connection);

            const nextInLine = await WaitingListRepository.findNextInLine(
                booking.event_id,
                connection
            );

            let reassignedBooking = null;

            if (nextInLine) {
                const newBookingId = await BookingRepository.create(
                    booking.event_id,
                    nextInLine.user_id,
                    connection
                );
                await WaitingListRepository.promote(nextInLine.id, connection);

                reassignedBooking = {
                    userId: nextInLine.user_id,
                    bookingId: newBookingId
                };

                logger.info('BOOKING', 'Ticket reassigned from waiting list', {
                    cancelledBookingId: bookingId,
                    newBookingId,
                    userId: nextInLine.user_id,
                    eventId: booking.event_id
                });
            } else {
                await EventRepository.incrementAvailableTickets(booking.event_id, connection);
            }

            await connection.commit();

            logger.info('BOOKING', 'Booking cancelled', {
                bookingId,
                eventId: booking.event_id,
                reassigned: !!reassignedBooking
            });

            return {
                message: 'Booking cancelled successfully',
                reassigned: !!reassignedBooking,
                reassignedTo: reassignedBooking
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = new BookingService();