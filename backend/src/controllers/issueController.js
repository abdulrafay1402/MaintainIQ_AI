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
const { notifyAdmins, notifyUser, notifySupervisors } = require('../services/notificationService');
const { sendResolutionEmail } = require('../services/emailService');

const buildIssueNumber = () => `ISU-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

// Issues in a terminal/settled state cannot be assigned, claimed, or have maintenance
// recorded against them until they are explicitly reopened.
const SETTLED_ISSUE_STATUSES = ['Resolved', 'Verified', 'Closed', 'Rejected', 'Cancelled'];

// A technician whose supervisorCategories include the issue's category is that
// department's supervisor: they review completed work (verify/close/reopen).
const isSupervisorOf = (user, category) =>
  user?.role === 'technician' && Array.isArray(user.supervisorCategories) && !!category && user.supervisorCategories.includes(category);

// Supervisors act on the review stage of the lifecycle, not on active repair steps
// (those belong to the assigned technician).
const SUPERVISOR_ALLOWED_TARGETS = ['Verified', 'Closed', 'Reopened'];

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

const ISSUE_SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  updated: { updatedAt: -1 },
  status: { status: 1, createdAt: -1 },
};

const listIssues = asyncHandler(async (req, res) => {
  const { status, priority, assignedTechnician, search, unassigned, category, location, sort } = req.query;
  const filter = {};

  if (req.user.role === 'technician') {
    if (unassigned === 'true') {
      filter.assignedTechnician = null;
    } else {
      filter.assignedTechnician = req.user._id;
    }
  } else if (req.user.role === 'admin') {
    if (unassigned === 'true') {
      filter.assignedTechnician = null;
    } else if (assignedTechnician) {
      filter.assignedTechnician = assignedTechnician === 'unassigned' ? null : assignedTechnician;
    }
  } else {
    // Students/reporters may only ever list their own reports here —
    // authorization is enforced on the server, not by hiding frontend buttons.
    filter.$and = [{
      $or: [
        { reporterId: req.user._id },
        { reporterEmail: req.user.email },
      ],
    }];
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
    .sort(ISSUE_SORTS[sort] || ISSUE_SORTS.newest);

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
  const isSupervisor = isSupervisorOf(req.user, issue.category);
  const isReporter = (issue.reporterId && issue.reporterId.toString() === req.user._id.toString())
    || (issue.reporterEmail && issue.reporterEmail.toLowerCase() === req.user.email.toLowerCase());

  if (!isAdmin && !isAssignedTechnician && !isSupervisor && !isReporter) {
    throw new ApiError(403, 'You are not authorized to view this issue');
  }

  if (isAdmin || isAssignedTechnician || isSupervisor) {
    return res.json({ issue });
  }

  res.json({ issue: toReporterIssueView(issue) });
});

// Supervisor team view: every issue in the categories this technician supervises,
// used for review queues, team performance stats, and dashboard notifications.
const listTeamIssues = asyncHandler(async (req, res) => {
  const categories = req.user.supervisorCategories || [];
  if (req.user.role !== 'technician' || categories.length === 0) {
    throw new ApiError(403, 'Only supervisors can view the team queue');
  }

  const issues = await Issue.find({ category: { $in: categories } })
    .populate('asset', 'name code category location status')
    .populate('assignedTechnician', 'name email expertise')
    .sort({ updatedAt: -1 });

  res.json({ issues, categories });
});

const reportPublicIssue = asyncHandler(async (req, res) => {
  let { title, description, priority, category, reporterName, reporterEmail, studentId, evidence = [], aiSuggestion } = req.body;
  const asset = await findAssetByIdentifier(req.params.code);

  if (!asset) {
    throw new ApiError(404, 'Asset not found');
  }

  if (asset.status === 'Retired') {
    throw new ApiError(400, 'This asset is retired. New issues cannot be reported against it.');
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

  if (SETTLED_ISSUE_STATUSES.includes(issue.status)) {
    throw new ApiError(400, `Issue is ${issue.status} and cannot be ${isRelease ? 'released' : 'assigned'}. Reopen it first.`);
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

  // The department supervisor tracks what their team is working on.
  await safeNotify(() => notifySupervisors({
    category: issue.category,
    excludeUserId: technician._id,
    type: 'team_assignment',
    title: `Team assignment: ${issue.issueNumber}`,
    message: `${technician.name} was assigned "${issue.title}" (${issue.assetCode}) in your department (${issue.category}).`,
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
  const isSupervisor = isSupervisorOf(req.user, issue.category);

  if (!isAdmin && !isAssignedTechnician && !isSupervisor) {
    throw new ApiError(403, 'You can only update issues assigned to you');
  }

  // Supervisors (when not the assigned technician) only review completed work.
  if (isSupervisor && !isAdmin && !isAssignedTechnician && !SUPERVISOR_ALLOWED_TARGETS.includes(status)) {
    throw new ApiError(403, 'Supervisors can only verify, close, or reopen issues in their department');
  }

  // Reopening is a review decision: only an admin or the department supervisor may do it.
  if (status === 'Reopened' && !isAdmin && !isSupervisor) {
    throw new ApiError(403, 'Only an admin or the department supervisor can reopen an issue');
  }

  if (!canTransitionIssue(issue.status, status)) {
    throw new ApiError(400, `Invalid issue transition from ${issue.status} to ${status}`);
  }

  if (status === 'Resolved' && !note) {
    throw new ApiError(400, 'Resolution note is required before resolving an issue');
  }

  const previousStatus = issue.status;
  issue.status = status;
  // The note always lands in the timeline entry below; maintenanceNotes is only
  // set on resolution so a later status note can't clobber the maintenance record.
  if (note && status === 'Resolved') {
    issue.maintenanceNotes = note;
  }
  if (status === 'Inspection Started' && !issue.inspectionStartedAt) {
    // Recorded so the maintenance form can auto-fill the real work-start date.
    issue.inspectionStartedAt = new Date();
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

    // The department supervisor reviews completed work (verify / reopen).
    await safeNotify(() => notifySupervisors({
      category: issue.category,
      excludeUserId: req.user._id,
      type: 'team_resolution',
      title: `Ready for review: ${issue.issueNumber}`,
      message: `"${issue.title}" (${issue.assetCode}) was resolved by ${req.user.name}. Please review and verify or reopen.`,
      relatedIssue: issue._id,
    }));
  }

  // Reopened work goes straight back to the assigned technician's attention.
  if (status === 'Reopened' && issue.assignedTechnician) {
    await safeNotify(() => notifyUser({
      userId: issue.assignedTechnician,
      type: 'issue_reopened',
      title: `Issue reopened: ${issue.issueNumber}`,
      message: `"${issue.title}" (${issue.assetCode}) was reopened by ${req.user.name}${note ? `: ${note}` : '.'}`,
      relatedIssue: issue._id,
    }));
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
  let { notes, partsUsed = [], cost = 0, startedAt, completedAt, nextServiceDate, evidence = [], inspectionFindings = '', workPerformed = '', finalCondition = 'Good', durationHours = 1 } = req.body;
  const issue = await Issue.findById(req.params.id);
  if (!issue) {
    throw new ApiError(404, 'Issue not found');
  }

  // This endpoint accepts multipart/form-data (evidence photos), so structured
  // fields may arrive as JSON strings — normalize them first.
  if (typeof partsUsed === 'string') {
    try {
      partsUsed = JSON.parse(partsUsed);
    } catch {
      throw new ApiError(400, 'partsUsed must be a valid JSON array');
    }
  }
  if (typeof evidence === 'string') {
    try {
      evidence = JSON.parse(evidence);
    } catch {
      evidence = evidence ? [evidence] : [];
    }
  }
  if (!Array.isArray(partsUsed)) partsUsed = [];
  if (!Array.isArray(evidence)) evidence = [];

  // Photos uploaded by the technician as proof of the completed work.
  const uploadedEvidence = (req.files || []).map((file) => file.path);
  const evidenceUrls = [...uploadedEvidence, ...evidence];

  const isAdmin = req.user.role === 'admin';
  const isAssignedTechnician = issue.assignedTechnician
    && issue.assignedTechnician.toString() === req.user._id.toString();

  if (!isAdmin && !isAssignedTechnician) {
    throw new ApiError(403, 'Only the assigned technician or an admin can record maintenance for this issue');
  }

  if (SETTLED_ISSUE_STATUSES.includes(issue.status)) {
    throw new ApiError(400, `Issue is already ${issue.status}. Reopen it before recording new maintenance.`);
  }

  const previousStatus = issue.status;

  if (!notes) {
    throw new ApiError(400, 'Maintenance notes are required');
  }

  // Normalize parts: every entry becomes { name, quantity, cost } with numeric,
  // non-negative values; the parts subtotal is computed server-side so the stored
  // totals are always consistent with the line items.
  const cleanParts = partsUsed
    .map((part) => ({
      name: String(part?.name || '').trim(),
      quantity: Number(part?.quantity),
      cost: Number(part?.cost),
    }))
    .filter((part) => part.name);

  if (cleanParts.some((part) => !Number.isFinite(part.quantity) || part.quantity <= 0 || !Number.isFinite(part.cost) || part.cost < 0)) {
    throw new ApiError(400, 'Every part needs a positive quantity and a non-negative cost');
  }

  const partsSubtotal = cleanParts.reduce((sum, part) => sum + part.quantity * part.cost, 0);

  // Grand total defaults to the parts subtotal when not supplied explicitly,
  // and can never be less than the parts it includes.
  const numericCost = cost === undefined || cost === null || cost === '' ? partsSubtotal : Number(cost);
  if (!Number.isFinite(numericCost) || numericCost < 0) {
    throw new ApiError(400, 'Maintenance cost must be a valid non-negative number');
  }
  if (numericCost < partsSubtotal) {
    throw new ApiError(400, `Total cost (${numericCost}) cannot be less than the parts subtotal (${partsSubtotal})`);
  }

  if (!completedAt) {
    throw new ApiError(400, 'Maintenance completion date is required');
  }

  const { endOfToday } = require('../utils/validators');

  // Work can only be logged as done today or earlier — never in the future.
  if (new Date(completedAt) > endOfToday()) {
    throw new ApiError(400, 'Completion date cannot be in the future — it must be today or earlier');
  }

  if (startedAt && new Date(startedAt) > new Date(completedAt)) {
    throw new ApiError(400, 'Maintenance start date cannot be after the completion date');
  }

  // The next service must be scheduled for a future day.
  if (nextServiceDate && new Date(nextServiceDate) <= endOfToday()) {
    throw new ApiError(400, 'Next service date must be after today');
  }

  if (nextServiceDate && new Date(nextServiceDate) < new Date(completedAt)) {
    throw new ApiError(400, 'Next service date cannot be before the completion date');
  }

  issue.maintenanceNotes = notes;
  issue.partsUsed = cleanParts;
  issue.maintenanceCost = numericCost;
  issue.maintenanceEvidence = evidenceUrls;
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
    partsUsed: cleanParts,
    cost: numericCost,
    startedAt,
    completedAt,
    nextServiceDate,
    evidence: evidenceUrls,
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

  // The department supervisor reviews completed maintenance (verify / reopen).
  await safeNotify(() => notifySupervisors({
    category: issue.category,
    excludeUserId: req.user._id,
    type: 'team_resolution',
    title: `Ready for review: ${issue.issueNumber}`,
    message: `${req.user.name} recorded maintenance and resolved "${issue.title}" (${issue.assetCode}). Please review and verify or reopen.`,
    relatedIssue: issue._id,
  }));

  res.status(201).json({ maintenanceRecord, issue });
});

const triageIssue = asyncHandler(async (req, res) => {
  const { assetCode, complaint } = req.body;

  if (!complaint || !complaint.trim()) {
    throw new ApiError(400, 'Complaint text is required for AI triage');
  }

  const asset = await findAssetByIdentifier(assetCode);

  if (!asset) {
    throw new ApiError(404, 'Asset not found');
  }

  const recentIssues = await Issue.find({ asset: asset._id })
    .select('title category status createdAt')
    .sort({ createdAt: -1 })
    .limit(10);

  const suggestion = await buildTriage({ asset, complaint, recentIssues });
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

  if (SETTLED_ISSUE_STATUSES.includes(issue.status)) {
    throw new ApiError(400, `Issue is ${issue.status} and cannot be claimed. Reopen it first.`);
  }

  const previousStatus = issue.status;
  issue.assignedTechnician = req.user._id;
  issue.status = 'Assigned';
  addTimelineEntry(issue, { fromStatus: previousStatus, toStatus: 'Assigned', actor: req.user._id, actorName: req.user.name, note: 'Claimed from the shared pool' });
  await issue.save();

  const asset = await Asset.findById(issue.asset);
  if (asset) {
    asset.assignedTechnician = req.user._id;
    asset.status = nextAssetStatusForIssueStatus('Assigned');
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
  listTeamIssues,
  getIssueById,
  reportPublicIssue,
  assignIssue,
  updateIssueStatus,
  addMaintenanceRecord,
  triageIssue,
  claimIssue,
  getTechnicianRecommendations,
};
