const Asset = require('../models/Asset');
const Issue = require('../models/Issue');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { createHistoryEntry } = require('../services/historyService');
const { canTransitionIssue, nextAssetStatusForIssueStatus } = require('../services/workflowService');
const { buildTriage, generateMaintenanceSummary } = require('../services/triageService');
const { findAssetByIdentifier } = require('../utils/assetLookup');
const { toReporterIssueView } = require('../utils/publicDtos');
const { notifyAdmins, notifyUser } = require('../services/notificationService');
const { sendResolutionEmail } = require('../services/emailService');

const buildIssueNumber = () => `ISU-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

const addTimelineEntry = (issue, { fromStatus, toStatus, actor, actorName, note }) => {
  issue.timeline.push({ fromStatus, toStatus, actor, actorName, note });
};

// Notifications must never break the main workflow, so failures are logged and swallowed.
const safeNotify = async (fn) => {
  try {
    await fn();
  } catch (error) {
    console.error('Notification error:', error.message);
  }
};

const listIssues = asyncHandler(async (req, res) => {
  const { status, priority, assignedTechnician, search, unassigned, category, location } = req.query;
  const filter = {};

  if (req.user.role === 'technician') {
    if (unassigned === 'true') {
      filter.assignedTechnician = null;
    } else {
      filter.assignedTechnician = req.user._id;
    }
  } else {
    if (unassigned === 'true') {
      filter.assignedTechnician = null;
    } else if (assignedTechnician && req.user.role === 'admin') {
      filter.assignedTechnician = assignedTechnician === 'unassigned' ? null : assignedTechnician;
    }
  }

  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (category) filter.category = category;
  if (location) {
    const matchingAssets = await Asset.find({ location: { $regex: location, $options: 'i' } }).select('_id');
    filter.asset = { $in: matchingAssets.map((asset) => asset._id) };
  }
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { issueNumber: { $regex: search, $options: 'i' } },
      { assetCode: { $regex: search, $options: 'i' } },
    ];
  }

  const issues = await Issue.find(filter)
    .populate('asset', 'name code category location status')
    .populate('assignedTechnician', 'name email role')
    .populate('reporterId', 'name email studentId')
    .sort({ createdAt: -1 });

  res.json({ issues });
});

const listMyIssues = asyncHandler(async (req, res) => {
  const filter = {
    $or: [
      { reporterId: req.user._id },
      { reporterEmail: req.user.email },
    ],
  };

  const issues = await Issue.find(filter)
    .populate('asset', 'name code category location status')
    .populate('assignedTechnician', 'name email')
    .sort({ createdAt: -1 });

  res.json({ issues });
});

const listAssignedIssues = asyncHandler(async (req, res) => {
  const issues = await Issue.find({ assignedTechnician: req.user._id })
    .populate('asset', 'name code category location status')
    .sort({ updatedAt: -1 });

  res.json({ issues });
});

const getIssueById = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id)
    .populate('asset')
    .populate('assignedTechnician', 'name email role');

  if (!issue) {
    throw new ApiError(404, 'Issue not found');
  }

  const isAdmin = req.user.role === 'admin';
  const isAssignedTechnician = issue.assignedTechnician
    && issue.assignedTechnician._id.toString() === req.user._id.toString();
  const isReporter = (issue.reporterId && issue.reporterId.toString() === req.user._id.toString())
    || (issue.reporterEmail && issue.reporterEmail.toLowerCase() === req.user.email.toLowerCase());

  if (!isAdmin && !isAssignedTechnician && !isReporter) {
    throw new ApiError(403, 'You are not authorized to view this issue');
  }

  if (isAdmin || isAssignedTechnician) {
    return res.json({ issue });
  }

  res.json({ issue: toReporterIssueView(issue) });
});

const reportPublicIssue = asyncHandler(async (req, res) => {
  let { title, description, priority, category, reporterName, reporterEmail, studentId, evidence = [], aiSuggestion } = req.body;
  const asset = await findAssetByIdentifier(req.params.code);

  if (!asset) {
    throw new ApiError(404, 'Asset not found');
  }

  if (typeof aiSuggestion === 'string') {
    try {
      aiSuggestion = JSON.parse(aiSuggestion);
    } catch {
      aiSuggestion = undefined;
    }
  }

  if (typeof evidence === 'string') {
    try {
      evidence = JSON.parse(evidence);
    } catch {
      evidence = evidence ? [evidence] : [];
    }
  }

  const uploadedEvidence = (req.files || []).map((file) => file.path);
  const evidenceUrls = [...uploadedEvidence, ...(Array.isArray(evidence) ? evidence : [])];

  if (!title || !description || !category || !reporterName) {
    throw new ApiError(400, 'Title, description, category, and reporter name are required');
  }

  const issueNumber = buildIssueNumber();
  const issue = await Issue.create({
    issueNumber,
    asset: asset._id,
    assetCode: asset.code,
    title,
    description,
    priority,
    category,
    reporterName,
    reporterEmail,
    studentId,
    evidence: evidenceUrls,
    aiSuggestion,
  });

  addTimelineEntry(issue, { fromStatus: null, toStatus: 'Reported', actorName: reporterName, note: 'Issue submitted from the public asset page' });
  await issue.save();

  await safeNotify(() => notifyAdmins({
    type: 'issue_reported',
    title: `New issue reported: ${issue.issueNumber}`,
    message: `${reporterName} reported "${issue.title}" on asset ${asset.code} (${asset.name}).`,
    relatedIssue: issue._id,
  }));

  asset.status = 'Issue Reported';
  await asset.save();

  await createHistoryEntry({
    asset: asset._id,
    issue: issue._id,
    actorName: reporterName,
    action: 'Issue reported',
    details: `${issue.issueNumber} submitted from the public asset page`,
  });

  res.status(201).json({ issue });
});

const assignIssue = asyncHandler(async (req, res) => {
  const { technicianId } = req.body;
  const isRelease = !technicianId || technicianId === 'unassigned';

  if (!isRelease && !technicianId) {
    throw new ApiError(400, 'Technician is required');
  }

  const issue = await Issue.findById(req.params.id);
  if (!issue) {
    throw new ApiError(404, 'Issue not found');
  }

  if (isRelease) {
    const previousStatus = issue.status;
    issue.assignedTechnician = null;
    issue.status = 'Reported';
    addTimelineEntry(issue, { fromStatus: previousStatus, toStatus: 'Reported', actor: req.user._id, actorName: req.user.name, note: 'Released to the shared technician pool' });
    await issue.save();

    const asset = await Asset.findById(issue.asset);
    if (asset) {
      asset.assignedTechnician = null;
      asset.status = 'Issue Reported';
      await asset.save();
    }

    await createHistoryEntry({
      asset: issue.asset,
      issue: issue._id,
      actor: req.user._id,
      actorName: req.user.name,
      action: 'Issue released to shared pool',
      details: 'Released/shared by admin',
    });

    return res.json({ issue });
  }

  const technician = await User.findById(technicianId);
  if (!technician || technician.role !== 'technician') {
    throw new ApiError(400, 'Selected user is not a technician');
  }

  const previousStatus = issue.status;
  issue.assignedTechnician = technicianId;
  issue.status = 'Assigned';
  addTimelineEntry(issue, { fromStatus: previousStatus, toStatus: 'Assigned', actor: req.user._id, actorName: req.user.name, note: `Assigned to ${technician.name}` });
  await issue.save();

  await safeNotify(() => notifyUser({
    userId: technician._id,
    type: 'issue_assigned',
    title: `Issue assigned: ${issue.issueNumber}`,
    message: `You have been assigned "${issue.title}" (${issue.assetCode}).`,
    relatedIssue: issue._id,
  }));

  const asset = await Asset.findById(issue.asset);
  if (asset) {
    asset.assignedTechnician = technicianId;
    asset.status = nextAssetStatusForIssueStatus('Assigned');
    await asset.save();
  }

  await createHistoryEntry({
    asset: issue.asset,
    issue: issue._id,
    actor: req.user._id,
    actorName: req.user.name,
    action: 'Issue assigned',
    details: `Assigned to technician ${technicianId}`,
  });

  res.json({ issue });
});

const updateIssueStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  const issue = await Issue.findById(req.params.id);
  if (!issue) {
    throw new ApiError(404, 'Issue not found');
  }

  if (!status) {
    throw new ApiError(400, 'Status is required');
  }

  const isAdmin = req.user.role === 'admin';
  const isAssignedTechnician = issue.assignedTechnician && issue.assignedTechnician.toString() === req.user._id.toString();

  if (!isAdmin && !isAssignedTechnician) {
    throw new ApiError(403, 'You can only update issues assigned to you');
  }

  if (!canTransitionIssue(issue.status, status)) {
    throw new ApiError(400, `Invalid issue transition from ${issue.status} to ${status}`);
  }

  if (status === 'Resolved' && !note) {
    throw new ApiError(400, 'Resolution note is required before resolving an issue');
  }

  const previousStatus = issue.status;
  issue.status = status;
  if (note) {
    issue.maintenanceNotes = note;
  }
  if (status === 'Resolved') {
    issue.resolvedAt = new Date();
  }
  if (status === 'Closed') {
    issue.closedAt = new Date();
  }
  if (status === 'Rejected') {
    issue.rejectedReason = note || 'Rejected without a stated reason';
  }
  if (status === 'Verified') {
    issue.verifiedBy = req.user._id;
    issue.verifiedAt = new Date();
  }
  addTimelineEntry(issue, { fromStatus: previousStatus, toStatus: status, actor: req.user._id, actorName: req.user.name, note });

  await issue.save();

  const asset = await Asset.findById(issue.asset);

  if (status === 'Resolved') {
    // In-app notification for logged-in reporters
    if (issue.reporterId) {
      await safeNotify(() => notifyUser({
        userId: issue.reporterId,
        type: 'issue_resolved',
        title: `Issue resolved: ${issue.issueNumber}`,
        message: `Your reported issue "${issue.title}" has been resolved.`,
        relatedIssue: issue._id,
      }));
    }

    // Email notification for any reporter who supplied an email (including anonymous QR scans)
    const recipientEmail = issue.reporterEmail;
    if (recipientEmail) {
      await safeNotify(() => sendResolutionEmail({
        reporterEmail: recipientEmail,
        reporterName: issue.reporterName || 'Valued Reporter',
        issue,
        asset,
        resolutionNote: note || issue.maintenanceNotes || null,
      }));
    }
  }

  if (asset) {
    asset.status = nextAssetStatusForIssueStatus(status);
    if (status === 'Inspection Started') {
      asset.status = 'Under Inspection';
    }
    if (status === 'Maintenance In Progress' || status === 'Waiting for Parts') {
      asset.status = 'Under Maintenance';
    }
    if (status === 'Resolved' || status === 'Closed') {
      asset.status = 'Operational';
    }
    if (status === 'Reopened') {
      asset.status = 'Issue Reported';
    }
    await asset.save();
  }

  await createHistoryEntry({
    asset: issue.asset,
    issue: issue._id,
    actor: req.user._id,
    actorName: req.user.name,
    action: `Issue status changed to ${status}`,
    details: note || 'Status updated',
  });

  res.json({ issue });
});

const addMaintenanceRecord = asyncHandler(async (req, res) => {
  const { notes, partsUsed = [], cost = 0, startedAt, completedAt, nextServiceDate, evidence = [], inspectionFindings = '', workPerformed = '', finalCondition = 'Good', durationHours = 1 } = req.body;
  const issue = await Issue.findById(req.params.id);
  if (!issue) {
    throw new ApiError(404, 'Issue not found');
  }

  const isAdmin = req.user.role === 'admin';
  const isAssignedTechnician = issue.assignedTechnician
    && issue.assignedTechnician.toString() === req.user._id.toString();

  if (!isAdmin && !isAssignedTechnician) {
    throw new ApiError(403, 'Only the assigned technician or an admin can record maintenance for this issue');
  }

  const previousStatus = issue.status;

  if (!notes) {
    throw new ApiError(400, 'Maintenance notes are required');
  }

  if (Number(cost) < 0) {
    throw new ApiError(400, 'Maintenance cost cannot be negative');
  }

  if (!completedAt) {
    throw new ApiError(400, 'Maintenance completion date is required');
  }

  if (nextServiceDate && new Date(nextServiceDate) < new Date(completedAt)) {
    throw new ApiError(400, 'Next service date cannot be before the completion date');
  }

  issue.maintenanceNotes = notes;
  issue.partsUsed = partsUsed;
  issue.maintenanceCost = Number(cost);
  issue.status = 'Resolved';
  issue.resolvedAt = new Date(completedAt);
  issue.inspectionFindings = inspectionFindings;
  issue.workPerformed = workPerformed;
  issue.finalCondition = finalCondition;
  issue.durationHours = Number(durationHours) || 1;
  addTimelineEntry(issue, { fromStatus: previousStatus, toStatus: 'Resolved', actor: req.user._id, actorName: req.user.name, note: notes });

  const asset = await Asset.findById(issue.asset);

  // Generate AI Summary and Preventive Recommendation on resolution (Step 9)
  try {
    const aiSummary = await generateMaintenanceSummary({ asset, issue });
    issue.aiMaintenanceSummary = aiSummary.summary;
    issue.aiPreventiveRecommendation = aiSummary.recommendation;
  } catch (error) {
    console.error('Failed to generate AI maintenance summary:', error);
  }

  await issue.save();

  if (asset) {
    asset.status = 'Operational';
    asset.lastServiceDate = new Date(completedAt);
    if (nextServiceDate) {
      asset.nextServiceDate = new Date(nextServiceDate);
    }
    await asset.save();
  }

  const MaintenanceRecord = require('../models/MaintenanceRecord');
  const maintenanceRecord = await MaintenanceRecord.create({
    issue: issue._id,
    asset: issue.asset,
    technician: req.user._id,
    notes,
    partsUsed,
    cost,
    startedAt,
    completedAt,
    nextServiceDate,
    evidence,
    inspectionFindings,
    workPerformed,
    finalCondition,
    durationHours: Number(durationHours) || 1,
  });

  await createHistoryEntry({
    asset: issue.asset,
    issue: issue._id,
    actor: req.user._id,
    actorName: req.user.name,
    action: 'Maintenance recorded',
    details: notes,
  });

  // In-app notification for logged-in reporters
  if (issue.reporterId) {
    await safeNotify(() => notifyUser({
      userId: issue.reporterId,
      type: 'issue_resolved',
      title: `Issue resolved: ${issue.issueNumber}`,
      message: `Your reported issue "${issue.title}" has been resolved. ${notes}`,
      relatedIssue: issue._id,
    }));
  }

  // Email notification — sent to any reporter email (covers anonymous QR scan reporters)
  const recipientEmail = issue.reporterEmail;
  if (recipientEmail) {
    await safeNotify(() => sendResolutionEmail({
      reporterEmail: recipientEmail,
      reporterName: issue.reporterName || 'Valued Reporter',
      issue,
      asset,
      resolutionNote: notes || null,
    }));
  }

  res.status(201).json({ maintenanceRecord, issue });
});

const triageIssue = asyncHandler(async (req, res) => {
  const { assetCode, complaint } = req.body;
  const asset = await findAssetByIdentifier(assetCode);

  if (!asset) {
    throw new ApiError(404, 'Asset not found');
  }

  const suggestion = await buildTriage({ asset, complaint });
  res.json({ suggestion });
});

const claimIssue = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id);
  if (!issue) {
    throw new ApiError(404, 'Issue not found');
  }

  if (issue.assignedTechnician) {
    throw new ApiError(400, 'Issue is already assigned to a technician');
  }

  const previousStatus = issue.status;
  issue.assignedTechnician = req.user._id;
  issue.status = 'Assigned';
  addTimelineEntry(issue, { fromStatus: previousStatus, toStatus: 'Assigned', actor: req.user._id, actorName: req.user.name, note: 'Claimed from the shared pool' });
  await issue.save();

  const asset = await Asset.findById(issue.asset);
  if (asset) {
    asset.assignedTechnician = req.user._id;
    asset.status = 'Under Inspection';
    await asset.save();
  }

  await createHistoryEntry({
    asset: issue.asset,
    issue: issue._id,
    actor: req.user._id,
    actorName: req.user.name,
    action: 'Issue claimed',
    details: `Claimed by technician ${req.user.name}`,
  });

  res.json({ issue });
});

const getTechnicianRecommendations = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id).populate('asset');
  if (!issue) {
    throw new ApiError(404, 'Issue not found');
  }

  const User = require('../models/User');
  const technicians = await User.find({ role: 'technician', isActive: true });
  
  const issueCategory = issue.category || issue.aiSuggestion?.category || '';
  
  const recommendations = technicians.map(tech => {
    const isExpert = tech.expertise && tech.expertise.includes(issueCategory);
    let matchScore = isExpert ? 100 : 0;
    
    return {
      technician: {
        _id: tech._id,
        name: tech.name,
        email: tech.email,
        expertise: tech.expertise
      },
      matchScore,
      isExpert,
      recommendationReason: isExpert 
        ? `AI Recommendation: Specialized in ${issueCategory} (Expertise Match)` 
        : `Available technician`
    };
  });

  recommendations.sort((a, b) => b.matchScore - a.matchScore);

  res.json({ recommendations });
});

module.exports = {
  listIssues,
  listMyIssues,
  listAssignedIssues,
  getIssueById,
  reportPublicIssue,
  assignIssue,
  updateIssueStatus,
  addMaintenanceRecord,
  triageIssue,
  claimIssue,
  getTechnicianRecommendations,
};
