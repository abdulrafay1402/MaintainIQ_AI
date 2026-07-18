require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { connectCloudinary } = require('./config/cloudinary');
const { connectEmail } = require('./services/emailService');
const { checkGeminiConnection } = require('./services/triageService');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    await connectCloudinary();
    await connectEmail();

    // Verify AI connectivity before opening the port. Not fatal:
    // the rule-based fallback keeps triage working without AI.
    console.log('Checking AI connection...');
    const gemini = await checkGeminiConnection();
    if (gemini.connected) {
      console.log(`AI connected: OK (provider: ${gemini.provider})`);
    } else {
      console.warn(`⚠️ AI NOT connected${gemini.provider ? ` [provider: ${gemini.provider}]` : ''} (${gemini.reason}). Rule-based fallback triage will be used.`);
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
};

startServer();
