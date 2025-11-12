const { OAuth2Client } = require('google-auth-library');
require('dotenv').config({ path: '.env.local' });

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verifyToken(token) {
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
}

module.exports = { verifyToken };
