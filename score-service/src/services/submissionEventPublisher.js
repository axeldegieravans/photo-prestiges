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

const getScoreEventsExchangeName = () => {
  return process.env.SCORE_EVENTS_EXCHANGE || 'score.events';
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
    console.error('[score-service] RabbitMQ publisher connection error:', error.message);
  });

  connection.on('close', () => {
    console.warn('[score-service] RabbitMQ publisher connection closed');
    resetConnectionState();
  });

  channel = await connection.createChannel();

  await channel.assertExchange(getScoreEventsExchangeName(), 'topic', {
    durable: true
  });

  console.log(
    `[score-service] RabbitMQ publisher exchange ready: ${getScoreEventsExchangeName()}`
  );

  return channel;
};

const publishSubmissionEvent = async ({ routingKey, payload }) => {
  const activeChannel = await connectRabbitMq();

  const published = activeChannel.publish(
    getScoreEventsExchangeName(),
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
    exchange: getScoreEventsExchangeName(),
    routingKey
  };
};

const publishSubmissionCreated = async ({ submission, user }) => {
  return publishSubmissionEvent({
    routingKey: 'submission.created',
    payload: {
      eventType: 'submission.created',
      submissionId: String(submission._id),
      targetId: String(submission.targetId),
      participantId: String(submission.participantId),
      participantEmail: user?.email || null,
      participantName: user?.name || null,
      similarityScore: submission.similarityScore,
      submittedAt: submission.submittedAt || submission.createdAt
    }
  });
};

const publishSubmissionDeleted = async ({ submission, user }) => {
  return publishSubmissionEvent({
    routingKey: 'submission.deleted',
    payload: {
      eventType: 'submission.deleted',
      submissionId: String(submission._id),
      targetId: String(submission.targetId),
      participantId: String(submission.participantId),
      participantEmail: user?.email || null,
      participantName: user?.name || null,
      deletedAt: new Date().toISOString()
    }
  });
};

module.exports = {
  publishSubmissionCreated,
  publishSubmissionDeleted
};
