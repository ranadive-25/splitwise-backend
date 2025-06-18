require('dotenv').config();

const { Pool } = require('pg');

// Use DATABASE_URL from Render environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Render's managed PostgreSQL
  },
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
