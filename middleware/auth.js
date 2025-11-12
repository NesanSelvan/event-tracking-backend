const router = require('express').Router();
const axios = require('axios');
require('dotenv').config({ path: '.env.local' });
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_CALLBACK_URL;

router.get('/google', (req, res) => {
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=profile email`;
    res.redirect(url);
  });

router.get('/google/callback', async (req, res) => {
    console.log('Full callback URL:', req.url);
    console.log('Query params:', req.query);
    const { code } = req.query;
    console.log('Extracted code:', code);

    if (!code) {
      console.error('No authorization code received!');
      return res.redirect('/login?error=no_code');
    }

    try {
      const params = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      });

      const { data } = await axios.post('https://oauth2.googleapis.com/token', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      console.log('Token data:', data);

      res.json({
        success: true,
        message: 'Use this id_token in /register endpoint',
        id_token: data.id_token,
        access_token: data.access_token,
        expires_in: data.expires_in
      });
    } catch (error) {
      console.log('Error:', error);
      if (error?.response?.data) {
        console.error('Google OAuth Error Response:', JSON.stringify(error.response.data, null, 2));
      }
      if (error?.response?.status) {
        console.error('Status Code:', error.response.status);
      }
      console.error('Request details - Code:', code, 'Redirect URI:', REDIRECT_URI);
      res.redirect('/login');
    }
  });

  router.get('/logout', (req, res) => {
    res.redirect('/login');
  });

  module.exports = router;
