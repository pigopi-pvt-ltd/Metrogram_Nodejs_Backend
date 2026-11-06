import multer from 'multer';

// Use in-memory storage so buffers can be streamed to Cloudinary
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Allow images (JPEG, PNG, WEBP, etc.) and PDF documents
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file type. Only JPEG, PNG, WEBP images and PDF documents are allowed.');
    error.statusCode = 400;
    cb(error, false);
  }
};

const imageOnlyFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file type for profile image. Only JPEG, PNG, and WEBP images are allowed.');
    error.statusCode = 400;
    cb(error, false);
  }
};

export const uploadProfileImage = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: imageOnlyFilter
}).single('profileImage');

export const uploadCustomerDocuments = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB per file limit
  },
  fileFilter
}).fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'aadharImage', maxCount: 1 },
  { name: 'panImage', maxCount: 1 }
]);

export const uploadUserFiles = uploadCustomerDocuments;

/**
 * Helper to retrieve uploaded profile image file whether uploaded as single or fields
 * @param {Object} req - Express request
 * @returns {Object|null} Multer file object or null
 */
export const extractUploadedProfileImage = (req) => {
  if (req?.file && req.file.fieldname === 'profileImage') {
    return req.file;
  }
  if (req?.files?.profileImage && req.files.profileImage[0]) {
    return req.files.profileImage[0];
  }
  return null;
};

export const uploadTestReport = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB limit for PDF report
  },
  fileFilter
}).single('report');

const resumeFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/jpg',
    'image/png'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file type for resume. Allowed formats: PDF, DOC, DOCX, and images (JPG, PNG).');
    error.statusCode = 400;
    cb(error, false);
  }
};

export const uploadResume = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB limit for resume
  },
  fileFilter: resumeFileFilter
}).single('resume');

export default uploadCustomerDocuments;
