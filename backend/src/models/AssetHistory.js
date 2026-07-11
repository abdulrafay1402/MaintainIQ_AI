const mongoose = require('mongoose');

const assetHistorySchema = new mongoose.Schema(
  {
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      required: true,
    },
    issue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issue',
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    actorName: {
      type: String,
      required: true,
      trim: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    details: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

assetHistorySchema.pre('findOneAndUpdate', function () {
  throw new Error('Asset history entries are immutable and cannot be updated');
});

assetHistorySchema.pre('updateOne', function () {
  throw new Error('Asset history entries are immutable and cannot be updated');
});

assetHistorySchema.pre('deleteOne', function () {
  throw new Error('Asset history entries are immutable and cannot be deleted');
});

assetHistorySchema.pre('findOneAndDelete', function () {
  throw new Error('Asset history entries are immutable and cannot be deleted');
});

assetHistorySchema.pre('updateMany', function () {
  throw new Error('Asset history entries are immutable and cannot be updated');
});

assetHistorySchema.pre('deleteMany', function () {
  throw new Error('Asset history entries are immutable and cannot be deleted');
});

assetHistorySchema.pre('replaceOne', function () {
  throw new Error('Asset history entries are immutable and cannot be replaced');
});

module.exports = mongoose.model('AssetHistory', assetHistorySchema);
