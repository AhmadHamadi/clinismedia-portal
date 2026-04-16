const mongoose = require("mongoose");

const retellCallSchema = new mongoose.Schema(
  {
    retellCallId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    twilioCallSid: {
      type: String,
      default: null,
      index: true,
    },
    agentId: {
      type: String,
      default: null,
      index: true,
    },
    agentVersion: {
      type: Number,
      default: null,
    },
    callType: {
      type: String,
      default: "phone_call",
    },
    direction: {
      type: String,
      default: "inbound",
    },
    fromNumber: {
      type: String,
      default: null,
    },
    toNumber: {
      type: String,
      default: null,
    },
    callStatus: {
      type: String,
      default: null,
      index: true,
    },
    disconnectionReason: {
      type: String,
      default: null,
    },
    startTimestamp: {
      type: Date,
      default: null,
      index: true,
    },
    endTimestamp: {
      type: Date,
      default: null,
    },
    durationMs: {
      type: Number,
      default: null,
    },
    recordingUrl: {
      type: String,
      default: null,
    },
    transcript: {
      type: String,
      default: null,
    },
    transcriptObject: {
      type: Array,
      default: undefined,
    },
    transcriptWithToolCalls: {
      type: Array,
      default: undefined,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    retellLlmDynamicVariables: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    collectedDynamicVariables: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    customSipHeaders: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    callAnalysis: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    webhookEvents: {
      type: [String],
      default: [],
    },
    lastWebhookEvent: {
      type: String,
      default: null,
    },
    rawCall: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

retellCallSchema.index({ customerId: 1, startTimestamp: -1 });
retellCallSchema.index({ twilioCallSid: 1, startTimestamp: -1 });

module.exports = mongoose.model("RetellCall", retellCallSchema);
