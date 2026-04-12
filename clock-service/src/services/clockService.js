const {
  publishTargetResultsMessage,
  publishReminderMessage,
  publishCompetitionExpiredEvent,
  publishWinnerDeterminedEvent
} = require('./clockEventPublisher');
const TrackedCompetition = require('../models/TrackedCompetition');
const ClockRegistration = require('../models/ClockRegistration');
const ClockSubmission = require('../models/ClockSubmission');
const {
  getWinner,
  buildTargetResultsPayload,
  buildReminderPayload
} = require('./clockPayloadService');

const parseRunAt = (now) => {
  if (!now) {
    return new Date();
  }

  const parsed = new Date(now);

  if (Number.isNaN(parsed.getTime())) {
    const error = new Error('Invalid now value. Use a valid ISO date string.');
    error.statusCode = 400;
    throw error;
  }

  return parsed;
};

const getReminderIntervalMs = () => {
  const minutes = Math.max(
    Number(process.env.REMINDER_INTERVAL_MINUTES) || 30,
    1
  );

  return minutes * 60 * 1000;
};

const calculateNextReminderAt = (fromDate, deadline) => {
  const next = new Date(new Date(fromDate).getTime() + getReminderIntervalMs());
  const deadlineDate = new Date(deadline);

  if (Number.isNaN(next.getTime()) || Number.isNaN(deadlineDate.getTime())) {
    return null;
  }

  return next < deadlineDate ? next : null;
};

const isNotFoundError = (error) => {
  return error?.statusCode === 404 || error?.message === 'Target not found';
};

const buildTargetSnapshot = (competition) => {
  return {
    _id: competition.targetId,
    ownerId: competition.ownerId,
    title: competition.title || `Target ${competition.targetId}`,
    city: competition.city || null,
    createdAt: competition.startedAt,
    startedAt: competition.startedAt,
    deadline: competition.deadline
  };
};

const buildUserSnapshots = ({ competition, registrations, submissions }) => {
  const users = new Map();

  users.set(String(competition.ownerId), {
    userId: String(competition.ownerId),
    name: competition.ownerName || null,
    email: competition.ownerEmail || null,
    role: 'OWNER'
  });

  registrations.forEach((registration) => {
    users.set(String(registration.participantId), {
      userId: String(registration.participantId),
      name: registration.participantName || null,
      email: registration.participantEmail || null,
      role: 'PARTICIPANT'
    });
  });

  submissions.forEach((submission) => {
    if (!users.has(String(submission.participantId))) {
      users.set(String(submission.participantId), {
        userId: String(submission.participantId),
        name: submission.participantName || null,
        email: submission.participantEmail || null,
        role: 'PARTICIPANT'
      });
    }
  });

  return [...users.values()];
};

const markCompetitionDeleted = async ({ targetId, deletedAt }) => {
  if (!targetId) {
    const error = new Error('targetId is required');
    error.statusCode = 400;
    throw error;
  }

  const parsedDeletedAt = deletedAt ? new Date(deletedAt) : new Date();

  if (Number.isNaN(parsedDeletedAt.getTime())) {
    const error = new Error('deletedAt must be a valid date');
    error.statusCode = 400;
    throw error;
  }

  const competition = await TrackedCompetition.findOneAndUpdate(
    {
      targetId: String(targetId),
      status: 'ACTIVE'
    },
    {
      $set: {
        status: 'DELETED',
        deletedAt: parsedDeletedAt,
        nextReminderAt: null
      }
    },
    {
      new: true
    }
  );

  await Promise.all([
    ClockRegistration.deleteMany({ targetId: String(targetId) }),
    ClockSubmission.deleteMany({ targetId: String(targetId) })
  ]);

  return competition;
};

