const nodemailer = require('nodemailer');
const {
  validateEmailLike,
  validateNonEmptyString
} = require('./mailValidationService');

let cachedTransporter = null;
let cachedMode = null;

const getMailMode = () => {
  return String(process.env.MAIL_MODE || 'ethereal').toLowerCase();
};

const getDefaultFrom = () => {
  return process.env.MAIL_FROM || 'Photo Prestiges <no-reply@photo-prestiges.local>';
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

module.exports = {
  sendMailInternal
};
