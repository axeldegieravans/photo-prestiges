const {
  fetchTargetById,
  fetchActiveTargetsPage,
  fetchOwnerTargets,
  fetchRegistrationsByTarget,
  fetchSubmissionsByTarget,
  fetchMyRegistrations,
  fetchMySubmissions
} = require('./readApiService');

const OWNER = 'OWNER';
const PARTICIPANT = 'PARTICIPANT';

const compareSubmissions = (a, b) => {
  if (b.similarityScore !== a.similarityScore) {
    return b.similarityScore - a.similarityScore;
  }

  return new Date(a.submittedAt) - new Date(b.submittedAt);
};

const getBestSubmission = (submissions) => {
  if (!Array.isArray(submissions) || submissions.length === 0) {
    return null;
  }

  return [...submissions].sort(compareSubmissions)[0];
};

const assertOwner = (user) => {
  if (!user || user.role !== OWNER) {
    const error = new Error('Only owners can perform this action');
    error.statusCode = 403;
    throw error;
  }
};

const assertParticipant = (user) => {
  if (!user || user.role !== PARTICIPANT) {
    const error = new Error('Only participants can perform this action');
    error.statusCode = 403;
    throw error;
  }
};

const getActiveTargets = async ({ page, limit, city, search }) => {
  const result = await fetchActiveTargetsPage({
    page,
    limit,
    city,
    search
  });

  return {
    items: result.items || [],
    pagination: result.pagination || {
      page: 1,
      limit: 10,
      total: 0,
      pages: 1
    }
  };
};

const getOwnerDashboard = async ({ user, authHeader }) => {
  assertOwner(user);

  const targets = await fetchOwnerTargets(authHeader);

  const items = await Promise.all(
    targets.map(async (target) => {
      const [registrations, submissions] = await Promise.all([
        fetchRegistrationsByTarget(target._id, authHeader),
        fetchSubmissionsByTarget(target._id, authHeader)
      ]);

      const bestSubmission = getBestSubmission(submissions);

      return {
        targetId: target._id,
        title: target.title,
        city: target.city,
        status: target.status,
        deadline: target.deadline,
        createdAt: target.createdAt,
        registrationCount: registrations.length,
        submissionCount: submissions.length,
        bestScore: bestSubmission ? bestSubmission.similarityScore : null,
        bestSubmissionAt: bestSubmission ? bestSubmission.submittedAt : null
      };
    })
  );

  return {
    ownerId: user.userId,
    totals: {
      targets: items.length,
      registrations: items.reduce(
        (sum, item) => sum + item.registrationCount,
        0
      ),
      submissions: items.reduce((sum, item) => sum + item.submissionCount, 0)
    },
    items
  };
};

const getOwnerTargetOverview = async ({ targetId, user, authHeader }) => {
  assertOwner(user);

  if (!targetId) {
    const error = new Error('targetId is required');
    error.statusCode = 400;
    throw error;
  }

  const target = await fetchTargetById(targetId);

  if (String(target.ownerId) !== String(user.userId)) {
    const error = new Error('You can only access your own target overview');
    error.statusCode = 403;
    throw error;
  }

  const [registrations, submissions] = await Promise.all([
    fetchRegistrationsByTarget(targetId, authHeader),
    fetchSubmissionsByTarget(targetId, authHeader)
  ]);

  const sortedSubmissions = [...submissions].sort(compareSubmissions);
  const bestSubmission = sortedSubmissions[0] || null;

  return {
    target: {
      id: target._id,
      title: target.title,
      description: target.description,
      city: target.city,
      latitude: target.latitude,
      longitude: target.longitude,
      radiusMeters: target.radiusMeters,
      imageUrl: target.imageUrl,
      ownerId: target.ownerId,
      deadline: target.deadline,
      status: target.status,
      createdAt: target.createdAt
    },
    stats: {
      registrationCount: registrations.length,
      submissionCount: submissions.length,
      bestScore: bestSubmission ? bestSubmission.similarityScore : null,
      bestSubmissionAt: bestSubmission ? bestSubmission.submittedAt : null
    },
    leaderboardTop5: sortedSubmissions.slice(0, 5).map((submission) => ({
      submissionId: submission._id,
      participantId: submission.participantId,
      similarityScore: submission.similarityScore,
      submittedAt: submission.submittedAt,
      imageUrl: submission.imageUrl
    }))
  };
};

const getParticipantDashboard = async ({ user, authHeader }) => {
  assertParticipant(user);

  const [registrations, submissions] = await Promise.all([
    fetchMyRegistrations(authHeader),
    fetchMySubmissions(authHeader)
  ]);

  const entryMap = new Map();

  registrations.forEach((registration) => {
    entryMap.set(String(registration.targetId), {
      targetId: String(registration.targetId),
      registration,
      submission: null
    });
  });

  submissions.forEach((submission) => {
    const key = String(submission.targetId);

    if (!entryMap.has(key)) {
      entryMap.set(key, {
        targetId: key,
        registration: null,
        submission
      });
    } else {
      entryMap.get(key).submission = submission;
    }
  });

  const items = await Promise.all(
    [...entryMap.values()].map(async (entry) => {
      const target = await fetchTargetById(entry.targetId);

      return {
        targetId: target._id,
        title: target.title,
        city: target.city,
        deadline: target.deadline,
        status: target.status,
        imageUrl: target.imageUrl,
        isRegistered: Boolean(entry.registration),
        registeredAt: entry.registration
          ? entry.registration.createdAt || entry.registration.registeredAt
          : null,
        hasSubmitted: Boolean(entry.submission),
        submissionId: entry.submission ? entry.submission._id : null,
        submittedAt: entry.submission ? entry.submission.submittedAt : null,
        similarityScore: entry.submission
          ? entry.submission.similarityScore
          : null
      };
    })
  );

  return {
    participantId: user.userId,
    totals: {
      registrations: registrations.length,
      submissions: submissions.length
    },
    items
  };
};

module.exports = {
  getActiveTargets,
  getOwnerDashboard,
  getOwnerTargetOverview,
  getParticipantDashboard
};