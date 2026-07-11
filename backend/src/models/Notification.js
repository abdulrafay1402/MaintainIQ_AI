const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['issue_reported', 'issue_assigned', 'issue_accepted', 'status_changed', 'issue_resolved', 'issue_verified', 'issue_rejected'],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    relatedIssue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issue',
    },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
