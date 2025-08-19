const mysql = require('mysql2/promise');

// const pool = mysql.createPool({
//   host: 'localhost',
//   user: 'root',
//   password: '',
//   database: 'intranet',
//   waitForConnections: true,
//   connectionLimit: 10
// });

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'intranet',
});

module.exports = pool;


