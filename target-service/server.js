require('dotenv').config();

const app = require('./src/app');
const connectDB = require('./src/config/db');
const {
  startTargetEventOutboxWorker
} = require('./src/services/targetEventOutboxService');
const { startClockEventConsumer } = require('./src/services/rabbitmqConsumer');

const PORT = process.env.PORT || 3003;

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Target service running on port ${PORT}`);
    startTargetEventOutboxWorker();

    startClockEventConsumer().catch((error) => {
      console.error(
        '[target-service] Failed to start RabbitMQ consumers:',
        error.message
      );
    });
  });
};

startServer();
