const Registration = require('../models/Registration');
const TargetRegistrationState = require('../models/TargetRegistrationState');
const {
  assertParticipant,
  assertOwner,
  validateRegistrationId,
  fetchTargetById,
  assertTargetOwner,
  validateTargetForRegistration
} = require('./registrationValidationService');
const { normalizePagination } = require('../utils/pagination');
const {
  publishRegistrationCreated,
  publishRegistrationDeleted
} = require('./registrationEventPublisher');

const createRegistration = async ({ targetId, user }) => {
  assertParticipant(user);

  if (!targetId) {
    const error = new Error('targetId is required');
    error.statusCode = 400;
    throw error;
  }

  const participantId = user.userId;
  const target = await validateTargetForRegistration(targetId);

  if (String(target.ownerId) === String(participantId)) {
    const error = new Error('You cannot register for your own target');
    error.statusCode = 403;
    throw error;
  }

  const targetState = await TargetRegistrationState.findOneAndUpdate(
    { targetId },
    {
      $setOnInsert: {
        targetId,
        registrationsOpen: true,
        closedAt: null
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  if (!targetState.registrationsOpen) {
    const error = new Error('Registrations for this target are closed');
    error.statusCode = 403;
    throw error;
  }

  try {
    const registration = await Registration.create({
      targetId,
      participantId
    });

    try {
      await publishRegistrationCreated({
        registration,
        user
      });
    } catch (error) {
      console.warn(
        '[register-service] Registration created, but failed to publish registration-created event:',
        error.message
      );
    }

    return registration;
  } catch (err) {
    if (err.code === 11000) {
      const error = new Error('You are already registered for this target');
      error.statusCode = 409;
      throw error;
    }

    throw err;
  }
};

const getMyRegistrations = async ({ user, page, limit }) => {
  assertParticipant(user);

  const participantId = user.userId;

  const {
    skip,
    page: normalizedPage,
    limit: normalizedLimit
  } = normalizePagination(page, limit);

  const [registrations, total] = await Promise.all([
    Registration.find({ participantId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(normalizedLimit),
    Registration.countDocuments({ participantId })
  ]);

  return {
    items: registrations,
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      pages: Math.ceil(total / normalizedLimit) || 1
    }
  };
};

const getRegistrationsByTarget = async ({ targetId, user, page, limit }) => {
  assertOwner(user);

  if (!targetId) {
    const error = new Error('targetId is required');
    error.statusCode = 400;
    throw error;
  }

  const target = await fetchTargetById(targetId);
  assertTargetOwner(target, user);

  const {
    skip,
    page: normalizedPage,
    limit: normalizedLimit
  } = normalizePagination(page, limit);

  const [registrations, total, targetState] = await Promise.all([
    Registration.find({ targetId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(normalizedLimit),
    Registration.countDocuments({ targetId }),
    TargetRegistrationState.findOne({ targetId })
  ]);

  return {
    targetId,
    registrationsOpen: targetState ? targetState.registrationsOpen : true,
    closedAt: targetState ? targetState.closedAt : null,
    items: registrations,
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      pages: Math.ceil(total / normalizedLimit) || 1
    }
  };
};

const deleteRegistration = async ({ registrationId, user }) => {
  assertParticipant(user);

  validateRegistrationId(registrationId);

  const registration = await Registration.findById(registrationId);

  if (!registration) {
    const error = new Error('Registration not found');
    error.statusCode = 404;
    throw error;
  }

  const isParticipant = String(registration.participantId) === String(user.userId);

  if (!isParticipant) {
    const error = new Error('You can only delete your own registration');
    error.statusCode = 403;
    throw error;
  }

  await registration.deleteOne();

  try {
    await publishRegistrationDeleted({
      registration,
      user
    });
  } catch (error) {
    console.warn(
      '[register-service] Registration deleted, but failed to publish registration-deleted event:',
      error.message
    );
  }

  return {
    message: 'Registration deleted successfully'
  };
};

const closeRegistrationsForTarget = async ({ targetId, user }) => {
  assertOwner(user);

  if (!targetId) {
    const error = new Error('targetId is required');
    error.statusCode = 400;
    throw error;
  }

  const target = await fetchTargetById(targetId);
  assertTargetOwner(target, user);

  const targetState = await TargetRegistrationState.findOneAndUpdate(
    { targetId },
    {
      $set: {
        registrationsOpen: false,
        closedAt: new Date()
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  return targetState;
};

const closeRegistrationsForTargetInternal = async ({ targetId, closedAt }) => {
  if (!targetId) {
    const error = new Error('targetId is required');
    error.statusCode = 400;
    throw error;
  }

  const parsedClosedAt = closedAt ? new Date(closedAt) : new Date();

  if (Number.isNaN(parsedClosedAt.getTime())) {
    const error = new Error('closedAt must be a valid date');
    error.statusCode = 400;
    throw error;
  }

  const targetState = await TargetRegistrationState.findOneAndUpdate(
    { targetId },
    {
      $set: {
        registrationsOpen: false,
        closedAt: parsedClosedAt
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  return targetState;
};

const deleteRegistrationsForTargetInternal = async ({ targetId }) => {
  if (!targetId) {
    const error = new Error('targetId is required');
    error.statusCode = 400;
    throw error;
  }

  const [registrationsResult, stateResult] = await Promise.all([
    Registration.deleteMany({ targetId }),
    TargetRegistrationState.deleteOne({ targetId })
  ]);

  return {
    targetId,
    deletedRegistrations: registrationsResult.deletedCount || 0,
    deletedRegistrationStates: stateResult.deletedCount || 0
  };
};

module.exports = {
  createRegistration,
  getMyRegistrations,
  getRegistrationsByTarget,
  deleteRegistration,
  closeRegistrationsForTarget,
  closeRegistrationsForTargetInternal,
  deleteRegistrationsForTargetInternal
};