const startCompetitionForTarget = async ({ data }) => {
  const {
    targetId,
    ownerId,
    ownerEmail,
    ownerName,
    title,
    city,
    startedAt,
    deadline
  } = data || {};

  if (!targetId || !ownerId || !deadline) {
    const error = new Error('targetId, ownerId and deadline are required');
    error.statusCode = 400;
    throw error;
  }

  const parsedStartedAt = startedAt ? new Date(startedAt) : new Date();
  const parsedDeadline = new Date(deadline);

  if (Number.isNaN(parsedStartedAt.getTime())) {
    const error = new Error('startedAt must be a valid date');
    error.statusCode = 400;
    throw error;
  }

  if (Number.isNaN(parsedDeadline.getTime())) {
    const error = new Error('deadline must be a valid date');
    error.statusCode = 400;
    throw error;
  }

  if (parsedDeadline <= parsedStartedAt) {
    const error = new Error('deadline must be after startedAt');
    error.statusCode = 400;
    throw error;
  }

  const existing = await TrackedCompetition.findOne({
    targetId: String(targetId)
  });

  if (existing) {
    return existing;
  }

  const trackedCompetition = await TrackedCompetition.create({
    targetId: String(targetId),
    ownerId: String(ownerId),
    ownerEmail: ownerEmail || null,
    ownerName: ownerName || null,
    title: title || null,
    city: city || null,
    startedAt: parsedStartedAt,
    deadline: parsedDeadline,
    status: 'ACTIVE',
    lastReminderSentAt: null,
    nextReminderAt: calculateNextReminderAt(parsedStartedAt, parsedDeadline),
    registrationsClosedAt: null,
    finalizedAt: null
  });

  return trackedCompetition;
};

