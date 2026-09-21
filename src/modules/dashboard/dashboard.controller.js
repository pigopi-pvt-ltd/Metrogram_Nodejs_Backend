import dashboardService from './dashboard.service.js';

class DashboardController {
  async getStats(req, res, next) {
    try {
      const stats = await dashboardService.getStats(req.user);
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new DashboardController();
