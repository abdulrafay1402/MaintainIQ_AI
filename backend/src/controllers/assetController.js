const QRCode = require('qrcode');
const Asset = require('../models/Asset');
const Issue = require('../models/Issue');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { createHistoryEntry } = require('../services/historyService');
const { findAssetByIdentifier } = require('../utils/assetLookup');
const { toPublicAssetDto, toPublicIssueActivityDto } = require('../utils/publicDtos');
const { appCache, invalidateAssetCache } = require('../utils/cache');

// QR/public links point at CLIENT_URL when set; otherwise the deployed frontend
// in production and localhost only during local development.
const FRONTEND_FALLBACK = process.env.VERCEL ? 'https://maintain-iq-ai.vercel.app' : 'http://localhost:5173';

const getPublicAssetUrl = (publicId) => {
  return `${process.env.CLIENT_URL || FRONTEND_FALLBACK}/public/assets/${publicId}`;
};

// Asset date rules: purchase/last-service can never be in the future, and the
// next service must be scheduled for today or a future day (never already passed).
const validateAssetDates = ({ purchaseDate, lastServiceDate, nextServiceDate }) => {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  if (purchaseDate && new Date(purchaseDate) > endOfToday) {
    throw new ApiError(400, 'Purchase date cannot be in the future');
  }
  if (lastServiceDate && new Date(lastServiceDate) > endOfToday) {
    throw new ApiError(400, 'Last service date cannot be in the future');
  }
  if (nextServiceDate && new Date(nextServiceDate) < startOfToday) {
    throw new ApiError(400, 'Next service date must be today or a future date — it cannot be a date that has already passed');
  }
  if (lastServiceDate && nextServiceDate && new Date(nextServiceDate) < new Date(lastServiceDate)) {
    throw new ApiError(400, 'Next service date cannot be before the last service date');
  }
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

  if (payload.purchaseCost !== undefined && payload.purchaseCost !== '' && payload.purchaseCost !== null) {
    const numericPurchase = Number(payload.purchaseCost);
    if (!Number.isFinite(numericPurchase) || numericPurchase < 0) {
      throw new ApiError(400, 'Purchase cost must be a non-negative number');
    }
    payload.purchaseCost = numericPurchase;
  } else {
    delete payload.purchaseCost;
  }

  validateAssetDates(payload);

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

const ASSET_SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { name: 1 },
  'name-desc': { name: -1 },
  code: { code: 1 },
  status: { status: 1, name: 1 },
  'next-service': { nextServiceDate: 1 },
};

const getAssets = asyncHandler(async (req, res) => {
  const { search, status, category, location, assignedTechnician, sort } = req.query;
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

  // .lean() returns plain objects — required for caching (hydrated Mongoose
  // documents must never go into the cache) and faster for a read-only list.
  const assets = await Asset.find(filter)
    .populate('assignedTechnician', 'name email role')
    .sort(ASSET_SORTS[sort] || ASSET_SORTS.newest)
    .lean();

  // Total maintenance spend per asset (sum of all its issues' maintenance costs),
  // so internal views can show running cost alongside the purchase cost.
  const spend = await Issue.aggregate([
    { $group: { _id: '$asset', total: { $sum: { $ifNull: ['$maintenanceCost', 0] } } } },
  ]);
  const spendByAsset = Object.fromEntries(spend.map((entry) => [String(entry._id), entry.total]));
  assets.forEach((asset) => {
    asset.maintenanceSpend = spendByAsset[String(asset._id)] || 0;
  });

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

  if (req.body.purchaseCost !== undefined && req.body.purchaseCost !== '' && req.body.purchaseCost !== null) {
    const numericPurchase = Number(req.body.purchaseCost);
    if (!Number.isFinite(numericPurchase) || numericPurchase < 0) {
      throw new ApiError(400, 'Purchase cost must be a non-negative number');
    }
    req.body.purchaseCost = numericPurchase;
  }

  // Validate against the merged (incoming + existing) values so a partial
  // update can't sneak an invalid date combination past the rules.
  validateAssetDates({
    purchaseDate: req.body.purchaseDate ?? asset.purchaseDate,
    lastServiceDate: req.body.lastServiceDate ?? asset.lastServiceDate,
    nextServiceDate: req.body.nextServiceDate !== undefined ? req.body.nextServiceDate : undefined,
  });

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

// AI Asset Health Report — analyzes this asset's history + issues via Gemini.
// Gracefully reports { available: false } when AI is not connected.
const getAssetAiReport = asyncHandler(async (req, res) => {
  const asset = await Asset.findById(req.params.id);
  if (!asset) {
    throw new ApiError(404, 'Asset not found');
  }

  const AssetHistory = require('../models/AssetHistory');
  const { generateAssetHealthReport } = require('../services/triageService');

  const [history, issues] = await Promise.all([
    AssetHistory.find({ asset: asset._id }).sort({ createdAt: -1 }).limit(20).lean(),
    Issue.find({ asset: asset._id }).select('title category status priority maintenanceCost createdAt').sort({ createdAt: -1 }).limit(15).lean(),
  ]);

  const result = await generateAssetHealthReport({ asset, history, issues });
  res.json(result);
});

module.exports = {
  createAsset,
  getAssets,
  getAssetById,
  updateAsset,
  getPublicAsset,
  getAssetQr,
  getPublicAssetQr,
  getAssetAiReport,
};
