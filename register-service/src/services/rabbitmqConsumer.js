const amqp = require('amqplib');
const { deleteRegistrationsForTargetInternal } = require('./registrationService');

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
  return process.env.REGISTER_TARGET_DELETED_QUEUE || 'register.target-deleted';
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

        const result = await deleteRegistrationsForTargetInternal({
          targetId: payload.targetId
        });

        channel.ack(message);

        console.log(
          `[register-service] target-deleted event processed for target ${payload.targetId}; deleted registrations=${result.deletedRegistrations}`
        );
      } catch (error) {
        console.error(
          '[register-service] failed to process target-deleted event:',
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
    `[register-service] RabbitMQ consumer started for queue: ${getTargetDeletedQueueName()}`
  );

  return channel;
};

module.exports = {
  startTargetDeletedConsumer
};
