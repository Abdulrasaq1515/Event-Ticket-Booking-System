# Event Ticket Booking System

A production-ready Node.js application for managing event ticket bookings with advanced concurrency handling, JWT authentication, rate limiting, and comprehensive testing.

## 🚀 Features

- **Concurrent Booking System**: Thread-safe ticket booking with pessimistic locking
- **Waiting List Management**: Automatic waiting list when events are sold out
- **Auto-Reassignment**: Automatic ticket reassignment from waiting list on cancellation
- **JWT Authentication**: Secure user authentication with JSON Web Tokens
- **Rate Limiting**: API protection against abuse (configurable)
- **Comprehensive Logging**: Detailed operation logging for monitoring and debugging
- **Test-Driven Development**: 80%+ test coverage with unit and integration tests
- **MySQL Transactions**: ACID-compliant database operations
- **Raw SQL Queries**: No ORM overhead, optimized query performance

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18+ (LTS recommended)
- **MySQL** 
- **npm** (comes with Node.js)
- **Git** (for cloning the repository)


## 📥 Installation

###  Clone the Repository

```bash
git clone https://github.com/Abdulrasaq1515/Event-Ticket-Booking-System
cd event-booking-system
```

###  Install Dependencies

```bash
npm install
```

###  Create Database

Open MySQL command line:

```bash
mysql -u root -p
```

Create the database:

```sql
CREATE DATABASE event_booking;
USE event_booking;
exit;
```

###  Run Database Migrations

Run migrations in order:

```bash
mysql -u root -p event_booking < migrations/001_create_events.sql
mysql -u root -p event_booking < migrations/002_create_bookings.sql
mysql -u root -p event_booking < migrations/003_create_waiting_list.sql
mysql -u root -p event_booking < migrations/004_create_users.sql
```

Or run all at once (Windows PowerShell):
```powershell
Get-ChildItem migrations\*.sql | ForEach-Object { mysql -u root -p event_booking -e "SOURCE $($_.FullName)" }
```

Mac/Linux:
```bash
for f in migrations/*.sql; do mysql -u root -p event_booking < "$f"; done
```

```

### Verify Setup

Run the verification script:

```bash
npm run check
```

You should see all green checkmarks ✅. If any checks fail, see [Troubleshooting](#troubleshooting).

## ⚙️ Configuration



### Database Configuration

The application uses connection pooling with these settings:

- **Connection Limit**: 10 connections
- **Queue Limit**: Unlimited
- **Keep Alive**: Enabled

## 🚀 Running the Application

### Development Mode

```bash
npm run dev
```

Server will start on `http://localhost:3000` with auto-reload on file changes.

### Production Mode

```bash
npm start
```

Server will start without auto-reload.

### Health Check

Once running, verify the server:

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 📚 API Documentation

### Base URL

```
http://localhost:3000/api
```

### Authentication

All endpoints except authentication routes require a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <your_jwt_token>
```

---

## 🔐 Authentication Endpoints

### 1. Register User

Create a new user account.

**Endpoint:** `POST /api/auth/register`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Success Response (201 Created):**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**

- **400 Bad Request** - Invalid input
```json
{
  "error": {
    "message": "Password must be at least 6 characters long"
  }
}
```

- **409 Conflict** - User already exists
```json
{
  "error": {
    "message": "User with this email already exists"
  }
}
```

**Validation Rules:**
- Username: Required, 3-100 characters
- Email: Required, valid email format
- Password: Required, minimum 6 characters

---

### 2. Login

Authenticate and receive JWT token.

**Endpoint:** `POST /api/auth/login`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Success Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiam9obkBleGFtcGxlLmNvbSIsImlhdCI6MTcwNjcyODgwMCwiZXhwIjoxNzA2ODE1MjAwfQ.XYZ...",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**

- **401 Unauthorized** - Invalid credentials
```json
{
  "error": {
    "message": "Invalid credentials"
  }
}
```

**Token Usage:**
Store the token and include it in subsequent requests:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🎫 Event Endpoints

All event endpoints require authentication.

### 3. Initialize Event

Create a new event with specified ticket capacity.

**Endpoint:** `POST /api/initialize`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Tech Conference 2024",
  "totalTickets": 100
}
```

**Success Response (201 Created):**
```json
{
  "eventId": 1,
  "name": "Tech Conference 2024",
  "totalTickets": 100,
  "availableTickets": 100
}
```

**Error Responses:**

- **400 Bad Request** - Invalid input
```json
{
  "error": {
    "message": "Total tickets must be a positive number"
  }
}
```

