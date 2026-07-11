const mongoose = require('mongoose');

const partSchema = new mongoose.Schema(
  {
    name: String,
    quantity: { type: Number, default: 1 },
    cost: { type: Number, default: 0 },
  },
  { _id: false }
);

const maintenanceRecordSchema = new mongoose.Schema(
  {
    issue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issue',
      required: true,
    },
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      required: true,
    },
    technician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    notes: {
      type: String,
      required: true,
      trim: true,
    },
    partsUsed: [partSchema],
    cost: {
      type: Number,
      default: 0,
      min: 0,
    },
    startedAt: Date,
    completedAt: {
      type: Date,
      required: true,
    },
    nextServiceDate: Date,
    evidence: [String],
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
  },
  { timestamps: true }
);

module.exports = mongoose.model('MaintenanceRecord', maintenanceRecordSchema);
