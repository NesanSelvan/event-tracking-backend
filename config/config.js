require('dotenv').config({ path: '.env.local' });

function googleAuthConfigEnv() {
    console.log(`Client ID: ${process.env.GOOGLE_CLIENT_ID}`);
    console.log(`Client Secret: ${process.env.GOOGLE_CLIENT_SECRET}`);
    console.log(`Callback URL: ${process.env.GOOGLE_CALLBACK_URL}`);
    return {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: process.env.GOOGLE_CALLBACK_URL,
    }
}

module.exports = { googleAuthConfigEnv };