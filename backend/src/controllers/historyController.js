const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const Asset = require('../models/Asset');
const AssetHistory = require('../models/AssetHistory');

const getAssetHistory = asyncHandler(async (req, res) => {
  const asset = await Asset.findById(req.params.id);
  if (!asset) {
    throw new ApiError(404, 'Asset not found');
  }

  const history = await AssetHistory.find({ asset: asset._id })
    .populate('actor', 'name email role')
    .populate('issue', 'issueNumber title status')
    .sort({ createdAt: -1 });

  res.json({ history });
});

module.exports = { getAssetHistory };
