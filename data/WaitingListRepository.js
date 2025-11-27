const pool = require('../config/database');

class WaitingListRepository {
    async add(eventId, userId, connection = null) {
        const conn = connection || pool;

        const [positionResult] = await conn.execute(
            'SELECT COALESCE(MAX(position), 0) + 1 as next_position FROM waiting_list WHERE event_id = ? AND status = ?',
            [eventId, 'waiting']
        );
        const position = positionResult[0].next_position;

        const [result] = await conn.execute(
            'INSERT INTO waiting_list (event_id, user_id, position, status) VALUES (?, ?, ?, ?)',
            [eventId, userId, position, 'waiting']
        );

        return {
            id: result.insertId,
            position
        };
    }

    async findNextInLine(eventId, connection) {
        const [rows] = await connection.execute(
            'SELECT * FROM waiting_list WHERE event_id = ? AND status = ? ORDER BY position ASC LIMIT 1 FOR UPDATE',
            [eventId, 'waiting']
        );
        return rows[0] || null;
    }

    async promote(waitingListId, connection) {
        const [result] = await connection.execute(
            'UPDATE waiting_list SET status = ? WHERE id = ?',
            ['promoted', waitingListId]
        );
        return result.affectedRows > 0;
    }

    async countByEvent(eventId, connection = null) {
        const conn = connection || pool;
        const [rows] = await conn.execute(
            'SELECT COUNT(*) as count FROM waiting_list WHERE event_id = ? AND status = ?',
            [eventId, 'waiting']
        );
        return rows[0].count;
    }

    async findByEventAndUser(eventId, userId, connection = null) {
        const conn = connection || pool;
        const [rows] = await conn.execute(
            'SELECT * FROM waiting_list WHERE event_id = ? AND user_id = ? AND status = ?',
            [eventId, userId, 'waiting']
        );
        return rows[0] || null;
    }
}

module.exports = new WaitingListRepository();