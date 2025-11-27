const express = require('express');
require('dotenv').config();

const appConfig = require('./config/app');
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const errorHandler = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');
const logger = require('./utils/logger');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(rateLimiter);

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api', eventRoutes);

app.use((req, res) => {
    res.status(404).json({
        error: {
            message: 'Route not found'
        }
    });
});

app.use(errorHandler);

const PORT = appConfig.port;

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        logger.info('SERVER', `Server running on port ${PORT}`, {
            environment: appConfig.env
        });
    });
}
module.exports = app;