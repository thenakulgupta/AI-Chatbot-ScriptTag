const mongoose = require("mongoose");

const chatSessionSchema = new mongoose.Schema(
  {
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    userAgent: {
      type: String,
      default: "Unknown",
    },
    url: {
      type: String,
      default: "Unknown",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
chatSessionSchema.index({ createdAt: -1 });
chatSessionSchema.index({ lastActivity: -1 });
chatSessionSchema.index({ isActive: 1 });

// Virtual for message count
chatSessionSchema.virtual("messageCount", {
  ref: "ChatMessage",
  localField: "_id",
  foreignField: "sessionId",
  count: true,
});

// Method to update last activity
chatSessionSchema.methods.updateActivity = function () {
  this.lastActivity = new Date();
  return this.save();
};

// Static method to find active sessions
chatSessionSchema.statics.findActiveSessions = function () {
  return this.find({ isActive: true }).sort({ lastActivity: -1 });
};

// Static method to cleanup old sessions
chatSessionSchema.statics.cleanupOldSessions = function (
  inactiveThreshold = 30 * 60 * 1000
) {
  const cutoffDate = new Date(Date.now() - inactiveThreshold);
  return this.updateMany(
    {
      lastActivity: { $lt: cutoffDate },
      isActive: true,
    },
    { isActive: false }
  );
};

module.exports = mongoose.model("ChatSession", chatSessionSchema);
