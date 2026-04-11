const fs = require('fs/promises');

const getPublicBaseUrl = () => {
  return process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
};

const buildTargetImageUrl = (filename) => {
  return `${getPublicBaseUrl()}/uploads/targets/${filename}`;
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
  buildTargetImageUrl,
  deleteFileIfExists
};