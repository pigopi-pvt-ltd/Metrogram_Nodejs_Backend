import mongoose from 'mongoose';
import Job from './job.model.js';
import JobApplication from './jobApplication.model.js';
import User from '../user/user.model.js';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../../config/cloudinary.js';
import emailService from '../../services/email.service.js';

class CareerService {
  // ==========================================
  // 1. JOB POSTINGS MANAGEMENT (SUPER ADMIN)
  // ==========================================

  /**
   * Create a new job opening
   */
  async createJob(jobData, userId) {
    const formattedData = {
      ...jobData,
      createdBy: userId,
      responsibilities: Array.isArray(jobData.responsibilities)
        ? jobData.responsibilities.filter(Boolean)
        : jobData.responsibilities ? [jobData.responsibilities] : [],
      requirements: Array.isArray(jobData.requirements)
        ? jobData.requirements.filter(Boolean)
        : jobData.requirements ? [jobData.requirements] : [],
      benefits: Array.isArray(jobData.benefits)
        ? jobData.benefits.filter(Boolean)
        : jobData.benefits ? [jobData.benefits] : [],
      skills: Array.isArray(jobData.skills)
        ? jobData.skills.filter(Boolean)
        : jobData.skills ? [jobData.skills] : []
    };

    const job = new Job(formattedData);
    await job.save();
    return job;
  }

  /**
   * Update an existing job opening
   */
  async updateJob(jobId, updateData, userId) {
    const job = await Job.findById(jobId);
    if (!job) {
      const err = new Error(`Job posting with ID '${jobId}' not found`);
      err.statusCode = 404;
      throw err;
    }

    if (updateData.responsibilities !== undefined) {
      updateData.responsibilities = Array.isArray(updateData.responsibilities)
        ? updateData.responsibilities.filter(Boolean)
        : [updateData.responsibilities];
    }

    if (updateData.requirements !== undefined) {
      updateData.requirements = Array.isArray(updateData.requirements)
        ? updateData.requirements.filter(Boolean)
        : [updateData.requirements];
    }

    if (updateData.benefits !== undefined) {
      updateData.benefits = Array.isArray(updateData.benefits)
        ? updateData.benefits.filter(Boolean)
        : [updateData.benefits];
    }

    if (updateData.skills !== undefined) {
      updateData.skills = Array.isArray(updateData.skills)
        ? updateData.skills.filter(Boolean)
        : [updateData.skills];
    }

    Object.assign(job, updateData);
    job.updatedBy = userId;
    await job.save();

    return job;
  }

  /**
   * Delete a job posting
   */
  async deleteJob(jobId) {
    const job = await Job.findById(jobId);
    if (!job) {
      const err = new Error(`Job posting with ID '${jobId}' not found`);
      err.statusCode = 404;
      throw err;
    }

    await Job.findByIdAndDelete(jobId);
    return { success: true, message: 'Job posting deleted successfully' };
  }

  /**
   * Toggle job status or active state
   */
  async toggleJobStatus(jobId, { status, isActive }, userId) {
    const job = await Job.findById(jobId);
    if (!job) {
      const err = new Error(`Job posting with ID '${jobId}' not found`);
      err.statusCode = 404;
      throw err;
    }

    if (status !== undefined) job.status = status;
    if (isActive !== undefined) job.isActive = isActive;
    job.updatedBy = userId;

    await job.save();
    return job;
  }

  /**
   * Get all job postings for Admin (includes draft, closed, inactive)
   */
  async getAdminJobs({
    search = '',
    department = '',
    jobType = '',
    status = '',
    isActive,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = {}) {
    const filter = {};

    if (department) {
      filter.department = { $regex: new RegExp(`^${department}$`, 'i') };
    }

    if (jobType) {
      filter.jobType = jobType;
    }

    if (status) {
      filter.status = status;
    }

    if (isActive !== undefined && isActive !== '') {
      filter.isActive = isActive === 'true' || isActive === true;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { skills: { $elemMatch: { $regex: search, $options: 'i' } } }
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;
    const sortObj = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .populate('createdBy', 'firstName lastName email role')
        .populate('updatedBy', 'firstName lastName email role')
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum),
      Job.countDocuments(filter)
    ]);

