const express = require('express');
require('dotenv').config({ path: '.env.local' });
const authRoutes = require('./middleware/auth');
const { registerUser, get_api_key, revoke_api_key, regenerate_api_key } = require('./middleware/user_manager');
const { collectEvent, getEventSummary, getUserStats } = require('./controllers/analytics_controller');
const app = express();
const port = 3000;

app.use(express.json());

app.use('/auth', authRoutes);

app.post('/api/auth/register', registerUser);
app.get('/api/auth/api-key', get_api_key);
app.post('/api/auth/revoke-api-key', revoke_api_key);
app.post('/api/auth/regenerate-api-key', regenerate_api_key);

app.post('/api/analytics/collect', collectEvent);
app.get('/api/analytics/event-summary', getEventSummary);
app.get('/api/analytics/user-stats', getUserStats);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
