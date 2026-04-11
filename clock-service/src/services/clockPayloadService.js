const uniqueStrings = (values = []) => {
  return [...new Set(values.map((value) => String(value)).filter(Boolean))];
};

const normalizeSubmission = (submission) => {
  if (submission && typeof submission.toObject === 'function') {
    return submission.toObject();
  }

  return submission;
};

const getSubmittedAt = (submission) => {
  const submittedAt = new Date(submission.submittedAt || submission.createdAt);

  return Number.isNaN(submittedAt.getTime()) ? null : submittedAt;
};

const getSpeedScore = ({ submittedAt, startedAt, deadline }) => {
  if (!submittedAt || !startedAt || !deadline) {
    return 0;
  }

  const totalMs = deadline.getTime() - startedAt.getTime();
  const elapsedMs = submittedAt.getTime() - startedAt.getTime();

  if (totalMs <= 0 || elapsedMs < 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, 100 - (elapsedMs / totalMs) * 100));
};

const calculateFinalScore = ({ submission, target }) => {
  const startedAt = new Date(target.createdAt || target.startedAt);
  const deadline = new Date(target.deadline);
  const submittedAt = getSubmittedAt(submission);
  const similarityScore = Number(submission.similarityScore) || 0;

  const speedScore = getSpeedScore({
    submittedAt,
    startedAt: Number.isNaN(startedAt.getTime()) ? null : startedAt,
    deadline: Number.isNaN(deadline.getTime()) ? null : deadline
  });

  return Number((similarityScore * 0.75 + speedScore * 0.25).toFixed(2));
};

const compareScoredSubmissions = (a, b) => {
  if (b.finalScore !== a.finalScore) {
    return b.finalScore - a.finalScore;
  }

  if (b.similarityScore !== a.similarityScore) {
    return b.similarityScore - a.similarityScore;
  }

  return new Date(a.submittedAt) - new Date(b.submittedAt);
};

const getWinner = (submissions, target) => {
  if (!Array.isArray(submissions) || submissions.length === 0) {
    return null;
  }

  return submissions
    .map(normalizeSubmission)
    .map((submission) => ({
      ...submission,
      finalScore: calculateFinalScore({ submission, target })
    }))
    .sort(compareScoredSubmissions)[0];
};

const formatTimeRemaining = (deadline, now) => {
  const deadlineDate = new Date(deadline);
  const nowDate = new Date(now);

  const diffMs = deadlineDate.getTime() - nowDate.getTime();

  if (Number.isNaN(diffMs) || diffMs <= 0) {
    return '0 minutes';
  }

  const totalMinutes = Math.ceil(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} hour${hours === 1 ? '' : 's'} and ${minutes} minute${minutes === 1 ? '' : 's'}`;
  }

  if (hours > 0) {
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }

  return `${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}`;
};

const buildTargetResultsPayload = ({
  target,
  closedAt,
  submissions,
  registrations,
  users,
  winner
}) => {
  const userMap = new Map(users.map((user) => [String(user.userId), user]));

  const submissionMap = new Map(
    submissions.map((submission) => [String(submission.participantId), submission])
  );

  const ownerUser = userMap.get(String(target.ownerId));
  const winnerUser = winner ? userMap.get(String(winner.participantId)) : null;

  const registeredParticipantIds = uniqueStrings(
    registrations.map((registration) => registration.participantId)
  );

  const participants = registeredParticipantIds.map((participantId) => {
    const user = userMap.get(String(participantId));
    const submission = submissionMap.get(String(participantId));
    const finalScore = submission
      ? calculateFinalScore({ submission, target })
      : null;

    return {
      participantId,
      name: user?.name || null,
      email: user?.email || null,
      didSubmit: Boolean(submission),
      score: submission ? submission.similarityScore : null,
      finalScore,
      submittedAt: submission ? submission.submittedAt : null
    };
  });

  return {
    target: {
      targetId: String(target._id),
      title: target.title,
      city: target.city || null,
      deadline: target.deadline || null,
      closedAt
    },
    owner: {
      userId: String(target.ownerId),
      name: ownerUser?.name || null,
      email: ownerUser?.email || null
    },
    winner: winner
      ? {
          participantId: String(winner.participantId),
          name: winnerUser?.name || null,
          email: winnerUser?.email || null,
          score: winner.finalScore ?? winner.similarityScore,
          similarityScore: winner.similarityScore,
          finalScore: winner.finalScore,
          submittedAt: winner.submittedAt
        }
      : null,
    participants
  };
};

const buildReminderPayload = ({
  target,
  registrations,
  submissions,
  users,
  now
}) => {
  const userMap = new Map(users.map((user) => [String(user.userId), user]));
  const submittedParticipantIds = new Set(
    submissions.map((submission) => String(submission.participantId))
  );

  const recipientIds = uniqueStrings(
    registrations
      .map((registration) => registration.participantId)
      .filter((participantId) => !submittedParticipantIds.has(String(participantId)))
  );

  const recipients = recipientIds
    .map((participantId) => {
      const user = userMap.get(String(participantId));

      return {
        participantId,
        name: user?.name || null,
        email: user?.email || null
      };
    })
    .filter((recipient) => recipient.email);

  return {
    target: {
      targetId: String(target._id),
      title: target.title,
      city: target.city || null,
      deadline: target.deadline || null,
      timeRemainingLabel: formatTimeRemaining(target.deadline, now)
    },
    recipients
  };
};

module.exports = {
  uniqueStrings,
  calculateFinalScore,
  getWinner,
  buildTargetResultsPayload,
  buildReminderPayload
};
