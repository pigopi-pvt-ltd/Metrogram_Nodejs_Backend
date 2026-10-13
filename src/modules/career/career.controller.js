import careerService from './career.service.js';

class CareerController {
  // ==========================================
  // 1. JOB POSTINGS MANAGEMENT (SUPER ADMIN)
  // ==========================================

  /**
   * Create a new job opening (Super Admin only)
   */
  async createJob(req, res, next) {
    try {
      const {
        title,
        department,
        location,
        jobType,
        workplaceType,
        experienceLevel,
        education,
        salary,
        description,
        responsibilities,
        requirements,
        benefits,
        skills,
        openings,
        deadline,
        status,
        isActive
      } = req.body;

      if (!title || !department || !description) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: title, department, and description are required'
        });
      }

      // Format salary object if provided as string or object
      let formattedSalary = {
        min: 0,
        max: 0,
        currency: 'INR',
        period: 'PER_MONTH',
        isDisclosed: true,
        displayText: ''
      };

      if (salary && typeof salary === 'object') {
        formattedSalary = {
          min: Number(salary.min) || 0,
          max: Number(salary.max) || 0,
          currency: salary.currency || 'INR',
          period: salary.period || 'PER_MONTH',
          isDisclosed: salary.isDisclosed !== undefined ? Boolean(salary.isDisclosed) : true,
          displayText: salary.displayText ? String(salary.displayText).trim() : ''
        };
      } else if (typeof salary === 'string') {
        formattedSalary.displayText = salary.trim();
      }

      const job = await careerService.createJob(
        {
          title,
          department,
          location,
          jobType,
          workplaceType,
          experienceLevel,
          education,
          salary: formattedSalary,
          description,
          responsibilities,
          requirements,
          benefits,
          skills,
          openings: openings ? Number(openings) : 1,
          deadline: deadline ? new Date(deadline) : null,
          status: status || 'OPEN',
          isActive: isActive !== undefined ? Boolean(isActive) : true
        },
        req.user._id
      );

      res.status(201).json({
        success: true,
        message: 'Job posting created successfully',
        data: job
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Update an existing job opening (Super Admin only)
   */
  async updateJob(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };

      if (updateData.salary && typeof updateData.salary === 'object') {
        updateData.salary = {
          min: updateData.salary.min !== undefined ? Number(updateData.salary.min) : 0,
          max: updateData.salary.max !== undefined ? Number(updateData.salary.max) : 0,
          currency: updateData.salary.currency || 'INR',
          period: updateData.salary.period || 'PER_MONTH',
          isDisclosed: updateData.salary.isDisclosed !== undefined ? Boolean(updateData.salary.isDisclosed) : true,
          displayText: updateData.salary.displayText ? String(updateData.salary.displayText).trim() : ''
        };
      }

      if (updateData.openings !== undefined) {
        updateData.openings = Number(updateData.openings);
      }

      if (updateData.deadline !== undefined) {
        updateData.deadline = updateData.deadline ? new Date(updateData.deadline) : null;
      }

      const job = await careerService.updateJob(id, updateData, req.user._id);

      res.status(200).json({
        success: true,
        message: 'Job posting updated successfully',
        data: job
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Delete a job posting (Super Admin only)
   */
  async deleteJob(req, res, next) {
    try {
      const { id } = req.params;
      const result = await careerService.deleteJob(id);

      res.status(200).json(result);
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Toggle job status or active status (Super Admin only)
   */
  async toggleJobStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, isActive } = req.body;

      const job = await careerService.toggleJobStatus(id, { status, isActive }, req.user._id);

      res.status(200).json({
        success: true,
        message: 'Job status updated successfully',
        data: job
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * List all jobs for Super Admin (including draft and closed)
   */
  async getAdminJobs(req, res, next) {
    try {
      const result = await careerService.getAdminJobs(req.query);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  // ==========================================
  // 2. PUBLIC CAREER / JOB LISTINGS
  // ==========================================

  /**
   * Public list of active open jobs
   */
  async getPublicJobs(req, res, next) {
    try {
      const result = await careerService.getPublicJobs(req.query);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Public get single job details
   */
  async getPublicJobById(req, res, next) {
    try {
      const { id } = req.params;
      const job = await careerService.getPublicJobByIdOrSlug(id);

      res.status(200).json({
        success: true,
        data: job
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Public get distinct departments & filters
   */
  async getDepartments(req, res, next) {
    try {
      const filters = await careerService.getJobDepartments();

      res.status(200).json({
        success: true,
        data: filters
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  // ==========================================
  // 3. APPLICATION SUBMISSION (PUBLIC)
  // ==========================================

  /**
   * Apply for a job (Public)
   * Supports multipart/form-data with file field 'resume'
   */
  async apply(req, res, next) {
    try {
      const jobId = req.params.id || req.body.jobId || req.body.job;

      if (!jobId) {
        return res.status(400).json({
          success: false,
          message: 'Job ID is required to apply'
        });
      }

      const {
        fullName,
        email,
        phone,
        alternatePhone,
        currentLocation,
        highestQualification,
        totalExperience,
        currentCompany,
        currentDesignation,
        currentSalary,
        expectedSalary,
        noticePeriod,
        portfolioUrl,
        linkedinUrl,
        coverLetter,
        resumeUrl
      } = req.body;

      if (!fullName || !email || !phone) {
        return res.status(400).json({
          success: false,
          message: 'Missing required applicant fields: fullName, email, and phone are required'
        });
      }

      const file = req.file || null;
      if (!file && !resumeUrl) {
        return res.status(400).json({
          success: false,
          message: 'Resume file is required. Please upload a PDF, DOC, or DOCX document.'
        });
      }

      const application = await careerService.applyForJob(
        jobId,
        {
          fullName,
          email,
          phone,
          alternatePhone,
          currentLocation,
          highestQualification,
          totalExperience,
          currentCompany,
          currentDesignation,
          currentSalary,
          expectedSalary,
          noticePeriod,
          portfolioUrl,
          linkedinUrl,
          coverLetter,
          resumeUrl
        },
        file
      );

      res.status(201).json({
        success: true,
        message: 'Your application has been submitted successfully! Check your email for confirmation.',
        data: {
          applicationCode: application.applicationCode,
          fullName: application.fullName,
          email: application.email,
          status: application.status,
          createdAt: application.createdAt
        }
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  // ==========================================
  // 4. APPLICATION MANAGEMENT (SUPER ADMIN)
  // ==========================================

  /**
   * Get all job applications (Super Admin only)
   */
  async getAllApplications(req, res, next) {
    try {
      const result = await careerService.getAllApplications(req.query);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Get single job application by ID (Super Admin only)
   */
  async getApplicationById(req, res, next) {
    try {
      const { id } = req.params;
      const application = await careerService.getApplicationById(id);

      res.status(200).json({
        success: true,
        data: application
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Update application status and admin notes (Super Admin only)
   */
  async updateApplicationStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, adminNotes } = req.body;

      if (!status && adminNotes === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Provide status or adminNotes to update'
        });
      }

      const validStatuses = ['APPLIED', 'IN_REVIEW', 'SHORTLISTED', 'REJECTED', 'HIRED'];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Allowed values: ${validStatuses.join(', ')}`
        });
      }

      const application = await careerService.updateApplicationStatus(
        id,
        { status, adminNotes },
        req.user._id
      );

      res.status(200).json({
        success: true,
        message: 'Application status updated successfully',
        data: application
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Delete an application (Super Admin only)
   */
  async deleteApplication(req, res, next) {
    try {
      const { id } = req.params;
      const result = await careerService.deleteApplication(id);

      res.status(200).json(result);
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Get application stats and recruitment overview (Super Admin only)
   */
  async getApplicationStats(req, res, next) {
    try {
      const stats = await careerService.getApplicationStats();

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }
}

export default new CareerController();
