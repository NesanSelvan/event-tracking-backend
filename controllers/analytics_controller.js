const { runQuery } = require('../config/database');

async function collectEvent(req, res) {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required in x-api-key header'
      });
    }

    const keyQuery = await runQuery(
      `SELECT ak.application_id, ak.is_revoked, ak.expires_at
       FROM api_keys ak
       WHERE ak.api_key = $1`,
      [apiKey]
    );

    if (keyQuery.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const keyData = keyQuery.rows[0];

    if (keyData.is_revoked) {
      return res.status(403).json({
        error: 'API key has been revoked',
        message: 'Your API key has been revoked. Please regenerate a new key using the /api/auth/regenerate-api-key endpoint.',
        code: 'KEY_REVOKED'
      });
    }

    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      return res.status(403).json({
        error: 'API key has expired',
        message: 'Your API key has expired. Please regenerate a new key using the /api/auth/regenerate-api-key endpoint.',
        expired_at: keyData.expires_at,
        code: 'KEY_EXPIRED'
      });
    }

    const { event, user_id, url, referrer, device, ipAddress, timestamp, metadata } = req.body;

    if (!event) {
      return res.status(400).json({ error: 'Event name required' });
    }

    const eventTime = timestamp ? new Date(timestamp) : new Date();
    if (isNaN(eventTime.getTime())) {
      return res.status(400).json({ error: 'Invalid timestamp' });
    }

    const result = await runQuery(
      `INSERT INTO analytics_events ( application_id, event_name, user_id, url, referrer, device, ip_address, timestamp, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, timestamp`,
      [
        keyData.application_id,
        event,
        user_id,
        url,
        referrer,
        device,
        ipAddress,
        eventTime,
        metadata ? JSON.stringify(metadata) : null
      ]
    );

    res.status(201).json({
      success: true,
      event_id: result.rows[0].id,
      recorded_at: result.rows[0].timestamp
    });

  } catch (error) {
    console.error('Event collection failed:', error);
    res.status(500).json({ error: 'Failed to collect event' });
  }
}


async function getEventSummary(req, res) {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required in x-api-key header'
      });
    }

    const keyQuery = await runQuery(
      `SELECT ak.application_id, ak.is_revoked, ak.expires_at FROM api_keys ak
       WHERE ak.api_key = $1`,
      [apiKey]
    );

    if (keyQuery.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const keyData = keyQuery.rows[0];

    if (keyData.is_revoked) {
      return res.status(403).json({
        error: 'API key has been revoked',
        message: 'Your API key has been revoked. Please regenerate a new key using the /api/auth/regenerate-api-key endpoint.',
        code: 'KEY_REVOKED'
      });
    }

    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      return res.status(403).json({
        error: 'API key has expired',
        message: 'Your API key has expired. Please regenerate a new key using the /api/auth/regenerate-api-key endpoint.',
        expired_at: keyData.expires_at,
        code: 'KEY_EXPIRED'
      });
    }

    const { event, startDate, endDate } = req.body;

    if (!event) {
      return res.status(400).json({ error: 'Event name required' });
    }

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

    console.log('Query:', query);
    console.log('Params:', params);
    const result = await runQuery(query, params);
    console.log('Results:', result.rows);

    let totalCount = 0;
    let uniqueUsers = 0;
    const deviceData = {};

    result.rows.forEach(row => {
      totalCount += parseInt(row.count);
      uniqueUsers = Math.max(uniqueUsers, parseInt(row.unique_users));
      if (row.device) {
        deviceData[row.device] = parseInt(row.count);
      }
    });

    res.json({
      event,
      count: totalCount,
      uniqueUsers,
      deviceData
    });

  } catch (error) {
    console.error('Event summary failed:', error);
    res.status(500).json({ error: 'Failed to get summary' });
  }
}

async function getUserStats(req, res) {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required in x-api-key header'
      });
    }

    const keyQuery = await runQuery(
      `SELECT ak.application_id, ak.is_revoked, ak.expires_at
       FROM api_keys ak
       WHERE ak.api_key = $1`,
      [apiKey]
    );

    if (keyQuery.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const keyData = keyQuery.rows[0];

    if (keyData.is_revoked) {
      return res.status(403).json({
        error: 'API key has been revoked',
        message: 'Your API key has been revoked. Please regenerate a new key using the /api/auth/regenerate-api-key endpoint.',
        code: 'KEY_REVOKED'
      });
    }

    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      return res.status(403).json({
        error: 'API key has expired',
        message: 'Your API key has expired. Please regenerate a new key using the /api/auth/regenerate-api-key endpoint.',
        expired_at: keyData.expires_at,
        code: 'KEY_EXPIRED'
      });
    }

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const stats = await runQuery(
      `SELECT COUNT(*) as total_events, metadata, ip_address FROM analytics_events WHERE user_id = $1 AND application_id = $2
       GROUP BY metadata, ip_address ORDER BY total_events DESC LIMIT 1`,
      [userId, keyData.application_id]
    );

    if (stats.rows.length === 0) {
      return res.status(404).json({ error: 'No events found' });
    }

    const data = stats.rows[0];
    const meta = data.metadata || {};

    res.json({
      userId,
      totalEvents: parseInt(data.total_events),
      deviceDetails: {
        browser: meta.browser,
        os: meta.os
      },
      ipAddress: data.ip_address
    });

  } catch (error) {
    console.error('User stats failed:', error);
    res.status(500).json({ error: 'Failed to get user stats' });
  }
}

module.exports = {
  collectEvent,
  getEventSummary,
  getUserStats
};