- **401 Unauthorized** - Missing or invalid token
```json
{
  "error": {
    "message": "No token provided"
  }
}
```

**Validation Rules:**
- Name: Required, non-empty string
- Total Tickets: Required, positive integer

---

### 4. Book Ticket

Book a ticket for a user. If sold out, user is added to waiting list.

**Endpoint:** `POST /api/book`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "eventId": 1,
  "userId": 1
}
```

**Success Response - Ticket Available (201 Created):**
```json
{
  "bookingId": 1,
  "eventId": 1,
  "userId": 1,
  "status": "confirmed"
}
```

**Success Response - Added to Waiting List (200 OK):**
```json
{
  "waitingListId": 1,
  "eventId": 1,
  "userId": 1,
  "position": 5,
  "message": "Event is sold out. You have been added to the waiting list."
}
```

**Error Responses:**

- **404 Not Found** - Event doesn't exist
```json
{
  "error": {
    "message": "Event not found"
  }
}
```

- **409 Conflict** - User already has booking
```json
{
  "error": {
    "message": "User already has a booking for this event"
  }
}
```

**Concurrency Handling:**
This endpoint uses database transactions with row-level locking to prevent race conditions. Multiple simultaneous requests will be processed sequentially.

---

### 5. Cancel Booking

Cancel a booking and automatically reassign to waiting list if available.

**Endpoint:** `POST /api/cancel`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "bookingId": 1
}
```

**Success Response - With Reassignment (200 OK):**
```json
{
  "message": "Booking cancelled successfully",
  "reassigned": true,
  "reassignedTo": {
    "userId": 5,
    "bookingId": 15
  }
}
```

**Success Response - Without Reassignment (200 OK):**
```json
{
  "message": "Booking cancelled successfully",
  "reassigned": false,
  "reassignedTo": null
}
```

**Error Responses:**

- **404 Not Found** - Booking doesn't exist
```json
{
  "error": {
    "message": "Booking not found"
  }
}
```

- **409 Conflict** - Booking already cancelled
```json
{
  "error": {
    "message": "Booking is already cancelled"
  }
}
```

**Automatic Reassignment:**
When a booking is cancelled, the system automatically checks the waiting list. If users are waiting, the first person in line is automatically assigned the ticket.

---

### 6. Get Event Status

Retrieve current status of an event including available tickets and waiting list count.

**Endpoint:** `GET /api/status/:eventId`

**Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
- `eventId` (integer) - The event ID

**Example:**
```
GET /api/status/1
```

**Success Response (200 OK):**
```json
{
  "eventId": 1,
  "name": "Tech Conference 2024",
  "totalTickets": 100,
  "availableTickets": 45,
  "bookedTickets": 55,
  "waitingListCount": 12
}
```

**Error Responses:**

- **404 Not Found** - Event doesn't exist
```json
{
  "error": {
    "message": "Event not found"
  }
}
```

---

## 🧪 Testing

### Run All Tests

```bash
npm test
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

Expected coverage: 80%+

### Run Specific Test Suites

```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Specific test file
npm test -- test/integration_test/booking.test.js

# With verbose output
npm run test:verbose
```


```

### Test Structure

```
test/
├── integration_test/         
│   ├── auth.test.js          
│   ├── event.test.js        
│   └── booking.test.js      
├── unit_test/                      
│   └── AuthService.test.js
    |---BokkingService.test.js
    |--EventService.test.js
└──          
```

### Test Coverage Report

After running tests with coverage, view the HTML report:

```bash
# Windows
start coverage/lcov-report/index.html

# Mac
open coverage/lcov-report/index.html

# Linux
xdg-open coverage/lcov-report/index.html
```

---

## 🏗️ Architecture

### Project Structure

```
event-booking-system/
├── src/
│   ├── config/             
│   │   ├── database.js     
│   │   ├── app.js          
│   │   └── auth.js         
│   ├── data/               
│   │   ├── EventRepository.js
│   │   ├── BookingRepository.js
│   │   ├── WaitingListRepository.js
│   │   └── UserRepository.js
│   ├── services/          
│   │   ├── EventService.js
│   │   ├── BookingService.js
│   │   └── AuthService.js
│   ├── controllers/        
│   │   ├── EventController.js
│   │   └── AuthController.js
│   ├── routes/           
│   │   ├── eventRoutes.js
│   │   └── authRoutes.js
│   ├── middleware/        
│   │   ├── auth.js       
│   │   ├── errorHandler.js
│   │   └── rateLimiter.js
│   ├── utils/            
│   │   ├── logger.js
│   │   └── errors.js   
│   └── server.js         
├── migrations/            
├── test/                 
├── postman_collection.json            
├── .env                  # to gitignore
├── .gitignore         
├── package.json         
└── README.md           
```

