require('dotenv').config();

const app = require('./src/app');
const { startMailQueueConsumers } = require('./src/services/mailQueueConsumer');

const PORT = process.env.PORT || 3006;

const startServer = async () => {
    await startMailQueueConsumers();

  app.listen(PORT, () => {
    console.log(`Mail service running on port ${PORT}`);
  });
};

startServer();
