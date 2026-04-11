require('dotenv').config();

const app = require('./src/app');

const PORT = process.env.PORT || 3007;

app.listen(PORT, () => {
  console.log(`Read service running on port ${PORT}`);
});