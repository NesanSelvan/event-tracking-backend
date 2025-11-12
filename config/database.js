require('dotenv').config({ path: '.env.local' });
console.log(process.env.DB_USER);
console.log(process.env.DB_HOST);
console.log(process.env.DB_NAME);
console.log(process.env.DB_PASSWORD);
console.log(process.env.DB_PORT);
const { Pool } = require('pg');

const client = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});


function runQuery(query, params) {
  return client.query(query, params);
}
// runQuery('insert into public.users (email, google_auth_id) values ($1, $2)', ['nesan@gmail.com', '44df4d4d4d4d4d4d4d4d4d4d4d4d4d4d']);


module.exports = { runQuery };