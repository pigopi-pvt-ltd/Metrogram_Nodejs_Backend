import SuperAdmin from './superAdmin.model.js';
import User from '../user/user.model.js';
import { ROLES, PROFILE_MODELS } from '../../constants/roles.js';

class SuperAdminService {
  /**
   * Seed the Super Admin (Boss)
   */
  async seedSuperAdmin({
    email,
    password,
    firstName = 'Boss',
    lastName = 'Admin',
    phoneNumber = '+1234567890'
  }) {
    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { role: ROLES.SUPER_ADMIN }]
    });

    if (existing) {
      return { user: existing, alreadyExisted: true };
    }

    const user = new User({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password,
      phoneNumber,
      role: ROLES.SUPER_ADMIN,
      profileModel: PROFILE_MODELS[ROLES.SUPER_ADMIN],
      createdBy: null
    });

    await user.save();

    const superAdminProfile = new SuperAdmin({
      user: user._id,
      adminLevel: 'PRIMARY_BOSS',
      permissions: ['*'],
      systemNotes: 'Seeded Master Super Admin (Boss)'
    });

    await superAdminProfile.save();

    user.profile = superAdminProfile._id;
    await user.save();

    return { user, superAdminProfile, alreadyExisted: false };
  }

  /**
   * Get SuperAdmin profile by user ID
   */
  async getProfileByUserId(userId) {
    return await SuperAdmin.findOne({ user: userId }).populate('user');
  }
}

export default new SuperAdminService();
