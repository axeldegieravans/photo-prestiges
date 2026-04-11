const { sendMailInternal } = require('./mailTransportService');
const {
  buildOwnerResultsText,
  buildParticipantResultText,
  buildReminderText,
  isWinnerParticipant
} = require('./mailFormatterService');
const {
  validateTargetResultsPayload,
  validateReminderPayload
} = require('./mailValidationService');

const sendTargetResults = async (payload) => {
  validateTargetResultsPayload(payload);

  const { target, owner, winner, participants } = payload;
  const results = [];

  const ownerMail = await sendMailInternal({
    to: owner.email,
    subject: `Target results: ${target.title || 'Unknown target'}`,
    text: buildOwnerResultsText({ target, owner, winner, participants })
  });

  results.push({
    type: 'OWNER_SUMMARY',
    ...ownerMail
  });

  for (const participant of participants) {
    if (!participant.email) {
      continue;
    }

    const participantMail = await sendMailInternal({
      to: participant.email,
      subject: `Your result for ${target.title || 'Unknown target'}`,
      text: buildParticipantResultText({ target, participant, winner })
    });

    results.push({
      type: participant.didSubmit
        ? isWinnerParticipant(participant, winner)
          ? 'PARTICIPANT_WINNER_RESULT'
          : 'PARTICIPANT_RESULT'
        : 'PARTICIPANT_NO_SUBMISSION',
      ...participantMail
    });
  }

  return {
    message: 'Target result mails processed successfully',
    count: results.length,
    items: results
  };
};

const sendReminders = async (payload) => {
  validateReminderPayload(payload);

  const { target, recipients } = payload;
  const results = [];

  for (const recipient of recipients) {
    if (!recipient.email) {
      continue;
    }

    const item = await sendMailInternal({
      to: recipient.email,
      subject: `Reminder: submit for ${target.title || 'Unknown target'}`,
      text: buildReminderText({ target, recipient })
    });

    results.push({
      type: 'REMINDER',
      ...item
    });
  }

  return {
    message: 'Reminder mails processed successfully',
    count: results.length,
    items: results
  };
};

module.exports = {
  sendTargetResults,
  sendReminders
};
