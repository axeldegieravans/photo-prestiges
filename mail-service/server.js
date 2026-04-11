require('dotenv').config();

const app = require('./src/app');
const { startMailConsumers } = require('./src/services/rabbitmqConsumer');

const PORT = process.env.PORT || 3006;

const startServer = async () => {
  await startMailConsumers();

  app.listen(PORT, () => {
    console.log(`Mail service running on port ${PORT}`);
  });
};

startServer();
