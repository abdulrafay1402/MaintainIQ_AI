const mongoose = require('mongoose');
const { randomUUID } = require('crypto');

const assetSchema = new mongoose.Schema(
  {
    publicId: {
      type: String,
      unique: true,
      default: () => randomUUID(),
      immutable: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    building: {
      type: String,
      trim: true,
    },
    floor: {
      type: String,
      trim: true,
    },
    roomNumber: {
      type: String,
      trim: true,
    },
    vendor: {
      type: String,
      trim: true,
    },
    modelNumber: {
      type: String,
      trim: true,
    },
    warrantyDate: {
      type: Date,
    },
    images: [String],
    maintenanceFrequencyDays: {
      type: Number,
    },
    condition: {
      type: String,
      default: 'Good',
      trim: true,
    },
    status: {
      type: String,
      enum: ['Operational', 'Issue Reported', 'Under Inspection', 'Under Maintenance', 'Out of Service', 'Retired', 'Faulty'],
      default: 'Operational',
    },
    serialNumber: {
      type: String,
      trim: true,
    },
    purchaseDate: {
      type: Date,
    },
    lastServiceDate: {
      type: Date,
    },
    nextServiceDate: {
      type: Date,
    },
    assignedTechnician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

assetSchema.pre('save', function (next) {
  if (!this.publicId) {
    this.publicId = randomUUID();
  }
  next();
});

module.exports = mongoose.model('Asset', assetSchema);
