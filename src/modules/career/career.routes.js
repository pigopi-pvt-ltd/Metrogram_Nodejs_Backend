import express from 'express';
import careerController from './career.controller.js';
import { protect } from '../../middleware/auth.js';
import { authorize } from '../../middleware/roleCheck.js';
import { ROLES } from '../../constants/roles.js';
import { uploadResume } from '../../middleware/upload.js';

const router = express.Router();

// ==========================================
// 1. PUBLIC CAREER / JOB ROUTES
// ==========================================

// List public active jobs
router.get('/', careerController.getPublicJobs.bind(careerController));
router.get('/jobs', careerController.getPublicJobs.bind(careerController));

// Distinct departments & job types for search filters
router.get('/jobs/departments', careerController.getDepartments.bind(careerController));

// Super Admin Jobs Overview (Placed before /jobs/:id to avoid route collision)
router.get(
  '/admin/jobs',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  careerController.getAdminJobs.bind(careerController)
);

// Get single job details (by ID or Slug)
router.get('/jobs/:id', careerController.getPublicJobById.bind(careerController));

// Apply for a job (Public - supports multipart resume upload)
router.post(
  '/jobs/:id/apply',
  uploadResume,
  careerController.apply.bind(careerController)
);

router.post(
  '/apply',
  uploadResume,
  careerController.apply.bind(careerController)
);

// ==========================================
// 2. SUPER ADMIN JOB MANAGEMENT ROUTES
// ==========================================

// Create new job posting
router.post(
  '/jobs',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  careerController.createJob.bind(careerController)
);

// Update existing job posting
router.put(
  '/jobs/:id',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  careerController.updateJob.bind(careerController)
);

// Toggle job status or active state
router.patch(
  '/jobs/:id/status',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  careerController.toggleJobStatus.bind(careerController)
);

// Delete job posting
router.delete(
  '/jobs/:id',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  careerController.deleteJob.bind(careerController)
);

// ==========================================
// 3. SUPER ADMIN APPLICATION MANAGEMENT ROUTES
// ==========================================

// Application stats & recruitment overview
router.get(
  '/applications/stats',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  careerController.getApplicationStats.bind(careerController)
);

// List all applications with filters
router.get(
  '/applications',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  careerController.getAllApplications.bind(careerController)
);

// Get single application by ID
router.get(
  '/applications/:id',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  careerController.getApplicationById.bind(careerController)
);

// Update application status & admin notes
router.patch(
  '/applications/:id/status',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  careerController.updateApplicationStatus.bind(careerController)
);

// Delete application
router.delete(
  '/applications/:id',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  careerController.deleteApplication.bind(careerController)
);

export default router;
