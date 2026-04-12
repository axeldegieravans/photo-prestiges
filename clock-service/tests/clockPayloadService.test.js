const {
  calculateFinalScore,
  getWinner,
  buildReminderPayload,
  buildTargetResultsPayload
} = require('../src/services/clockPayloadService');

test('clock scoring combines similarity and speed', () => {
  const target = {
    createdAt: '2026-04-11T18:00:00.000Z',
    deadline: '2026-04-11T19:00:00.000Z'
  };

  const score = calculateFinalScore({
    target,
    submission: {
      similarityScore: 80,
      submittedAt: '2026-04-11T18:30:00.000Z'
    }
  });

  expect(score).toBe(72.5);
});

test('clock winner selection prefers the best final score', () => {
  const target = {
    createdAt: '2026-04-11T18:00:00.000Z',
    deadline: '2026-04-11T19:00:00.000Z'
  };

  const winner = getWinner(
    [
      {
        participantId: 'p1',
        similarityScore: 70,
        submittedAt: '2026-04-11T18:50:00.000Z'
      },
      {
        participantId: 'p2',
        similarityScore: 65,
        submittedAt: '2026-04-11T18:05:00.000Z'
      }
    ],
    target
  );

  expect(winner.participantId).toBe('p2');
  expect(winner.finalScore).toBe(71.67);
});

test('clock reminder payload only includes participants without submissions', () => {
  const payload = buildReminderPayload({
    target: {
      _id: 'target-1',
      title: 'Museum statue',
      city: 'Amsterdam',
      deadline: '2026-04-11T19:00:00.000Z'
    },
    registrations: [
      { participantId: 'p1' },
      { participantId: 'p2' }
    ],
    submissions: [{ participantId: 'p1' }],
    users: [
      { userId: 'p1', name: 'Alice', email: 'alice@example.com' },
      { userId: 'p2', name: 'Bob', email: 'bob@example.com' }
    ],
    now: '2026-04-11T18:10:00.000Z'
  });

  expect(payload.recipients).toHaveLength(1);
  expect(payload.recipients[0].participantId).toBe('p2');
  expect(payload.target.timeRemainingLabel).toBe('50 minutes');
});

test('clock results payload includes the owner and submitted participants', () => {
  const payload = buildTargetResultsPayload({
    target: {
      _id: 'target-1',
      ownerId: 'owner-1',
      title: 'Museum statue',
      city: 'Amsterdam',
      deadline: '2026-04-11T19:00:00.000Z'
    },
    closedAt: '2026-04-11T19:00:00.000Z',
    submissions: [
      {
        participantId: 'p1',
        similarityScore: 80,
        submittedAt: '2026-04-11T18:30:00.000Z'
      }
    ],
    registrations: [{ participantId: 'p1' }],
    users: [
      { userId: 'owner-1', name: 'Owner', email: 'owner@example.com' },
      { userId: 'p1', name: 'Alice', email: 'alice@example.com' }
    ],
    winner: {
      participantId: 'p1',
      similarityScore: 80,
      submittedAt: '2026-04-11T18:30:00.000Z',
      finalScore: 72.5
    }
  });

  expect(payload.owner.email).toBe('owner@example.com');
  expect(payload.participants).toHaveLength(1);
  expect(payload.winner.finalScore).toBe(72.5);
});
