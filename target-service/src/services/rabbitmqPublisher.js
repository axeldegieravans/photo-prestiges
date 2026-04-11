const amqp = require('amqplib');

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

const buildTargetCreatedPayload = (target) => {
  return {
    targetId: String(target._id),
    ownerId: String(target.ownerId),
    startedAt: target.createdAt,
    deadline: target.deadline
  };
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
    console.error('[target-service] RabbitMQ connection error:', error.message);
  });

  connection.on('close', () => {
    console.warn('[target-service] RabbitMQ connection closed');
    resetConnectionState();
  });

  channel = await connection.createChannel();

  await channel.assertQueue(getClockTargetCreatedQueueName(), {
    durable: true
  });

  await channel.assertExchange(getTargetEventsExchangeName(), 'topic', {
    durable: true
  });

  console.log(
    `[target-service] RabbitMQ connected, queue ready: ${getClockTargetCreatedQueueName()}, exchange ready: ${getTargetEventsExchangeName()}`
  );

  return channel;
};

const publishTargetCreated = async ({ target }) => {
  if (!target) {
    const error = new Error('target is required');
    error.statusCode = 400;
    throw error;
  }

  return publishTargetCreatedPayload(buildTargetCreatedPayload(target));
};

const publishTargetCreatedPayload = async (payload) => {
  const activeChannel = await connectRabbitMq();

  const published = activeChannel.sendToQueue(
    getClockTargetCreatedQueueName(),
    Buffer.from(JSON.stringify(payload)),
    {
      persistent: true,
      contentType: 'application/json'
    }
  );

  if (!published) {
    const error = new Error('Failed to publish target-created message');
    error.statusCode = 503;
    throw error;
  }

  return {
    queued: true,
    queue: getClockTargetCreatedQueueName()
  };
};

const publishTargetDeleted = async ({ targetId, ownerId, deletedAt }) => {
  if (!targetId) {
    const error = new Error('targetId is required');
    error.statusCode = 400;
    throw error;
  }

  const payload = {
    eventType: 'target.deleted',
    targetId: String(targetId),
    ownerId: ownerId ? String(ownerId) : null,
    deletedAt: deletedAt || new Date().toISOString()
  };

  const activeChannel = await connectRabbitMq();

  const published = activeChannel.publish(
    getTargetEventsExchangeName(),
    'target.deleted',
    Buffer.from(JSON.stringify(payload)),
    {
      persistent: true,
      contentType: 'application/json'
    }
  );

  if (!published) {
    const error = new Error('Failed to publish target-deleted event');
    error.statusCode = 503;
    throw error;
  }

  return {
    queued: true,
    exchange: getTargetEventsExchangeName(),
    routingKey: 'target.deleted'
  };
};

module.exports = {
  buildTargetCreatedPayload,
  publishTargetCreated,
  publishTargetCreatedPayload,
  publishTargetDeleted
};
