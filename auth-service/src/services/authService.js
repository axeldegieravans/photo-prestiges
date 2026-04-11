const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

const ALLOWED_ROLES = ['PARTICIPANT', 'OWNER'];

const registerUser = async ({ name, email, password, role }) => {
  if (!name || !email || !password || !role) {
    const error = new Error('Name, email, password and role are required');
    error.statusCode = 400;
    throw error;
  }

  const normalizedRole = String(role).toUpperCase().trim();

  if (!ALLOWED_ROLES.includes(normalizedRole)) {
    const error = new Error('Role must be PARTICIPANT or OWNER');
    error.statusCode = 400;
    throw error;
  }

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    const error = new Error('User with this email already exists');
    error.statusCode = 409;
    throw error;
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
    const error = new Error('Email and password are required');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({ email });

  if (!user) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
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
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return user;
};

const getUsersBatch = async (userIds) => {
  if (!Array.isArray(userIds)) {
    const error = new Error('userIds must be an array');
    error.statusCode = 400;
    throw error;
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