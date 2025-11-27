const request = require('supertest');
const app = require('../../server');
const pool = require('../../config/database');

jest.setTimeout(30000); 

describe('Concurrency Tests', () => {
    let authTokens = [];
    let userIds = [];
    let eventId;

    beforeAll(async () => {
        for (let i = 1; i <= 50; i++) {
            await pool.execute('DELETE FROM users WHERE email = ?', [`concuser${i}@example.com`]);
        }

        for (let i = 1; i <= 50; i++) {
            const registerResponse = await request(app)
                .post('/api/auth/register')
                .send({
                    username: `concuser${i}`,
                    email: `concuser${i}@example.com`,
                    password: 'password123'
                });

            if (registerResponse.status !== 201) {
                console.error(`Failed to register concuser${i}:`, registerResponse.body);
                continue;
            }

            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: `concuser${i}@example.com`,
                    password: 'password123'
                });

            if (loginResponse.status !== 200 || !loginResponse.body.token || !loginResponse.body.user) {
                console.error(`Failed to login concuser${i}:`, loginResponse.body);
                continue;
            }

            authTokens.push(loginResponse.body.token);
            userIds.push(loginResponse.body.user.id);
        }

        if (authTokens.length === 0) {
            throw new Error('Failed to create any test users');
        }

        const eventResponse = await request(app)
            .post('/api/initialize')
            .set('Authorization', `Bearer ${authTokens[0]}`)
            .send({
                name: 'Concurrency Test Event',
                totalTickets: 10
            });

        if (eventResponse.status !== 201 && eventResponse.status !== 200) {
            throw new Error(`Failed to initialize event: ${JSON.stringify(eventResponse.body)}`);
        }

        eventId = eventResponse.body.eventId;
    });

    afterAll(async () => {
        try {
            if (eventId) {
                await pool.execute('DELETE FROM bookings WHERE event_id = ?', [eventId]);
                await pool.execute('DELETE FROM waiting_list WHERE event_id = ?', [eventId]);
                await pool.execute('DELETE FROM events WHERE id = ?', [eventId]);
            }

            for (let i = 1; i <= 50; i++) {
                await pool.execute('DELETE FROM users WHERE email = ?', [`concuser${i}@example.com`]);
            }
        } finally {
            await pool.end();
        }
    });

    it('should handle 50 concurrent booking requests correctly', async () => {
        const bookingPromises = userIds.map((userId, index) => {
            return request(app)
                .post('/api/book')
                .set('Authorization', `Bearer ${authTokens[index]}`)
                .send({
                    eventId,
                    userId
                });
        });

        const responses = await Promise.all(bookingPromises);

        let confirmedBookings = 0;
        let waitingListAdditions = 0;

        responses.forEach(response => {
            if (response.body && response.body.status === 'confirmed') {
                confirmedBookings++;
            } else if (response.body && response.body.waitingListId) {
                waitingListAdditions++;
            }
        });

        expect(confirmedBookings).toBe(10);

        expect(waitingListAdditions).toBe(40);

        const [bookings] = await pool.execute(
            'SELECT COUNT(*) as count FROM bookings WHERE event_id = ? AND status = ?',
            [eventId, 'confirmed']
        );
        expect(bookings[0].count).toBe(10);

        const [waitingList] = await pool.execute(
            'SELECT COUNT(*) as count FROM waiting_list WHERE event_id = ? AND status = ?',
            [eventId, 'waiting']
        );
        expect(waitingList[0].count).toBe(40);

        const [event] = await pool.execute(
            'SELECT available_tickets FROM events WHERE id = ?',
            [eventId]
        );
        expect(event[0].available_tickets).toBe(0);
    });

    it('should correctly reassign tickets from waiting list during concurrent cancellations', async () => {
        const [bookings] = await pool.execute(
            'SELECT id FROM bookings WHERE event_id = ? AND status = ? LIMIT 5',
            [eventId, 'confirmed']
        );

        expect(bookings.length).toBe(5);

        const cancellationPromises = bookings.map((booking, index) => {
            return request(app)
                .post('/api/cancel')
                .set('Authorization', `Bearer ${authTokens[index]}`)
                .send({
                    bookingId: booking.id
                });
        });

        const cancelResponses = await Promise.all(cancellationPromises);

        cancelResponses.forEach(response => {
            expect(response.status).toBe(200);
            expect(response.body.reassigned).toBe(true);
            expect(response.body.reassignedTo).toBeDefined();
        });

        const [currentBookings] = await pool.execute(
            'SELECT COUNT(*) as count FROM bookings WHERE event_id = ? AND status = ?',
            [eventId, 'confirmed']
        );
        expect(currentBookings[0].count).toBe(10);

        const [currentWaitingList] = await pool.execute(
            'SELECT COUNT(*) as count FROM waiting_list WHERE event_id = ? AND status = ?',
            [eventId, 'waiting']
        );
        expect(currentWaitingList[0].count).toBe(35);

        const [promotedUsers] = await pool.execute(
            'SELECT COUNT(*) as count FROM waiting_list WHERE event_id = ? AND status = ?',
            [eventId, 'promoted']
        );
        expect(promotedUsers[0].count).toBe(5);
    });

    it('should prevent double booking race condition', async () => {
        const newEventResponse = await request(app)
            .post('/api/initialize')
            .set('Authorization', `Bearer ${authTokens[0]}`)
            .send({
                name: 'Double Booking Test',
                totalTickets: 5
            });

        expect(newEventResponse.status === 201 || newEventResponse.status === 200).toBe(true);

        const testEventId = newEventResponse.body.eventId;

        const userId = userIds[0];
        const token = authTokens[0];

        const duplicateBookingPromises = Array.from({ length: 10 }).map(() => {
            return request(app)
                .post('/api/book')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    eventId: testEventId,
                    userId
                });
        });

        const duplicateResponses = await Promise.all(duplicateBookingPromises);

        let successCount = 0;
        let conflictCount = 0;

        duplicateResponses.forEach(response => {
            if (response.status === 201 || response.status === 200) {
                if (response.body.bookingId || response.body.waitingListId) {
                    successCount++;
                }
            } else if (response.status === 409) {
                conflictCount++;
            }
        });

        expect(successCount).toBe(1);
        expect(conflictCount).toBe(9);

        await pool.execute('DELETE FROM bookings WHERE event_id = ?', [testEventId]);
        await pool.execute('DELETE FROM waiting_list WHERE event_id = ?', [testEventId]);
        await pool.execute('DELETE FROM events WHERE id = ?', [testEventId]);
    });

    it('should maintain correct waiting list positions under concurrent load', async () => {
        const zeroTicketEvent = await request(app)
            .post('/api/initialize')
            .set('Authorization', `Bearer ${authTokens[0]}`)
            .send({
                name: 'Waiting List Position Test',
                totalTickets: 1 
            });

        expect(zeroTicketEvent.status === 201 || zeroTicketEvent.status === 200).toBe(true);

        const testEventId = zeroTicketEvent.body.eventId;

        await request(app)
            .post('/api/book')
            .set('Authorization', `Bearer ${authTokens[0]}`)
            .send({
                eventId: testEventId,
                userId: userIds[0]
            });

        const waitingListPromises = userIds.slice(1, 21).map((userId, index) => {
            return request(app)
                .post('/api/book')
                .set('Authorization', `Bearer ${authTokens[index + 1]}`)
                .send({
                    eventId: testEventId,
                    userId
                });
        });

        const waitingListResponses = await Promise.all(waitingListPromises);

        waitingListResponses.forEach(response => {
            expect(response.status === 201 || response.status === 200).toBe(true);
            expect(response.body.waitingListId).toBeDefined();
            expect(response.body.position).toBeGreaterThan(0);
            expect(response.body.position).toBeLessThanOrEqual(20);
        });

        const positions = waitingListResponses.map(r => r.body.position);
        const uniquePositions = new Set(positions);
        expect(uniquePositions.size).toBe(20);

        const sortedPositions = [...positions].sort((a, b) => a - b);
        expect(sortedPositions[0]).toBe(1);
        expect(sortedPositions[19]).toBe(20);

        await pool.execute('DELETE FROM waiting_list WHERE event_id = ?', [testEventId]);
        await pool.execute('DELETE FROM bookings WHERE event_id = ?', [testEventId]);
        await pool.execute('DELETE FROM events WHERE id = ?', [testEventId]);
    });
});