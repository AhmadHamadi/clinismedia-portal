/**
 * Meta Leads — full setup health check.
 *
 * One command to verify EVERYTHING after connecting all clinics to Make:
 *   1. Configuration (IMAP off, webhook base URL, customer/token counts)
 *   2. Per-clinic delivery status (who is receiving Make webhook leads)
 *   3. Data integrity (missing lead ids, empty leads, duplicates)
 *   4. Recent activity (last 24h / 7d, newest deliveries)
 *   5. A plain-English verdict + what to do next
 *
 * Run from the backend/ folder with the same env that points at the live DB:
 *   node scripts/checkWebhookStatus.js
 *
 * Read-only: it never creates, edits, or deletes any lead or customer.
 */
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('../config/db');
const User = require('../models/User');
const MetaLead = require('../models/MetaLead');

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}
function fmtDate(d) {
  return d ? new Date(d).toISOString().slice(0, 16).replace('T', ' ') : '—';
}
function pad(s, n) {
  return String(s).padEnd(n);
}

async function run() {
  await connectDB();

  const since1 = daysAgo(1);
  const since7 = daysAgo(7);
  const since30 = daysAgo(30);

  // ---------------------------------------------------------------------------
  // 1) CONFIGURATION
  // ---------------------------------------------------------------------------
  const imapEnabled = String(process.env.META_LEADS_IMAP_ENABLED || '').trim().toLowerCase() === 'true';
  const webhookBase = (process.env.BACKEND_PUBLIC_URL || process.env.API_BASE_URL || '(derived from request host)');

  const customers = await User.find({ role: 'customer' })
    .select('+webhookToken name email')
    .sort({ name: 1 })
    .lean();

  const withToken = customers.filter((c) => !!c.webhookToken);
  const noToken = customers.filter((c) => !c.webhookToken);

  console.log('\n==================================================================');
  console.log(' META LEADS — FULL SETUP HEALTH CHECK');
  console.log('==================================================================');
  console.log('\n[1] CONFIGURATION');
  console.log(`   Legacy IMAP scraper : ${imapEnabled ? '⚠️  ENABLED (META_LEADS_IMAP_ENABLED=true)' : '✅ disabled (webhook-only)'}`);
  console.log(`   Webhook base URL    : ${webhookBase}`);
  console.log(`   Customers (clinics) : ${customers.length}`);
  console.log(`   With webhook token  : ${withToken.length}`);
  console.log(`   Missing token       : ${noToken.length ? `❗ ${noToken.length}` : '✅ 0'}`);

  // ---------------------------------------------------------------------------
  // 2) PER-CLINIC DELIVERY STATUS
  // ---------------------------------------------------------------------------
  const agg = await MetaLead.aggregate([
    {
      $group: {
        _id: '$customerId',
        total: { $sum: 1 },
        webhookTotal: { $sum: { $cond: [{ $eq: ['$source', 'make-webhook'] }, 1, 0] } },
        imapTotal: { $sum: { $cond: [{ $eq: ['$source', 'imap-poller'] }, 1, 0] } },
        webhook1d: { $sum: { $cond: [{ $and: [{ $eq: ['$source', 'make-webhook'] }, { $gte: ['$createdAt', since1] }] }, 1, 0] } },
        webhook7d: { $sum: { $cond: [{ $and: [{ $eq: ['$source', 'make-webhook'] }, { $gte: ['$createdAt', since7] }] }, 1, 0] } },
        latestAt: { $max: '$emailDate' },
      },
    },
  ]);
  const byId = new Map(agg.map((r) => [String(r._id), r]));

  const connected = [];
  const pending = [];
  for (const c of customers) {
    const s = byId.get(String(c._id)) || {};
    const row = {
      name: c.name || '(no name)',
      email: c.email || '',
      hasToken: !!c.webhookToken,
      total: s.total || 0,
      webhookTotal: s.webhookTotal || 0,
      webhook1d: s.webhook1d || 0,
      webhook7d: s.webhook7d || 0,
      imapTotal: s.imapTotal || 0,
      latestAt: s.latestAt || null,
    };
    (row.webhookTotal > 0 ? connected : pending).push(row);
  }

  console.log(`\n[2] PER-CLINIC DELIVERY STATUS`);
  console.log(`   ✅ RECEIVING WEBHOOK LEADS (${connected.length})`);
  for (const r of connected.sort((a, b) => b.webhook7d - a.webhook7d)) {
    console.log(`      ${pad(r.name, 28)} webhook ${String(r.webhookTotal).padStart(4)} total | ${String(r.webhook7d).padStart(3)} (7d) | ${String(r.webhook1d).padStart(3)} (24h) | latest ${fmtDate(r.latestAt)}`);
  }
  console.log(`\n   ⚠️  NO WEBHOOK LEADS YET (${pending.length}) — a clinic stays here until its first NEW lead arrives after connecting`);
  for (const r of pending.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(`      ${pad(r.name, 28)} existing ${String(r.total).padStart(4)} (imap ${r.imapTotal}) | latest ${fmtDate(r.latestAt)}${r.hasToken ? '' : '  ❗NO TOKEN'}`);
  }

  // ---------------------------------------------------------------------------
  // 3) DATA INTEGRITY
  // ---------------------------------------------------------------------------
  const webhookMissingId = await MetaLead.countDocuments({ source: 'make-webhook', $or: [{ metaLeadId: null }, { metaLeadId: { $exists: false } }] });
  const emptyLeads = await MetaLead.countDocuments({
    'leadInfo.name': { $in: [null, ''] },
    'leadInfo.email': { $in: [null, ''] },
    'leadInfo.phone': { $in: [null, ''] },
  });
  const dupAgg = await MetaLead.aggregate([
    { $match: { metaLeadId: { $type: 'string' } } },
    { $group: { _id: { c: '$customerId', m: '$metaLeadId' }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $count: 'dups' },
  ]);
  const duplicateKeys = dupAgg[0]?.dups || 0;

  console.log(`\n[3] DATA INTEGRITY`);
  console.log(`   Webhook leads missing Lead ID : ${webhookMissingId === 0 ? '✅ 0' : `⚠️  ${webhookMissingId} (check the metaLeadId mapping in those Make scenarios)`}`);
  console.log(`   Leads with no name/email/phone: ${emptyLeads === 0 ? '✅ 0' : `⚠️  ${emptyLeads}`}`);
  console.log(`   Duplicate (clinic + Lead ID)  : ${duplicateKeys === 0 ? '✅ 0 (dedupe working)' : `❗ ${duplicateKeys}`}`);

  // ---------------------------------------------------------------------------
  // 4) RECENT ACTIVITY
  // ---------------------------------------------------------------------------
  const created1d = await MetaLead.countDocuments({ createdAt: { $gte: since1 } });
  const created7d = await MetaLead.countDocuments({ createdAt: { $gte: since7 } });
  const created30d = await MetaLead.countDocuments({ createdAt: { $gte: since30 } });
  const webhook7dTotal = connected.reduce((sum, r) => sum + r.webhook7d, 0);

  const recent = await MetaLead.find({ source: 'make-webhook' })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('customerId createdAt leadInfo.name leadInfo.email metaLeadId')
    .populate('customerId', 'name')
    .lean();

  console.log(`\n[4] RECENT ACTIVITY`);
  console.log(`   New leads: ${created1d} (24h) | ${created7d} (7d) | ${created30d} (30d)`);
  console.log(`   Webhook leads in last 7d: ${webhook7dTotal}`);
  console.log(`   Newest webhook deliveries (eyeball that each name matches its clinic):`);
  if (recent.length === 0) {
    console.log('      (none yet — run a scenario in Make, or wait for a real lead)');
  } else {
    for (const r of recent) {
      const clinic = r.customerId?.name || '(unknown clinic)';
      const who = r.leadInfo?.name || r.leadInfo?.email || '(no contact info)';
      console.log(`      ${fmtDate(r.createdAt)}  ${pad(clinic, 24)} → ${who}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 5) VERDICT
  // ---------------------------------------------------------------------------
  console.log(`\n[5] VERDICT`);
  const problems = [];
  if (noToken.length) problems.push(`${noToken.length} clinic(s) missing a webhook token`);
  if (webhookMissingId) problems.push(`${webhookMissingId} webhook lead(s) missing Lead ID`);
  if (duplicateKeys) problems.push(`${duplicateKeys} duplicate clinic+LeadId group(s)`);
  if (imapEnabled) problems.push('legacy IMAP scraper is still ENABLED');

  if (problems.length === 0) {
    console.log('   ✅ No structural problems found. Configuration and dedupe look healthy.');
  } else {
    console.log('   ⚠️  Things to look at:');
    for (const p of problems) console.log(`      - ${p}`);
  }
  if (pending.length) {
    console.log(`   ℹ️  ${pending.length} clinic(s) have not received a webhook lead yet. That is expected for any`);
    console.log('      clinic with no NEW Facebook lead since you connected it. Use Make → Run once to');
    console.log('      force one, then re-run this script — it should move into the ✅ list.');
  }
  console.log('   ℹ️  All pre-existing leads are untouched and still counted above.\n');

  await mongoose.disconnect();
}

run().catch(async (e) => {
  console.error('checkWebhookStatus failed:', e.message || e);
  try {
    await mongoose.disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
