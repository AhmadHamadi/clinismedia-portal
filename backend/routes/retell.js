const express = require("express");
const router = express.Router();
const User = require("../models/User");
const CallLog = require("../models/CallLog");
const RetellCall = require("../models/RetellCall");
const authenticateToken = require("../middleware/authenticateToken");
const authorizeRole = require("../middleware/authorizeRole");
const resolveEffectiveCustomerId = require("../middleware/resolveEffectiveCustomerId");
const {
  sanitizeAiReceptionistSettings,
  summarizeDestination,
  getRetellReadiness,
  verifyRetellSignature,
} = require("../services/retellService");
const EmailService = require("../services/emailService");

function getSettings(user) {
  return sanitizeAiReceptionistSettings(user?.aiReceptionistSettings || {});
}

function preferIncomingValue(incomingValue, existingValue) {
  if (incomingValue === undefined || incomingValue === null || incomingValue === "") {
    return existingValue === undefined ? null : existingValue;
  }

  return incomingValue;
}

function isRetellEmailKey(key) {
  const keyText = String(key || "");
  const tokenizedKey = keyText.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
  const tokens = tokenizedKey
    .split(/[^a-zA-Z0-9]+/)
    .map((token) => token.toLowerCase())
    .filter(Boolean);
  const normalizedKey = keyText.replace(/[^a-z0-9]/gi, "").toLowerCase();

  return (
    tokens.includes("email") ||
    normalizedKey === "email" ||
    normalizedKey === "emailaddress" ||
    normalizedKey.endsWith("emailaddress")
  );
}

