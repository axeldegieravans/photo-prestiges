require('dotenv').config();

const app = require('./src/app');
const { connectDB } = require('./src/config/db');
const { startScheduler } = require('./src/services/clockService');
const { startClockConsumers } = require('./src/services/rabbitmqConsumer');

const PORT = process.env.PORT || 3005;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, async () => {
      console.log(`Clock service running on port ${PORT}`);

      startScheduler();

      try {
        await startClockConsumers();
      } catch (error) {
        console.error(
          '[clock-service] Failed to start RabbitMQ consumers:',
          error.message
        );
      }
    });
  } catch (error) {
    console.error('[clock-service] Failed to start:', error.message);
    process.exit(1);
  }
};

startServer();
