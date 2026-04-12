const amqp = require('amqplib');
const { finalizeTargetInternal } = require('./targetService');

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

const getClockEventsExchangeName = () => {
  return process.env.CLOCK_EVENTS_EXCHANGE || 'clock.events';
};

const getWinnerDeterminedQueueName = () => {
  return process.env.TARGET_WINNER_DETERMINED_QUEUE || 'target.winner-determined';
};

const resetConnectionState = () => {
  connection = null;
  channel = null;
};

const startClockEventConsumer = async () => {
  if (channel) {
    return channel;
  }

  connection = await amqp.connect(getRabbitUrl());

  connection.on('error', (error) => {
    console.error('[target-service] RabbitMQ consumer connection error:', error.message);
  });

  connection.on('close', () => {
    console.warn('[target-service] RabbitMQ consumer connection closed');
    resetConnectionState();
  });

  channel = await connection.createChannel();

  await channel.assertExchange(getClockEventsExchangeName(), 'topic', {
    durable: true
  });

  await channel.assertQueue(getWinnerDeterminedQueueName(), {
    durable: true
  });

  await channel.bindQueue(
    getWinnerDeterminedQueueName(),
    getClockEventsExchangeName(),
    'winner.determined'
  );

  await channel.prefetch(1);

  await channel.consume(
    getWinnerDeterminedQueueName(),
    async (message) => {
      if (!message) {
        return;
      }

      try {
        const payload = JSON.parse(message.content.toString());

        await finalizeTargetInternal({
          targetId: payload.targetId,
          data: payload
        });

        channel.ack(message);

        console.log(
          `[target-service] winner-determined event processed for target ${payload.targetId}`
        );
      } catch (error) {
        console.error(
          '[target-service] failed to process winner-determined event:',
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
    `[target-service] RabbitMQ consumer started for queue: ${getWinnerDeterminedQueueName()}`
  );

  return channel;
};

module.exports = {
  startClockEventConsumer
};
