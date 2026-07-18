const express = require('express');
const {
  listIssues,
  listMyIssues,
  listAssignedIssues,
  listTeamIssues,
  getIssueById,
  reportPublicIssue,
  assignIssue,
  updateIssueStatus,
  addMaintenanceRecord,
  triageIssue,
  claimIssue,
  getTechnicianRecommendations,
} = require('../controllers/issueController');
const { protect, authorizeRoles } = require('../middleware/auth');
const { uploadEvidence } = require('../middleware/upload');
const { publicReportLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/public/:code/report', publicReportLimiter, uploadEvidence.array('evidence', 5), reportPublicIssue);
router.post('/triage', publicReportLimiter, triageIssue);
router.get('/', protect, listIssues);
router.get('/my', protect, listMyIssues);
router.get('/assigned', protect, listAssignedIssues);
router.get('/team', protect, authorizeRoles('technician'), listTeamIssues);
router.get('/:id', protect, getIssueById);
router.get('/:id/recommendations', protect, authorizeRoles('admin'), getTechnicianRecommendations);
router.patch('/:id/assign', protect, authorizeRoles('admin'), assignIssue);
router.patch('/:id/status', protect, updateIssueStatus);
router.patch('/:id/claim', protect, authorizeRoles('technician', 'admin'), claimIssue);
// Multipart: technicians attach evidence photos of the completed work.
router.post('/:id/maintenance', protect, authorizeRoles('admin', 'technician'), uploadEvidence.array('evidence', 5), addMaintenanceRecord);

module.exports = router;
