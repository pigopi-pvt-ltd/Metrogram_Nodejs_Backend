import 'dotenv/config';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import superAdminService from '../modules/superAdmin/superAdmin.service.js';

const seedSuperAdmin = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/user_management_db';

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
      console.log('Connected to MongoDB for seeding...');
    }

    const email = (process.env.SUPER_ADMIN_EMAIL || 'boss@company.com').toLowerCase();
    const password = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123456';
    const firstName = process.env.SUPER_ADMIN_FIRST_NAME || 'Boss';
    const lastName = process.env.SUPER_ADMIN_LAST_NAME || 'Admin';
    const phoneNumber = process.env.SUPER_ADMIN_PHONE || '+1234567890';

    const result = await superAdminService.seedSuperAdmin({
      email,
      password,
      firstName,
      lastName,
      phoneNumber
    });

    if (result.alreadyExisted) {
      console.log(`⚠️ Super Admin already exists: ${result.user.email} (ID: ${result.user._id})`);
      return result.user;
    }

    console.log('====================================================');
    console.log('✅ Super Admin (Boss) successfully seeded!');
    console.log(`👤 Name: ${firstName} ${lastName}`);
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`🆔 User ID: ${result.user._id}`);
    console.log(`🛡️  Profile ID: ${result.superAdminProfile._id}`);
    console.log('====================================================');

    return result.user;
  } catch (error) {
    console.error('❌ Error seeding Super Admin:', error.message);
    throw error;
  }
};

const isDirectExecution =
  (typeof import.meta.main !== 'undefined' && import.meta.main) ||
  (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]);

if (isDirectExecution) {
  seedSuperAdmin()
    .then(async () => {
      await mongoose.disconnect();
      console.log('Seeding completed. Disconnected from MongoDB.');
      process.exit(0);
    })
    .catch(async (error) => {
      console.error(error);
      await mongoose.disconnect();
      process.exit(1);
    });
}

export default seedSuperAdmin;
