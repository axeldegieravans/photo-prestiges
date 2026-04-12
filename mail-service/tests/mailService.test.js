const {
  formatTargetLabel,
  formatParticipantScoreLine
} = require('../src/services/mailFormatterService');

test('mail helpers format target labels', () => {
  expect(formatTargetLabel({ title: 'Bell Tower', city: 'Den Bosch' })).toBe('Bell Tower (Den Bosch)');
  expect(formatTargetLabel({})).toBe('Unknown target (Unknown city)');
});

test('mail helpers format participant score lines', () => {
  expect(
    formatParticipantScoreLine(
      {
        name: 'Alice',
        didSubmit: false
      },
      null
    )
  ).toBe('- Alice: no submission');

  expect(
    formatParticipantScoreLine(
      {
        participantId: 'p1',
        name: 'Alice',
        didSubmit: true,
        finalScore: 72.5,
        submittedAt: '2026-04-11T18:30:00.000Z'
      },
      {
        participantId: 'p1'
      }
    )
  ).toBe('- Alice: final score 72.5, submitted at 2026-04-11T18:30:00.000Z (winner)');
});
