const jwt = require('jsonwebtoken');

function checkAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  // Header format is "Bearer <token>"
  if (!authHeader) {
    return res.status(401).json({ error: 'Access denied. Login required.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token missing.' });
  }

  jwt.verify(token, process.env.SECRET_KEY, (err, userData) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired session.' });
    }
    
    // Attach the decoded user info (id, username) to the request object
    req.user = userData;
    next();
  });
}

module.exports = checkAuth;