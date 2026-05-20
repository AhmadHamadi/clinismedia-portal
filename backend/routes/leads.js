const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');

const MetaLead = require('../models/MetaLead');
const User = require('../models/User');

const router = express.Router();

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

function safeTokenMatches(expectedToken, incomingToken) {
  const expected = Buffer.from(String(expectedToken || ''));
  const incoming = Buffer.from(String(incomingToken || ''));

  if (expected.length !== incoming.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, incoming);
}

function firstValue(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

function normalizeFields(fields) {
  if (Array.isArray(fields)) {
    return fields.reduce((acc, field) => {
      const key = firstValue(field?.name, field?.key, field?.label);
      if (!key) return acc;

      const values = Array.isArray(field?.values) ? field.values : null;
      acc[key] = firstValue(field?.value, values?.[0]);
      return acc;
    }, {});
  }

  if (!fields || typeof fields !== 'object') {
    return {};
  }
  return fields;
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  return digits.length === 10 ? `1${digits}` : digits;
}

function getDayBounds(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function mergeLeadFields(existingFields, incomingFields) {
  return {
    ...(existingFields || {}),
    ...(incomingFields || {}),
  };
}

async function findSameDayLead(customerId, normalized) {
  const emailNorm = normalized.email ? normalized.email.trim().toLowerCase() : null;
  const phoneNorm = normalized.phone ? normalizePhone(normalized.phone) : null;
  if (!emailNorm && !phoneNorm) return null;

  const { start, end } = getDayBounds(normalized.submittedAt);
  const candidates = await MetaLead.find({
    customerId,
    emailDate: { $gte: start, $lte: end },
  });

  return candidates.find((lead) => {
    const leadEmail = lead?.leadInfo?.email ? String(lead.leadInfo.email).trim().toLowerCase() : null;
    const leadPhone = lead?.leadInfo?.phone ? normalizePhone(lead.leadInfo.phone) : null;
    return (emailNorm && leadEmail === emailNorm) || (phoneNorm && leadPhone === phoneNorm);
  }) || null;
}

async function mergeWebhookIntoExistingLead(existingLead, normalized, rawPayload) {
  let changed = false;

  const assignIfEmpty = (field, value) => {
    if (value && !existingLead[field]) {
      existingLead[field] = value;
      changed = true;
    }
  };

  assignIfEmpty('metaLeadId', normalized.metaLeadId);
  assignIfEmpty('campaignName', normalized.campaignName);
  assignIfEmpty('formName', normalized.formName);
  assignIfEmpty('pageName', normalized.pageName);

  const leadInfo = existingLead.leadInfo || {};
  for (const [key, value] of Object.entries({
    name: normalized.name,
    email: normalized.email,
    phone: normalized.phone,
  })) {
    if (value && !leadInfo[key]) {
      leadInfo[key] = value;
      changed = true;
    }
  }

  const mergedFields = mergeLeadFields(leadInfo.fields, normalized.fields);
  if (JSON.stringify(leadInfo.fields || {}) !== JSON.stringify(mergedFields)) {
    leadInfo.fields = mergedFields;
    changed = true;
  }

  existingLead.leadInfo = leadInfo;
  existingLead.rawPayload = rawPayload;
  existingLead.source = 'make-webhook';
  changed = true;

  if (changed) {
    await existingLead.save();
  }

  return existingLead;
}

function normalizeLeadPayload(body) {
  const fields = normalizeFields(body?.fields || body?.field_data || body?.fieldData);
  const metaLeadId = firstValue(
    body?.metaLeadId,
    body?.meta_lead_id,
    body?.leadId,
    body?.lead_id,
    body?.leadgen_id,
    body?.id,
    fields.metaLeadId,
    fields.meta_lead_id,
    fields.leadId,
    fields.lead_id,
    fields.leadgen_id
  );

  const submittedAtRaw = firstValue(body?.submittedAt, body?.submitted_at, body?.created_time, body?.createdTime);
  const submittedAt = submittedAtRaw ? new Date(submittedAtRaw) : new Date();

  return {
    metaLeadId,
    name: firstValue(body?.name, body?.fullName, body?.full_name, fields.name, fields.fullName, fields.full_name, fields['Full Name']),
    email: firstValue(body?.email, fields.email, fields.Email),
    phone: normalizePhone(firstValue(body?.phone, body?.phoneNumber, body?.phone_number, fields.phone, fields.phoneNumber, fields.phone_number, fields['Phone Number'])),
    formName: firstValue(body?.formName, body?.form_name),
    pageName: firstValue(body?.pageName, body?.page_name),
    campaignName: firstValue(body?.campaignName, body?.campaign_name, fields.campaignName, fields.campaign_name, fields['Campaign Name']),
    fields,
    submittedAt: Number.isNaN(submittedAt.getTime()) ? new Date() : submittedAt,
  };
}

router.post('/webhook/:customerId', webhookLimiter, async (req, res) => {
  try {
    const { customerId } = req.params;
    if (!mongoose.isValidObjectId(customerId)) {
      return res.status(400).json({ error: 'Invalid customerId' });
    }

    const token = firstValue(req.query.token, req.headers['x-webhook-token']);
    const customer = await User.findById(customerId).select('+webhookToken name email role');
    if (!customer || customer.role !== 'customer' || !customer.webhookToken) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    if (!safeTokenMatches(customer.webhookToken, token)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const normalized = normalizeLeadPayload(req.body || {});
    if (!normalized.metaLeadId) {
      return res.status(400).json({ error: 'metaLeadId required' });
    }

    const existingLead = await MetaLead.findOne({ customerId, metaLeadId: normalized.metaLeadId });
    if (existingLead) {
      return res.status(200).json({ ok: true, leadId: existingLead._id, duplicate: true });
    }

    const sameDayLead = await findSameDayLead(customerId, normalized);
    if (sameDayLead) {
      const mergedLead = await mergeWebhookIntoExistingLead(sameDayLead, normalized, req.body);
      return res.status(200).json({ ok: true, leadId: mergedLead._id, duplicate: true, merged: true });
    }

    const lead = await MetaLead.create({
      customerId,
      emailSubject: normalized.campaignName || normalized.formName || 'Meta Lead Webhook',
      campaignName: normalized.campaignName,
      metaLeadId: normalized.metaLeadId,
      formName: normalized.formName,
      pageName: normalized.pageName,
      leadInfo: {
        name: normalized.name,
        email: normalized.email,
        phone: normalized.phone,
        message: null,
        rawContent: null,
        fields: normalized.fields,
      },
      emailFrom: 'make-webhook',
      emailDate: normalized.submittedAt,
      status: 'new',
      source: 'make-webhook',
      rawPayload: req.body,
    });

    res.status(200).json({ ok: true, leadId: lead._id, duplicate: false });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(200).json({ ok: true, duplicate: true });
    }

    console.error('[Lead Webhook] Error:', error.message || error);
    res.status(500).json({ error: 'Webhook failed' });
  }
});

module.exports = router;
module.exports._private = {
  normalizeLeadPayload,
  safeTokenMatches,
};
