const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const UserRepository = require('../data/UserRepository');
const { ValidationError, UnauthorizedError, ConflictError } = require('../utils/errors');
const authConfig = require('../config/auth');
const logger = require('../utils/logger');

class AuthService {
    async register(username, email, password) {
        if (!username || !email || !password) {
            throw new ValidationError('Username, email, and password are required');
        }
        if (password.length < 6) {
            throw new ValidationError('Password must be at least 6 characters long');
        }

        const existingUser = await UserRepository.findByEmail(email);
        if (existingUser) {
            throw new ConflictError('User with this email already exists');
        }

        const existingUsername = await UserRepository.findByUsername(username);
        if (existingUsername) {
            throw new ConflictError('Username already taken');
        }

        const passwordHash = await bcrypt.hash(password, authConfig.bcryptSaltRounds);

        const userId = await UserRepository.create(username, email, passwordHash);

        logger.info('AUTH', 'User registered', { userId, username, email });

        const user = await UserRepository.findById(userId);
        return this._sanitizeUser(user);
    }

    async login(email, password) {
        if (!email || !password) {
            throw new ValidationError('Email and password are required');
        }

        const user = await UserRepository.findByEmail(email);
        if (!user) {
            throw new UnauthorizedError('Invalid credentials');
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            throw new UnauthorizedError('Invalid credentials');
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email },
            authConfig.jwtSecret,
            { expiresIn: authConfig.jwtExpiresIn }
        );

        logger.info('AUTH', 'User logged in', { userId: user.id, email });

        return {
            token,
            user: this._sanitizeUser(user)
        };
    }

    async verifyToken(token) {
        try {
            const decoded = jwt.verify(token, authConfig.jwtSecret);
            return decoded;
        } catch (error) {
            throw new UnauthorizedError('Invalid or expired token');
        }
    }

    _sanitizeUser(user) {
        const { password_hash, ...sanitizedUser } = user;
        return sanitizedUser;
    }
}

module.exports = new AuthService();