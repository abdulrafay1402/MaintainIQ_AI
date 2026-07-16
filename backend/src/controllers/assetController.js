const QRCode = require('qrcode');
const Asset = require('../models/Asset');
const Issue = require('../models/Issue');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { createHistoryEntry } = require('../services/historyService');
const { findAssetByIdentifier } = require('../utils/assetLookup');
const { toPublicAssetDto, toPublicIssueActivityDto } = require('../utils/publicDtos');
const { appCache, invalidateAssetCache } = require('../utils/cache');

const getPublicAssetUrl = (publicId) => {
  return `${process.env.CLIENT_URL || 'http://localhost:5173'}/public/assets/${publicId}`;
};

const createAsset = asyncHandler(async (req, res) => {
  const payload = req.body;
  const { name, code, category, location } = payload;

  if (!name || !code || !category || !location) {
    throw new ApiError(400, 'Name, code, category, and location are required');
  }

  const upperCode = code.toUpperCase().trim();

  const duplicate = await Asset.findOne({ code: upperCode });
  if (duplicate) {
    throw new ApiError(400, 'Duplicate asset code');
  }

  delete payload.publicId;

  const asset = await Asset.create({
    ...payload,
    code: upperCode,
  });

  await createHistoryEntry({
    asset: asset._id,
    actor: req.user._id,
    actorName: req.user.name,
    action: 'Asset created',
    details: `${asset.name} was registered with code ${asset.code}`,
  });

  const publicUrl = getPublicAssetUrl(asset.publicId);
  const qrCodeDataUrl = await QRCode.toDataURL(publicUrl);

  invalidateAssetCache();

  res.status(201).json({ asset, publicUrl, qrCodeDataUrl });
});

const getAssets = asyncHandler(async (req, res) => {
  const { search, status, category, location, assignedTechnician } = req.query;
  const cacheKey = `assets:${JSON.stringify(req.query)}`;
  const cachedAssets = appCache.get(cacheKey);

  if (cachedAssets) {
    return res.json({ assets: cachedAssets, cached: true });
  }

  const filter = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } },
      { category: { $regex: search, $options: 'i' } },
      { location: { $regex: search, $options: 'i' } },
    ];
  }

  if (status) filter.status = status;
  if (category) filter.category = category;
  if (location) filter.location = { $regex: location, $options: 'i' };
  if (assignedTechnician) {
    filter.assignedTechnician = assignedTechnician === 'unassigned' ? null : assignedTechnician;
  }

  const assets = await Asset.find(filter).populate('assignedTechnician', 'name email role').sort({ createdAt: -1 });
  appCache.set(cacheKey, assets);

  res.json({ assets });
});

const getAssetById = asyncHandler(async (req, res) => {
  const asset = await Asset.findById(req.params.id).populate('assignedTechnician', 'name email role');
  if (!asset) {
    throw new ApiError(404, 'Asset not found');
  }

  const publicUrl = getPublicAssetUrl(asset.publicId);
  const qrCodeDataUrl = await QRCode.toDataURL(publicUrl);
  const recentIssues = await Issue.find({ asset: asset._id }).sort({ createdAt: -1 }).limit(5);

  res.json({ asset, publicUrl, qrCodeDataUrl, recentIssues });
});

const updateAsset = asyncHandler(async (req, res) => {
  const asset = await Asset.findById(req.params.id);
  if (!asset) {
    throw new ApiError(404, 'Asset not found');
  }

  delete req.body.publicId;

  if (req.body.code) {
    const duplicate = await Asset.findOne({ code: req.body.code.toUpperCase(), _id: { $ne: asset._id } });
    if (duplicate) {
      throw new ApiError(400, 'Duplicate asset code');
    }
    req.body.code = req.body.code.toUpperCase();
  }

  Object.assign(asset, req.body);
  await asset.save();

  await createHistoryEntry({
    asset: asset._id,
    actor: req.user._id,
    actorName: req.user.name,
    action: 'Asset updated',
    details: `${asset.name} details were updated`,
  });

  invalidateAssetCache();

  res.json({ asset });
});

const getPublicAsset = asyncHandler(async (req, res) => {
  const asset = await findAssetByIdentifier(req.params.code);
  if (!asset) {
    throw new ApiError(404, 'Asset not found');
  }

  const publicIssues = await Issue.find({ asset: asset._id })
    .select('issueNumber title category priority status createdAt resolvedAt')
    .sort({ createdAt: -1 })
    .limit(10);

  res.json({
    asset: toPublicAssetDto(asset),
    recentIssues: publicIssues.map(toPublicIssueActivityDto),
    organizationName: process.env.ORGANIZATION_NAME || 'MaintainIQ',
  });
});

const getAssetQr = asyncHandler(async (req, res) => {
  const asset = await Asset.findById(req.params.id);
  if (!asset) {
    throw new ApiError(404, 'Asset not found');
  }

  const publicUrl = getPublicAssetUrl(asset.publicId);
  const qrCodeDataUrl = await QRCode.toDataURL(publicUrl);
  res.json({ publicUrl, qrCodeDataUrl, publicId: asset.publicId });
});

const getPublicAssetQr = asyncHandler(async (req, res) => {
  const asset = await findAssetByIdentifier(req.params.code);
  if (!asset) {
    throw new ApiError(404, 'Asset not found');
  }

  const publicUrl = getPublicAssetUrl(asset.publicId);
  const qrCodeDataUrl = await QRCode.toDataURL(publicUrl);
  res.json({ publicUrl, qrCodeDataUrl, publicId: asset.publicId });
});

module.exports = {
  createAsset,
  getAssets,
  getAssetById,
  updateAsset,
  getPublicAsset,
  getAssetQr,
  getPublicAssetQr,
};
