jest.mock('../../config/database', () => {
    return {
        getConnection: jest.fn(async () => ({
            beginTransaction: jest.fn(),
            commit: jest.fn(),
            rollback: jest.fn(),
            release: jest.fn(),
            execute: jest.fn()
        })),
        execute: jest.fn(),
        query: jest.fn(),
        end: jest.fn()
    };
});
const BookingService = require('../../services/BookingService');
const pool = require('../../config/database');
const EventRepository = require('../../data/EventRepository');
const BookingRepository = require('../../data/BookingRepository');
const WaitingListRepository = require('../../data/WaitingListRepository');
const { ValidationError, NotFoundError, ConflictError } = require('../../utils/errors');

jest.mock('../../data/EventRepository');
jest.mock('../../data/BookingRepository');
jest.mock('../../data/WaitingListRepository');

describe('BookingService', () => {
    let mockConnection;

    beforeEach(() => {
        jest.clearAllMocks();

        mockConnection = {
            beginTransaction: jest.fn(),
            commit: jest.fn(),
            rollback: jest.fn(),
            release: jest.fn()
        };

        pool.getConnection.mockResolvedValue(mockConnection);
    });

    describe('book', () => {
        it('should book a ticket when available', async () => {
            const mockEvent = {
                id: 1,
                available_tickets: 10
            };

            EventRepository.findByIdForUpdate.mockResolvedValue(mockEvent);
            BookingRepository.findActiveByEventAndUser.mockResolvedValue(null);
            WaitingListRepository.findByEventAndUser.mockResolvedValue(null);
            BookingRepository.create.mockResolvedValue(1);
            EventRepository.decrementAvailableTickets.mockResolvedValue(true);

            const result = await BookingService.book(1, 1);

            expect(result).toEqual({
                bookingId: 1,
                eventId: 1,
                userId: 1,
                status: 'confirmed'
            });
            expect(mockConnection.commit).toHaveBeenCalled();
            expect(mockConnection.rollback).not.toHaveBeenCalled();
        });

        it('should add to waiting list when tickets are sold out', async () => {
            const mockEvent = {
                id: 1,
                available_tickets: 0
            };

            EventRepository.findByIdForUpdate.mockResolvedValue(mockEvent);
            BookingRepository.findActiveByEventAndUser.mockResolvedValue(null);
            WaitingListRepository.findByEventAndUser.mockResolvedValue(null);
            WaitingListRepository.add.mockResolvedValue({ id: 1, position: 5 });

            const result = await BookingService.book(1, 1);

            expect(result.waitingListId).toBe(1);
            expect(result.position).toBe(5);
            expect(result.message).toContain('waiting list');
            expect(mockConnection.commit).toHaveBeenCalled();
        });

        it('should throw ConflictError if user already has a booking', async () => {
            const mockEvent = { id: 1, available_tickets: 10 };
            const existingBooking = { id: 1, user_id: 1, event_id: 1 };

            EventRepository.findByIdForUpdate.mockResolvedValue(mockEvent);
            BookingRepository.findActiveByEventAndUser.mockResolvedValue(existingBooking);

            await expect(BookingService.book(1, 1))
                .rejects.toThrow(ConflictError);

            expect(mockConnection.rollback).toHaveBeenCalled();
        });

        it('should throw NotFoundError if event does not exist', async () => {
            EventRepository.findByIdForUpdate.mockResolvedValue(null);

            await expect(BookingService.book(999, 1))
                .rejects.toThrow(NotFoundError);

            expect(mockConnection.rollback).toHaveBeenCalled();
        });
    });

    describe('cancel', () => {
        it('should cancel booking and reassign to waiting list', async () => {
            const mockBooking = {
                id: 1,
                event_id: 1,
                user_id: 1,
                status: 'confirmed'
            };
            const mockWaitingListUser = {
                id: 1,
                user_id: 2,
                event_id: 1
            };

            BookingRepository.findByIdForUpdate.mockResolvedValue(mockBooking);
            BookingRepository.cancel.mockResolvedValue(true);
            WaitingListRepository.findNextInLine.mockResolvedValue(mockWaitingListUser);
            BookingRepository.create.mockResolvedValue(2);
            WaitingListRepository.promote.mockResolvedValue(true);

            const result = await BookingService.cancel(1);

            expect(result.reassigned).toBe(true);
            expect(result.reassignedTo.userId).toBe(2);
            expect(mockConnection.commit).toHaveBeenCalled();
        });

        it('should cancel booking and increment available tickets if no waiting list', async () => {
            const mockBooking = {
                id: 1,
                event_id: 1,
                user_id: 1,
                status: 'confirmed'
            };

            BookingRepository.findByIdForUpdate.mockResolvedValue(mockBooking);
            BookingRepository.cancel.mockResolvedValue(true);
            WaitingListRepository.findNextInLine.mockResolvedValue(null);
            EventRepository.incrementAvailableTickets.mockResolvedValue(true);

            const result = await BookingService.cancel(1);

            expect(result.reassigned).toBe(false);
            expect(EventRepository.incrementAvailableTickets).toHaveBeenCalled();
            expect(mockConnection.commit).toHaveBeenCalled();
        });

        it('should throw NotFoundError if booking does not exist', async () => {
            BookingRepository.findByIdForUpdate.mockResolvedValue(null);

            await expect(BookingService.cancel(999))
                .rejects.toThrow(NotFoundError);

            expect(mockConnection.rollback).toHaveBeenCalled();
        });

        it('should throw ConflictError if booking is already cancelled', async () => {
            const mockBooking = {
                id: 1,
                status: 'cancelled'
            };

            BookingRepository.findByIdForUpdate.mockResolvedValue(mockBooking);

            await expect(BookingService.cancel(1))
                .rejects.toThrow(ConflictError);
        });
    });
});
