const crypto = require("crypto");

const DEFAULT_BUSINESS_HOURS = {
  monday: { enabled: true, start: "09:00", end: "17:00" },
  tuesday: { enabled: true, start: "09:00", end: "17:00" },
  wednesday: { enabled: true, start: "09:00", end: "17:00" },
  thursday: { enabled: true, start: "09:00", end: "17:00" },
  friday: { enabled: false, start: "09:00", end: "17:00" },
  saturday: { enabled: false, start: "09:00", end: "17:00" },
  sunday: { enabled: false, start: "09:00", end: "17:00" },
};

const VALID_ROUTING_MODES = new Set(["off", "after_hours", "always_ai"]);
const VALID_TELEPHONY_MODES = new Set(["sip_uri", "phone_number", "custom"]);

function normalizeTime(value, fallback) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : fallback;
}

function normalizeBusinessHours(input = {}) {
  const output = {};
  for (const [day, defaults] of Object.entries(DEFAULT_BUSINESS_HOURS)) {
    const dayInput = input && typeof input === "object" ? input[day] || {} : {};
    output[day] = {
      enabled: typeof dayInput.enabled === "boolean" ? dayInput.enabled : defaults.enabled,
      start: normalizeTime(dayInput.start, defaults.start),
      end: normalizeTime(dayInput.end, defaults.end),
    };
  }
  return output;
}

function sanitizeAiReceptionistSettings(input = {}) {
  const settings = input && typeof input === "object" ? input : {};
  const telephonyMode = VALID_TELEPHONY_MODES.has(settings.telephonyMode)
    ? settings.telephonyMode
    : "sip_uri";

  return {
    enabled: settings.enabled === true,
    provider: "retell",
    routingMode: VALID_ROUTING_MODES.has(settings.routingMode) ? settings.routingMode : "off",
    telephonyMode,
    retellAgentId:
      typeof settings.retellAgentId === "string" && settings.retellAgentId.trim()
        ? settings.retellAgentId.trim()
        : null,
    retellSipUri:
      typeof settings.retellSipUri === "string" && settings.retellSipUri.trim()
        ? settings.retellSipUri.trim()
        : null,
    retellPhoneNumber:
      typeof settings.retellPhoneNumber === "string" && settings.retellPhoneNumber.trim()
        ? settings.retellPhoneNumber.trim()
        : null,
    timezone:
      typeof settings.timezone === "string" && settings.timezone.trim()
        ? settings.timezone.trim()
        : "America/Toronto",
    sendMissedCallsToAi: settings.sendMissedCallsToAi === true,
    afterHoursMessage:
      typeof settings.afterHoursMessage === "string" && settings.afterHoursMessage.trim()
        ? settings.afterHoursMessage.trim()
        : null,
    businessHours: normalizeBusinessHours(settings.businessHours),
  };
}

function getCurrentClinicTime(timezone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "America/Toronto",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const weekday = parts.find((part) => part.type === "weekday")?.value?.toLowerCase();
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);

  return {
    weekday,
    minutes: hour * 60 + minute,
  };
}

function parseMinutes(timeText, fallback = 0) {
  if (typeof timeText !== "string" || !/^\d{2}:\d{2}$/.test(timeText)) {
    return fallback;
  }

  const [hour, minute] = timeText.split(":").map(Number);
  return hour * 60 + minute;
}

function isWithinBusinessHours(settings) {
  const normalized = sanitizeAiReceptionistSettings(settings);
  const { weekday, minutes } = getCurrentClinicTime(normalized.timezone);
  const today = normalized.businessHours[weekday];

  if (!today || today.enabled !== true) {
    return false;
  }

  const start = parseMinutes(today.start);
  const end = parseMinutes(today.end, 24 * 60);

  if (start === end) {
    return true;
  }

  if (end > start) {
    return minutes >= start && minutes < end;
  }

  return minutes >= start || minutes < end;
}

function summarizeDestination(settings) {
  const normalized = sanitizeAiReceptionistSettings(settings);
  if (normalized.telephonyMode === "phone_number") {
    return normalized.retellPhoneNumber || "Not configured";
  }

  if (normalized.telephonyMode === "custom") {
    return "Custom telephony";
  }

  return normalized.retellSipUri || "Not configured";
}

function getRetellReadiness(settings) {
  const normalized = sanitizeAiReceptionistSettings(settings);

  if (!normalized.enabled) {
    return { ready: false, reason: "AI reception is disabled", settings: normalized };
  }
  if (!normalized.retellAgentId) {
    return { ready: false, reason: "Missing Retell agent ID", settings: normalized };
  }
  if (normalized.telephonyMode === "sip_uri" && !normalized.retellSipUri) {
    return { ready: false, reason: "Missing Retell SIP URI", settings: normalized };
  }
  if (normalized.telephonyMode === "phone_number" && !normalized.retellPhoneNumber) {
    return { ready: false, reason: "Missing Retell phone number", settings: normalized };
  }
  if (normalized.telephonyMode === "custom") {
    return { ready: false, reason: "Custom telephony routing is not implemented yet", settings: normalized };
  }

  return { ready: true, reason: null, settings: normalized };
}

function verifyRetellSignature(rawBody, signature) {
  const webhookKey = process.env.RETELL_WEBHOOK_KEY || process.env.RETELL_API_KEY;
  if (!webhookKey || !signature || typeof rawBody !== "string") {
    return false;
  }

  const signatureText = String(signature);
  const match = signatureText.match(/^v=(\d+),d=([a-f0-9]+)$/i);
  if (!match) {
    return false;
  }

  const [, timestamp, providedDigest] = match;
  const now = Date.now();
  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > 5 * 60 * 1000) {
    return false;
  }

  const expectedDigest = crypto
    .createHmac("sha256", webhookKey)
    .update(`${rawBody}${timestamp}`, "utf8")
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedDigest, "utf8");
  const providedBuffer = Buffer.from(providedDigest, "utf8");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

async function registerRetellPhoneCall({
  settings,
  fromNumber,
  toNumber,
  twilioCallSid,
  customerId,
  customerName,
}) {
  const readiness = getRetellReadiness(settings);
  if (!readiness.ready) {
    throw new Error(readiness.reason || "Retell is not configured");
  }
  if (!process.env.RETELL_API_KEY) {
    throw new Error("RETELL_API_KEY is missing");
  }

  const response = await fetch("https://api.retellai.com/v2/register-phone-call", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
    },
    body: JSON.stringify({
      agent_id: readiness.settings.retellAgentId,
      from_number: fromNumber || undefined,
      to_number: toNumber || undefined,
      direction: "inbound",
      metadata: {
        customerId: customerId ? String(customerId) : null,
        customerName: customerName || null,
        twilioCallSid: twilioCallSid || null,
      },
      retell_llm_dynamic_variables: {
        clinic_name: customerName || "",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Retell register-phone-call failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  return {
    ...payload,
    sipUri: `sip:${payload.call_id}@sip.retellai.com`,
  };
}

module.exports = {
  DEFAULT_BUSINESS_HOURS,
  sanitizeAiReceptionistSettings,
  normalizeBusinessHours,
  summarizeDestination,
  getRetellReadiness,
  isWithinBusinessHours,
  verifyRetellSignature,
  registerRetellPhoneCall,
};
