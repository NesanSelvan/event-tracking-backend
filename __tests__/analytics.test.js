const request = require('supertest');
const express = require('express');
const { collectEvent, getEventSummary, getUserStats } = require('../controllers/analytics_controller');

const app = express();
app.use(express.json());
app.post('/api/analytics/collect', collectEvent);
app.get('/api/analytics/event-summary', getEventSummary);
app.get('/api/analytics/user-stats', getUserStats);

jest.mock('../config/database');
const { runQuery } = require('../config/database');

describe('Analytics Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/analytics/collect', () => {
    it('should return 401 when API key is missing', async () => {
      const response = await request(app)
        .post('/api/analytics/collect')
        .send({ event: 'test_event' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('API key required in x-api-key header');
    });

    it('should return 401 when API key is invalid', async () => {
      runQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/analytics/collect')
        .set('x-api-key', 'invalid_key')
        .send({ event: 'test_event' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid API key');
    });

    it('should return 403 when API key is revoked', async () => {
      runQuery.mockResolvedValueOnce({
        rows: [{
          application_id: 'app-123',
          is_revoked: true,
          expires_at: null
        }]
      });

      const response = await request(app)
        .post('/api/analytics/collect')
        .set('x-api-key', 'valid_key')
        .send({ event: 'test_event' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('API key has been revoked');
      expect(response.body.code).toBe('KEY_REVOKED');
    });

    it('should return 403 when API key is expired', async () => {
      const expiredDate = new Date('2020-01-01');
      runQuery.mockResolvedValueOnce({
        rows: [{
          application_id: 'app-123',
          is_revoked: false,
          expires_at: expiredDate
        }]
      });

      const response = await request(app)
        .post('/api/analytics/collect')
        .set('x-api-key', 'valid_key')
        .send({ event: 'test_event' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('API key has expired');
      expect(response.body.code).toBe('KEY_EXPIRED');
    });

    it('should return 400 when event name is missing', async () => {
      runQuery.mockResolvedValueOnce({
        rows: [{
          application_id: 'app-123',
          is_revoked: false,
          expires_at: new Date('2030-01-01')
        }]
      });

      const response = await request(app)
        .post('/api/analytics/collect')
        .set('x-api-key', 'valid_key')
        .send({ user_id: 'user123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Event name required');
    });

    it('should return 400 when timestamp is invalid', async () => {
      runQuery.mockResolvedValueOnce({
        rows: [{
          application_id: 'app-123',
          is_revoked: false,
          expires_at: new Date('2030-01-01')
        }]
      });

      const response = await request(app)
        .post('/api/analytics/collect')
        .set('x-api-key', 'valid_key')
        .send({
          event: 'test_event',
          timestamp: 'invalid-date'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid timestamp');
    });

    it('should successfully collect event', async () => {
      runQuery
        .mockResolvedValueOnce({
          rows: [{
            application_id: 'app-123',
            is_revoked: false,
            expires_at: new Date('2030-01-01')
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 'event-id-123',
            timestamp: new Date('2024-02-20T12:00:00Z')
          }]
        });

      const response = await request(app)
        .post('/api/analytics/collect')
        .set('x-api-key', 'valid_key')
        .send({
          event: 'button_click',
          user_id: 'user123',
          device: 'mobile',
          metadata: { browser: 'Chrome' }
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.event_id).toBe('event-id-123');
      expect(runQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe('GET /api/analytics/event-summary', () => {
    it('should return 401 when API key is missing', async () => {
      const response = await request(app)
        .get('/api/analytics/event-summary')
        .send({ event: 'test_event' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('API key required in x-api-key header');
    });

    it('should return 400 when event name is missing', async () => {
      runQuery.mockResolvedValueOnce({
        rows: [{
          application_id: 'app-123',
          is_revoked: false,
          expires_at: new Date('2030-01-01')
        }]
      });

      const response = await request(app)
        .get('/api/analytics/event-summary')
        .set('x-api-key', 'valid_key')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Event name required');
    });

    it('should return event summary successfully', async () => {
      runQuery
        .mockResolvedValueOnce({
          rows: [{
            application_id: 'app-123',
            is_revoked: false,
            expires_at: new Date('2030-01-01')
          }]
        })
        .mockResolvedValueOnce({
          rows: [
            { count: '50', unique_users: '25', device: 'mobile' },
            { count: '30', unique_users: '20', device: 'desktop' }
          ]
        });

      const response = await request(app)
        .get('/api/analytics/event-summary')
        .set('x-api-key', 'valid_key')
        .send({ event: 'button_click' });

      expect(response.status).toBe(200);
      expect(response.body.event).toBe('button_click');
      expect(response.body.count).toBe(80);
      expect(response.body.uniqueUsers).toBe(25);
      expect(response.body.deviceData).toEqual({
        mobile: 50,
        desktop: 30
      });
    });

    it('should handle date filtering', async () => {
      runQuery
        .mockResolvedValueOnce({
          rows: [{
            application_id: 'app-123',
            is_revoked: false,
            expires_at: new Date('2030-01-01')
          }]
        })
        .mockResolvedValueOnce({
          rows: [
            { count: '10', unique_users: '8', device: 'mobile' }
          ]
        });

      const response = await request(app)
        .get('/api/analytics/event-summary')
        .set('x-api-key', 'valid_key')
        .send({
          event: 'button_click',
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });

      expect(response.status).toBe(200);
      expect(runQuery).toHaveBeenCalledTimes(2);
      const queryCall = runQuery.mock.calls[1];
      expect(queryCall[1]).toContain('2024-01-01');
      expect(queryCall[1]).toContain('2024-12-31');
    });
  });

  describe('GET /api/analytics/user-stats', () => {
    it('should return 401 when API key is missing', async () => {
      const response = await request(app)
        .get('/api/analytics/user-stats')
        .send({ userId: 'user123' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('API key required in x-api-key header');
    });

    it('should return 400 when userId is missing', async () => {
      runQuery.mockResolvedValueOnce({
        rows: [{
          application_id: 'app-123',
          is_revoked: false,
          expires_at: new Date('2030-01-01')
        }]
      });

      const response = await request(app)
        .get('/api/analytics/user-stats')
        .set('x-api-key', 'valid_key')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('userId required');
    });

    it('should return 404 when no events found for user', async () => {
      runQuery
        .mockResolvedValueOnce({
          rows: [{
            application_id: 'app-123',
            is_revoked: false,
            expires_at: new Date('2030-01-01')
          }]
        })
        .mockResolvedValueOnce({
          rows: []
        });

      const response = await request(app)
        .get('/api/analytics/user-stats')
        .set('x-api-key', 'valid_key')
        .send({ userId: 'nonexistent' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('No events found');
    });

    it('should return user stats successfully', async () => {
      runQuery
        .mockResolvedValueOnce({
          rows: [{
            application_id: 'app-123',
            is_revoked: false,
            expires_at: new Date('2030-01-01')
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            total_events: '42',
            metadata: { browser: 'Chrome', os: 'iOS' },
            ip_address: '192.168.1.1'
          }]
        });

      const response = await request(app)
        .get('/api/analytics/user-stats')
        .set('x-api-key', 'valid_key')
        .send({ userId: 'user123' });

      expect(response.status).toBe(200);
      expect(response.body.userId).toBe('user123');
      expect(response.body.totalEvents).toBe(42);
      expect(response.body.deviceDetails.browser).toBe('Chrome');
      expect(response.body.deviceDetails.os).toBe('iOS');
      expect(response.body.ipAddress).toBe('192.168.1.1');
    });
  });
});
