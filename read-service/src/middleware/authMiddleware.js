const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const error = new Error('Authorization token is required');
    error.statusCode = 401;
    return next(error);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.userId || !decoded.role) {
      const error = new Error('Token payload is invalid');
      error.statusCode = 401;
      return next(error);
    }

    req.user = {
      userId: String(decoded.userId),
      role: String(decoded.role).toUpperCase(),
      email: decoded.email
    };

    next();
  } catch (err) {
    const error = new Error('Invalid or expired token');
    error.statusCode = 401;
    next(error);
  }
};

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      const error = new Error('Unauthorized');
      error.statusCode = 401;
      return next(error);
    }

    const normalizedAllowedRoles = allowedRoles.map((role) =>
      String(role).toUpperCase()
    );

    if (!normalizedAllowedRoles.includes(req.user.role)) {
      const error = new Error('Forbidden');
      error.statusCode = 403;
      return next(error);
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorizeRoles
};