const amqp = require('amqplib');
const {
  deleteRegistrationSnapshot,
  deleteSubmissionSnapshot,
  markCompetitionDeleted,
  startCompetitionForTarget,
  upsertRegistrationSnapshot,
  upsertSubmissionSnapshot
} = require('./clockService');

let connection = null;
let channel = null;

const getRabbitUrl = () => {
  const url = process.env.RABBITMQ_URL;

  if (!url) {
    const error = new Error('RABBITMQ_URL is not configured');
    error.statusCode = 500;
    throw error;
  }

  return url;
};

const getClockTargetCreatedQueueName = () => {
  return process.env.CLOCK_TARGET_CREATED_QUEUE || 'clock.target-created';
};

const getTargetEventsExchangeName = () => {
  return process.env.TARGET_EVENTS_EXCHANGE || 'target.events';
};

const getRegisterEventsExchangeName = () => {
  return process.env.REGISTER_EVENTS_EXCHANGE || 'register.events';
};

const getScoreEventsExchangeName = () => {
  return process.env.SCORE_EVENTS_EXCHANGE || 'score.events';
};

const getClockTargetDeletedQueueName = () => {
  return process.env.CLOCK_TARGET_DELETED_QUEUE || 'clock.target-deleted';
};

const getClockRegistrationCreatedQueueName = () => {
  return process.env.CLOCK_REGISTRATION_CREATED_QUEUE || 'clock.registration-created';
};

const getClockRegistrationDeletedQueueName = () => {
  return process.env.CLOCK_REGISTRATION_DELETED_QUEUE || 'clock.registration-deleted';
};

const getClockSubmissionCreatedQueueName = () => {
  return process.env.CLOCK_SUBMISSION_CREATED_QUEUE || 'clock.submission-created';
};

const getClockSubmissionDeletedQueueName = () => {
  return process.env.CLOCK_SUBMISSION_DELETED_QUEUE || 'clock.submission-deleted';
};

const resetConnectionState = () => {
  connection = null;
  channel = null;
};

const bindConsumer = async ({
  queueName,
  exchangeName,
  routingKey,
  handler,
  successLabel,
  failureLabel
}) => {
  await channel.assertQueue(queueName, {
    durable: true
  });

  await channel.bindQueue(queueName, exchangeName, routingKey);

  await channel.consume(
    queueName,
    async (message) => {
      if (!message) {
        return;
      }

      try {
        const payload = JSON.parse(message.content.toString());

        await handler(payload);

        channel.ack(message);

        console.log(`[clock-service] ${successLabel} ${payload.targetId}`);
      } catch (error) {
        console.error(`[clock-service] ${failureLabel}:`, error.message);

        channel.nack(message, false, false);
      }
    },
    {
      noAck: false
    }
  );
};

const startClockConsumers = async () => {
  if (channel) {
    return channel;
  }

  connection = await amqp.connect(getRabbitUrl());

  connection.on('error', (error) => {
    console.error('[clock-service] target-created RabbitMQ connection error:', error.message);
  });

  connection.on('close', () => {
    console.warn('[clock-service] target-created RabbitMQ connection closed');
    resetConnectionState();
  });

  channel = await connection.createChannel();

  await channel.assertQueue(getClockTargetCreatedQueueName(), {
    durable: true
  });

  await channel.assertExchange(getTargetEventsExchangeName(), 'topic', {
    durable: true
  });

  await channel.assertExchange(getRegisterEventsExchangeName(), 'topic', {
    durable: true
  });

  await channel.assertExchange(getScoreEventsExchangeName(), 'topic', {
    durable: true
  });

  await channel.assertQueue(getClockTargetDeletedQueueName(), {
    durable: true
  });

  await channel.bindQueue(
    getClockTargetDeletedQueueName(),
    getTargetEventsExchangeName(),
    'target.deleted'
  );

  await channel.prefetch(1);

  await channel.consume(
    getClockTargetCreatedQueueName(),
    async (message) => {
      if (!message) {
        return;
      }

      try {
        const payload = JSON.parse(message.content.toString());

        await startCompetitionForTarget({
          data: payload
        });

        channel.ack(message);

        console.log(
          `[clock-service] target-created message processed for target ${payload.targetId}`
        );
      } catch (error) {
        console.error(
          '[clock-service] failed to process target-created message:',
          error.message
        );

        channel.nack(message, false, false);
      }
    },
    {
      noAck: false
    }
  );

  await channel.consume(
    getClockTargetDeletedQueueName(),
    async (message) => {
      if (!message) {
        return;
      }

      try {
        const payload = JSON.parse(message.content.toString());

        await markCompetitionDeleted({
          targetId: payload.targetId,
          deletedAt: payload.deletedAt
        });

        channel.ack(message);

        console.log(
          `[clock-service] target-deleted message processed for target ${payload.targetId}`
        );
      } catch (error) {
        console.error(
          '[clock-service] failed to process target-deleted message:',
          error.message
        );

        channel.nack(message, false, false);
      }
    },
    {
      noAck: false
    }
  );

  await bindConsumer({
    queueName: getClockRegistrationCreatedQueueName(),
    exchangeName: getRegisterEventsExchangeName(),
    routingKey: 'registration.created',
    handler: (payload) => upsertRegistrationSnapshot({ data: payload }),
    successLabel: 'registration-created event processed for target',
    failureLabel: 'failed to process registration-created event'
  });

  await bindConsumer({
    queueName: getClockRegistrationDeletedQueueName(),
    exchangeName: getRegisterEventsExchangeName(),
    routingKey: 'registration.deleted',
    handler: (payload) => deleteRegistrationSnapshot({ data: payload }),
    successLabel: 'registration-deleted event processed for target',
    failureLabel: 'failed to process registration-deleted event'
  });

  await bindConsumer({
    queueName: getClockSubmissionCreatedQueueName(),
    exchangeName: getScoreEventsExchangeName(),
    routingKey: 'submission.created',
    handler: (payload) => upsertSubmissionSnapshot({ data: payload }),
    successLabel: 'submission-created event processed for target',
    failureLabel: 'failed to process submission-created event'
  });

  await bindConsumer({
    queueName: getClockSubmissionDeletedQueueName(),
    exchangeName: getScoreEventsExchangeName(),
    routingKey: 'submission.deleted',
    handler: (payload) => deleteSubmissionSnapshot({ data: payload }),
    successLabel: 'submission-deleted event processed for target',
    failureLabel: 'failed to process submission-deleted event'
  });

  console.log(
    `[clock-service] RabbitMQ consumers started for queues: ${getClockTargetCreatedQueueName()}, ${getClockTargetDeletedQueueName()}, ${getClockRegistrationCreatedQueueName()}, ${getClockRegistrationDeletedQueueName()}, ${getClockSubmissionCreatedQueueName()}, ${getClockSubmissionDeletedQueueName()}`
  );

  return channel;
};

module.exports = {
  startClockConsumers
};
