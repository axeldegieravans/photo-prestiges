const nodemailer = require('nodemailer');

let cachedTransporter = null;
let cachedMode = null;

const getMailMode = () => {
  return String(process.env.MAIL_MODE || 'ethereal').toLowerCase();
};

const getDefaultFrom = () => {
  return process.env.MAIL_FROM || 'Photo Prestiges <no-reply@photo-prestiges.local>';
};

const validateEmailLike = (value, fieldName) => {
  if (!value || typeof value !== 'string' || !value.includes('@')) {
    const error = new Error(`${fieldName} must be a valid email address`);
    error.statusCode = 400;
    throw error;
  }
};

const validateNonEmptyString = (value, fieldName) => {
  if (!value || typeof value !== 'string' || !value.trim()) {
    const error = new Error(`${fieldName} is required`);
    error.statusCode = 400;
    throw error;
  }
};

const getTransporter = async () => {
  const mode = getMailMode();

  if (cachedTransporter && cachedMode === mode) {
    return {
      transporter: cachedTransporter,
      mode: cachedMode
    };
  }

  if (mode === 'console') {
    cachedTransporter = nodemailer.createTransport({
      jsonTransport: true
    });
    cachedMode = mode;

    return {
      transporter: cachedTransporter,
      mode: cachedMode
    };
  }

  if (mode === 'ethereal') {
    const testAccount = await nodemailer.createTestAccount();

    cachedTransporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });

    cachedMode = mode;

    console.log('[mail-service] Ethereal account created:', testAccount.user);

    return {
      transporter: cachedTransporter,
      mode: cachedMode
    };
  }

  const error = new Error('MAIL_MODE must be either ethereal or console');
  error.statusCode = 500;
  throw error;
};

const sendMailInternal = async ({ to, subject, text }) => {
  validateEmailLike(to, 'to');
  validateNonEmptyString(subject, 'subject');
  validateNonEmptyString(text, 'text');

  const { transporter, mode } = await getTransporter();

  const info = await transporter.sendMail({
    from: getDefaultFrom(),
    to,
    subject,
    text
  });

  const previewUrl =
    mode === 'ethereal' ? nodemailer.getTestMessageUrl(info) : null;

  if (mode === 'console') {
    console.log('[mail-service] Console mail payload:', info.message);
  } else if (previewUrl) {
    console.log('[mail-service] Preview URL:', previewUrl);
  }

  return {
    to,
    subject,
    mode,
    messageId: info.messageId,
    previewUrl
  };
};

const formatTargetLabel = (target = {}) => {
  const title = target.title || 'Unknown target';
  const city = target.city || 'Unknown city';
  return `${title} (${city})`;
};

const formatParticipantScoreLine = (participant, winner) => {
  const label = participant.name || participant.email || 'Unknown participant';

  if (!participant.didSubmit) {
    return `- ${label}: no submission`;
  }

  const isWinner =
    winner &&
    String(winner.participantId || winner.id || winner.email) ===
      String(participant.participantId || participant.id || participant.email);

  return [
    `- ${label}: final score ${participant.finalScore ?? participant.score ?? 'N/A'}`,
    participant.submittedAt ? `, submitted at ${participant.submittedAt}` : '',
    isWinner ? ' (winner)' : ''
  ].join('');
};

const sendTargetResults = async (payload) => {
  const { target, owner, winner, participants } = payload || {};

  if (!target || typeof target !== 'object') {
    const error = new Error('target is required');
    error.statusCode = 400;
    throw error;
  }

  if (!owner || typeof owner !== 'object' || !owner.email) {
    const error = new Error('owner with email is required');
    error.statusCode = 400;
    throw error;
  }

  if (!Array.isArray(participants)) {
    const error = new Error('participants must be an array');
    error.statusCode = 400;
    throw error;
  }

  const submittedParticipants = participants.filter((participant) => participant.didSubmit);

  const results = [];

  const ownerMailText = [
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

  const ownerMail = await sendMailInternal({
    to: owner.email,
    subject: `Target results: ${target.title || 'Unknown target'}`,
    text: ownerMailText
  });

  results.push({
    type: 'OWNER_SUMMARY',
    ...ownerMail
  });

  for (const participant of participants) {
    if (!participant.email) {
      continue;
    }

    const isWinner =
      winner &&
      String(winner.participantId || winner.id || winner.email) ===
        String(participant.participantId || participant.id || participant.email);

    const text = participant.didSubmit
      ? [
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
          .join('\n')
      : [
          `Hello ${participant.name || 'Participant'},`,
          '',
          `The target "${formatTargetLabel(target)}" has been finalized.`,
          'No submission was recorded for you before the deadline.',
          `Winner: ${winner ? winner.name || winner.email || 'No winner' : 'No winner'}`,
          ''
        ].join('\n');

    const participantMail = await sendMailInternal({
      to: participant.email,
      subject: `Your result for ${target.title || 'Unknown target'}`,
      text
    });

    results.push({
      type: participant.didSubmit
        ? isWinner
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
  const { target, recipients } = payload || {};

  if (!target || typeof target !== 'object') {
    const error = new Error('target is required');
    error.statusCode = 400;
    throw error;
  }

  if (!Array.isArray(recipients)) {
    const error = new Error('recipients must be an array');
    error.statusCode = 400;
    throw error;
  }

  const results = [];

  for (const recipient of recipients) {
    if (!recipient.email) {
      continue;
    }

    const item = await sendMailInternal({
      to: recipient.email,
      subject: `Reminder: submit for ${target.title || 'Unknown target'}`,
      text: [
        `Hello ${recipient.name || 'Participant'},`,
        '',
        `This is a reminder for the target "${formatTargetLabel(target)}".`,
        `Time remaining: ${target.timeRemainingLabel || 'Unknown'}`,
        `Deadline: ${target.deadline || 'Unknown'}`,
        'Please submit before the deadline.',
        ''
      ].join('\n')
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
