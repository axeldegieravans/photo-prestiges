const amqp = require('amqplib');
const mailService = require('./mailService');

let connection = null;
let channel = null;

const getTargetResultsQueueName = () => {
  return process.env.MAIL_TARGET_RESULTS_QUEUE || 'mail.target-results';
};

const getRemindersQueueName = () => {
  return process.env.MAIL_REMINDERS_QUEUE || 'mail.reminders';
};

const getRabbitUrl = () => {
  const url = process.env.RABBITMQ_URL;

  if (!url) {
    const error = new Error('RABBITMQ_URL is not configured');
    error.statusCode = 500;
    throw error;
  }

  return url;
};

const resetConnectionState = () => {
  connection = null;
  channel = null;
};

const startConsumer = async ({
  queueName,
  processMessage,
  successLabel,
  failureLabel
}) => {
  await channel.assertQueue(queueName, {
    durable: true
  });

  await channel.consume(
    queueName,
    async (message) => {
      if (!message) {
        return;
      }

      try {
        const payload = JSON.parse(message.content.toString());

        await processMessage(payload);

        channel.ack(message);

        console.log(
          `[mail-service] ${successLabel} from queue ${queueName}`
        );
      } catch (error) {
        console.error(
          `[mail-service] ${failureLabel}:`,
          error.message
        );

        channel.nack(message, false, false);
      }
    },
    {
      noAck: false
    }
  );
};

const startMailConsumers = async () => {
  if (channel) {
    return channel;
  }

  connection = await amqp.connect(getRabbitUrl());

  connection.on('error', (error) => {
    console.error('[mail-service] RabbitMQ connection error:', error.message);
  });

  connection.on('close', () => {
    console.warn('[mail-service] RabbitMQ connection closed');
    resetConnectionState();
  });

  channel = await connection.createChannel();

  await channel.prefetch(1);

  await startConsumer({
    queueName: getTargetResultsQueueName(),
    processMessage: mailService.sendTargetResults,
    successLabel: 'target-results message processed',
    failureLabel: 'failed to process target-results message'
  });

  await startConsumer({
    queueName: getRemindersQueueName(),
    processMessage: mailService.sendReminders,
    successLabel: 'reminder message processed',
    failureLabel: 'failed to process reminder message'
  });

  console.log(
    `[mail-service] RabbitMQ consumers started for queues: ${getTargetResultsQueueName()}, ${getRemindersQueueName()}`
  );

  return channel;
};

module.exports = {
  startMailConsumers
};