function scrubRetellEmailFields(value) {
  if (Array.isArray(value)) {
    return value.map((item) => scrubRetellEmailFields(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.entries(value).reduce((scrubbed, [key, entryValue]) => {
    if (isRetellEmailKey(key)) {
      return scrubbed;
    }

    scrubbed[key] = scrubRetellEmailFields(entryValue);
    return scrubbed;
  }, {});
}

function mergeCallAnalysis(existingAnalysis, incomingAnalysis) {
  if (!existingAnalysis && !incomingAnalysis) {
    return undefined;
  }

  return {
    ...(existingAnalysis && typeof existingAnalysis === "object"
      ? scrubRetellEmailFields(existingAnalysis)
      : {}),
    ...(incomingAnalysis && typeof incomingAnalysis === "object"
      ? scrubRetellEmailFields(incomingAnalysis)
      : {}),
    raw:
      (incomingAnalysis?.raw ? scrubRetellEmailFields(incomingAnalysis.raw) : undefined) ??
      (existingAnalysis?.raw ? scrubRetellEmailFields(existingAnalysis.raw) : undefined) ??
      (incomingAnalysis && typeof incomingAnalysis === "object"
        ? scrubRetellEmailFields(incomingAnalysis)
        : undefined) ??
      (existingAnalysis && typeof existingAnalysis === "object"
        ? scrubRetellEmailFields(existingAnalysis)
        : undefined),
  };
}

function readAnalysisValue(callAnalysis, ...keys) {
  if (!callAnalysis || typeof callAnalysis !== "object") {
    return null;
  }

  const candidateObjects = [
    callAnalysis,
    callAnalysis.custom_analysis_data,
    callAnalysis.custom_analysis,
    callAnalysis.analysis_data,
    callAnalysis.extracted_data,
  ].filter((value) => value && typeof value === "object");

  for (const key of keys) {
    for (const candidate of candidateObjects) {
      if (candidate[key] !== undefined && candidate[key] !== null && candidate[key] !== "") {
        return candidate[key];
      }
    }
  }

  return null;
}

function mapCallAnalysis(callAnalysis = {}) {
  if (!callAnalysis || typeof callAnalysis !== "object") {
    return undefined;
  }

  const appointmentIntent = readAnalysisValue(
    callAnalysis,
    "appointment_intent",
    "appointmentIntent"
  );
  const insuranceMentioned = readAnalysisValue(
    callAnalysis,
    "insurance_mentioned",
    "insuranceMentioned"
  );

  return {
    callSummary: readAnalysisValue(callAnalysis, "call_summary", "callSummary"),
    callSuccessful:
      typeof readAnalysisValue(callAnalysis, "call_successful", "callSuccessful") === "boolean"
        ? readAnalysisValue(callAnalysis, "call_successful", "callSuccessful")
        : null,
    userSentiment: readAnalysisValue(callAnalysis, "user_sentiment", "userSentiment"),
    callerName: readAnalysisValue(callAnalysis, "caller_name", "callerName", "name"),
    reasonForCall: readAnalysisValue(callAnalysis, "reason_for_call", "reasonForCall"),
    callbackNumber: readAnalysisValue(
      callAnalysis,
      "callback_number",
      "callbackNumber",
      "phone_number"
    ),
    symptomsMentioned: readAnalysisValue(
      callAnalysis,
      "symptoms_mentioned",
      "symptomsMentioned"
    ),
    preferredCallbackTime: readAnalysisValue(
      callAnalysis,
      "preferred_callback_time",
      "preferredCallbackTime"
    ),
    patientType: readAnalysisValue(callAnalysis, "patient_type", "patientType"),
    urgencyLevel: readAnalysisValue(callAnalysis, "urgency_level", "urgencyLevel"),
    locationWorksForCaller: readAnalysisValue(
      callAnalysis,
      "location_works_for_caller",
      "locationWorksForCaller"
    ),
    recommendedFollowUp: readAnalysisValue(
      callAnalysis,
      "recommended_follow_up",
      "recommendedFollowUp"
    ),
    serviceRequested: readAnalysisValue(
      callAnalysis,
      "service_requested",
      "serviceRequested"
    ),
    appointmentIntent: typeof appointmentIntent === "boolean" ? appointmentIntent : null,
    insuranceMentioned: typeof insuranceMentioned === "boolean" ? insuranceMentioned : null,
    insuranceProvider: readAnalysisValue(
      callAnalysis,
      "insurance_provider",
      "insuranceProvider"
    ),
    painLevel:
      typeof readAnalysisValue(callAnalysis, "pain_level", "painLevel") === "number" ||
      typeof readAnalysisValue(callAnalysis, "pain_level", "painLevel") === "string"
        ? readAnalysisValue(callAnalysis, "pain_level", "painLevel")
        : null,
    preferredLocation: readAnalysisValue(
      callAnalysis,
      "preferred_location",
      "preferredLocation"
    ),
    bestNextAction: readAnalysisValue(callAnalysis, "best_next_action", "bestNextAction"),
    bookingReadiness: readAnalysisValue(
      callAnalysis,
      "booking_readiness",
      "bookingReadiness"
    ),
    raw: scrubRetellEmailFields(callAnalysis),
  };
}

async function findCustomerIdForRetellCall(call = {}) {
  const findClinicByNumber = async (number) => {
    if (!number || typeof number !== "string") {
      return null;
    }

    const normalized = number.replace(/\s/g, "").trim();
    const exactFormats = Array.from(
      new Set([number, normalized, normalized.replace(/^\+/, ""), normalized.replace(/^\+1/, "")].filter(Boolean))
    );

    const numberFields = [
      { twilioPhoneNumber: { $in: exactFormats } },
      { "aiReceptionistSettings.retellPhoneNumber": { $in: exactFormats } },
    ];

    const nationalDigits = normalized.replace(/\D/g, "").replace(/^1/, "");
    if (nationalDigits.length >= 10) {
      numberFields.push(
        { twilioPhoneNumber: { $regex: nationalDigits, $options: "i" } },
        { "aiReceptionistSettings.retellPhoneNumber": { $regex: nationalDigits, $options: "i" } }
      );
    }

    return User.findOne({
      role: "customer",
      $or: numberFields,
    }).select("_id");
  };

  const metadataCustomerId = call?.metadata?.customerId;
  if (metadataCustomerId) {
    return metadataCustomerId;
  }

  const twilioCallSid = call?.metadata?.twilioCallSid || call?.telephony_identifier?.twilio_call_sid;
  if (!twilioCallSid) {
    const inboundNumber =
      call?.metadata?.called_number ||
      call?.metadata?.calledNumber ||
      call?.to_number ||
      null;

    if (inboundNumber) {
      const clinic = await findClinicByNumber(inboundNumber);
      return clinic?._id || null;
    }

    return null;
  }

  const callLog = await CallLog.findOne({ callSid: twilioCallSid }).select("customerId");
  if (callLog?.customerId) {
    return callLog.customerId;
  }

  const inboundNumber =
    call?.metadata?.called_number ||
    call?.metadata?.calledNumber ||
    call?.to_number ||
    null;

  if (inboundNumber) {
    const clinic = await findClinicByNumber(inboundNumber);
    return clinic?._id || null;
  }

  return null;
}

async function upsertRetellCallFromWebhook(event, call) {
  const existingCall = await RetellCall.findOne({ retellCallId: call.call_id }).lean();
  const customerId = await findCustomerIdForRetellCall(call);
  const twilioCallSid = call?.metadata?.twilioCallSid || call?.telephony_identifier?.twilio_call_sid || null;
  const scrubbedCall = scrubRetellEmailFields(call);
  const incomingCallAnalysis = mapCallAnalysis(scrubbedCall?.call_analysis);

  return RetellCall.findOneAndUpdate(
    { retellCallId: call.call_id },
    {
      customerId: preferIncomingValue(customerId, existingCall?.customerId),
      twilioCallSid: preferIncomingValue(twilioCallSid, existingCall?.twilioCallSid),
      agentId: preferIncomingValue(call?.agent_id, existingCall?.agentId),
      agentVersion:
        typeof call?.agent_version === "number"
          ? call.agent_version
          : preferIncomingValue(null, existingCall?.agentVersion),
      callType: preferIncomingValue(call?.call_type, existingCall?.callType ?? "phone_call"),
      direction: preferIncomingValue(call?.direction, existingCall?.direction ?? "inbound"),
      fromNumber: preferIncomingValue(call?.from_number, existingCall?.fromNumber),
      toNumber: preferIncomingValue(call?.to_number, existingCall?.toNumber),
      callStatus: preferIncomingValue(call?.call_status, existingCall?.callStatus),
      disconnectionReason: preferIncomingValue(
        call?.disconnection_reason,
        existingCall?.disconnectionReason
      ),
      startTimestamp: preferIncomingValue(
        call?.start_timestamp ? new Date(call.start_timestamp) : null,
        existingCall?.startTimestamp
      ),
      endTimestamp: preferIncomingValue(
        call?.end_timestamp ? new Date(call.end_timestamp) : null,
        existingCall?.endTimestamp
      ),
      durationMs: preferIncomingValue(
        typeof call?.duration_ms === "number" ? call.duration_ms : null,
        existingCall?.durationMs
      ),
      recordingUrl: preferIncomingValue(call?.recording_url, existingCall?.recordingUrl),
      transcript: preferIncomingValue(call?.transcript, existingCall?.transcript),
      transcriptObject: preferIncomingValue(
        Array.isArray(call?.transcript_object) ? call.transcript_object : undefined,
        existingCall?.transcriptObject
      ),
      transcriptWithToolCalls: preferIncomingValue(
        Array.isArray(call?.transcript_with_tool_calls) ? call.transcript_with_tool_calls : undefined,
        existingCall?.transcriptWithToolCalls
      ),
      metadata: preferIncomingValue(scrubbedCall?.metadata, existingCall?.metadata),
      retellLlmDynamicVariables: preferIncomingValue(
        scrubbedCall?.retell_llm_dynamic_variables,
        existingCall?.retellLlmDynamicVariables
      ),
      collectedDynamicVariables: preferIncomingValue(
        scrubbedCall?.collected_dynamic_variables,
        existingCall?.collectedDynamicVariables
      ),
      customSipHeaders: preferIncomingValue(scrubbedCall?.custom_sip_headers, existingCall?.customSipHeaders),
      callAnalysis: mergeCallAnalysis(existingCall?.callAnalysis, incomingCallAnalysis),
      lastWebhookEvent: event,
      rawCall: preferIncomingValue(scrubbedCall, existingCall?.rawCall),
      $addToSet: {
        webhookEvents: event,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function maybeSendAiReceptionistEmail(retellCall, event) {
  if (!retellCall || event !== "call_analyzed") {
    return;
  }

  if (retellCall.aiReceptionEmailSentAt || !retellCall.customerId) {
    return;
  }

  const clinic = await User.findById(retellCall.customerId).select(
    "name email role aiReceptionistSettings"
  );

  if (!clinic || clinic.role !== "customer" || !clinic.email) {
    return;
  }

  const settings = getSettings(clinic);
  if (!settings.enabled || settings.routingMode === "off") {
    return;
  }

  const hasUsefulCallContent =
    !!retellCall.recordingUrl ||
    !!retellCall.callAnalysis?.callSummary ||
    !!retellCall.callAnalysis?.reasonForCall ||
    !!retellCall.callAnalysis?.callbackNumber;

  if (!hasUsefulCallContent) {
    return;
  }

  try {
    await EmailService.sendAiReceptionistMissedCallEmail(clinic, retellCall);
    await RetellCall.findOneAndUpdate(
      { retellCallId: retellCall.retellCallId },
      {
        aiReceptionEmailSentAt: new Date(),
        aiReceptionEmailRecipient: clinic.email,
      }
    );
  } catch (emailError) {
    console.error("[Retell] Failed to send AI receptionist notification email:", emailError);
  }
}

router.post("/webhook", async (req, res) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
  const signature = req.headers["x-retell-signature"];

  if (!verifyRetellSignature(rawBody, signature)) {
    console.error("[Retell] Invalid webhook signature");
    return res.status(401).json({ error: "Invalid Retell signature" });
  }

  try {
    const payload = JSON.parse(rawBody || "{}");
    const event = payload?.event || payload?.event_type || null;
    const { call } = payload;

    if (!event || !call?.call_id) {
      return res.status(400).json({ error: "Invalid Retell webhook payload" });
    }

    const retellCall = await upsertRetellCallFromWebhook(event, call);
    await maybeSendAiReceptionistEmail(retellCall, event);
    return res.status(204).send();
  } catch (error) {
    console.error("[Retell] Failed to process webhook:", error);
    return res.status(500).json({ error: "Failed to process Retell webhook" });
  }
});

router.get("/settings/:clinicId", authenticateToken, authorizeRole(["admin"]), async (req, res) => {
  try {
    const clinic = await User.findById(req.params.clinicId).select(
      "name role twilioPhoneNumber aiReceptionistSettings"
    );

    if (!clinic || clinic.role !== "customer") {
      return res.status(404).json({ error: "Clinic not found" });
    }

    const settings = getSettings(clinic);

    return res.json({
      clinicId: clinic._id,
      clinicName: clinic.name,
      twilioPhoneNumber: clinic.twilioPhoneNumber || null,
      aiReceptionistSettings: settings,
      integrationReady: getRetellReadiness(settings).ready,
    });
  } catch (error) {
    console.error("Error fetching AI receptionist settings:", error);
    return res.status(500).json({
      error: "Failed to fetch AI receptionist settings",
      details: error.message,
    });
  }
});

router.put("/settings/:clinicId", authenticateToken, authorizeRole(["admin"]), async (req, res) => {
  try {
    const clinic = await User.findById(req.params.clinicId).select(
      "name role twilioPhoneNumber aiReceptionistSettings"
    );

    if (!clinic || clinic.role !== "customer") {
      return res.status(404).json({ error: "Clinic not found" });
    }

    const aiReceptionistSettings = sanitizeAiReceptionistSettings(req.body?.aiReceptionistSettings);
    clinic.aiReceptionistSettings = aiReceptionistSettings;
    await clinic.save();

    return res.json({
      message: "AI receptionist settings updated successfully",
      clinicId: clinic._id,
      clinicName: clinic.name,
      twilioPhoneNumber: clinic.twilioPhoneNumber || null,
      aiReceptionistSettings,
      routingSummary: {
        enabled: aiReceptionistSettings.enabled,
        routingMode: aiReceptionistSettings.routingMode,
        destination: summarizeDestination(aiReceptionistSettings),
      },
    });
  } catch (error) {
    console.error("Error updating AI receptionist settings:", error);
    return res.status(500).json({
      error: "Failed to update AI receptionist settings",
      details: error.message,
    });
  }
});

router.get(
  "/configuration",
  authenticateToken,
  authorizeRole(["customer", "receptionist"]),
  resolveEffectiveCustomerId,
  async (req, res) => {
    try {
      const clinic = await User.findById(req.effectiveCustomerId).select(
        "name twilioPhoneNumber aiReceptionistSettings"
      );

      if (!clinic) {
        return res.status(404).json({ error: "Clinic not found" });
      }

      const settings = getSettings(clinic);

      return res.json({
        clinicName: clinic.name,
        twilioPhoneNumber: clinic.twilioPhoneNumber || null,
        aiReceptionistSettings: settings,
        routingSummary: {
          enabled: settings.enabled,
          routingMode: settings.routingMode,
          destination: summarizeDestination(settings),
        },
      });
    } catch (error) {
      console.error("Error fetching customer AI receptionist configuration:", error);
      return res.status(500).json({
        error: "Failed to fetch AI receptionist configuration",
        details: error.message,
      });
    }
  }
);

router.get(
  "/calls",
  authenticateToken,
  authorizeRole(["admin", "customer", "receptionist"]),
  async (req, res) => {
    try {
      let customerId = null;
      if (req.user.role === "admin") {
        customerId = req.query.clinicId || null;
      } else {
        customerId = req.user.parentCustomerId || req.user._id || req.user.id;
      }

      const page = Math.max(parseInt(req.query.page || "1", 10), 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
      const skip = (page - 1) * limit;
      const query = customerId ? { customerId } : {};

      const [calls, total] = await Promise.all([
        RetellCall.find(query)
          .sort({ startTimestamp: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        RetellCall.countDocuments(query),
      ]);

      return res.json({
        calls,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(Math.ceil(total / limit), 1),
        },
      });
    } catch (error) {
      console.error("Error fetching Retell calls:", error);
      return res.status(500).json({ error: "Failed to fetch Retell calls" });
    }
  }
);

router.get(
  "/calls/:callId",
  authenticateToken,
  authorizeRole(["admin", "customer", "receptionist"]),
  async (req, res) => {
    try {
      const call = await RetellCall.findOne({ retellCallId: req.params.callId }).lean();
      if (!call) {
        return res.status(404).json({ error: "Retell call not found" });
      }

      if (req.user.role !== "admin") {
        const effectiveCustomerId = String(req.user.parentCustomerId || req.user._id || req.user.id);
        if (!call.customerId || String(call.customerId) !== effectiveCustomerId) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }

      return res.json(call);
    } catch (error) {
      console.error("Error fetching Retell call detail:", error);
      return res.status(500).json({ error: "Failed to fetch Retell call detail" });
    }
  }
);

module.exports = router;
