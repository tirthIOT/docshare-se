require('dotenv').config();
const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const db = require('./config/db');
const checkAuth = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer to save files in /uploads with unique names
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + uuidv4() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB limit
});

// 1. Register a new user
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username.trim(), hashedPassword],
      function (err) {
        if (err) {
          return res.status(400).json({ error: 'Username already exists.' });
        }
        res.status(201).json({ message: 'Account created successfully.' });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Registration failed.' });
  }
});

// 2. Login existing user
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.SECRET_KEY,
      { expiresIn: '12h' }
    );
    res.json({ token: token, username: user.username });
  });
});

// 3. Upload a file (Protected route)
app.post('/api/upload', checkAuth, upload.single('myFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file selected.' });
  }

  const { originalname, filename, size } = req.file;
  db.run(
    'INSERT INTO files (user_id, file_name, saved_name, file_size) VALUES (?, ?, ?, ?)',
    [req.user.id, originalname, filename, size],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Database error while saving file.' });
      }
      res.status(201).json({ message: 'File uploaded.', id: this.lastID });
    }
  );
});

// 4. Get all files for the logged-in user (Protected route)
app.get('/api/files', checkAuth, (req, res) => {
  db.all(
    'SELECT id, file_name, file_size, share_code, link_expiry, created_at FROM files WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.id],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Could not load files.' });
      }
      res.json(rows);
    }
  );
});

// 5. Private download for file owner (Protected route)
app.get('/api/files/:id/download', checkAuth, (req, res) => {
  db.get(
    'SELECT * FROM files WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id],
    (err, file) => {
      if (err || !file) {
        return res.status(404).json({ error: 'File not found.' });
      }
      const fullPath = path.join(__dirname, 'uploads', file.saved_name);
      res.download(fullPath, file.file_name);
    }
  );
});

// 6. Generate a 24-hour public share link (Protected route)
app.post('/api/files/:id/share', checkAuth, (req, res) => {
  const code = uuidv4();
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  db.run(
    'UPDATE files SET share_code = ?, link_expiry = ? WHERE id = ? AND user_id = ?',
    [code, expiry, req.params.id, req.user.id],
    function (err) {
      if (err || this.changes === 0) {
        return res.status(404).json({ error: 'File not found.' });
      }
      const link = req.protocol + '://' + req.get('host') + '/share/' + code;
      res.json({ shareLink: link, expiresAt: expiry });
    }
  );
});

// 7. Public download route (No login required)
app.get('/share/:code', (req, res) => {
  db.get('SELECT * FROM files WHERE share_code = ?', [req.params.code], (err, file) => {
    if (err || !file) {
      return res.status(404).send('<h3>404 - Invalid share link.</h3>');
    }

    if (file.link_expiry && new Date(file.link_expiry) < new Date()) {
      return res.status(410).send('<h3>410 - This link has expired.</h3>');
    }

    const fullPath = path.join(__dirname, 'uploads', file.saved_name);
    res.download(fullPath, file.file_name);
  });
});

// 8. Delete file from disk and database (Protected route)
app.delete('/api/files/:id', checkAuth, (req, res) => {
  db.get(
    'SELECT * FROM files WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id],
    (err, file) => {
      if (err || !file) {
        return res.status(404).json({ error: 'File not found.' });
      }

      const fullPath = path.join(__dirname, 'uploads', file.saved_name);
      fs.unlink(fullPath, () => {
        db.run('DELETE FROM files WHERE id = ?', [req.params.id], () => {
          res.json({ message: 'File deleted.' });
        });
      });
    }
  );
});

app.listen(PORT, () => {
  console.log('File sharing and storage cloud server started on http://localhost:' + PORT);
});