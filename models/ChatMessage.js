const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatSession",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["user", "ai", "system"],
      index: true,
    },
    message: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // For AI messages, store additional context
    aiContext: {
      model: String,
      tokens: Number,
      processingTime: Number,
      temperature: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
chatMessageSchema.index({ sessionId: 1, timestamp: 1 });
chatMessageSchema.index({ sessionId: 1, type: 1 });
chatMessageSchema.index({ timestamp: -1 });

// Virtual for formatted timestamp
chatMessageSchema.virtual("formattedTimestamp").get(function () {
  return this.timestamp.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
});

// Static method to get chat history
chatMessageSchema.statics.getChatHistory = function (sessionId, limit = 50) {
  return this.find({ sessionId }).sort({ timestamp: 1 }).limit(limit).lean();
};

// Static method to get recent messages
chatMessageSchema.statics.getRecentMessages = function (sessionId, limit = 10) {
  return this.find({ sessionId }).sort({ timestamp: -1 }).limit(limit).lean();
};

// Static method to count messages by type
chatMessageSchema.statics.getMessageStats = function (sessionId) {
  return this.aggregate([
    { $match: { sessionId } },
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 },
        lastMessage: { $max: "$timestamp" },
      },
    },
  ]);
};

// Static method to cleanup old messages (optional)
chatMessageSchema.statics.cleanupOldMessages = function (olderThanDays = 30) {
  const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  return this.deleteMany({ timestamp: { $lt: cutoffDate } });
};

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
