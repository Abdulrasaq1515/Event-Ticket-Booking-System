const AuthService = require('../services/AuthService');
const { UnauthorizedError } = require('../utils/errors');

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedError('No token provided');
        }

        const token = authHeader.substring(7); 
        const decoded = await AuthService.verifyToken(token);

        req.user = decoded;
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = { authenticate };
