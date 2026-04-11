const {
  publishTargetResultsMessage,
  publishReminderMessage
} = require('./rabbitmqPublisher');
const TrackedCompetition = require('../models/TrackedCompetition');
const {
  fetchTargetById,
  fetchSubmissionsByTargetInternal,
  fetchRegistrationsByTargetInternal,
  closeRegistrationsForTargetInternal,
  fetchUsersBatchInternal,
  finalizeTargetInternal
} = require('./clockApiService');
const {
  uniqueStrings,
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

  return competition;
};

const startCompetitionForTarget = async ({ data }) => {
  const {
    targetId,
    ownerId,
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
        const target = await fetchTargetById(competition.targetId);

        if (!competition.registrationsClosedAt) {
          await closeRegistrationsForTargetInternal({
            targetId: competition.targetId,
            closedAt: runAt.toISOString()
          });
        }

        const submissions = await fetchSubmissionsByTargetInternal(
          competition.targetId
        );
        const winner = getWinner(submissions, target);

        await finalizeTargetInternal({
          targetId: competition.targetId,
          winner,
          closedAt: runAt.toISOString()
        });

        let mailStatus = 'SKIPPED';
        let mailMessage = null;

        try {
          const registrations = await fetchRegistrationsByTargetInternal(
            competition.targetId
          );

          const relatedUserIds = uniqueStrings([
            target.ownerId,
            ...registrations.map((registration) => registration.participantId)
          ]);

          const usersResult = await fetchUsersBatchInternal(relatedUserIds);
          const users = Array.isArray(usersResult.items) ? usersResult.items : [];

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
        const target = await fetchTargetById(competition.targetId);

        const registrations = await fetchRegistrationsByTargetInternal(
          competition.targetId
        );
        const submissions = await fetchSubmissionsByTargetInternal(
          competition.targetId
        );

        const relatedUserIds = uniqueStrings(
          registrations.map((registration) => registration.participantId)
        );

        const usersResult = await fetchUsersBatchInternal(relatedUserIds);
        const users = Array.isArray(usersResult.items) ? usersResult.items : [];

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
  runDeadlineCycle,
  startScheduler
};
