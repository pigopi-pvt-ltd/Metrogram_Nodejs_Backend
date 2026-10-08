import { v2 as cloudinary } from 'cloudinary';

// Cloudinary automatically parses CLOUDINARY_URL if available in process.env
// Explicit configuration fallback ensures reliability
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL
  });
}

/**
 * Upload a buffer directly to Cloudinary using an upload stream
 * @param {Buffer} buffer - File buffer
 * @param {Object} options - Upload options (folder, resource_type, etc.)
 * @returns {Promise<Object>} Cloudinary upload result containing secure_url, public_id, etc.
 */
export const uploadBufferToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const defaultOptions = {
      folder: 'metrogram/customer_documents',
      resource_type: 'auto',
      ...options
    };

    const stream = cloudinary.uploader.upload_stream(
      defaultOptions,
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result);
      }
    );

    stream.end(buffer);
  });
};

/**
 * Delete a resource from Cloudinary by public ID
 * @param {string} publicId
 * @param {Object} options
 */
export const deleteFromCloudinary = async (publicId, options = {}) => {
  if (!publicId) return null;
  return await cloudinary.uploader.destroy(publicId, options);
};

export default cloudinary;
