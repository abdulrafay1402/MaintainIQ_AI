const ISSUE_STATUSES = [
  'Reported',
  'Assigned',
  'Inspection Started',
  'Maintenance In Progress',
  'Waiting for Parts',
  'Resolved',
  'Verified',
  'Closed',
  'Reopened',
  'Rejected',
  'Cancelled',
];

const ASSET_STATUSES = [
  'Operational',
  'Issue Reported',
  'Under Inspection',
  'Under Maintenance',
  'Out of Service',
  'Retired',
  'Faulty',
];

const ROLES = ['student', 'admin', 'technician'];

module.exports = { ISSUE_STATUSES, ASSET_STATUSES, ROLES };
