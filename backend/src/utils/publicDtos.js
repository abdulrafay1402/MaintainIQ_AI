const toPublicAssetDto = (asset) => ({
  id: asset._id,
  publicId: asset.publicId,
  name: asset.name,
  code: asset.code,
  category: asset.category,
  location: asset.location,
  building: asset.building,
  floor: asset.floor,
  roomNumber: asset.roomNumber,
  condition: asset.condition,
  status: asset.status,
  lastServiceDate: asset.lastServiceDate,
  nextServiceDate: asset.nextServiceDate,
});

const toPublicIssueActivityDto = (issue) => ({
  issueNumber: issue.issueNumber,
  title: issue.title,
  category: issue.category,
  status: issue.status,
  createdAt: issue.createdAt,
  resolvedAt: issue.resolvedAt,
});

const toReporterIssueView = (issue) => ({
  _id: issue._id,
  issueNumber: issue.issueNumber,
  title: issue.title,
  description: issue.description,
  category: issue.category,
  priority: issue.priority,
  status: issue.status,
  evidence: issue.evidence,
  createdAt: issue.createdAt,
  resolvedAt: issue.resolvedAt,
  closedAt: issue.closedAt,
  asset: issue.asset ? {
    _id: issue.asset._id,
    name: issue.asset.name,
    code: issue.asset.code,
    category: issue.asset.category,
    location: issue.asset.location,
    status: issue.asset.status,
  } : undefined,
  assignedTechnician: issue.assignedTechnician ? {
    _id: issue.assignedTechnician._id,
    name: issue.assignedTechnician.name,
  } : null,
});

module.exports = {
  toPublicAssetDto,
  toPublicIssueActivityDto,
  toReporterIssueView,
};
