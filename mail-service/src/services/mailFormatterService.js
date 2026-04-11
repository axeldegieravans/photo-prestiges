const formatTargetLabel = (target = {}) => {
  const title = target.title || 'Unknown target';
  const city = target.city || 'Unknown city';
  return `${title} (${city})`;
};

const isWinnerParticipant = (participant, winner) => {
  return Boolean(
    winner &&
      String(winner.participantId || winner.id || winner.email) ===
        String(participant.participantId || participant.id || participant.email)
  );
};

const formatParticipantScoreLine = (participant, winner) => {
  const label = participant.name || participant.email || 'Unknown participant';

  if (!participant.didSubmit) {
    return `- ${label}: no submission`;
  }

  return [
    `- ${label}: final score ${participant.finalScore ?? participant.score ?? 'N/A'}`,
    participant.submittedAt ? `, submitted at ${participant.submittedAt}` : '',
    isWinnerParticipant(participant, winner) ? ' (winner)' : ''
  ].join('');
};

const buildOwnerResultsText = ({ target, owner, winner, participants }) => {
  const submittedParticipants = participants.filter((participant) => participant.didSubmit);

  return [
    `Hello ${owner.name || 'Owner'},`,
    '',
    `Your target "${formatTargetLabel(target)}" has been finalized.`,
    `Submission count: ${submittedParticipants.length}`,
    `Winner: ${winner ? winner.name || winner.email || 'Unknown' : 'No winner'}`,
    `Winning score: ${winner ? winner.score ?? 'N/A' : 'N/A'}`,
    '',
    'Participant results:',
    ...(participants.length > 0
      ? participants.map((participant) => formatParticipantScoreLine(participant, winner))
      : ['- No participants']),
    ''
  ].join('\n');
};

const buildParticipantResultText = ({ target, participant, winner }) => {
  const isWinner = isWinnerParticipant(participant, winner);

  if (!participant.didSubmit) {
    return [
      `Hello ${participant.name || 'Participant'},`,
      '',
      `The target "${formatTargetLabel(target)}" has been finalized.`,
      'No submission was recorded for you before the deadline.',
      `Winner: ${winner ? winner.name || winner.email || 'No winner' : 'No winner'}`,
      ''
    ].join('\n');
  }

  return [
    `Hello ${participant.name || 'Participant'},`,
    '',
    `The target "${formatTargetLabel(target)}" has been finalized.`,
    `Your final score: ${participant.finalScore ?? participant.score ?? 'N/A'}`,
    `Submitted at: ${participant.submittedAt || 'Unknown'}`,
    `Winner: ${
      isWinner
        ? 'You'
        : winner
          ? winner.name || winner.email || 'Unknown'
          : 'No winner'
    }`,
    isWinner ? 'Congratulations, you won this target.' : '',
    ''
  ]
    .filter(Boolean)
    .join('\n');
};

const buildReminderText = ({ target, recipient }) => {
  return [
    `Hello ${recipient.name || 'Participant'},`,
    '',
    `This is a reminder for the target "${formatTargetLabel(target)}".`,
    `Time remaining: ${target.timeRemainingLabel || 'Unknown'}`,
    `Deadline: ${target.deadline || 'Unknown'}`,
    'Please submit before the deadline.',
    ''
  ].join('\n');
};

module.exports = {
  formatTargetLabel,
  formatParticipantScoreLine,
  isWinnerParticipant,
  buildOwnerResultsText,
  buildParticipantResultText,
  buildReminderText
};
