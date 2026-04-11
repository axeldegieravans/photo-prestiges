require('dotenv').config();

const app = require('./src/app');
const connectDB = require('./src/config/db');
const {
  startTargetEventOutboxWorker
} = require('./src/services/targetEventOutboxService');

const PORT = process.env.PORT || 3003;

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Target service running on port ${PORT}`);
    startTargetEventOutboxWorker();
  });
};

startServer();
