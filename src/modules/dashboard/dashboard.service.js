import User from '../user/user.model.js';
import Manager from '../manager/manager.model.js';
import Employee from '../employee/employee.model.js';
import Customer from '../customer/customer.model.js';
import Service from '../service/service.model.js';
import CardPlan from '../card/cardPlan.model.js';
import Payment from '../payment/payment.model.js';
import ServiceBooking from '../service/serviceBooking.model.js';
import { ROLES } from '../../constants/roles.js';

class DashboardService {
  /**
   * Get role-based dashboard metrics
   */
  async getStats(user) {
    const role = user.role;

    if (role === ROLES.SUPER_ADMIN) {
      const [
        totalUsers,
        totalManagers,
        totalEmployees,
        totalCustomers,
        activeUsers,
        inactiveUsers,
        totalServices,
        totalCardPlans,
        totalBookings,
        paidPaymentsCount,
        revenueAggregate,
        recentUsers,
        recentPayments
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: ROLES.MANAGER }),
        User.countDocuments({ role: ROLES.EMPLOYEE }),
        User.countDocuments({ role: ROLES.CUSTOMER }),
        User.countDocuments({ isActive: true }),
        User.countDocuments({ isActive: false }),
        Service.countDocuments(),
        CardPlan.countDocuments(),
        ServiceBooking.countDocuments(),
        Payment.countDocuments({ status: 'PAID' }),
        Payment.aggregate([
          { $match: { status: 'PAID' } },
          { $group: { _id: null, totalRevenue: { $sum: '$amount' } } }
        ]),
        User.find()
          .populate('profile')
          .populate('createdBy', 'firstName lastName email role')
          .sort({ createdAt: -1 })
          .limit(5),
        Payment.find()
          .populate('user', 'firstName lastName email')
          .populate('entityId')
          .sort({ createdAt: -1 })
          .limit(5)
      ]);

      const totalRevenue = revenueAggregate.length > 0 ? revenueAggregate[0].totalRevenue : 0;

      return {
        role: ROLES.SUPER_ADMIN,
        summary: {
          totalUsers,
          totalManagers,
          totalEmployees,
          totalCustomers,
          activeUsers,
          inactiveUsers,
          totalServices,
          totalCardPlans,
          totalBookings,
          paidPaymentsCount,
          totalRevenue
        },
        recentActivity: recentUsers,
        recentPayments
      };
    }

    if (role === ROLES.MANAGER) {
      const managerProfile = await Manager.findOne({ user: user._id });
      const managedEmployeeIds = managerProfile?.managedEmployees || [];

      const [
        totalDepartmentEmployees,
        totalCustomers,
        activeEmployees,
        recentEmployees,
        recentCustomers
      ] = await Promise.all([
        Employee.countDocuments({
          $or: [
            { manager: managerProfile?._id },
            { department: managerProfile?.department }
          ]
        }),
        Customer.countDocuments(),
        User.countDocuments({ role: ROLES.EMPLOYEE, isActive: true }),
        User.find({ role: ROLES.EMPLOYEE })
          .populate('profile')
          .sort({ createdAt: -1 })
          .limit(5),
        User.find({ role: ROLES.CUSTOMER })
          .populate('profile')
          .sort({ createdAt: -1 })
          .limit(5)
      ]);

      return {
        role: ROLES.MANAGER,
        managerInfo: {
          department: managerProfile?.department,
          branch: managerProfile?.branch,
          teamSize: managedEmployeeIds.length,
          maxTeamSize: managerProfile?.maxTeamSize
        },
        summary: {
          totalDepartmentEmployees,
          totalCustomers,
          activeEmployees
        },
        recentEmployees,
        recentCustomers
      };
    }

    if (role === ROLES.EMPLOYEE) {
      const employeeProfile = await Employee.findOne({ user: user._id });

      const [
        totalCustomers,
        customersCreatedByMe,
        recentCustomers
      ] = await Promise.all([
        Customer.countDocuments(),
        User.countDocuments({ role: ROLES.CUSTOMER, createdBy: user._id }),
        User.find({ role: ROLES.CUSTOMER })
          .populate('profile')
          .sort({ createdAt: -1 })
          .limit(5)
      ]);

      return {
        role: ROLES.EMPLOYEE,
        employeeInfo: {
          employeeCode: employeeProfile?.employeeCode,
          designation: employeeProfile?.designation,
          department: employeeProfile?.department
        },
        summary: {
          totalCustomers,
          customersCreatedByMe
        },
        recentCustomers
      };
    }

    // Customer
    const customerProfile = await Customer.findOne({ user: user._id });
    return {
      role: ROLES.CUSTOMER,
      customerInfo: {
        customerCode: customerProfile?.customerCode,
        membershipType: customerProfile?.membershipType,
        aadharNumber: customerProfile?.aadharNumber,
        panNumber: customerProfile?.panNumber,
        hasCard: customerProfile?.hasCard,
        activeCard: customerProfile?.activeCard,
        loyaltyPoints: customerProfile?.loyaltyPoints,
        address: customerProfile?.address
      }
    };
  }
}

export default new DashboardService();
