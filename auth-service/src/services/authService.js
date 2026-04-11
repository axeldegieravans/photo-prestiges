const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { createHttpError } = require('../utils/httpError');

const ALLOWED_ROLES = ['PARTICIPANT', 'OWNER'];

const registerUser = async ({ name, email, password, role }) => {
  if (!name || !email || !password || !role) {
    throw createHttpError(400, 'Name, email, password and role are required');
  }

  const normalizedRole = String(role).toUpperCase().trim();

  if (!ALLOWED_ROLES.includes(normalizedRole)) {
    throw createHttpError(400, 'Role must be PARTICIPANT or OWNER');
  }

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw createHttpError(409, 'User with this email already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role: normalizedRole
  });

  const token = generateToken(user);

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    },
    token
  };
};

const loginUser = async ({ email, password }) => {
  if (!email || !password) {
    throw createHttpError(400, 'Email and password are required');
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw createHttpError(401, 'Invalid credentials');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw createHttpError(401, 'Invalid credentials');
  }

  const token = generateToken(user);

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    },
    token
  };
};

const getCurrentUser = async (userId) => {
  const user = await User.findById(userId).select('-password');

  if (!user) {
    throw createHttpError(404, 'User not found');
  }

  return user;
};

const getUsersBatch = async (userIds) => {
  if (!Array.isArray(userIds)) {
    throw createHttpError(400, 'userIds must be an array');
  }

  const normalizedUserIds = [
    ...new Set(
      userIds
        .map((userId) => String(userId).trim())
        .filter(Boolean)
    )
  ];

  if (normalizedUserIds.length === 0) {
    return {
      items: [],
      missingUserIds: []
    };
  }

  const validObjectIds = normalizedUserIds.filter((userId) =>
    mongoose.Types.ObjectId.isValid(userId)
  );

  if (validObjectIds.length === 0) {
    return {
      items: [],
      missingUserIds: normalizedUserIds
    };
  }

  const users = await User.find({
    _id: { $in: validObjectIds }
  }).select('_id name email role');

  const userMap = new Map(
    users.map((user) => [
      String(user._id),
      {
        userId: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role
      }
    ])
  );

  const items = normalizedUserIds
    .map((userId) => userMap.get(userId))
    .filter(Boolean);

  const missingUserIds = normalizedUserIds.filter(
    (userId) => !userMap.has(userId)
  );

  return {
    items,
    missingUserIds
  };
};

module.exports = {
  registerUser,
  loginUser,
  getCurrentUser,
  getUsersBatch
};
