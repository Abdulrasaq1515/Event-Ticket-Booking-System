module.exports = {
  jwtSecret: process.env.JWT_SECRET || 'your_super_secret_jwt_key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  bcryptSaltRounds: 10
};