const upsertRegistrationSnapshot = async ({ data }) => {
  const { targetId, participantId, participantEmail, participantName } =
    data || {};

  if (!targetId || !participantId) {
    const error = new Error('targetId and participantId are required');
    error.statusCode = 400;
    throw error;
  }

  const registeredAt = data.registeredAt ? new Date(data.registeredAt) : new Date();

  if (Number.isNaN(registeredAt.getTime())) {
    const error = new Error('registeredAt must be a valid date');
    error.statusCode = 400;
    throw error;
  }

  return ClockRegistration.findOneAndUpdate(
    {
      targetId: String(targetId),
      participantId: String(participantId)
    },
    {
      $set: {
        participantEmail: participantEmail || null,
        participantName: participantName || null,
        registeredAt
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );
};

const deleteRegistrationSnapshot = async ({ data }) => {
  const { targetId, participantId } = data || {};

  if (!targetId || !participantId) {
    const error = new Error('targetId and participantId are required');
    error.statusCode = 400;
    throw error;
  }

  return ClockRegistration.deleteOne({
    targetId: String(targetId),
    participantId: String(participantId)
  });
};

const upsertSubmissionSnapshot = async ({ data }) => {
  const {
    submissionId,
    targetId,
    participantId,
    participantEmail,
    participantName,
    similarityScore
  } = data || {};

  if (!submissionId || !targetId || !participantId) {
    const error = new Error('submissionId, targetId and participantId are required');
    error.statusCode = 400;
    throw error;
  }

  const submittedAt = data.submittedAt ? new Date(data.submittedAt) : new Date();
  const normalizedSimilarityScore = Number(similarityScore);

  if (Number.isNaN(submittedAt.getTime())) {
    const error = new Error('submittedAt must be a valid date');
    error.statusCode = 400;
    throw error;
  }

  if (
    Number.isNaN(normalizedSimilarityScore) ||
    normalizedSimilarityScore < 0 ||
    normalizedSimilarityScore > 100
  ) {
    const error = new Error('similarityScore must be a number between 0 and 100');
    error.statusCode = 400;
    throw error;
  }

  return ClockSubmission.findOneAndUpdate(
    {
      targetId: String(targetId),
      participantId: String(participantId)
    },
    {
      $set: {
        submissionId: String(submissionId),
        participantEmail: participantEmail || null,
        participantName: participantName || null,
        similarityScore: normalizedSimilarityScore,
        submittedAt
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );
};

const deleteSubmissionSnapshot = async ({ data }) => {
  const { submissionId, targetId, participantId } = data || {};

  const query = submissionId
    ? { submissionId: String(submissionId) }
    : {
        targetId: String(targetId),
        participantId: String(participantId)
      };

  if (!query.submissionId && (!targetId || !participantId)) {
    const error = new Error('submissionId or targetId with participantId is required');
    error.statusCode = 400;
    throw error;
  }

  return ClockSubmission.deleteOne(query);
};

let isRunning = false;
let intervalId = null;

const runDeadlineCycle = async ({ now, source = 'scheduler' } = {}) => {
  if (isRunning) {
    return {
      source,
      skipped: true,
      message: 'Clock cycle is already running',
      runAt: new Date().toISOString()
    };
  }

  isRunning = true;

  try {
    const runAt = parseRunAt(now);

    const activeCompetitions = await TrackedCompetition.find({
      status: 'ACTIVE'
    }).sort({ deadline: 1 });

    const expiredCompetitions = activeCompetitions.filter((competition) => {
      const deadline = new Date(competition.deadline);

      if (Number.isNaN(deadline.getTime())) {
        return false;
      }

      return deadline <= runAt;
    });

    const reminderCompetitions = activeCompetitions.filter((competition) => {
      if (!competition.nextReminderAt) {
        return false;
      }

      const nextReminderAt = new Date(competition.nextReminderAt);
      const deadline = new Date(competition.deadline);

      if (
        Number.isNaN(nextReminderAt.getTime()) ||
        Number.isNaN(deadline.getTime())
      ) {
        return false;
      }

      return nextReminderAt <= runAt && deadline > runAt;
    });

    const items = [];
    const reminderItems = [];

    for (const competition of expiredCompetitions) {
      try {
        const target = buildTargetSnapshot(competition);

        if (!competition.registrationsClosedAt) {
          await publishCompetitionExpiredEvent({
            targetId: competition.targetId,
            closedAt: runAt.toISOString()
          });
        }

        const [registrations, submissions] = await Promise.all([
          ClockRegistration.find({ targetId: competition.targetId })
            .sort({ registeredAt: 1 })
            .lean(),
          ClockSubmission.find({ targetId: competition.targetId })
            .sort({ similarityScore: -1, submittedAt: 1 })
            .lean()
        ]);
        const winner = getWinner(submissions, target);

        await publishWinnerDeterminedEvent({
          targetId: competition.targetId,
          winnerParticipantId: winner ? winner.participantId : null,
          winnerSubmissionId: winner ? winner.submissionId || winner._id : null,
          winningScore: winner ? winner.finalScore ?? winner.similarityScore : null,
          winningSubmittedAt: winner ? winner.submittedAt : null,
          closedAt: runAt.toISOString()
        });

        let mailStatus = 'SKIPPED';
        let mailMessage = null;

        try {
          const users = buildUserSnapshots({
            competition,
            registrations,
            submissions
          });

          const payload = buildTargetResultsPayload({
            target,
            closedAt: runAt.toISOString(),
            submissions,
            registrations,
            users,
            winner
          });

          if (payload.owner.email) {
            await publishTargetResultsMessage(payload);
            mailStatus = 'QUEUED';
          } else {
            mailStatus = 'SKIPPED';
            mailMessage = 'Owner email is missing, so result mails were skipped';
          }
        } catch (mailError) {
          mailStatus = 'FAILED';
          mailMessage = mailError.message;
        }

        competition.status = 'FINALIZED';
        competition.registrationsClosedAt =
          competition.registrationsClosedAt || runAt;
        competition.finalizedAt = runAt;
        competition.nextReminderAt = null;
        await competition.save();

        items.push({
          targetId: competition.targetId,
          status: 'FINALIZED',
          submissionCount: submissions.length,
          winner: winner
            ? {
                participantId: winner.participantId,
                submissionId: winner._id,
                similarityScore: winner.similarityScore,
                finalScore: winner.finalScore,
                submittedAt: winner.submittedAt
              }
            : null,
          mailStatus,
          ...(mailMessage ? { mailMessage } : {})
        });
      } catch (error) {
        if (isNotFoundError(error)) {
          await markCompetitionDeleted({
            targetId: competition.targetId,
            deletedAt: runAt.toISOString()
          });

          items.push({
            targetId: competition.targetId,
            status: 'DELETED',
            message: 'Target no longer exists; clock tracking stopped'
          });
          continue;
        }

        items.push({
          targetId: competition.targetId,
          status: 'FAILED',
          message: error.message
        });
      }
    }

    for (const competition of reminderCompetitions) {
      try {
        const target = buildTargetSnapshot(competition);
        const [registrations, submissions] = await Promise.all([
          ClockRegistration.find({ targetId: competition.targetId })
            .sort({ registeredAt: 1 })
            .lean(),
          ClockSubmission.find({ targetId: competition.targetId })
            .sort({ submittedAt: 1 })
            .lean()
        ]);
        const users = buildUserSnapshots({
          competition,
          registrations,
          submissions
        });

        const payload = buildReminderPayload({
          target,
          registrations,
          submissions,
          users,
          now: runAt.toISOString()
        });

        if (payload.recipients.length === 0) {
          competition.nextReminderAt = calculateNextReminderAt(
            runAt,
            competition.deadline
          );
          await competition.save();

          reminderItems.push({
            targetId: competition.targetId,
            reminderStatus: 'SKIPPED',
            message: 'No registered participants without a submission'
          });
          continue;
        }

        await publishReminderMessage(payload);

        competition.lastReminderSentAt = runAt;
        competition.nextReminderAt = calculateNextReminderAt(
          runAt,
          competition.deadline
        );
        await competition.save();

        reminderItems.push({
          targetId: competition.targetId,
          reminderStatus: 'QUEUED',
          recipientCount: payload.recipients.length,
          timeRemaining: payload.target.timeRemainingLabel
        });
      } catch (error) {
        if (isNotFoundError(error)) {
          await markCompetitionDeleted({
            targetId: competition.targetId,
            deletedAt: runAt.toISOString()
          });

          reminderItems.push({
            targetId: competition.targetId,
            reminderStatus: 'SKIPPED',
            message: 'Target no longer exists; clock tracking stopped'
          });
          continue;
        }

        reminderItems.push({
          targetId: competition.targetId,
          reminderStatus: 'FAILED',
          message: error.message
        });
      }
    }

    return {
      source,
      skipped: false,
      runAt: runAt.toISOString(),
      trackedCompetitions: activeCompetitions.length,
      expiredTargets: expiredCompetitions.length,
      finalizedTargets: items.filter((item) => item.status === 'FINALIZED')
        .length,
      failedTargets: items.filter((item) => item.status === 'FAILED').length,
      queuedMailTargets: items.filter((item) => item.mailStatus === 'QUEUED')
        .length,
      reminderTargets: reminderCompetitions.length,
      queuedReminderTargets: reminderItems.filter(
        (item) => item.reminderStatus === 'QUEUED'
      ).length,
      failedReminderTargets: reminderItems.filter(
        (item) => item.reminderStatus === 'FAILED'
      ).length,
      items,
      reminderItems
    };
  } finally {
    isRunning = false;
  }
};

const startScheduler = () => {
  if (intervalId) {
    return;
  }

  const intervalMs = Math.max(
    Number(process.env.CLOCK_INTERVAL_MS) || 30000,
    1000
  );

  intervalId = setInterval(async () => {
    try {
      const result = await runDeadlineCycle({ source: 'scheduler' });

      if (!result.skipped) {
        console.log(
          `[clock-service] cycle complete | tracked=${result.trackedCompetitions} expired=${result.expiredTargets} finalized=${result.finalizedTargets} failed=${result.failedTargets} queued=${result.queuedMailTargets} reminderTargets=${result.reminderTargets} queuedReminders=${result.queuedReminderTargets} reminderFailed=${result.failedReminderTargets}`
        );
      }
    } catch (error) {
      console.error('[clock-service] cycle failed:', error.message);
    }
  }, intervalMs);

  console.log(
    `[clock-service] scheduler started with interval ${intervalMs}ms`
  );
};

module.exports = {
  markCompetitionDeleted,
  startCompetitionForTarget,
  upsertRegistrationSnapshot,
  deleteRegistrationSnapshot,
  upsertSubmissionSnapshot,
  deleteSubmissionSnapshot,
  runDeadlineCycle,
  startScheduler
};
