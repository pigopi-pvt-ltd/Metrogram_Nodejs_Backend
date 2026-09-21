import 'dotenv/config';
import app from './app.js';
import connectDB from './config/db.js';

const PORT = process.env.PORT || 5000;

// Connect to Database and start server
const startServer = async () => {
  try {
    await connectDB();
    const serverUrl = `http://localhost:${PORT}`;
    app.listen(PORT, () => {
      console.log('====================================================');
      console.log(`🚀 MetroGram Server started successfully!`);
      console.log(`🌐 Server URL:     ${serverUrl}`);
      console.log(`📡 API Base URL:   ${serverUrl}/api`);
      console.log(`🩺 Health Check:   ${serverUrl}/api/health`);
      console.log(`⚙️  Environment:    ${process.env.NODE_ENV || 'development'}`);
      console.log('====================================================');
    });
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();
