const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const { runQuery } = require('../config/database');
require('dotenv').config({ path: '.env.local' });

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verifyGoogleToken(token) {
  try {
    console.log('Verifying token:', token.substring(0, 50) + '...');
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    console.log('Token verified successfully for:', payload.email);
    return {
      google_id: payload['sub'],
      email: payload['email'],
      name: payload['name'],
      verified: true
    };
  } catch (error) {
    console.error('Token verification failed:', error.message);
    console.error('Make sure you are using the id_token, not access_token');
    return { verified: false, error: error.message };
  }
}

async function registerUser(req, res) {
  try {
    const authHeader = req.headers.authorization;
    const { app_name, domain } = req.body;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(400).json({ error: 'Authorization header with Bearer token is required' });
    }

    const token = authHeader.split(' ')[1];
    const userData = await verifyGoogleToken(token);

    if (!userData.verified) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    const { google_id, email, name } = userData;

    const userResult = await runQuery(
      `INSERT INTO users (google_auth_id, email, created_at, name)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (google_auth_id)
       DO UPDATE SET email = $2
       RETURNING id`,
      [google_id, email, name]
    );

    const user_id = userResult.rows[0].id;

    const appResult = await runQuery(
      `INSERT INTO applications (user_id, name, domain, created_at)
       VALUES ($1, $2, $3, NOW())
       on conflict (user_id)
       do update set name = $2, domain = $3
       RETURNING id, name, domain, created_at`,
      [user_id, app_name || 'My Application', domain || '']
    );

    const application = appResult.rows[0];

    const api_key = generate_api_key();

    await runQuery(
      `INSERT INTO api_keys (application_id, api_key, is_revoked, expires_at, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (application_id)
       DO UPDATE SET api_key = $2, is_revoked = $3, expires_at = $4`,
      [application.id, api_key, false, new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)]
    );

    res.status(200).json({
      success: true,
      user: {
        id: user_id,
        google_id,
        email,
        name
      },
      application: {
        id: application.id,
        name: application.name,
        domain: application.domain,
        created_at: application.created_at
      },
      api_key
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
}

function generate_api_key() {
  return crypto.randomBytes(32).toString('hex');
}
async function get_api_key(req, res) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(400).json({ error: 'Authorization header with Bearer token is required' });
    }

    const token = authHeader.split(' ')[1];
    const userData = await verifyGoogleToken(token);

    if (!userData.verified) {
      return res.status(401).json({ error: 'Unauthorized: Invalid Google token' });
    }

    const { google_id, email } = userData;

    const userResult = await runQuery(
      `SELECT id FROM users WHERE google_auth_id = $1`,
      [google_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found. Please register first.' });
    }

    const user_id = userResult.rows[0].id;

    const apiKeyResult = await runQuery(
      `SELECT ak.api_key, ak.is_revoked, ak.expires_at, ak.created_at,
              a.id as application_id, a.name as app_name, a.domain
       FROM api_keys ak
       JOIN applications a ON ak.application_id = a.id
       WHERE a.user_id = $1 AND ak.is_revoked = false
       ORDER BY ak.created_at DESC`,
      [user_id]
    );

    if (apiKeyResult.rows.length === 0) {
      return res.status(404).json({ error: 'No API keys found for this user' });
    }

    res.status(200).json({
      success: true,
      user: {
        google_id,
        email
      },
      api_keys: apiKeyResult.rows
    });

  } catch (error) {
    console.error('Get API key error:', error);
    res.status(500).json({ error: 'Failed to retrieve API keys', details: error.message });
  }
}
async function revoke_api_key(req, res) {
  const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(400).json({ error: 'Authorization header with Bearer token is required' });
    }

    const token = authHeader.split(' ')[1];
    const userData = await verifyGoogleToken(token);

    if (!userData.verified) {
      return res.status(401).json({ error: 'Unauthorized: Invalid Google token' });
    }
  const { google_id, email } = userData;
  const userResult = await runQuery(
    `SELECT id FROM users WHERE google_auth_id = $1`,
    [google_id]
  );
  if (userResult.rows.length === 0) {
    return res.status(404).json({ error: 'User not found. Please register first.' });
  }
  const user_id = userResult.rows[0].id;
  const applicationResult = await runQuery(
    `SELECT id FROM applications WHERE user_id = $1`,
    [user_id]
  );
  if (applicationResult.rows.length === 0) {
    return res.status(404).json({ error: 'Application not found. Please create an application first.' });
  }
  const application_id = applicationResult.rows[0].id;
  const apiKeyResult = await runQuery(
    `UPDATE api_keys SET is_revoked = true WHERE application_id = $1`,
    [application_id]
  );
  if (apiKeyResult.rowCount === 0) {
    return res.status(404).json({ error: 'API key not found. Please generate an API key first.' });
  }
  res.status(200).json({ success: true, message: 'API key revoked successfully' });
}
module.exports = { registerUser, get_api_key, revoke_api_key };