    return {
      jobs,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      limit: limitNum
    };
  }

  // ==========================================
  // 2. PUBLIC CAREER / JOB LISTINGS
  // ==========================================

  /**
   * Get active public job postings
   */
  async getPublicJobs({
    search = '',
    department = '',
    jobType = '',
    workplaceType = '',
    location = '',
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = {}) {
    const filter = {
      isActive: true,
      status: 'OPEN'
    };

    if (department) {
      filter.department = { $regex: new RegExp(`^${department}$`, 'i') };
    }

    if (jobType) {
      filter.jobType = jobType;
    }

    if (workplaceType) {
      filter.workplaceType = workplaceType;
    }

    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { skills: { $elemMatch: { $regex: search, $options: 'i' } } }
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;
    const sortObj = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .select('-createdBy -updatedBy')
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum),
      Job.countDocuments(filter)
    ]);

    return {
      jobs,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      limit: limitNum
    };
  }

  /**
   * Get public job details by ID or slug
   */
  async getPublicJobByIdOrSlug(idOrSlug) {
    const isObjectId = mongoose.Types.ObjectId.isValid(idOrSlug);
    const query = isObjectId
      ? { _id: idOrSlug, isActive: true, status: 'OPEN' }
      : { slug: idOrSlug, isActive: true, status: 'OPEN' };

    const job = await Job.findOne(query).select('-createdBy -updatedBy');
    if (!job) {
      const err = new Error('Job opening not found or is no longer accepting applications');
      err.statusCode = 404;
      throw err;
    }

    return job;
  }

  /**
   * Get distinct departments and filters for job seekers
   */
  async getJobDepartments() {
    const [departments, jobTypes, workplaceTypes] = await Promise.all([
      Job.distinct('department', { isActive: true, status: 'OPEN' }),
      Job.distinct('jobType', { isActive: true, status: 'OPEN' }),
      Job.distinct('workplaceType', { isActive: true, status: 'OPEN' })
    ]);

    return {
      departments,
      jobTypes,
      workplaceTypes
    };
  }

  // ==========================================
  // 3. JOB APPLICATION SUBMISSION (PUBLIC)
  // ==========================================

  /**
   * Submit job application with resume file or URL
   */
  async applyForJob(jobId, applicantData, file = null) {
    const job = await Job.findById(jobId);
    if (!job || !job.isActive || job.status !== 'OPEN') {
      const err = new Error('This job posting is not available or is no longer accepting applications');
      err.statusCode = 400;
      throw err;
    }

    if (job.deadline && new Date() > new Date(job.deadline)) {
      const err = new Error('The application deadline for this position has passed');
      err.statusCode = 400;
      throw err;
    }

    const email = (applicantData.email || '').trim().toLowerCase();
    if (!email) {
      const err = new Error('Email address is required');
      err.statusCode = 400;
      throw err;
    }

    // Check duplicate application within 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const existingApp = await JobApplication.findOne({
      job: job._id,
      email,
      createdAt: { $gte: thirtyDaysAgo }
    });

    if (existingApp) {
      const err = new Error('You have already applied for this position recently. Our recruitment team is reviewing your profile.');
      err.statusCode = 409;
      throw err;
    }

    let resumeUrl = applicantData.resumeUrl;
    let resumePublicId = null;
    let resumeOriginalName = '';
    let resumeResourceType = 'auto';
    let resumeSize = 0;

    // Handle resume file upload via Multer buffer
    if (file && file.buffer) {
      const uploadRes = await uploadBufferToCloudinary(file.buffer, {
        folder: 'metrogram/resumes',
        resource_type: 'auto'
      });
      resumeUrl = uploadRes.secure_url;
      resumePublicId = uploadRes.public_id;
      resumeResourceType = uploadRes.resource_type || 'auto';
      resumeOriginalName = file.originalname || 'Resume.pdf';
      resumeSize = file.size || 0;
    }

    if (!resumeUrl) {
      const err = new Error('Please upload your resume document (PDF, DOC, DOCX)');
      err.statusCode = 400;
      throw err;
    }

    const application = new JobApplication({
      job: job._id,
      fullName: applicantData.fullName,
      email,
      phone: applicantData.phone,
      alternatePhone: applicantData.alternatePhone || '',
      currentLocation: applicantData.currentLocation || '',
      highestQualification: applicantData.highestQualification || '',
      totalExperience: applicantData.totalExperience || '',
      currentCompany: applicantData.currentCompany || '',
      currentDesignation: applicantData.currentDesignation || '',
      currentSalary: applicantData.currentSalary || '',
      expectedSalary: applicantData.expectedSalary || '',
      noticePeriod: applicantData.noticePeriod || '',
      portfolioUrl: applicantData.portfolioUrl || '',
      linkedinUrl: applicantData.linkedinUrl || '',
      coverLetter: applicantData.coverLetter || '',
      resumeUrl,
      resumePublicId,
      resumeOriginalName,
      resumeResourceType,
      resumeSize,
      status: 'APPLIED'
    });

    await application.save();

    // Increment application count on the job posting
    await Job.findByIdAndUpdate(job._id, { $inc: { applicationCount: 1 } });

    // Send confirmation email asynchronously (does not block response)
    emailService
      .sendJobApplicationConfirmationEmail({
        to: application.email,
        name: application.fullName,
        jobTitle: job.title,
        applicationCode: application.applicationCode
      })
      .catch((emailErr) => {
        console.error(`[CareerService] Error sending application email for ${application.applicationCode}:`, emailErr.message);
      });

    return application;
  }

  // ==========================================
  // 4. APPLICATION MANAGEMENT (SUPER ADMIN)
  // ==========================================

  /**
   * Get all job applications with comprehensive filters
   */
  async getAllApplications({
    jobId = '',
    status = '',
    search = '',
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = {}) {
    const filter = {};

    if (jobId) {
      filter.job = jobId;
    }

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { applicationCode: { $regex: search, $options: 'i' } },
        { currentCompany: { $regex: search, $options: 'i' } },
        { highestQualification: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;
    const sortObj = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [applications, total] = await Promise.all([
      JobApplication.find(filter)
        .populate('job', 'title department location jobType status')
        .populate('reviewedBy', 'firstName lastName email role')
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum),
      JobApplication.countDocuments(filter)
    ]);

    return {
      applications,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      limit: limitNum
    };
  }

  /**
   * Get single application by ID
   */
  async getApplicationById(applicationId) {
    const application = await JobApplication.findById(applicationId)
      .populate('job')
      .populate('reviewedBy', 'firstName lastName email role');

    if (!application) {
      const err = new Error(`Application with ID '${applicationId}' not found`);
      err.statusCode = 404;
      throw err;
    }

    return application;
  }

  /**
   * Update application status and HR / Admin notes
   */
  async updateApplicationStatus(applicationId, { status, adminNotes }, reviewerUserId) {
    const application = await JobApplication.findById(applicationId);
    if (!application) {
      const err = new Error(`Application with ID '${applicationId}' not found`);
      err.statusCode = 404;
      throw err;
    }

    if (status) {
      application.status = status;
    }

    if (adminNotes !== undefined) {
      application.adminNotes = adminNotes;
    }

    application.reviewedBy = reviewerUserId;
    application.reviewedAt = new Date();

    await application.save();

    return await JobApplication.findById(application._id)
      .populate('job', 'title department location')
      .populate('reviewedBy', 'firstName lastName email role');
  }

  /**
   * Delete an application and clean up Cloudinary resume
   */
  async deleteApplication(applicationId) {
    const application = await JobApplication.findById(applicationId);
    if (!application) {
      const err = new Error(`Application with ID '${applicationId}' not found`);
      err.statusCode = 404;
      throw err;
    }

    // Clean up resume from Cloudinary
    if (application.resumePublicId) {
      try {
        await deleteFromCloudinary(application.resumePublicId, {
          resource_type: application.resumeResourceType || 'auto'
        });
      } catch (cloudErr) {
        console.warn(`[CareerService] Failed to delete resume ${application.resumePublicId} from Cloudinary:`, cloudErr.message);
      }
    }

    // Decrement application count on job
    await Job.findByIdAndUpdate(application.job, {
      $inc: { applicationCount: -1 }
    });

    await JobApplication.findByIdAndDelete(applicationId);

    return { success: true, message: 'Application deleted successfully' };
  }

  /**
   * Get career and recruitment metrics for Super Admin
   */
  async getApplicationStats() {
    const [
      totalJobs,
      openJobs,
      closedJobs,
      totalApplications,
      appliedCount,
      inReviewCount,
      shortlistedCount,
      rejectedCount,
      hiredCount,
      recentApplications
    ] = await Promise.all([
      Job.countDocuments(),
      Job.countDocuments({ status: 'OPEN', isActive: true }),
      Job.countDocuments({ status: 'CLOSED' }),
      JobApplication.countDocuments(),
      JobApplication.countDocuments({ status: 'APPLIED' }),
      JobApplication.countDocuments({ status: 'IN_REVIEW' }),
      JobApplication.countDocuments({ status: 'SHORTLISTED' }),
      JobApplication.countDocuments({ status: 'REJECTED' }),
      JobApplication.countDocuments({ status: 'HIRED' }),
      JobApplication.find()
        .populate('job', 'title department')
        .sort({ createdAt: -1 })
        .limit(5)
    ]);

    return {
      jobs: {
        total: totalJobs,
        open: openJobs,
        closed: closedJobs
      },
      applications: {
        total: totalApplications,
        byStatus: {
          applied: appliedCount,
          inReview: inReviewCount,
          shortlisted: shortlistedCount,
          rejected: rejectedCount,
          hired: hiredCount
        }
      },
      recentApplications
    };
  }
}

export default new CareerService();
