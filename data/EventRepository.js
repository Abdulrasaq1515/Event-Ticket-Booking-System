const pool = require('../config/database');
const { NotFoundError } = require('../utils/errors');

class EventRepository {
    async create(name, totalTickets, connection = null) {
        const conn = connection || pool;
        const [result] = await conn.execute(
            'INSERT INTO events (name, total_tickets, available_tickets) VALUES (?, ?, ?)',
            [name, totalTickets, totalTickets]
        );
        return result.insertId;
    }

    async findById(eventId, connection = null) {
        const conn = connection || pool;
        const [rows] = await conn.execute(
            'SELECT * FROM events WHERE id = ?',
            [eventId]
        );
        return rows[0] || null;
    }

    async findByIdForUpdate(eventId, connection) {
        const [rows] = await connection.execute(
            'SELECT * FROM events WHERE id = ? FOR UPDATE',
            [eventId]
        );
        return rows[0] || null;
    }

    async updateAvailableTickets(eventId, availableTickets, connection) {
        const [result] = await connection.execute(
            'UPDATE events SET available_tickets = ? WHERE id = ?',
            [availableTickets, eventId]
        );
        return result.affectedRows > 0;
    }

    async decrementAvailableTickets(eventId, connection) {
        const [result] = await connection.execute(
            'UPDATE events SET available_tickets = available_tickets - 1 WHERE id = ? AND available_tickets > 0',
            [eventId]
        );
        return result.affectedRows > 0;
    }

    async incrementAvailableTickets(eventId, connection) {
        const [result] = await connection.execute(
            'UPDATE events SET available_tickets = available_tickets + 1 WHERE id = ?',
            [eventId]
        );
        return result.affectedRows > 0;
    }
}

module.exports = new EventRepository();
