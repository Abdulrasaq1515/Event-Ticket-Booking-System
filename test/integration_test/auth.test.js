const request = require('supertest');
const app = require('../../server');
const pool = require('../../config/database');

describe('Authentication Integration Tests', () => {
    beforeAll(async () => {
        try {
            await pool.execute('DELETE FROM users WHERE email LIKE ?', ['test%@example.com']);
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    });

    afterAll(async () => {
        try {
            await pool.execute('DELETE FROM users WHERE email LIKE ?', ['test%@example.com']);
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    });

    describe('POST /api/auth/register', () => {
        it('should register a new user', async () => {
            const uniqueId = Date.now();
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    username: `testuser${uniqueId}`,
                    email: `test${uniqueId}@example.com`,
                    password: 'password123'
                });

            expect(response.status).toBe(201);
            expect(response.body.user).toBeDefined();
            expect(response.body.user).toHaveProperty('id');
            expect(response.body.user.email).toBe(`test${uniqueId}@example.com`);
            expect(response.body.user).not.toHaveProperty('password_hash');
        });

        it('should return 409 for duplicate email', async () => {
            const uniqueId = Date.now();
            const email = `testdup${uniqueId}@example.com`;

            await request(app)
                .post('/api/auth/register')
                .send({
                    username: `testuser${uniqueId}`,
                    email: email,
                    password: 'password123'
                });

            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    username: `testuser${uniqueId}_2`,
                    email: email,
                    password: 'password123'
                });

            expect(response.status).toBe(409);
        });

        it('should return 400 for short password', async () => {
            const uniqueId = Date.now();
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    username: `testuser${uniqueId}`,
                    email: `test${uniqueId}@example.com`,
                    password: '123'
                });

            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/auth/login', () => {
        let testEmail;
        const testPassword = 'password123';

        beforeAll(async () => {
            const uniqueId = Date.now();
            testEmail = `testlogin${uniqueId}@example.com`;

            await request(app)
                .post('/api/auth/register')
                .send({
                    username: `loginuser${uniqueId}`,
                    email: testEmail,
                    password: testPassword
                });
        });

        it('should login with valid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testEmail,
                    password: testPassword
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('token');
            expect(response.body.user).toBeDefined();
            expect(response.body.user.email).toBe(testEmail);
        });

        it('should return 401 for invalid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testEmail,
                    password: 'wrongpassword'
                });

            expect(response.status).toBe(401);
        });
    });
});