const mysql = require('mysql2/promise');

// Create the connection pool
const pool = mysql.createPool({
    host: 'srv864.hstgr.io',
    user: 'u596872099_vantage',
    password: 'Vantage1623',
    database: 'u596872099_vantage',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;
