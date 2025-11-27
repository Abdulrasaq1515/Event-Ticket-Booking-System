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

const EventService = require('../../services/EventService');
const EventRepository = require('../../data/EventRepository');
const BookingRepository = require('../../data/BookingRepository');
const WaitingListRepository = require('../../data/WaitingListRepository');
const { ValidationError, NotFoundError } = require('../../utils/errors');

jest.mock('../../data/EventRepository');
jest.mock('../../data/BookingRepository');
jest.mock('../../data/WaitingListRepository');

describe('EventService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('initialize creates and returns event data', async () => {
        EventRepository.create.mockResolvedValue(1);
        EventRepository.findById.mockResolvedValue({
            id: 1,
            name: 'Test Event',
            total_tickets: 100,
            available_tickets: 100
        });

        const result = await EventService.initialize('Test Event', 100);

        expect(result).toEqual({
            eventId: 1,
            name: 'Test Event',
            totalTickets: 100,
            availableTickets: 100
        });
    });

    describe('initialize', () => {
        it('should create a new event with valid data', async () => {
            const mockEvent = {
                id: 1,
                name: 'Test Event',
                total_tickets: 100,
                available_tickets: 100
            };

            EventRepository.create.mockResolvedValue(1);
            EventRepository.findById.mockResolvedValue(mockEvent);

            const result = await EventService.initialize('Test Event', 100);

            expect(result).toEqual({
                eventId: 1,
                name: 'Test Event',
                totalTickets: 100,
                availableTickets: 100
            });
            expect(EventRepository.create).toHaveBeenCalledWith('Test Event', 100);
        });

        it('should throw ValidationError when name is missing', async () => {
            await expect(EventService.initialize('', 100))
                .rejects.toThrow(ValidationError);
        });

        it('should throw ValidationError when totalTickets is not a positive number', async () => {
            await expect(EventService.initialize('Test Event', 0))
                .rejects.toThrow(ValidationError);

            await expect(EventService.initialize('Test Event', -5))
                .rejects.toThrow(ValidationError);
        });
    });

    describe('getStatus', () => {
        it('should return event status with all counts', async () => {
            const mockEvent = {
                id: 1,
                name: 'Test Event',
                total_tickets: 100,
                available_tickets: 50
            };

            EventRepository.findById.mockResolvedValue(mockEvent);
            BookingRepository.countByEvent.mockResolvedValue(50);
            WaitingListRepository.countByEvent.mockResolvedValue(10);

            const result = await EventService.getStatus(1);

            expect(result).toEqual({
                eventId: 1,
                name: 'Test Event',
                totalTickets: 100,
                availableTickets: 50,
                bookedTickets: 50,
                waitingListCount: 10
            });
        });

        it('should throw NotFoundError when event does not exist', async () => {
            EventRepository.findById.mockResolvedValue(null);

            await expect(EventService.getStatus(999))
                .rejects.toThrow(NotFoundError);
        });

        it('should throw ValidationError for invalid eventId', async () => {
            await expect(EventService.getStatus(null))
                .rejects.toThrow(ValidationError);
        });
    });
});