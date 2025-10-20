// utils/adsPreflight.js

function mask(val) {
  if (!val) return "(undefined)";
  if (val.length <= 8) return `(${val.length}) ****`;
  return `(${val.length}) ${val.slice(0, 4)}...${val.slice(-4)}`;
}

function normalizeId(id) {
  if (!id) return null;
  const clean = String(id).replace(/-/g, "");
  return /^\d{10}$/.test(clean) ? clean : null; // Google Ads IDs are 10 digits
}

function preflightEnv() {
  const missing = ["GOOGLE_ADS_CLIENT_ID","GOOGLE_ADS_CLIENT_SECRET","GOOGLE_ADS_DEVELOPER_TOKEN"]
    .filter(k => !process.env[k] || process.env[k] === "");
  if (missing.length) return { ok: false, reason: `Missing env(s): ${missing.join(", ")}` };
  return { ok: true };
}

function logPreflightContext(ctx) {
  console.log(`[ADS PREFLIGHT] ${ctx.route}`, {
    mccId_raw: ctx.mccId,
    mccId_norm: normalizeId(ctx.mccId) ?? "(invalid)",
    clientId_raw: ctx.clientId,
    clientId_norm: normalizeId(ctx.clientId) ?? "(invalid)",
    refreshToken: mask(ctx.refreshToken),
    clientId_has_hyphen: /-/.test(String(ctx.clientId||"")),
  });
}

module.exports = {
  mask,
  normalizeId,
  preflightEnv,
  logPreflightContext
};
