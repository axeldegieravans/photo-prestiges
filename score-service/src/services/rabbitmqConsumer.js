const amqp = require('amqplib');
const { deleteSubmissionsForTargetInternal } = require('./submissionService');

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

const getTargetDeletedQueueName = () => {
  return process.env.SCORE_TARGET_DELETED_QUEUE || 'score.target-deleted';
};

const resetConnectionState = () => {
  connection = null;
  channel = null;
};

const startTargetDeletedConsumer = async () => {
  if (channel) {
    return channel;
  }

  connection = await amqp.connect(getRabbitUrl());

  connection.on('error', (error) => {
    console.error('[score-service] RabbitMQ connection error:', error.message);
  });

  connection.on('close', () => {
    console.warn('[score-service] RabbitMQ connection closed');
    resetConnectionState();
  });

  channel = await connection.createChannel();

  await channel.assertExchange(getTargetEventsExchangeName(), 'topic', {
    durable: true
  });

  await channel.assertQueue(getTargetDeletedQueueName(), {
    durable: true
  });

  await channel.bindQueue(
    getTargetDeletedQueueName(),
    getTargetEventsExchangeName(),
    'target.deleted'
  );

  await channel.prefetch(1);

  await channel.consume(
    getTargetDeletedQueueName(),
    async (message) => {
      if (!message) {
        return;
      }

      try {
        const payload = JSON.parse(message.content.toString());

        const result = await deleteSubmissionsForTargetInternal({
          targetId: payload.targetId
        });

        channel.ack(message);

        console.log(
          `[score-service] target-deleted event processed for target ${payload.targetId}; deleted submissions=${result.deletedCount}`
        );
      } catch (error) {
        console.error(
          '[score-service] failed to process target-deleted event:',
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
    `[score-service] RabbitMQ consumer started for queue: ${getTargetDeletedQueueName()}`
  );

  return channel;
};

module.exports = {
  startTargetDeletedConsumer
};
