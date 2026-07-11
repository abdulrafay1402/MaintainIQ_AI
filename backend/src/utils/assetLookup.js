const Asset = require('../models/Asset');

const findAssetByIdentifier = async (identifier) => {
  if (!identifier) return null;

  const byPublicId = await Asset.findOne({ publicId: identifier });
  if (byPublicId) return byPublicId;

  return Asset.findOne({ code: identifier.toUpperCase().trim() });
};

module.exports = { findAssetByIdentifier };
