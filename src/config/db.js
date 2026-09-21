import mongoose from 'mongoose';

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/user_management_db';
  try {
    console.log(`🔌 Connecting to MongoDB at ${uri}...`);
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.error(`💡 Tip: Ensure your MongoDB Docker container or service is running on ${uri}`);
    process.exit(1);
  }
};

export default connectDB;
