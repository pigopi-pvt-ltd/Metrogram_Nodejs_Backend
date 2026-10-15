import FranchiseEnquiry from './franchise.model.js';
import User from '../user/user.model.js';
import emailService from '../../services/email.service.js';
import { ROLES } from '../../constants/roles.js';

class FranchiseService {
  /**
   * Submit a new franchise enquiry (Public)
   * Validates input, saves enquiry to DB, and sends alert email to Super Admin & confirmation to applicant
   */
  async createEnquiry(payload = {}, meta = {}) {
    // Helper to extract field value supporting camelCase, PascalCase, snake_case, and space-separated keys
    const getVal = (...keys) => {
      for (const k of keys) {
        if (payload[k] !== undefined && payload[k] !== null && String(payload[k]).trim() !== '') {
          return String(payload[k]).trim();
        }
      }
      const lowerMap = {};
      for (const [key, value] of Object.entries(payload)) {
        lowerMap[key.toLowerCase().replace(/[\s_-]/g, '')] = value;
      }
      for (const k of keys) {
        const normK = k.toLowerCase().replace(/[\s_-]/g, '');
        if (lowerMap[normK] !== undefined && lowerMap[normK] !== null && String(lowerMap[normK]).trim() !== '') {
          return String(lowerMap[normK]).trim();
        }
      }
      return '';
    };

    const fullName = getVal('fullName', 'name', 'applicantName');
    const email = getVal('email').toLowerCase();
    const phone = getVal('phone', 'mobile', 'phoneNumber', 'contactNumber');
    const location = getVal('location', 'preferredLocation', 'city');
    const currentOccupation = getVal('currentOccupation', 'current occupation', 'occupation', 'profession');
    
    // Address & code resolution
    const rawAddress = getVal('address', 'streetAddress');
    const rawCode = getVal('pincode', 'code', 'pinCode', 'postalCode', 'zipCode');
    const rawAddressWithCode = getVal('addressWithCode', 'address with code', 'addressWithPincode');

    const address = rawAddress || rawAddressWithCode;
    const pincode = rawCode;

    // Build canonical address with code string
    let addressWithCode = rawAddressWithCode;
    if (!addressWithCode && address) {
      addressWithCode = pincode ? `${address}, Code/PIN: ${pincode}` : address;
    }

    const notes = getVal('notes', 'message', 'remarks');

    // Validation checks
    const missingFields = [];
    if (!fullName) missingFields.push('Name');
    if (!email) missingFields.push('Email');
    if (!phone) missingFields.push('Mobile');
    if (!location) missingFields.push('Location');
    if (!currentOccupation) missingFields.push('Current occupation');
    if (!address) missingFields.push('Address');
    if (!pincode && !rawAddressWithCode) missingFields.push('Address Code / Pincode');

    if (missingFields.length > 0) {
      const err = new Error(`Please provide all required fields: ${missingFields.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    // Email format check
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      const err = new Error('Please provide a valid email address');
      err.statusCode = 400;
      throw err;
    }

    // Phone format check (must contain at least 7 digits)
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      const err = new Error('Please provide a valid mobile number');
      err.statusCode = 400;
      throw err;
    }

    // Prevent spam: Check duplicate enquiry with same email/phone in last 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentDuplicate = await FranchiseEnquiry.findOne({
      $or: [{ email }, { phone }],
      createdAt: { $gte: tenMinutesAgo }
    });

    if (recentDuplicate) {
      const err = new Error('An enquiry was already submitted with this contact information recently. Our team will contact you shortly.');
      err.statusCode = 429;
      throw err;
    }

    const enquiry = new FranchiseEnquiry({
      fullName,
      email,
      phone,
      location,
      currentOccupation,
      address,
      pincode,
      addressWithCode,
      notes,
      ipAddress: meta.ipAddress || '',
      userAgent: meta.userAgent || '',
      status: 'PENDING'
    });

    await enquiry.save();

    // Determine Super Admin email addresses
    this._dispatchNotificationEmails(enquiry).catch((err) => {
      console.error('[FranchiseService] Background email dispatch error:', err.message);
    });

    return enquiry;
  }

  /**
   * Helper to dispatch email to Super Admin and confirmation to applicant
   */
  async _dispatchNotificationEmails(enquiry) {
    try {
      // 1. Fetch Super Admin email(s) from database
      const superAdmins = await User.find({
        role: ROLES.SUPER_ADMIN,
        isActive: true
      }).select('email firstName lastName');

      const adminEmails = superAdmins
        .map((u) => u.email)
        .filter(Boolean);

      // Also check env vars as fallback / supplement
      const envSuperAdminEmail = process.env.SUPER_ADMIN_NOTIFICATION_EMAIL || process.env.SUPER_ADMIN_EMAIL;
      if (envSuperAdminEmail && !adminEmails.includes(envSuperAdminEmail.toLowerCase())) {
        adminEmails.push(envSuperAdminEmail.toLowerCase());
      }

      // If no admin email is found, fallback to sender
      if (adminEmails.length === 0 && process.env.EMAIL_ID_SENDER) {
        adminEmails.push(process.env.EMAIL_ID_SENDER);
      }

      // Dispatch Super Admin alert
      if (adminEmails.length > 0) {
        await emailService.sendFranchiseEnquiryAlertToSuperAdmin({
          to: adminEmails,
          enquiry
        });
      }

      // 2. Dispatch applicant confirmation email
      if (enquiry.email) {
        await emailService.sendFranchiseEnquiryConfirmationToApplicant({
          to: enquiry.email,
          name: enquiry.fullName,
          enquiryCode: enquiry.enquiryCode,
          location: enquiry.location
        });
      }
    } catch (error) {
      console.error('[FranchiseService] Failed to send franchise notification emails:', error.message);
    }
  }

  /**
   * Get all franchise enquiries (Super Admin only)
   * With search, status filtering, location filter, date range, pagination
   */
  async getAllEnquiries({
    status = '',
    search = '',
    location = '',
    startDate = '',
    endDate = '',
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = {}) {
    const filter = {};

    if (status) {
      filter.status = status.toUpperCase();
    }

    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    if (search) {
      filter.$or = [
        { enquiryCode: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { currentOccupation: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
        { pincode: { $regex: search, $options: 'i' } },
        { addressWithCode: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;
    const sortObj = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [enquiries, total] = await Promise.all([
      FranchiseEnquiry.find(filter)
        .populate('reviewedBy', 'firstName lastName email role')
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum),
      FranchiseEnquiry.countDocuments(filter)
    ]);

    return {
      enquiries,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      limit: limitNum
    };
  }

  /**
   * Get single franchise enquiry by ID (Super Admin)
   */
  async getEnquiryById(id) {
    const enquiry = await FranchiseEnquiry.findById(id).populate(
      'reviewedBy',
      'firstName lastName email role'
    );

    if (!enquiry) {
      const err = new Error('Franchise enquiry not found');
      err.statusCode = 404;
      throw err;
    }

    return enquiry;
  }

  /**
   * Update enquiry status & admin remarks (Super Admin)
   */
  async updateEnquiryStatus(id, { status, adminNotes }, adminUser) {
    const enquiry = await FranchiseEnquiry.findById(id);

    if (!enquiry) {
      const err = new Error('Franchise enquiry not found');
      err.statusCode = 404;
      throw err;
    }

    const validStatuses = ['PENDING', 'CONTACTED', 'IN_REVIEW', 'APPROVED', 'REJECTED'];
    if (status) {
      const upperStatus = status.toUpperCase();
      if (!validStatuses.includes(upperStatus)) {
        const err = new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        err.statusCode = 400;
        throw err;
      }
      enquiry.status = upperStatus;

      if (upperStatus === 'CONTACTED' && !enquiry.contactedAt) {
        enquiry.contactedAt = new Date();
      }
    }

    if (adminNotes !== undefined) {
      enquiry.adminNotes = adminNotes;
    }

    if (adminUser) {
      enquiry.reviewedBy = adminUser._id;
      enquiry.reviewedAt = new Date();
    }

    await enquiry.save();
    return enquiry;
  }

  /**
   * Get franchise enquiry metrics and KPIs (Super Admin)
   */
  async getStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      total,
      pending,
      contacted,
      inReview,
      approved,
      rejected,
      todayCount,
      recentEnquiries
    ] = await Promise.all([
      FranchiseEnquiry.countDocuments(),
      FranchiseEnquiry.countDocuments({ status: 'PENDING' }),
      FranchiseEnquiry.countDocuments({ status: 'CONTACTED' }),
      FranchiseEnquiry.countDocuments({ status: 'IN_REVIEW' }),
      FranchiseEnquiry.countDocuments({ status: 'APPROVED' }),
      FranchiseEnquiry.countDocuments({ status: 'REJECTED' }),
      FranchiseEnquiry.countDocuments({ createdAt: { $gte: todayStart } }),
      FranchiseEnquiry.find()
        .populate('reviewedBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(5)
    ]);

    return {
      total,
      pending,
      contacted,
      inReview,
      approved,
      rejected,
      today: todayCount,
      recent: recentEnquiries
    };
  }

  /**
   * Delete franchise enquiry (Super Admin)
   */
  async deleteEnquiry(id) {
    const enquiry = await FranchiseEnquiry.findById(id);

    if (!enquiry) {
      const err = new Error('Franchise enquiry not found');
      err.statusCode = 404;
      throw err;
    }

    await FranchiseEnquiry.findByIdAndDelete(id);

    return { message: 'Franchise enquiry successfully deleted' };
  }
}

export default new FranchiseService();
