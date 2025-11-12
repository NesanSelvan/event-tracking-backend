const request = require('supertest');
const express = require('express');
const { registerUser, get_api_key, revoke_api_key, regenerate_api_key } = require('../middleware/user_manager');

const app = express();
app.use(express.json());
app.post('/api/auth/register', registerUser);
app.get('/api/auth/api-key', get_api_key);
app.post('/api/auth/revoke-api-key', revoke_api_key);
app.post('/api/auth/regenerate-api-key', regenerate_api_key);

jest.mock('../config/database');
const { runQuery } = require('../config/database');

jest.mock('google-auth-library');
const { OAuth2Client } = require('google-auth-library');

describe('User Manager Endpoints', () => {
  let mockVerifyIdToken;

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyIdToken = jest.fn();
    OAuth2Client.mockImplementation(() => ({
      verifyIdToken: mockVerifyIdToken
    }));
  });

  describe('POST /api/auth/register', () => {
    it('should return 400 when authorization header is missing', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ app_name: 'Test App' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Authorization header with Bearer token is required');
    });

    it('should return 401 when token is invalid', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));

      const response = await request(app)
        .post('/api/auth/register')
        .set('Authorization', 'Bearer invalid_token')
        .send({ app_name: 'Test App' });

      expect(response.status).toBe(401);
    });

    it('should successfully register user and create application', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google_user_123',
          email: 'test@example.com',
          name: 'Test User'
        })
      });

      runQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'user-uuid-123' }]
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 'app-uuid-123',
            name: 'Test App',
            domain: 'example.com',
            created_at: new Date()
          }]
        })
        .mockResolvedValueOnce({
          rows: []
        });

      const response = await request(app)
        .post('/api/auth/register')
        .set('Authorization', 'Bearer valid_token')
        .send({
          app_name: 'Test App',
          domain: 'example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.application.name).toBe('Test App');
      expect(response.body.api_key).toBeDefined();
      expect(runQuery).toHaveBeenCalledTimes(3);
    });
  });

  describe('GET /api/auth/api-key', () => {
    it('should return 400 when authorization header is missing', async () => {
      const response = await request(app)
        .get('/api/auth/api-key');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Authorization header with Bearer token is required');
    });

    it('should return 404 when user not found', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google_user_123',
          email: 'test@example.com'
        })
      });

      runQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/auth/api-key')
        .set('Authorization', 'Bearer valid_token');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found. Please register first.');
    });

    it('should return 404 when no API keys found', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google_user_123',
          email: 'test@example.com'
        })
      });

      runQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'user-uuid-123' }]
        })
        .mockResolvedValueOnce({
          rows: []
        });

      const response = await request(app)
        .get('/api/auth/api-key')
        .set('Authorization', 'Bearer valid_token');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('No API keys found for this user');
    });

    it('should successfully retrieve API keys', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google_user_123',
          email: 'test@example.com'
        })
      });

      runQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'user-uuid-123' }]
        })
        .mockResolvedValueOnce({
          rows: [{
            api_key: 'test_api_key_123',
            is_revoked: false,
            created_at: new Date(),
            expires_at: new Date('2030-01-01'),
            application_id: 'app-uuid-123',
            app_name: 'Test App',
            domain: 'example.com'
          }]
        });

      const response = await request(app)
        .get('/api/auth/api-key')
        .set('Authorization', 'Bearer valid_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.api_keys).toHaveLength(1);
      expect(response.body.api_keys[0].api_key).toBe('test_api_key_123');
    });
  });

  describe('POST /api/auth/revoke-api-key', () => {
    it('should return 400 when authorization header is missing', async () => {
      const response = await request(app)
        .post('/api/auth/revoke-api-key');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Authorization header with Bearer token is required');
    });

    it('should return 404 when API key not found', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google_user_123',
          email: 'test@example.com'
        })
      });

      runQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'user-uuid-123' }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'app-uuid-123' }]
        })
        .mockResolvedValueOnce({
          rowCount: 0
        });

      const response = await request(app)
        .post('/api/auth/revoke-api-key')
        .set('Authorization', 'Bearer valid_token');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('API key not found. Please generate an API key first.');
    });

    it('should successfully revoke API key', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google_user_123',
          email: 'test@example.com'
        })
      });

      runQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'user-uuid-123' }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'app-uuid-123' }]
        })
        .mockResolvedValueOnce({
          rowCount: 1
        });

      const response = await request(app)
        .post('/api/auth/revoke-api-key')
        .set('Authorization', 'Bearer valid_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('API key revoked successfully');
    });
  });

  describe('POST /api/auth/regenerate-api-key', () => {
    it('should return 400 when authorization header is missing', async () => {
      const response = await request(app)
        .post('/api/auth/regenerate-api-key');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Authorization header with Bearer token is required');
    });

    it('should return 404 when user not found', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google_user_123',
          email: 'test@example.com'
        })
      });

      runQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/auth/regenerate-api-key')
        .set('Authorization', 'Bearer valid_token');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found. Please register first.');
    });

    it('should successfully regenerate API key', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google_user_123',
          email: 'test@example.com'
        })
      });

      runQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'user-uuid-123' }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'app-uuid-123' }]
        })
        .mockResolvedValueOnce({
          rows: [{
            api_key: 'new_api_key_456',
            created_at: new Date(),
            expires_at: new Date('2030-01-01')
          }]
        });

      const response = await request(app)
        .post('/api/auth/regenerate-api-key')
        .set('Authorization', 'Bearer valid_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('API key regenerated successfully');
      expect(response.body.api_key).toBe('new_api_key_456');
      expect(response.body.created_at).toBeDefined();
      expect(response.body.expires_at).toBeDefined();
    });
  });
});
