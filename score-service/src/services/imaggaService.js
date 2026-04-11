const fs = require('fs/promises');
const { safeParseJson } = require('../utils/httpClient');

const getImaggaConfig = () => {
  const apiKey = process.env.IMAGGA_API_KEY;
  const apiSecret = process.env.IMAGGA_API_SECRET;

  if (!apiKey || !apiSecret) {
    const error = new Error(
      'Imagga credentials are not configured. Set IMAGGA_API_KEY and IMAGGA_API_SECRET.'
    );
    error.statusCode = 500;
    throw error;
  }

  return {
    apiKey,
    apiSecret
  };
};

const buildBasicAuthHeader = (apiKey, apiSecret) => {
  return `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;
};

const getSimilarityEndpoint = () => {
  const categorizer = process.env.IMAGGA_SIMILARITY_CATEGORIZER || 'general_v3';
  return (
    process.env.IMAGGA_SIMILARITY_ENDPOINT ||
    `https://api.imagga.com/v2/images-similarity/categories/${categorizer}`
  );
};

const buildImaggaError = (result, fallbackMessage, responseStatus) => {
  const rawMessage =
    result?.status?.text || result?.message || fallbackMessage;

  const normalizedMessage = String(rawMessage).toLowerCase();

  if (
    responseStatus === 429 ||
    normalizedMessage.includes('concurrent request limits') ||
    normalizedMessage.includes('rate limit')
  ) {
    const error = new Error(
      'Imagga request limit reached. Wait a bit and try the submission again.'
    );
    error.statusCode = 503;
    throw error;
  }

  const error = new Error(rawMessage);
  error.statusCode = responseStatus >= 500 ? 503 : 400;
  throw error;
};

const compareImagesWithImaggaFiles = async ({
  targetImagePath,
  targetImageFilename,
  submissionImagePath,
  submissionImageFilename
}) => {
  const { apiKey, apiSecret } = getImaggaConfig();
  const [targetFileBuffer, submissionFileBuffer] = await Promise.all([
    fs.readFile(targetImagePath),
    fs.readFile(submissionImagePath)
  ]);
  const formData = new FormData();

  formData.append(
    'image',
    new Blob([targetFileBuffer], { type: 'application/octet-stream' }),
    targetImageFilename
  );

  formData.append(
    'image2',
    new Blob([submissionFileBuffer], { type: 'application/octet-stream' }),
    submissionImageFilename
  );

  const response = await fetch(getSimilarityEndpoint(), {
    method: 'POST',
    headers: {
      Authorization: buildBasicAuthHeader(apiKey, apiSecret)
    },
    body: formData
  });

  const result = await safeParseJson(response);

  if (!response.ok) {
    buildImaggaError(result, 'Imagga image similarity request failed', response.status);
  }

  const distance = Number(result?.result?.distance);

  if (Number.isNaN(distance)) {
    const error = new Error('Invalid Imagga image similarity response');
    error.statusCode = 503;
    throw error;
  }

  return distance;
};

module.exports = {
  compareImagesWithImaggaFiles
};
