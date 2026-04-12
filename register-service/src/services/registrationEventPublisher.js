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

const getRegisterEventsExchangeName = () => {
  return process.env.REGISTER_EVENTS_EXCHANGE || 'register.events';
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
    console.error('[register-service] RabbitMQ publisher connection error:', error.message);
  });

  connection.on('close', () => {
    console.warn('[register-service] RabbitMQ publisher connection closed');
    resetConnectionState();
  });

  channel = await connection.createChannel();

  await channel.assertExchange(getRegisterEventsExchangeName(), 'topic', {
    durable: true
  });

  console.log(
    `[register-service] RabbitMQ publisher exchange ready: ${getRegisterEventsExchangeName()}`
  );

  return channel;
};

const publishRegistrationEvent = async ({ routingKey, payload }) => {
  const activeChannel = await connectRabbitMq();

  const published = activeChannel.publish(
    getRegisterEventsExchangeName(),
    routingKey,
    Buffer.from(JSON.stringify(payload)),
    {
      persistent: true,
      contentType: 'application/json'
    }
  );

  if (!published) {
    const error = new Error(`Failed to publish ${routingKey} event`);
    error.statusCode = 503;
    throw error;
  }

  return {
    queued: true,
    exchange: getRegisterEventsExchangeName(),
    routingKey
  };
};

const publishRegistrationCreated = async ({ registration, user }) => {
  return publishRegistrationEvent({
    routingKey: 'registration.created',
    payload: {
      eventType: 'registration.created',
      registrationId: String(registration._id),
      targetId: String(registration.targetId),
      participantId: String(registration.participantId),
      participantEmail: user?.email || null,
      participantName: user?.name || null,
      registeredAt: registration.registeredAt || registration.createdAt
    }
  });
};

const publishRegistrationDeleted = async ({ registration, user }) => {
  return publishRegistrationEvent({
    routingKey: 'registration.deleted',
    payload: {
      eventType: 'registration.deleted',
      registrationId: String(registration._id),
      targetId: String(registration.targetId),
      participantId: String(registration.participantId),
      participantEmail: user?.email || null,
      participantName: user?.name || null,
      deletedAt: new Date().toISOString()
    }
  });
};

module.exports = {
  publishRegistrationCreated,
  publishRegistrationDeleted
};