### Layered Architecture

```
│         Routes Layer                │  HTTP endpoint definitions

│      Controllers Layer              │  Request/Response handling

│       Services Layer                │  Business logic & transactions

│    Data Repository Layer            │  Database queries

│         MySQL Database              │  Data persistence

```

### Design Patterns

1. **Repository Pattern**: Data access abstraction
2. **Service Layer Pattern**: Business logic separation
3. **Dependency Injection**: Loose coupling between layers
4. **Transaction Script**: Database transaction management

---

## 🔒 Security Features

### 1. Authentication & Authorization

- **JWT Tokens**: Stateless authentication
- **Password Hashing**: Bcrypt with salt rounds (10)
- **Token Expiration**: Configurable (default 24h)
- **Protected Routes**: Middleware-based authorization

### 2. Rate Limiting

- **Default**: 100 requests per 15 minutes per IP
- **Configurable**: Adjust via environment variables
- **Response**: Returns 429 Too Many Requests when exceeded

### 3. Input Validation

- **Service Layer**: Business rule validation
- **Type Checking**: Strict type validation
- **SQL Injection Prevention**: Parameterized queries only

### 4. Database Security

- **Connection Pooling**: Prevents connection exhaustion
- **Prepared Statements**: All queries use placeholders
- **Row-Level Locking**: Prevents concurrent modification conflicts

---

## ⚡ Concurrency Handling

### Problem Statement

When multiple users try to book the last ticket simultaneously, we need to ensure:
1. Only one booking succeeds
2. Others are properly added to waiting list
3. No overselling occurs
4. No data corruption

### Solution: Pessimistic Locking

```
// Example: How booking works
const connection = await pool.getConnection();
await connection.beginTransaction();

try {
  // Lock the event row for update
  const event = await EventRepository.findByIdForUpdate(eventId, connection);
  
  if (event.available_tickets > 0) {
    // Create booking and decrement tickets atomically
    await BookingRepository.create(eventId, userId, connection);
    await EventRepository.decrementAvailableTickets(eventId, connection);
  } else {
    // Add to waiting list
    await WaitingListRepository.add(eventId, userId, connection);
  }
  
  await connection.commit();
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
}
```

### Key Features

1. **Database Transactions**: All operations are atomic
2. **FOR UPDATE**: Row-level locks prevent concurrent modifications
3. **Rollback on Error**: Failed operations don't corrupt data
4. **Sequential Processing**: Concurrent requests processed in order

### Performance Considerations

- **Transaction Duration**: Kept minimal to reduce lock contention
- **Connection Pooling**: Reuses connections efficiently
- **Indexed Queries**: Fast lookups with proper indexing
---

## 📊 Database Schema

### Events Table

```sql

CREATE TABLE events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    total_tickets INT NOT NULL,
    available_tickets INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_available_tickets (available_tickets)
) ENGINE=InnoDB;
```
### Bookings Table

```sql

CREATE TABLE bookings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_id INT NOT NULL,
    user_id INT NOT NULL,
    status ENUM('confirmed', 'cancelled') DEFAULT 'confirmed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    INDEX idx_event_user (event_id, user_id),
    INDEX idx_status (status),
    UNIQUE KEY unique_active_booking (event_id, user_id, status)
) ENGINE=InnoDB;
```

### Waiting List Table

```sql

CREATE TABLE waiting_list (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_id INT NOT NULL,
    user_id INT NOT NULL,
    position INT NOT NULL,
    status ENUM('waiting', 'promoted', 'expired') DEFAULT 'waiting',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    INDEX idx_event_position (event_id, position),
    INDEX idx_status (status),
    UNIQUE KEY unique_waiting_user (event_id, user_id, status)
) ENGINE=InnoDB;
```

### Users Table

```sql

CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_username (username)
) ENGINE=InnoDB;
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Write tests for new features
4. Ensure all tests pass: `npm test`
5. Ensure code coverage remains above 80%
6. Commit changes: `git commit -am 'Add feature'`
7. Push to branch: `git push origin feature-name`
8. Submit a pull request

### Code Style

- Use ES6+ features
- Follow existing code patterns
- Keep functions small and focused
- follow best practise 
---

---

**Built with ❤️ using Test-Driven Development**
