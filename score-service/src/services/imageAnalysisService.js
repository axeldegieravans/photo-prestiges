const fs = require('fs/promises');
const crypto = require('crypto');
const { compareImagesWithImaggaFiles } = require('./imaggaService');

let imageAnalysisQueue = Promise.resolve();

const runImageAnalysisSequentially = async (task) => {
  const nextTask = imageAnalysisQueue.then(task, task);
  imageAnalysisQueue = nextTask.catch(() => {});
  return nextTask;
};

const getImageAnalysisProvider = () => {
  return String(process.env.IMAGE_ANALYSIS_PROVIDER || 'IMAGGA').toUpperCase();
};

const hashFile = async (filePath) => {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

const convertDistanceToSimilarityScore = (distance) => {
  if (distance <= 0) {
    return 100;
  }

  return Number(Math.max(0, Math.min(100, 100 / (1 + distance))).toFixed(2));
};

const analyzeImageSimilarity = async ({
  targetImagePath,
  targetImageFilename,
  submissionImagePath,
  submissionImageFilename
}) => {
  const [targetHash, submissionHash] = await Promise.all([
    hashFile(targetImagePath),
    hashFile(submissionImagePath)
  ]);

  if (targetHash === submissionHash) {
    const error = new Error(
      'Submission image must differ from the original target image'
    );
    error.statusCode = 400;
    throw error;
  }

  const provider = getImageAnalysisProvider();

  if (provider !== 'IMAGGA') {
    const error = new Error('IMAGE_ANALYSIS_PROVIDER must be IMAGGA');
    error.statusCode = 500;
    throw error;
  }

  return runImageAnalysisSequentially(async () => {
    const distance = await compareImagesWithImaggaFiles({
      targetImagePath,
      targetImageFilename,
      submissionImagePath,
      submissionImageFilename
    });

    return {
      provider: 'IMAGGA',
      similarityScore: convertDistanceToSimilarityScore(distance),
      summary: `Imagga image similarity completed. Distance: ${distance.toFixed(4)}`
    };
  });
};

module.exports = {
  analyzeImageSimilarity
};
