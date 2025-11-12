# Event Tracking Backend

## Live Deployment

**Production URL:** https://event-tracking-backend-uhh9.onrender.com

**API Documentation:** https://app.swaggerhub.com/apis/nesan/event-tracking-backend-api/1.0.0

## Overview

This is a production-ready event analytics engine that provides:
- Google OAuth authentication for user management
- API key generation and management system
- Event collection from multiple platforms
- Real-time analytics and reporting
- RESTful API with comprehensive error handling

## Features Implemented

### 1. Authentication System
- **Google OAuth Integration**: Secure user authentication using Google Sign-In
- **Token Verification**: Server-side validation of Google ID tokens
- **User Registration**: Automatic user and application creation on first login
- **API Key Management**: Generate, retrieve, and revoke API keys

### 2. Event Collection
- **Multi-Platform Support**: Track events from web and mobile applications
- **Flexible Event Schema**: Support for custom metadata and device information
- **Timestamp Handling**: Automatic and manual timestamp support
- **IP Address Tracking**: Capture user IP addresses for analytics

### 3. Analytics & Reporting
- **Event Summary**: Get aggregated counts by event name with date filtering
- **User Statistics**: Track individual user behavior and device details
- **Device Analytics**: Break down events by device type
- **Unique User Counting**: Accurate unique user metrics

### 4. Security Features
- **API Key Authentication**: Secure endpoints using x-api-key header
- **Key Expiration**: Automatic expiration handling for API keys
- **Key Revocation**: Ability to revoke compromised keys
- **Input Validation**: Comprehensive validation of all inputs

### 5. Database Design
- **PostgreSQL with Supabase**: Cloud-hosted database with connection pooling
- **UUID Primary Keys**: Scalable identifier system
- **Foreign Key Constraints**: Data integrity enforcement

## Tech Stack

- **Runtime**: Node.js 18
- **Framework**: Express.js 5
- **Database**: PostgreSQL (Supabase)
- **Authentication**: Google OAuth 2.0
- **Deployment**: Render (Docker)
- **Version Control**: Git/GitHub

## API Endpoints

### Authentication Endpoints

**Google OAuth Callback**
```
GET /auth/google/callback
Returns: { success, message, id_token, access_token, expires_in }
```

**Register User**
```
POST /api/auth/register
Headers: Authorization: Bearer <id_token>
Body: { app_name, domain }
Returns: { success, user, application, api_key }
```

**Get API Key**
```
GET /api/auth/api-key
Headers: Authorization: Bearer <id_token>
Returns: { success, user, api_keys[] }
```

**Revoke API Key**
```
POST /api/auth/revoke-api-key
Headers: Authorization: Bearer <id_token>
Returns: { success, message }
```

### Analytics Endpoints

**Collect Event**
```
POST /api/analytics/collect
Headers: x-api-key: <api_key>
Body: {
  event: "event_name",
  user_id: "user123",
  url: "https://example.com",
  referrer: "https://google.com",
  device: "mobile",
  ipAddress: "192.168.1.1",
  timestamp: "2024-02-20T12:00:00Z",
  metadata: { browser: "Chrome", os: "iOS" }
}
Returns: { success, event_id, recorded_at }
```

**Get Event Summary**
```
GET /api/analytics/event-summary
Headers: x-api-key: <api_key>
Body: {
  event: "event_name",
  startDate: "2024-01-01",
  endDate: "2024-12-31"
}
Returns: { event, count, uniqueUsers, deviceData }
```

**Get User Stats**
```
GET /api/analytics/user-stats
Headers: x-api-key: <api_key>
Body: { userId: "user123" }
Returns: { userId, totalEvents, deviceDetails, ipAddress }
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_auth_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Applications Table
```sql
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
```

### API Keys Table
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  api_key VARCHAR(255) UNIQUE NOT NULL,
  is_revoked BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(application_id)
);
```

