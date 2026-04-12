const amqp = require('amqplib');

let connection = null;
let channel = null;

const getTargetResultsQueueName = () => {
  return process.env.MAIL_TARGET_RESULTS_QUEUE || 'mail.target-results';
};

const getRemindersQueueName = () => {
  return process.env.MAIL_REMINDERS_QUEUE || 'mail.reminders';
};

const getClockEventsExchangeName = () => {
  return process.env.CLOCK_EVENTS_EXCHANGE || 'clock.events';
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

const connectRabbitMq = async () => {
  if (channel) {
    return channel;
  }

  connection = await amqp.connect(getRabbitUrl());

  connection.on('error', (error) => {
    console.error('[clock-service] RabbitMQ connection error:', error.message);
  });

  connection.on('close', () => {
    console.warn('[clock-service] RabbitMQ connection closed');
    resetConnectionState();
  });

  channel = await connection.createChannel();

  await channel.assertQueue(getTargetResultsQueueName(), {
    durable: true
  });

  await channel.assertQueue(getRemindersQueueName(), {
    durable: true
  });

  await channel.assertExchange(getClockEventsExchangeName(), 'topic', {
    durable: true
  });

  console.log(
    `[clock-service] RabbitMQ connected, queues ready: ${getTargetResultsQueueName()}, ${getRemindersQueueName()}, exchange ready: ${getClockEventsExchangeName()}`
  );

  return channel;
};

const publishMessage = async ({ queueName, payload, failureMessage }) => {
  if (!payload || typeof payload !== 'object') {
    const error = new Error('RabbitMQ payload must be an object');
    error.statusCode = 400;
    throw error;
  }

  const activeChannel = await connectRabbitMq();

  const published = activeChannel.sendToQueue(
    queueName,
    Buffer.from(JSON.stringify(payload)),
    {
      persistent: true,
      contentType: 'application/json'
    }
  );

  if (!published) {
    const error = new Error(failureMessage);
    error.statusCode = 503;
    throw error;
  }

  return {
    queued: true,
    queue: queueName
  };
};

const publishEvent = async ({ routingKey, payload, failureMessage }) => {
  if (!payload || typeof payload !== 'object') {
    const error = new Error('RabbitMQ payload must be an object');
    error.statusCode = 400;
    throw error;
  }

  const activeChannel = await connectRabbitMq();

  const published = activeChannel.publish(
    getClockEventsExchangeName(),
    routingKey,
    Buffer.from(JSON.stringify(payload)),
    {
      persistent: true,
      contentType: 'application/json'
    }
  );

  if (!published) {
    const error = new Error(failureMessage);
    error.statusCode = 503;
    throw error;
  }

  return {
    queued: true,
    exchange: getClockEventsExchangeName(),
    routingKey
  };
};

const publishTargetResultsMessage = async (payload) => {
  return publishMessage({
    queueName: getTargetResultsQueueName(),
    payload,
    failureMessage: 'Failed to publish target results message'
  });
};

const publishReminderMessage = async (payload) => {
  return publishMessage({
    queueName: getRemindersQueueName(),
    payload,
    failureMessage: 'Failed to publish reminder message'
  });
};

const publishCompetitionExpiredEvent = async (payload) => {
  return publishEvent({
    routingKey: 'competition.expired',
    payload: {
      eventType: 'competition.expired',
      ...payload
    },
    failureMessage: 'Failed to publish competition-expired event'
  });
};

const publishWinnerDeterminedEvent = async (payload) => {
  return publishEvent({
    routingKey: 'winner.determined',
    payload: {
      eventType: 'winner.determined',
      ...payload
    },
    failureMessage: 'Failed to publish winner-determined event'
  });
};

module.exports = {
  connectRabbitMq,
  publishTargetResultsMessage,
  publishReminderMessage,
  publishCompetitionExpiredEvent,
  publishWinnerDeterminedEvent
};
