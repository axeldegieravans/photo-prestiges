require('dotenv').config();

const app = require('./src/app');
const connectDB = require('./src/config/db');
const { startTargetDeletedConsumer } = require('./src/services/rabbitmqConsumer');

const PORT = process.env.PORT || 3004;

const startServer = async () => {
  await connectDB();
  await startTargetDeletedConsumer();

  app.listen(PORT, () => {
    console.log(`Score service running on port ${PORT}`);
  });
};

startServer();
