const jwt = require('jsonwebtoken');

const generateToken = require('../src/utils/generateToken');
const { authenticate, authorizeRoles } = require('../src/middleware/authMiddleware');

const createRes = () => {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
};

test('generateToken signs the expected user payload', () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRES_IN = '2h';

  const token = generateToken({
    _id: 'user-1',
    email: 'test@example.com',
    role: 'OWNER'
  });

  const decoded = jwt.verify(token, 'test-secret');

  expect(decoded.userId).toBe('user-1');
  expect(decoded.email).toBe('test@example.com');
  expect(decoded.role).toBe('OWNER');
});

test('authenticate rejects requests without a bearer token', () => {
  const req = { headers: {} };
  const res = createRes();
  let error;

  authenticate(req, res, (err) => {
    error = err;
  });

  expect(res.statusCode).toBe(401);
  expect(res.body.message).toBe('No token provided');
  expect(req.user).toBeUndefined();
  expect(error).toBeUndefined();
});

test('authorizeRoles allows matching roles and blocks others', () => {
  const req = { user: { role: 'OWNER' } };
  const res = createRes();
  let nextCalled = false;

  authorizeRoles('OWNER')(req, res, (err) => {
    expect(err).toBeUndefined();
    nextCalled = true;
  });

  expect(nextCalled).toBe(true);

  let forbiddenError;
  authorizeRoles('PARTICIPANT')(
    { user: { role: 'OWNER' } },
    res,
    (err) => {
      forbiddenError = err;
    }
  );

  expect(res.statusCode).toBe(403);
  expect(res.body.message).toBe('Forbidden');
  expect(forbiddenError).toBeUndefined();
});
