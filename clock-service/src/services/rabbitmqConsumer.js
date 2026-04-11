const amqp = require('amqplib');
const {
  markCompetitionDeleted,
  startCompetitionForTarget
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

const getClockTargetDeletedQueueName = () => {
  return process.env.CLOCK_TARGET_DELETED_QUEUE || 'clock.target-deleted';
};

const resetConnectionState = () => {
  connection = null;
  channel = null;
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

  console.log(
    `[clock-service] RabbitMQ consumers started for queues: ${getClockTargetCreatedQueueName()}, ${getClockTargetDeletedQueueName()}`
  );

  return channel;
};

module.exports = {
  startClockConsumers
};