### Analytics Events Table
```sql
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  event_name VARCHAR(255) NOT NULL,
  user_id VARCHAR(255),
  url TEXT,
  referrer TEXT,
  device VARCHAR(100),
  ip_address VARCHAR(45),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX idx_events_app_name ON analytics_events(application_id, event_name);
CREATE INDEX idx_events_user ON analytics_events(user_id);
CREATE INDEX idx_events_timestamp ON analytics_events(timestamp);
```

## Installation & Running Locally

### Prerequisites
- Node.js 18 or higher
- PostgreSQL database (or Supabase account)
- Google OAuth credentials

### Step 1: Clone Repository
```bash
git clone https://github.com/NesanSelvan/event-tracking-backend.git
cd event-tracking-backend
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Create a `.env.local` file:
```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

DB_HOST=your_database_host
DB_PORT=5432
DB_NAME=postgres
DB_USER=your_database_user
DB_PASSWORD=your_database_password

SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

### Step 4: Set Up Database
Run the SQL schema from the Database Schema section above to create all tables.

### Step 5: Run Application
```bash
npm start
```

The application will be available at `http://localhost:3000`

## Running with Docker

### Using Docker Compose
```bash
docker compose up --build
```

### Using Docker Manually
```bash
docker build -t event-tracking-backend .
docker run -p 3000:3000 --env-file .env.local event-tracking-backend
```

## Deployment to Render

### Option 1: Using Blueprint (Automated)
1. Push code to GitHub
2. Go to Render Dashboard
3. Click "New" → "Blueprint"
4. Connect your repository
5. Render auto-detects `render.yaml` and deploys

### Option 2: Manual Deployment
1. Create PostgreSQL database on Render
2. Create Web Service with Node runtime
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variables
6. Deploy


## Challenges Faced & Solutions

### Dynamic Query Building with Date Filters

**Challenge**:

When implementing the event summary endpoint with optional date range filtering, I encountered a complex issue with dynamically building PostgreSQL queries. The endpoint needed to support three scenarios:
- Events without any date filters (all time)
- Events with only a start date
- Events with both start and end dates

The challenge was constructing parameterized queries dynamically while maintaining proper parameter indexing ($1, $2, $3, etc.) to prevent SQL injection. Initial attempts resulted in incorrect parameter indices, causing PostgreSQL errors like "bind message supplies 3 parameters, but prepared statement requires 4".

Additionally, date type conversion was problematic - passing date strings directly wasn't working with timestamp comparisons, and explicit type casting (::timestamptz) caused query failures.

**Solution Implemented**:

Implemented a dynamic query builder with proper parameter indexing:

```javascript
let query = `
  SELECT COUNT(*) as count, COUNT(DISTINCT user_id) as unique_users, device
  FROM analytics_events
  WHERE event_name = $1 AND application_id = $2
`;
const params = [event, keyData.application_id];
let paramIndex = 3;

if (startDate) {
  query += ` AND timestamp >= $${paramIndex}`;
  params.push(startDate);
  paramIndex++;
}

if (endDate) {
  query += ` AND timestamp <= $${paramIndex}`;
  params.push(endDate);
  paramIndex++;
}

query += ` GROUP BY device`;
const result = await runQuery(query, params);
```

## Testing the API

### Using cURL

**1. Get OAuth Tokens**
```bash
# Visit in browser
https://event-tracking-backend-uhh9.onrender.com/auth/google
```

**2. Register User**
```bash
curl -X POST https://event-tracking-backend-uhh9.onrender.com/api/auth/register \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"app_name":"My App","domain":"example.com"}'
```

**3. Collect Event**
```bash
curl -X POST https://event-tracking-backend-uhh9.onrender.com/api/analytics/collect \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "button_click",
    "user_id": "user123",
    "device": "mobile",
    "metadata": {"button": "submit"}
  }'
```

**4. Get Event Summary**
```bash
curl -X GET https://event-tracking-backend-uhh9.onrender.com/api/analytics/event-summary \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "button_click",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31"
  }'
```


**Developer**: Nesan Selvan
**Repository**: https://github.com/NesanSelvan/event-tracking-backend
**Live URL**: https://event-tracking-backend-uhh9.onrender.com

---

