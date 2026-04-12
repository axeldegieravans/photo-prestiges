const amqp = require('amqplib');
const {
  closeRegistrationsForTargetInternal,
  deleteRegistrationsForTargetInternal
} = require('./registrationService');

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

const getTargetEventsExchangeName = () => {
  return process.env.TARGET_EVENTS_EXCHANGE || 'target.events';
};

const getClockEventsExchangeName = () => {
  return process.env.CLOCK_EVENTS_EXCHANGE || 'clock.events';
};

const getTargetDeletedQueueName = () => {
  return process.env.REGISTER_TARGET_DELETED_QUEUE || 'register.target-deleted';
};

const getCompetitionExpiredQueueName = () => {
  return process.env.REGISTER_COMPETITION_EXPIRED_QUEUE || 'register.competition-expired';
};

const resetConnectionState = () => {
  connection = null;
  channel = null;
};

const startConsumer = async ({
  queueName,
  exchangeName,
  routingKey,
  processMessage,
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

        await processMessage(payload);

        channel.ack(message);

        console.log(`[register-service] ${successLabel} ${payload.targetId}`);
      } catch (error) {
        console.error(`[register-service] ${failureLabel}:`, error.message);

        channel.nack(message, false, false);
      }
    },
    {
      noAck: false
    }
  );
};

const startRegistrationConsumers = async () => {
  if (channel) {
    return channel;
  }

  connection = await amqp.connect(getRabbitUrl());

  connection.on('error', (error) => {
    console.error('[register-service] RabbitMQ connection error:', error.message);
  });

  connection.on('close', () => {
    console.warn('[register-service] RabbitMQ connection closed');
    resetConnectionState();
  });

  channel = await connection.createChannel();

  await channel.assertExchange(getTargetEventsExchangeName(), 'topic', {
    durable: true
  });

  await channel.assertExchange(getClockEventsExchangeName(), 'topic', {
    durable: true
  });

  await channel.prefetch(1);

  await startConsumer({
    queueName: getTargetDeletedQueueName(),
    exchangeName: getTargetEventsExchangeName(),
    routingKey: 'target.deleted',
    processMessage: async (payload) => {
      const result = await deleteRegistrationsForTargetInternal({
        targetId: payload.targetId
      });

      console.log(
        `[register-service] deleted registrations=${result.deletedRegistrations}`
      );
    },
    successLabel: 'target-deleted event processed for target',
    failureLabel: 'failed to process target-deleted event'
  });

  await startConsumer({
    queueName: getCompetitionExpiredQueueName(),
    exchangeName: getClockEventsExchangeName(),
    routingKey: 'competition.expired',
    processMessage: (payload) =>
      closeRegistrationsForTargetInternal({
        targetId: payload.targetId,
        closedAt: payload.closedAt
      }),
    successLabel: 'competition-expired event processed for target',
    failureLabel: 'failed to process competition-expired event'
  });

  console.log(
    `[register-service] RabbitMQ consumers started for queues: ${getTargetDeletedQueueName()}, ${getCompetitionExpiredQueueName()}`
  );

  return channel;
};

module.exports = {
  startRegistrationConsumers
};
