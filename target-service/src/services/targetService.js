const path = require('path');
const Target = require('../models/Target');
const {
  buildTargetImageUrl,
  deleteFileIfExists
} = require('../utils/fileStorage');
const { normalizePagination } = require('../utils/pagination');
const { createHttpError } = require('../utils/httpError');
const {
  assertOwner,
  assertTargetOwnership,
  getTargetOrThrow,
  validateCoordinates,
  validateTargetStatus
} = require('./targetValidationService');
const { voteOnTarget } = require('./targetVoteService');
const {
  publishTargetDeleted
} = require('./rabbitmqPublisher');
const {
  enqueueTargetCreatedEvent,
  dispatchTargetCreatedEvent
} = require('./targetEventOutboxService');

const createTarget = async ({ data, user, file }) => {
  assertOwner(user);

  const {
    title,
    description,
    city,
    latitude,
    longitude,
    radiusMeters,
    deadline
  } = data;

  if (!title || !description || !city || !radiusMeters || !deadline) {
    if (file?.path) {
      await deleteFileIfExists(file.path);
    }

    throw createHttpError(
      400,
      'title, description, city, radiusMeters and deadline are required'
    );
  }

  if (!file) {
    throw createHttpError(400, 'image file is required');
  }

  if (Number.isNaN(Number(radiusMeters)) || Number(radiusMeters) <= 0) {
    await deleteFileIfExists(file.path);

    throw createHttpError(400, 'radiusMeters must be a number greater than 0');
  }

  const parsedDeadline = new Date(deadline);

  if (Number.isNaN(parsedDeadline.getTime())) {
    await deleteFileIfExists(file.path);

    throw createHttpError(400, 'deadline must be a valid date');
  }

  if (parsedDeadline <= new Date()) {
    await deleteFileIfExists(file.path);

    throw createHttpError(400, 'deadline must be in the future');
  }

  validateCoordinates({ latitude, longitude });

  let target = null;

  try {
    target = await Target.create({
      title,
      description,
      city,
      latitude: latitude !== undefined && latitude !== '' ? Number(latitude) : null,
      longitude: longitude !== undefined && longitude !== '' ? Number(longitude) : null,
      radiusMeters: Number(radiusMeters),
      imageUrl: buildTargetImageUrl(file.filename),
      imageFilename: file.filename,
      ownerId: user.userId,
      ownerEmail: user.email || null,
      ownerName: user.name || null,
      deadline: parsedDeadline,
      status: 'OPEN'
    });
  } catch (error) {
    if (file?.path) {
      await deleteFileIfExists(file.path);
    }

    throw error;
  }

  try {
    const event = await enqueueTargetCreatedEvent({ target });
    await dispatchTargetCreatedEvent(event);
  } catch (error) {
    console.warn(
      '[target-service] Target created, target-created event saved for retry:',
      error.message
    );
  }

  return target;
};

const getTargets = async ({ page, limit, city, status, ownerId, search }) => {
  const {
    page: normalizedPage,
    limit: normalizedLimit,
    skip
  } = normalizePagination(page, limit);

  const query = {};

  if (city) {
    query.city = { $regex: city, $options: 'i' };
  }

  const normalizedStatus = validateTargetStatus(status);

  if (normalizedStatus) {
    query.status = normalizedStatus;
  }

  if (ownerId) {
    query.ownerId = ownerId;
  }

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { city: { $regex: search, $options: 'i' } }
    ];
  }

  const [targets, total] = await Promise.all([
    Target.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(normalizedLimit),
    Target.countDocuments(query)
  ]);

  return {
    items: targets,
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      pages: Math.ceil(total / normalizedLimit) || 1
    }
  };
};

const getMyTargets = async ({ user, page, limit, status }) => {
  assertOwner(user);

  return getTargets({
    page,
    limit,
    ownerId: user.userId,
    status
  });
};

const getTargetById = async ({ targetId }) => {
  return getTargetOrThrow(targetId);
};

const deleteTarget = async ({ targetId, user }) => {
  assertOwner(user);

  const target = await getTargetOrThrow(targetId);
  assertTargetOwnership(target, user);

  const filePath = target.imageFilename
    ? path.join(process.cwd(), 'uploads', 'targets', target.imageFilename)
    : null;
  const deletedEvent = {
    targetId: target._id,
    ownerId: target.ownerId,
    deletedAt: new Date().toISOString()
  };

  await target.deleteOne();
  await deleteFileIfExists(filePath);

  try {
    await publishTargetDeleted(deletedEvent);
  } catch (error) {
    console.warn(
      '[target-service] Target deleted, but failed to publish target-deleted event:',
      error.message
    );
  }

  return {
    message: 'Target deleted successfully'
  };
};

const finalizeTargetInternal = async ({ targetId, data }) => {
  const target = await getTargetOrThrow(targetId);

  const parsedClosedAt = data.closedAt ? new Date(data.closedAt) : new Date();

  if (Number.isNaN(parsedClosedAt.getTime())) {
    throw createHttpError(400, 'closedAt must be a valid date');
  }

  let parsedWinningSubmittedAt = null;

  if (
    data.winningSubmittedAt !== undefined &&
    data.winningSubmittedAt !== null
  ) {
    parsedWinningSubmittedAt = new Date(data.winningSubmittedAt);

    if (Number.isNaN(parsedWinningSubmittedAt.getTime())) {
      throw createHttpError(400, 'winningSubmittedAt must be a valid date');
    }
  }

  let normalizedWinningScore = null;

  if (data.winningScore !== undefined && data.winningScore !== null) {
    normalizedWinningScore = Number(data.winningScore);

    if (
      Number.isNaN(normalizedWinningScore) ||
      normalizedWinningScore < 0 ||
      normalizedWinningScore > 100
    ) {
      throw createHttpError(400, 'winningScore must be a number between 0 and 100');
    }
  }

  target.status = 'CLOSED';
  target.closedAt = parsedClosedAt;
  target.winnerParticipantId = data.winnerParticipantId || null;
  target.winnerSubmissionId = data.winnerSubmissionId || null;
  target.winningScore = normalizedWinningScore;
  target.winningSubmittedAt = parsedWinningSubmittedAt;

  await target.save();

  return target;
};

module.exports = {
  createTarget,
  getTargets,
  getMyTargets,
  getTargetById,
  deleteTarget,
  finalizeTargetInternal,
  voteOnTarget
};
