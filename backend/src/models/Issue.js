const mongoose = require('mongoose');

const partSchema = new mongoose.Schema(
  {
    name: String,
    quantity: { type: Number, default: 1 },
    cost: { type: Number, default: 0 },
  },
  { _id: false }
);

const issueSchema = new mongoose.Schema(
  {
    issueNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      required: true,
    },
    assetCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium',
    },
    reporterName: {
      type: String,
      required: true,
      trim: true,
    },
    reporterEmail: {
      type: String,
      trim: true,
    },
    studentId: {
      type: String,
      trim: true,
    },
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['Reported', 'Assigned', 'Inspection Started', 'Maintenance In Progress', 'Waiting for Parts', 'Resolved', 'Verified', 'Closed', 'Reopened', 'Rejected', 'Cancelled'],
      default: 'Reported',
    },
    rejectedReason: {
      type: String,
      trim: true,
    },
    acceptedAt: Date,
    // Stamped on the Assigned -> Inspection Started transition; used to
    // auto-fill the technician's work-start date in the maintenance form.
    inspectionStartedAt: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    verifiedAt: Date,
    timeline: [
      {
        fromStatus: String,
        toStatus: String,
        actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        actorName: String,
        note: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    assignedTechnician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    aiSuggestion: {
      title: String,
      category: String,
      priority: String,
      possibleCauses: [String],
      initialChecks: [String],
      warning: String,
      recurringPattern: String,
      reviewedByUser: { type: Boolean, default: false },
    },
    evidence: [String],
    // Photos uploaded by the technician as proof of completed maintenance
    // (kept separate from the reporter's complaint evidence above).
    maintenanceEvidence: [String],
    maintenanceNotes: {
      type: String,
      trim: true,
    },
    partsUsed: [partSchema],
    maintenanceCost: {
      type: Number,
      default: 0,
    },
    resolvedAt: Date,
    closedAt: Date,
    inspectionFindings: {
      type: String,
      trim: true,
    },
    workPerformed: {
      type: String,
      trim: true,
    },
    finalCondition: {
      type: String,
      trim: true,
    },
    durationHours: {
      type: Number,
      default: 1,
    },
    aiMaintenanceSummary: {
      type: String,
      trim: true,
    },
    aiPreventiveRecommendation: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Hot-path indexes: per-asset lookups (public page, history, spend aggregation),
// technician task lists, and category/status filters.
issueSchema.index({ asset: 1, createdAt: -1 });
issueSchema.index({ assignedTechnician: 1, status: 1 });
issueSchema.index({ category: 1, status: 1 });
issueSchema.index({ reporterId: 1 });

module.exports = mongoose.model('Issue', issueSchema);
