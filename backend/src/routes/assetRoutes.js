const express = require('express');
const {
  createAsset,
  getAssets,
  getAssetById,
  updateAsset,
  getPublicAsset,
  getAssetQr,
  getPublicAssetQr,
  getAssetAiReport,
} = require('../controllers/assetController');
const { protect, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/public/:code', getPublicAsset);
router.get('/public/:code/qr', getPublicAssetQr);
router.get('/', protect, getAssets);
router.post('/', protect, authorizeRoles('admin'), createAsset);
router.get('/:id', protect, getAssetById);
router.patch('/:id', protect, authorizeRoles('admin'), updateAsset);
router.get('/:id/qr', protect, getAssetQr);
router.get('/:id/ai-report', protect, getAssetAiReport);

module.exports = router;
