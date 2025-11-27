const pool = require('../config/database');

class BookingRepository {
    async create(eventId, userId, connection = null) {
        const conn = connection || pool;
        const [result] = await conn.execute(
            'INSERT INTO bookings (event_id, user_id, status) VALUES (?, ?, ?)',
            [eventId, userId, 'confirmed']
        );
        return result.insertId;
    }

    async findById(bookingId, connection = null) {
        const conn = connection || pool;
        const [rows] = await conn.execute(
            'SELECT * FROM bookings WHERE id = ?',
            [bookingId]
        );
        return rows[0] || null;
    }

    async findByIdForUpdate(bookingId, connection) {
        const [rows] = await connection.execute(
            'SELECT * FROM bookings WHERE id = ? FOR UPDATE',
            [bookingId]
        );
        return rows[0] || null;
    }

    async findActiveByEventAndUser(eventId, userId, connection = null) {
        const conn = connection || pool;
        const [rows] = await conn.execute(
            'SELECT * FROM bookings WHERE event_id = ? AND user_id = ? AND status = ?',
            [eventId, userId, 'confirmed']
        );
        return rows[0] || null;
    }

    async countByEvent(eventId, connection = null) {
        const conn = connection || pool;
        const [rows] = await conn.execute(
            'SELECT COUNT(*) as count FROM bookings WHERE event_id = ? AND status = ?',
            [eventId, 'confirmed']
        );
        return rows[0].count;
    }

    async cancel(bookingId, connection) {
        const [result] = await connection.execute(
            'UPDATE bookings SET status = ? WHERE id = ?',
            ['cancelled', bookingId]
        );
        return result.affectedRows > 0;
    }
}

module.exports = new BookingRepository();
