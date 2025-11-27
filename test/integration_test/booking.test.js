const request = require('supertest');
const app = require('../../server');
const pool = require('../../config/database');

describe('Booking Integration Tests', () => {
    let authToken;
    let userId;
    let eventId;
    let testEmail;

    beforeAll(async () => {
        console.log('\n🔧 Setting up Booking Tests...\n');

        const uniqueId = Date.now();
        testEmail = `bookinguser${uniqueId}@example.com`;

        console.log('1️⃣ Cleaning up existing test data...');
        try {
            await pool.execute('DELETE FROM users WHERE email = ?', [testEmail]);
            console.log('   ✅ Cleanup complete');
        } catch (error) {
            console.log('   ⚠️  Cleanup warning:', error.message);
        }

        console.log('2️⃣ Registering test user...');
        console.log('   Email:', testEmail);

        const registerResponse = await request(app)
            .post('/api/auth/register')
            .send({
                username: `bookinguser${uniqueId}`,
                email: testEmail,
                password: 'password123'
            });

        console.log('   Registration status:', registerResponse.status);

        if (registerResponse.status !== 201) {
            console.error('   ❌ Registration failed!');
            console.error('   Response body:', JSON.stringify(registerResponse.body, null, 2));
            console.error('   Response headers:', registerResponse.headers);

            if (registerResponse.status === 409) {
                console.error('   💡 User already exists. Trying to delete and retry...');
                await pool.execute('DELETE FROM users WHERE email = ?', [testEmail]);

                const retryResponse = await request(app)
                    .post('/api/auth/register')
                    .send({
                        username: `bookinguser${uniqueId}_retry`,
                        email: testEmail,
                        password: 'password123'
                    });

                if (retryResponse.status !== 201) {
                    throw new Error(`Registration failed after retry: ${JSON.stringify(retryResponse.body)}`);
                }

                console.log('   ✅ Registration successful on retry');
            } else {
                throw new Error(`Failed to register test user: ${JSON.stringify(registerResponse.body)}`);
            }
        } else {
            console.log('   ✅ User registered successfully');
        }

        console.log('3️⃣ Logging in...');

        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: testEmail,
                password: 'password123'
            });

        console.log('   Login status:', loginResponse.status);

        if (loginResponse.status !== 200) {
            console.error('   ❌ Login failed!');
            console.error('   Response body:', JSON.stringify(loginResponse.body, null, 2));
            throw new Error(`Failed to login: ${JSON.stringify(loginResponse.body)}`);
        }

        if (!loginResponse.body || !loginResponse.body.token || !loginResponse.body.user) {
            console.error('   ❌ Login response missing required data!');
            console.error('   Response:', JSON.stringify(loginResponse.body, null, 2));
            throw new Error('Login response missing token or user data');
        }

        authToken = loginResponse.body.token;
        userId = loginResponse.body.user.id;

        console.log('   ✅ Login successful');
        console.log('   User ID:', userId);
        console.log('   Token:', authToken ? 'Received' : 'Missing');

        console.log('4️⃣ Creating test event...');

        const eventResponse = await request(app)
            .post('/api/initialize')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                name: `Booking Test Event ${Date.now()}`,
                totalTickets: 2
            });

        console.log('   Event creation status:', eventResponse.status);

        if (eventResponse.status !== 201) {
            console.error('   ❌ Event creation failed!');
            console.error('   Response:', JSON.stringify(eventResponse.body, null, 2));
            throw new Error(`Failed to create event: ${JSON.stringify(eventResponse.body)}`);
        }

        eventId = eventResponse.body.eventId;
        console.log('   ✅ Event created');
        console.log('   Event ID:', eventId);

        console.log('\n✅ Setup complete! Ready to run tests.\n');
    });

    afterAll(async () => {
        console.log('\n🧹 Cleaning up Booking Tests...\n');

        try {
            if (userId) {
                await pool.execute('DELETE FROM bookings WHERE user_id = ?', [userId]);
                await pool.execute('DELETE FROM waiting_list WHERE user_id = ?', [userId]);
                console.log('   ✅ Cleaned user bookings');
            }

            if (eventId) {
                await pool.execute('DELETE FROM events WHERE id = ?', [eventId]);
                console.log('   ✅ Cleaned event');
            }

            if (testEmail) {
                await pool.execute('DELETE FROM users WHERE email = ?', [testEmail]);
                console.log('   ✅ Cleaned user');
            }
        } catch (error) {
            console.error('   ⚠️  Cleanup error:', error.message);
        }

        console.log('\n✅ Cleanup complete\n');
    });

    describe('POST /api/book', () => {
        it('should book a ticket successfully', async () => {
            const response = await request(app)
                .post('/api/book')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    eventId,
                    userId
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('bookingId');
            expect(response.body.status).toBe('confirmed');
        });

        it('should return 409 for duplicate booking', async () => {
            const response = await request(app)
                .post('/api/book')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    eventId,
                    userId
                });

            expect(response.status).toBe(409);
        });
    });

    describe('POST /api/cancel', () => {
        let bookingId;
        let user2Token;
        let user2Id;
        let user2Email;

        beforeAll(async () => {
            console.log('\n Setting up Cancel Tests...\n');

            const uniqueId = Date.now();
            user2Email = `bookinguser2_${uniqueId}@example.com`;

            console.log('1️⃣ Registering second user...');

            const registerResponse = await request(app)
                .post('/api/auth/register')
                .send({
                    username: `bookinguser2_${uniqueId}`,
                    email: user2Email,
                    password: 'password123'
                });

            if (registerResponse.status !== 201) {
                console.error('   ❌ Failed to register second user');
                console.error('   Response:', registerResponse.body);
                throw new Error('Failed to register second user');
            }

            console.log('    Second user registered');

            console.log('2️ Logging in second user...');

            const login2Response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: user2Email,
                    password: 'password123'
                });

            if (login2Response.status !== 200 || !login2Response.body.token) {
                console.error('   ❌ Failed to login second user');
                console.error('   Response:', login2Response.body);
                throw new Error('Failed to login second user');
            }

            user2Token = login2Response.body.token;
            user2Id = login2Response.body.user.id;

            console.log('    Second user logged in');
            console.log('    User ID:', user2Id);

            console.log('3️ Creating booking for second user...');

            const bookingResponse = await request(app)
                .post('/api/book')
                .set('Authorization', `Bearer ${user2Token}`)
                .send({
                    eventId,
                    userId: user2Id
                });

            if (bookingResponse.status !== 201) {
                console.error('   ❌ Failed to create booking');
                console.error('   Response:', bookingResponse.body);
                throw new Error('Failed to create booking for second user');
            }

            bookingId = bookingResponse.body.bookingId;
            console.log('   ✅ Booking created');
            console.log('   Booking ID:', bookingId);

            console.log('\n✅ Cancel test setup complete!\n');
        });

        afterAll(async () => {
            try {
                if (user2Id) {
                    await pool.execute('DELETE FROM bookings WHERE user_id = ?', [user2Id]);
                    await pool.execute('DELETE FROM users WHERE id = ?', [user2Id]);
                }
            } catch (error) {
                console.error('Cleanup error:', error.message);
            }
        });

        it('should cancel a booking', async () => {
            const response = await request(app)
                .post('/api/cancel')
                .set('Authorization', `Bearer ${user2Token}`)
                .send({
                    bookingId
                });

            expect(response.status).toBe(200);
            expect(response.body.message).toContain('cancelled successfully');
        });

        it('should return 404 for non-existent booking', async () => {
            const response = await request(app)
                .post('/api/cancel')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    bookingId: 99999
                });

            expect(response.status).toBe(404);
        });
    });

    describe('Waiting List Flow', () => {
        let smallEventId;
        let user1Token, user2Token;
        let user1Id, user2Id;
        let user1Email, user2Email;

        beforeAll(async () => {
            console.log('\n🔧 Setting up Waiting List Tests...\n');

            const baseTime = Date.now();

            const users = [];

            for (let i = 1; i <= 2; i++) {
                console.log(`${i}️⃣ Creating user ${i}...`);

                const uniqueEmail = `waituser${i}_${baseTime}_${i}@example.com`;

                try {
                    await pool.execute('DELETE FROM users WHERE email = ?', [uniqueEmail]);
                } catch (error) {
                }

                const registerResponse = await request(app)
                    .post('/api/auth/register')
                    .send({
                        username: `waituser${i}_${baseTime}`,
                        email: uniqueEmail,
                        password: 'password123'
                    });

                if (registerResponse.status !== 201) {
                    throw new Error(`Failed to register wait user ${i}: ${JSON.stringify(registerResponse.body)}`);
                }

                const loginResp = await request(app)
                    .post('/api/auth/login')
                    .send({
                        email: uniqueEmail,
                        password: 'password123'
                    });

                if (loginResp.status !== 200 || !loginResp.body.token) {
                    throw new Error(`Failed to login wait user ${i}: ${JSON.stringify(loginResp.body)}`);
                }

                users.push({
                    token: loginResp.body.token,
                    id: loginResp.body.user.id,
                    email: uniqueEmail
                });

                console.log(`   ✅ User ${i} created (ID: ${loginResp.body.user.id})`);
            }

            user1Token = users[0].token;
            user1Id = users[0].id;
            user1Email = users[0].email;

            user2Token = users[1].token;
            user2Id = users[1].id;
            user2Email = users[1].email;

            console.log('3️⃣ Creating small event (1 ticket)...');

            const eventResponse = await request(app)
                .post('/api/initialize')
                .set('Authorization', `Bearer ${user1Token}`)
                .send({
                    name: `Small Event ${Date.now()}`,
                    totalTickets: 1
                });

            if (eventResponse.status !== 201) {
                throw new Error(`Failed to create small event: ${JSON.stringify(eventResponse.body)}`);
            }

            smallEventId = eventResponse.body.eventId;
            console.log(`   ✅ Event created (ID: ${smallEventId})`);

            console.log('\n✅ Waiting list test setup complete!\n');
        });

        afterAll(async () => {
            try {
                if (smallEventId) {
                    await pool.execute('DELETE FROM bookings WHERE event_id = ?', [smallEventId]);
                    await pool.execute('DELETE FROM waiting_list WHERE event_id = ?', [smallEventId]);
                    await pool.execute('DELETE FROM events WHERE id = ?', [smallEventId]);
                }

                if (user1Email) await pool.execute('DELETE FROM users WHERE email = ?', [user1Email]);
                if (user2Email) await pool.execute('DELETE FROM users WHERE email = ?', [user2Email]);
            } catch (error) {
                console.error('Cleanup error:', error.message);
            }
        });

        it('should add user to waiting list when sold out', async () => {
            const bookResponse = await request(app)
                .post('/api/book')
                .set('Authorization', `Bearer ${user1Token}`)
                .send({ eventId: smallEventId, userId: user1Id });

            expect([200, 201]).toContain(bookResponse.status);

            const response = await request(app)
                .post('/api/book')
                .set('Authorization', `Bearer ${user2Token}`)
                .send({ eventId: smallEventId, userId: user2Id });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('waitingListId');
            expect(response.body.position).toBe(1);
        });

        it('should reassign ticket from waiting list on cancellation', async () => {
            const [bookings] = await pool.execute(
                'SELECT id FROM bookings WHERE event_id = ? AND user_id = ? AND status = ?',
                [smallEventId, user1Id, 'confirmed']
            );

            if (bookings.length === 0) {
                throw new Error('No booking found for user 1');
            }

            const bookingId = bookings[0].id;

            const cancelResponse = await request(app)
                .post('/api/cancel')
                .set('Authorization', `Bearer ${user1Token}`)
                .send({ bookingId });

            expect(cancelResponse.status).toBe(200);
            expect(cancelResponse.body.reassigned).toBe(true);
            expect(cancelResponse.body.reassignedTo.userId).toBe(user2Id);

            const [user2Bookings] = await pool.execute(
                'SELECT * FROM bookings WHERE event_id = ? AND user_id = ? AND status = ?',
                [smallEventId, user2Id, 'confirmed']
            );

            expect(user2Bookings.length).toBe(1);
        });
    });
});