const fs = require('fs/promises');

const getPublicBaseUrl = () => {
  return process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
};

const buildSubmissionImageUrl = (filename) => {
  return `${getPublicBaseUrl()}/uploads/submissions/${filename}`;
};

const deleteFileIfExists = async (filePath) => {
  if (!filePath) {
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
};

module.exports = {
  buildSubmissionImageUrl,
  deleteFileIfExists
};