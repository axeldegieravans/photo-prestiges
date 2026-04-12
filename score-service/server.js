require('dotenv').config();

const app = require('./src/app');
const connectDB = require('./src/config/db');
const { startSubmissionEventConsumers } = require('./src/services/submissionEventConsumer');

const PORT = process.env.PORT || 3004;

const startServer = async () => {
  await connectDB();
  await startSubmissionEventConsumers();

  app.listen(PORT, () => {
    console.log(`Score service running on port ${PORT}`);
  });
};

startServer();
