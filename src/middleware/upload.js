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

export const uploadCustomerDocuments = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB per file limit
  },
  fileFilter
}).fields([
  { name: 'aadharImage', maxCount: 1 },
  { name: 'panImage', maxCount: 1 }
]);

export default uploadCustomerDocuments;
