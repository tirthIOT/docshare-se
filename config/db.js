const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create or open the SQLite database file in the root folder
const dbFile = path.join(__dirname, '..', 'filebox.db');
const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.log('Error opening database:', err.message);
  } else {
    console.log('SQLite database connected.');
  }
});

// Create tables when the server starts
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      saved_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      share_code TEXT UNIQUE,
      link_expiry DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
});

module.exports = db;