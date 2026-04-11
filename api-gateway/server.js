require('dotenv').config();

console.log('AUTH_SERVICE_URL:', process.env.AUTH_SERVICE_URL);
console.log('REGISTER_SERVICE_URL:', process.env.REGISTER_SERVICE_URL);
console.log('TARGET_SERVICE_URL:', process.env.TARGET_SERVICE_URL);

const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});