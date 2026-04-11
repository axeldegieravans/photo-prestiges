require('dotenv').config();

const app = require('./src/app');
const connectDB = require('./src/config/db');
const { startTargetDeletedConsumer } = require('./src/services/rabbitmqConsumer');

const PORT = process.env.PORT || 3002;

const startServer = async () => {
  await connectDB();
  await startTargetDeletedConsumer();

  app.listen(PORT, () => {
    console.log(`Register service running on port ${PORT}`);
  });
};

startServer();
