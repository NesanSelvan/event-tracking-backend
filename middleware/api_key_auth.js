const { runQuery } = require('../config/database');

async function validateApiKey(req, res, next) {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key is required in x-api-key header'
      });
    }

    const result = await runQuery(
      `SELECT ak.id, ak.application_id, ak.is_revoked, ak.expires_at,
              a.id as app_id, a.name as app_name, a.domain
       FROM api_keys ak
       JOIN applications a ON ak.application_id = a.id
       WHERE ak.api_key = $1 AND ak.is_revoked = false AND ak.expires_at > NOW()`,
      [apiKey]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key'
      });
    }

    const apiKeyData = result.rows[0];

    if (apiKeyData.is_revoked) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key has been revoked'
      });
    }

    if (apiKeyData.expires_at && new Date(apiKeyData.expires_at) < new Date()) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key has expired'
      });
    }

    req.application = {
      id: apiKeyData.application_id,
      name: apiKeyData.app_name,
      domain: apiKeyData.domain
    };

    next();
  } catch (error) {
    console.error('API Key validation error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to validate API key'
    });
  }
}

module.exports = { validateApiKey };
