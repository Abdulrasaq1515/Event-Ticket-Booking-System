const request = require('supertest');
const app = require('../../server');
const pool = require('../../config/database');

describe('Event Integration Tests', () => {
    let authToken;
    let userId;
    let testEmail;

    beforeAll(async () => {
        const uniqueId = Date.now();
        testEmail = `eventuser${uniqueId}@example.com`;

        try {
            await pool.execute('DELETE FROM users WHERE email = ?', [testEmail]);
        } catch (error) {
            console.error('Cleanup error:', error);
        }

        const registerResponse = await request(app)
            .post('/api/auth/register')
            .send({
                username: `eventuser${uniqueId}`,
                email: testEmail,
                password: 'password123'
            });

        if (registerResponse.status !== 201) {
            console.error('Registration failed:', registerResponse.body);
            throw new Error('Failed to register test user for event tests');
        }

        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: testEmail,
                password: 'password123'
            });

        if (loginResponse.status !== 200 || !loginResponse.body.token) {
            console.error('Login failed:', loginResponse.body);
            throw new Error('Failed to login test user for event tests');
        }

        authToken = loginResponse.body.token;
        userId = loginResponse.body.user.id;

        if (!authToken || !userId) {
            throw new Error('Invalid auth data received');
        }
    });

    afterAll(async () => {
        try {
            if (userId) {
                await pool.execute('DELETE FROM bookings WHERE user_id = ?', [userId]);
                await pool.execute('DELETE FROM waiting_list WHERE user_id = ?', [userId]);
            }
            await pool.execute('DELETE FROM events WHERE name LIKE ?', ['Test Event%']);
            if (testEmail) {
                await pool.execute('DELETE FROM users WHERE email = ?', [testEmail]);
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    });

    describe('POST /api/initialize', () => {
        it('should create a new event', async () => {
            const response = await request(app)
                .post('/api/initialize')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: `Test Event ${Date.now()}`,
                    totalTickets: 50
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('eventId');
            expect(response.body.totalTickets).toBe(50);
            expect(response.body.availableTickets).toBe(50);
        });

        it('should return 401 without authentication', async () => {
            const response = await request(app)
                .post('/api/initialize')
                .send({
                    name: `Test Event ${Date.now()}`,
                    totalTickets: 50
                });

            expect(response.status).toBe(401);
        });

        it('should return 400 for invalid data', async () => {
            const response = await request(app)
                .post('/api/initialize')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: `Test Event ${Date.now()}`,
                    totalTickets: -10
                });

            expect(response.status).toBe(400);
        });
    });

    describe('GET /api/status/:eventId', () => {
        let eventId;

        beforeAll(async () => {
            const response = await request(app)
                .post('/api/initialize')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: `Test Event Status ${Date.now()}`,
                    totalTickets: 100
                });

            if (response.status !== 201) {
                throw new Error('Failed to create test event');
            }

            eventId = response.body.eventId;
        });

        it('should get event status', async () => {
            const response = await request(app)
                .get(`/api/status/${eventId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.eventId).toBe(eventId);
            expect(response.body.totalTickets).toBe(100);
            expect(response.body.availableTickets).toBe(100);
        });

        it('should return 404 for non-existent event', async () => {
            const response = await request(app)
                .get('/api/status/99999')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
        });
    });
});