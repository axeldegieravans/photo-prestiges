const safeParseJson = async (response) => {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
};

module.exports = {
  safeParseJson
};
