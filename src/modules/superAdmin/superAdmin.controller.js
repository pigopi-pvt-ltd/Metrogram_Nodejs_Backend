import superAdminService from './superAdmin.service.js';

class SuperAdminController {
  async getProfile(req, res, next) {
    try {
      const profile = await superAdminService.getProfileByUserId(req.user._id);
      if (!profile) {
        return res.status(404).json({
          success: false,
          message: 'Super Admin profile not found'
        });
      }
      res.status(200).json({
        success: true,
        data: profile
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new SuperAdminController();
