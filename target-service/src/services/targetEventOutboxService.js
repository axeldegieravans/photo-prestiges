const TargetEventOutbox = require('../models/TargetEventOutbox');
const {
  buildTargetCreatedPayload,
  publishTargetCreatedPayload
} = require('./targetEventPublisher');

let intervalId = null;
let isDispatching = false;

const getRetryDelayMs = (attempts) => {
  return Math.min(60000, 1000 * (2 ** Math.max(attempts, 0)));
};

const enqueueTargetCreatedEvent = async ({ target }) => {
  const payload = buildTargetCreatedPayload(target);

  const event = await TargetEventOutbox.findOneAndUpdate(
    {
      eventType: 'target.created',
      targetId: payload.targetId
    },
    {
      $setOnInsert: {
        eventType: 'target.created',
        targetId: payload.targetId,
        payload,
        status: 'PENDING',
        attempts: 0,
        nextAttemptAt: new Date()
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  return event;
};

const dispatchTargetCreatedEvent = async (event) => {
  try {
    await publishTargetCreatedPayload(event.payload);

    event.status = 'PUBLISHED';
    event.publishedAt = new Date();
    event.lastError = null;
    await event.save();

    return {
      targetId: event.targetId,
      status: event.status
    };
  } catch (error) {
    event.attempts += 1;
    event.status = 'FAILED';
    event.lastError = error.message;
    event.nextAttemptAt = new Date(Date.now() + getRetryDelayMs(event.attempts));
    await event.save();

    throw error;
  }
};

const dispatchPendingTargetEvents = async ({ limit = 20 } = {}) => {
  if (isDispatching) {
    return {
      skipped: true
    };
  }

  isDispatching = true;

  try {
    const events = await TargetEventOutbox.find({
      eventType: 'target.created',
      status: { $in: ['PENDING', 'FAILED'] },
      nextAttemptAt: { $lte: new Date() }
    })
      .sort({ createdAt: 1 })
      .limit(limit);

    let published = 0;
    let failed = 0;

    for (const event of events) {
      try {
        await dispatchTargetCreatedEvent(event);
        published += 1;
      } catch (error) {
        failed += 1;
        console.warn(
          '[target-service] Failed to publish target-created outbox event:',
          event.targetId,
          error.message
        );
      }
    }

    return {
      skipped: false,
      scanned: events.length,
      published,
      failed
    };
  } finally {
    isDispatching = false;
  }
};

const startTargetEventOutboxWorker = () => {
  if (intervalId) {
    return;
  }

  const intervalMs = Math.max(
    Number(process.env.TARGET_OUTBOX_INTERVAL_MS) || 10000,
    1000
  );

  intervalId = setInterval(async () => {
    try {
      await dispatchPendingTargetEvents();
    } catch (error) {
      console.error('[target-service] Outbox worker failed:', error.message);
    }
  }, intervalMs);

  console.log(
    `[target-service] target event outbox worker started with interval ${intervalMs}ms`
  );
};

module.exports = {
  enqueueTargetCreatedEvent,
  dispatchTargetCreatedEvent,
  dispatchPendingTargetEvents,
  startTargetEventOutboxWorker
};
