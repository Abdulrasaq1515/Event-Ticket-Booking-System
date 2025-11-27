const AuthService = require('../services/AuthService');

class AuthController {
    async register(req, res, next) {
        try {
            const { username, email, password } = req.body;
            const user = await AuthService.register(username, email, password);

            res.status(201).json({
                message: 'User registered successfully',
                user
            });
        } catch (error) {
            next(error);
        }
    }

    async login(req, res, next) {
        try {
            const { email, password } = req.body;
            const result = await AuthService.login(email, password);

            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new AuthController();