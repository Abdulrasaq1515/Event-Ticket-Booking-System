jest.mock('../../config/database', () => {
  return {
    query: jest.fn(),
    execute: jest.fn(),
    end: jest.fn()
  };
});

const AuthService = require('../../services/AuthService');
const UserRepository = require('../../data/UserRepository');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { ValidationError, UnauthorizedError, ConflictError } = require('../../utils/errors');

jest.mock('../../data/UserRepository');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        created_at: new Date()
      };

      UserRepository.findByEmail.mockResolvedValue(null);
      UserRepository.findByUsername.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue('hashedpassword');
      UserRepository.create.mockResolvedValue(1);
      UserRepository.findById.mockResolvedValue(mockUser);

      const result = await AuthService.register('testuser', 'test@example.com', 'password123');

      expect(result).toEqual(mockUser);
      expect(UserRepository.create).toHaveBeenCalledWith(
        'testuser',
        'test@example.com',
        'hashedpassword'
      );
    });

    it('should throw ValidationError for short password', async () => {
      await expect(
        AuthService.register('testuser', 'test@example.com', '12345')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ConflictError if email already exists', async () => {
      UserRepository.findByEmail.mockResolvedValue({ id: 1 });

      await expect(
        AuthService.register('testuser', 'test@example.com', 'password123')
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('login', () => {
    it('should login user with valid credentials', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashedpassword'
      };

      UserRepository.findByEmail.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('mock-token');

      const result = await AuthService.login('test@example.com', 'password123');

      expect(result.token).toBe('mock-token');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.password_hash).toBeUndefined();
    });

    it('should throw UnauthorizedError for invalid credentials', async () => {
      UserRepository.findByEmail.mockResolvedValue(null);

      await expect(
        AuthService.login('test@example.com', 'wrongpassword')
      ).rejects.toThrow(UnauthorizedError);
    });
  });
});