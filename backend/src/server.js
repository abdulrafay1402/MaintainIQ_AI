require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { connectCloudinary } = require('./config/cloudinary');
const { connectEmail } = require('./services/emailService');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    await connectCloudinary();
    await connectEmail();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
};

startServer();
