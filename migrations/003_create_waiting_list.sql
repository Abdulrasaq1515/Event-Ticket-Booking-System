USE event_booking;

CREATE TABLE IF NOT EXISTS waiting_list (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_id INT NOT NULL,
    user_id INT NOT NULL,
    position INT NOT NULL,
    status ENUM('waiting', 'promoted', 'expired') DEFAULT 'waiting',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES event_booking.events (id) ON DELETE CASCADE,
    INDEX idx_event_position (event_id, position),
    INDEX idx_status (status),
    UNIQUE KEY unique_waiting_user (event_id, user_id, status)
) ENGINE=InnoDB;