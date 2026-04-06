/**
 * Meta Leads Email Service - compatible with cPanel and webmail.
 * - Connects via IMAP (port 993, TLS) to leads@clinimedia.ca (same mailbox as webmail).
 * - Processes ANY email (read or unread) received in the inbox. For each email we look at the
 *   subject and match it against the subject mappings set in Admin → Manage Meta Leads for each clinic.
 *   When the subject matches a clinic's mapping, a lead is created and appears in that clinic's customer portal.
 * - Dedupe by Message-ID so no duplicate leads.
 */
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const MetaLead = require('../models/MetaLead');
const MetaLeadFolderMapping = require('../models/MetaLeadFolderMapping');
const MetaLeadSubjectMapping = require('../models/MetaLeadSubjectMapping');
require('dotenv').config();

class MetaLeadsEmailService {
  constructor() {
    this.imap = null;
    this.isChecking = false;
    this.checkInterval = null;
    this.monitoringEnabled = false;
    this.monitoringIntervalMinutes = null;
    this.lastMonitoringStartedAt = null;
    this.lastCheckStartedAt = null;
    this.lastCheckCompletedAt = null;
    this.lastSuccessfulCheckAt = null;
    this.lastResult = null;
    this.lastError = null;
  }

  /**
   * Build IMAP config from current process.env (so we always use latest env, not stale values from module load).
   * Leads go to leads@clinimedia.ca; we connect to that inbox. EMAIL_PASS can be used if it's the same password.
   */
  getImapConfig() {
    const leadsEmailUser = process.env.LEADS_EMAIL_USER || 'leads@clinimedia.ca';
    const leadsEmailPass = process.env.LEADS_EMAIL_PASS || process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;
    const leadsEmailHost = process.env.LEADS_EMAIL_HOST || process.env.EMAIL_HOST || 'mail.clinimedia.ca';
    const leadsEmailPort = parseInt(process.env.LEADS_EMAIL_IMAP_PORT, 10) || 993;
    return {
      user: leadsEmailUser,
      password: leadsEmailPass,
      host: leadsEmailHost,
      port: leadsEmailPort,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    };
  }

  /**
   * Connect to IMAP server
   */
  connect() {
    return new Promise((resolve, reject) => {
      // Always create a new connection to avoid stale connections
      // Old connections might be in a bad state after ECONNRESET
      if (this.imap) {
        try {
          if (this.imap.state !== 'disconnected') {
            this.imap.end();
          }
        } catch (e) {
          // Ignore errors when closing old connection
        }
        this.imap = null;
      }

      const config = this.getImapConfig();
      this.imap = new Imap(config);

      this.imap.once('ready', () => {
        console.log(`[Meta Leads] Connected to ${config.user} (IMAP). Checking for new lead emails...`);
        resolve(this.imap);
      });

      this.imap.once('error', (err) => {
        if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
          this.imap = null;
        } else {
          console.error('IMAP error:', err);
        }
        reject(err);
      });

      this.imap.once('end', () => {
        this.imap = null;
      });

      this.imap.connect();
    });
  }

  /**
   * Parse lead information from email content
   * Handles formats like:
   * - "New Lead Info:"
   * - "Full Name: Khawaja Ahsan"
   * - "Email: khawajahsan00@gmail.com"
   * - "Phone Number: +14372234998"
   * - "City: Stoney Creek"
   */
  parseLeadInfo(emailContent, emailSubject) {
    const normalizeValue = (v) => (typeof v === 'string' ? v.replace(/^["']|["']$/g, '').trim() : '');
    const isLikelyPersonName = (v) => {
      const value = normalizeValue(v);
      if (!value) return false;
      if (value.length < 2 || value.length > 80) return false;
      // Reject obvious non-person labels/campaign phrases.
      if (/(campaign|lead info|cdcp|month|march|feb|january|december)/i.test(value)) return false;
      // Reject values that look like phone/email.
      if (/@/.test(value) || /\d{5,}/.test(value)) return false;
      return true;
    };
    // Initialize with null values - will be set if found, otherwise remain null
    const leadInfo = {
      name: null,
      email: null,
      phone: null,
      message: null,
      rawContent: null,
      campaignName: null,
      fields: {}
    };

    // Safely get text and HTML content (handle undefined/null cases)
    const textContent = emailContent?.text || null;
    const htmlContent = emailContent?.html || null;
    
    // Store raw content for reference (prefer text, fallback to HTML)
    leadInfo.rawContent = textContent || htmlContent || null;
    leadInfo.message = textContent || htmlContent || null;

    // Get text content for parsing (prefer text over HTML, but try both)
    let text = textContent || '';
    
    // If we have HTML but no text, try to extract text from HTML
    if (!text && htmlContent) {
      try {
        text = htmlContent
                 // Preserve structure from common block/line-break tags first.
                 .replace(/<\s*br\s*\/?>/gi, '\n')
                 .replace(/<\s*\/p\s*>/gi, '\n')
                 .replace(/<\s*\/div\s*>/gi, '\n')
                 .replace(/<\s*\/li\s*>/gi, '\n')
                 .replace(/<[^>]*>/g, ' ') // Remove remaining HTML tags
                 .replace(/&nbsp;/g, ' ')   // Replace &nbsp;
                 .replace(/&amp;/g, '&')    // Replace &amp;
                 .replace(/&lt;/g, '<')     // Replace &lt;
                 .replace(/&gt;/g, '>')     // Replace &gt;
                 .replace(/&quot;/g, '"')   // Replace &quot;
                 .replace(/&#39;/g, "'")    // Replace &#39;
                 .replace(/\r\n|\r/g, '\n')
                 .replace(/[ \t]+/g, ' ')   // Normalize horizontal whitespace
                 .replace(/\n{3,}/g, '\n\n')
                 .trim();
        
        // If text is empty after processing, set to empty string
        if (!text) {
          text = '';
        }
      } catch (e) {
        text = '';
      }
    }
    
    // If no text content at all, return early with null values
    if (!text || text.trim().length === 0) {
      return leadInfo;
    }

    // Enhanced patterns for Facebook lead email format
    // Keep name patterns strict to avoid matching "Campaign Name".
    const namePatterns = [
      /(?:^|\n)\s*full\s+name\s*:\s*([^\n\r]+)(?:\n|$)/im,
      /(?:^|\n)\s*name\s*:\s*([^\n\r]+)(?:\n|$)/im,
      /(?:^|\n)\s*first\s+name\s*:\s*([^\n\r]+)(?:\n|$)/im,
    ];
    
    // Pattern 2: "Email: khawajahsan00@gmail.com"
    const emailPatterns = [
      /(?:email|e-mail|email\s+address)[\s:]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
      /^[^:\n]*email[^:\n]*:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/im,
    ];
    
    // Pattern 3: "Phone Number: +14372234998" or "Phone: +1-437-223-4998"
    const phonePatterns = [
      /(?:phone\s+number|phone|mobile|telephone|cell|phone\s+no)[\s:]*([+\d\s\-\(\)]{7,})/i,
      /^[^:\n]*phone[^:\n]*:\s*([+\d\s\-\(\)]{7,})/im,
    ];

    // Extract name
    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        leadInfo.name = match[1].trim();
        break;
      }
    }

    // Extract email
    for (const pattern of emailPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        leadInfo.email = match[1].trim();
        break;
      }
    }

    // Extract phone
    for (const pattern of phonePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        leadInfo.phone = match[1].trim().replace(/\s+/g, ' ');
        break;
      }
    }

    // Fallback: capture first email address anywhere in body if labeled extraction failed.
    if (!leadInfo.email) {
      const anyEmails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      const filtered = anyEmails
        .map((e) => e.trim())
        .filter((e) => !/noreply|no-reply/i.test(e));
      if (filtered.length > 0) {
        // Prefer non-clinimedia address if available.
        leadInfo.email = filtered.find((e) => !/@clinimedia\.ca$/i.test(e)) || filtered[0];
      }
    }

    // Fallback: capture likely phone number if labeled extraction failed.
    if (!leadInfo.phone) {
      const phoneMatch = text.match(/(?:\+\d[\d\s\-().]{7,}\d|\b\d{10,15}\b)/);
      if (phoneMatch && phoneMatch[0]) {
        leadInfo.phone = phoneMatch[0].trim().replace(/\s+/g, ' ');
      }
    }

    // Parse key-value pairs (more robust)
    // Split by newlines and look for "Key: Value" format
    try {
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        // Skip empty lines
        if (!line || !line.trim()) continue;
        
        // Look for "Key: Value" pattern
        const colonMatch = line.match(/^([^:]+):\s*(.+)$/);
        if (colonMatch && colonMatch[1] && colonMatch[2]) {
          const key = colonMatch[1].trim().toLowerCase();
          const value = colonMatch[2].trim();
          
          // Only store if value is not empty
          if (value) {
            // Store in fields object
            leadInfo.fields[key] = value;
            
            // Map to specific fields if not already set (exclude 'campaign name' from mapping to lead name)
            // Prefer explicit person-name labels first.
            if (key.includes('full name') || key === 'name') {
              if (!leadInfo.name) leadInfo.name = value;
            }
            if (key.includes('email')) {
              if (!leadInfo.email) leadInfo.email = value;
            }
            if (key.includes('phone')) {
              if (!leadInfo.phone) leadInfo.phone = value;
            }
            // Store other fields (city, address, etc.)
            if (key.includes('city')) {
              leadInfo.fields.city = value;
            }
            if (key.includes('address')) {
              leadInfo.fields.address = value;
            }
            if (key.includes('campaign')) {
              const trimmed = value.trim();
              leadInfo.campaignName = trimmed || null;
            }
            if (key.includes('message') || key.includes('comments') || key.includes('notes')) {
              if (!leadInfo.message || leadInfo.message.length < value.length) {
                leadInfo.message = value;
              }
            }
          }
        }
      }
    } catch (e) {
      // Continue even if key-value parsing fails
    }

    // Also check email headers as fallback (only if we didn't find info in body)
    try {
      if (emailContent?.from?.value && Array.isArray(emailContent.from.value) && emailContent.from.value.length > 0) {
        const fromInfo = emailContent.from.value[0];
        if (fromInfo) {
          // Only use from address if we didn't find email in body
          if (!leadInfo.email && fromInfo.address) {
            // Validate email format before using
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (emailRegex.test(fromInfo.address)) {
              leadInfo.email = fromInfo.address;
            }
          }
          // Only use from name if we didn't find name in body
          if (!leadInfo.name && fromInfo.name && isLikelyPersonName(fromInfo.name)) {
            leadInfo.name = fromInfo.name.trim();
          }
        }
      }
    } catch (e) {
      // Continue even if header extraction fails
    }

    // Try to parse JSON if present
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonData = JSON.parse(jsonMatch[0]);
        Object.assign(leadInfo.fields, jsonData);
        if (jsonData.name && !leadInfo.name) leadInfo.name = jsonData.name;
        if (jsonData.fullName && !leadInfo.name) leadInfo.name = jsonData.fullName;
        if (jsonData.email && !leadInfo.email) leadInfo.email = jsonData.email;
        if (jsonData.phone && !leadInfo.phone) leadInfo.phone = jsonData.phone;
        if (jsonData.phoneNumber && !leadInfo.phone) leadInfo.phone = jsonData.phoneNumber;
        if (jsonData.city) leadInfo.fields.city = jsonData.city;
        const jsonCampaign = jsonData.campaignName || jsonData.campaign_name || jsonData['campaign name'];
        if (jsonCampaign && typeof jsonCampaign === 'string') {
          const t = jsonCampaign.trim();
          if (t) leadInfo.campaignName = t;
        }
      }
    } catch (e) {
      // Not JSON, that's fine - we already parsed key-value pairs
    }

    // Clean up and validate extracted values (only if they exist)
    if (leadInfo.name) {
      leadInfo.name = normalizeValue(leadInfo.name);
      // If name is empty after cleaning, set to null
      if (!leadInfo.name || leadInfo.name.length === 0) {
        leadInfo.name = null;
      }
    } else {
      leadInfo.name = null; // Ensure it's explicitly null
    }

    // Guardrail: never treat campaign-like text as a person's name.
    if (leadInfo.name && leadInfo.campaignName) {
      const n = leadInfo.name.toLowerCase().replace(/\s+/g, ' ').trim();
      const c = leadInfo.campaignName.toLowerCase().replace(/\s+/g, ' ').trim();
      if (n === c || n.includes('campaign') || n.includes('cdcp')) {
        leadInfo.name = null;
      }
    }

    // Secondary guardrail: if extracted "name" is not plausible, drop it.
    if (leadInfo.name && !isLikelyPersonName(leadInfo.name)) {
      leadInfo.name = null;
    }
    
    if (leadInfo.email) {
      leadInfo.email = leadInfo.email.replace(/^["']|["']$/g, '').trim();
      // Validate email format, if invalid set to null
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!leadInfo.email || leadInfo.email.length === 0 || !emailRegex.test(leadInfo.email)) {
        leadInfo.email = null;
      }
    } else {
      leadInfo.email = null; // Ensure it's explicitly null
    }
    
    if (leadInfo.phone) {
      leadInfo.phone = leadInfo.phone.replace(/^["']|["']$/g, '').trim();
      // If phone is empty after cleaning or too short, set to null
      // Minimum 7 characters for a valid phone number (e.g., "+1234567")
      if (!leadInfo.phone || leadInfo.phone.length < 7) {
        leadInfo.phone = null;
      }
    } else {
      leadInfo.phone = null; // Ensure it's explicitly null
    }
    
    // Ensure message and rawContent are null if empty, not empty strings
    if (leadInfo.message && leadInfo.message.trim().length === 0) {
      leadInfo.message = null;
    }
    if (leadInfo.rawContent && leadInfo.rawContent.trim().length === 0) {
      leadInfo.rawContent = null;
    }

    return leadInfo;
  }

  /**
   * Normalize email subject for matching: strip leading bullets/prefixes, trim, collapse whitespace.
   * Email clients often show "• CliniMedia - Dental Lenses Leads" — we strip the bullet so it matches
   * admin mapping "CliniMedia - Dental Lenses Leads".
   */
  normalizeSubject(subject) {
    if (!subject || typeof subject !== 'string') return '';
    let s = subject
      .replace(/\r\n|\r|\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // Strip leading bullet (•), dash, or "Re:" / "Fwd:" so "• CliniMedia - Dental Lenses Leads" matches "CliniMedia - Dental Lenses Leads"
    s = s.replace(/^[\s\u2022\u00B7\u2023\u2043\u2219\-\*]+\s*/i, '').trim(); // bullet variants: • · ‣ ⁃ ∙
    s = s.replace(/^(re|fwd|fw):\s*/gi, '').trim();
    return s;
  }

  /**
   * Normalize folder names for matching against cPanel/IMAP paths.
   * Examples:
   * - "INBOX.Fletcher Dental Centre" -> "fletcher dental centre"
   * - "Fletcher Dental Centre" -> "fletcher dental centre"
   */
  normalizeFolderName(folderName) {
    if (!folderName || typeof folderName !== 'string') return '';
    const normalized = folderName
      .replace(/\\/g, '.')
      .split('.')
      .map((segment) => segment.trim())
      .filter(Boolean)
      .pop() || folderName;

    return normalized.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  extractFolderNames(boxTree, prefix = '') {
    const folderNames = [];

    for (const name in boxTree || {}) {
      const box = boxTree[name];
      const fullName = prefix ? `${prefix}${box?.delimiter || '.'}${name}` : name;
      if (fullName && String(fullName).trim()) {
        folderNames.push(fullName);
      }
      if (box?.children && typeof box.children === 'object') {
        folderNames.push(...this.extractFolderNames(box.children, fullName || name));
      }
    }

    return folderNames;
  }

  resolveRequestedFolders(requestedFolders = [], availableFolders = []) {
    const availableByNormalizedName = new Map();

    for (const availableFolder of availableFolders) {
      const normalized = this.normalizeFolderName(availableFolder);
      if (normalized && !availableByNormalizedName.has(normalized)) {
        availableByNormalizedName.set(normalized, availableFolder);
      }
    }

    return requestedFolders.map((requestedFolder) => {
      const exactMatch = availableFolders.find((folder) => folder === requestedFolder);
      if (exactMatch) {
        return { requestedFolder, resolvedFolder: exactMatch, matchedBy: 'exact' };
      }

      const normalizedRequested = this.normalizeFolderName(requestedFolder);
      const normalizedMatch = normalizedRequested ? availableByNormalizedName.get(normalizedRequested) : null;
      return {
        requestedFolder,
        resolvedFolder: normalizedMatch || requestedFolder,
        matchedBy: normalizedMatch ? 'normalized' : 'fallback'
      };
    });
  }

  buildFolderOpenCandidates(folderName) {
    const rawFolder = String(folderName || '').trim();
    if (!rawFolder) return [];

    const candidates = [];
    const pushCandidate = (candidate) => {
      const value = String(candidate || '').trim();
      if (value && !candidates.includes(value)) {
        candidates.push(value);
      }
    };

    pushCandidate(rawFolder);
    pushCandidate(rawFolder.replace(/\//g, '.'));
    pushCandidate(rawFolder.replace(/\./g, '/'));

    if (!/^INBOX([./]|$)/i.test(rawFolder)) {
      pushCandidate(`INBOX.${rawFolder}`);
      pushCandidate(`INBOX/${rawFolder}`);
      pushCandidate(`INBOX.${rawFolder.replace(/\//g, '.')}`);
      pushCandidate(`INBOX/${rawFolder.replace(/\./g, '/')}`);
    }

    return candidates;
  }

  async openBoxWithFallback(folderName) {
    const candidates = this.buildFolderOpenCandidates(folderName);
    const errors = [];

    for (const candidate of candidates) {
      try {
        const box = await new Promise((resolve, reject) => {
          this.imap.openBox(candidate, false, (err, openedBox) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(openedBox);
          });
        });

        return { box, openedFolderName: candidate, attemptedFolders: candidates, errors };
      } catch (error) {
        errors.push(`${candidate}: ${error.message}`);
      }
    }

    throw new Error(errors.join(' | '));
  }

  getStaleCheckThresholdMs() {
    return 10 * 60 * 1000;
  }

  async recoverIfCheckIsStale() {
    if (!this.isChecking || !this.lastCheckStartedAt) {
      return false;
    }

    const startedAtMs = new Date(this.lastCheckStartedAt).getTime();
    if (!Number.isFinite(startedAtMs)) {
      return false;
    }

    if ((Date.now() - startedAtMs) < this.getStaleCheckThresholdMs()) {
      return false;
    }

    console.warn('[Meta Leads] Detected stale email check lock. Resetting IMAP connection so polling can recover automatically.');
    try {
      await this.disconnect();
    } catch (_) {
      // Best-effort recovery only.
    }
    this.isChecking = false;
    this.lastError = 'Recovered from stale Meta Leads check lock';
    return true;
  }

  /**
   * Find customer by IMAP folder name.
   */
  async findCustomerByFolder(folderName) {
    try {
      const normalizedFolder = this.normalizeFolderName(folderName);
      if (!normalizedFolder) return null;

      const mapping = await MetaLeadFolderMapping.findOne({
        folderNameLower: normalizedFolder,
        isActive: true
      }).populate('customerId');

      if (mapping && mapping.customerId) {
        return mapping.customerId;
      }

      return null;
    } catch (error) {
      console.error('Error finding customer by folder:', error);
      return null;
    }
  }

  /**
   * Find customer by email subject (matches Admin → Manage Meta Leads subject mappings)
   */
  async findCustomerBySubject(subject) {
    try {
      const normalized = this.normalizeSubject(subject);
      const normalizedLower = normalized.toLowerCase();

      // Try exact match first (normalized)
      let mapping = await MetaLeadSubjectMapping.findOne({
        emailSubject: normalized,
        isActive: true
      }).populate('customerId');

      if (mapping && mapping.customerId) {
        return mapping.customerId;
      }

      // Try case-insensitive match (normalized)
      mapping = await MetaLeadSubjectMapping.findOne({
        emailSubjectLower: normalizedLower,
        isActive: true
      }).populate('customerId');

      if (mapping && mapping.customerId) {
        return mapping.customerId;
      }

      // Try partial match (subject contains mapping or vice versa); normalize stored subject for whitespace
      const mappings = await MetaLeadSubjectMapping.find({ isActive: true })
        .populate('customerId');

      for (const map of mappings) {
        const mapNorm = (map.emailSubjectLower || '').replace(/\s+/g, ' ').trim();
        if (!mapNorm) continue;
        if (normalizedLower.includes(mapNorm) || mapNorm.includes(normalizedLower)) {
          return map.customerId;
        }
      }

      // No mapping found - log so admin can add one or fix subject
      if (normalized && normalized !== 'No Subject') {
        console.warn(`[Meta Leads] No subject mapping for email subject: "${normalized.substring(0, 80)}${normalized.length > 80 ? '...' : ''}"`);
      }
      return null;
    } catch (error) {
      console.error('Error finding customer by subject:', error);
      return null;
    }
  }

  /**
   * Test which customer would get a lead for a given subject (for admin debugging).
   * Returns { customer, normalizedSubject } or { normalizedSubject, match: false }.
   */
  async testSubjectMatch(subject) {
    const normalized = this.normalizeSubject(subject || '');
    const customer = await this.findCustomerBySubject(subject || '');
    if (customer) {
      return { match: true, normalizedSubject: normalized, customerId: customer._id, customerName: customer.name, customerEmail: customer.email };
    }
    return { match: false, normalizedSubject: normalized };
  }

  /**
   * Test which customer would get a lead for a given folder.
   */
  async testFolderMatch(folderName) {
    const normalizedFolder = this.normalizeFolderName(folderName || '');
    const customer = await this.findCustomerByFolder(folderName || '');
    if (customer) {
      return {
        match: true,
        normalizedFolder,
        customerId: customer._id,
        customerName: customer.name,
        customerEmail: customer.email
      };
    }
    return { match: false, normalizedFolder };
  }

  buildLeadPayload(customer, subject, leadInfo, from, date, messageId, folderName) {
    return {
      customerId: customer._id,
      emailSubject: subject,
      campaignName: (leadInfo.campaignName && leadInfo.campaignName.trim()) ? leadInfo.campaignName.trim() : null,
      leadInfo: {
        name: leadInfo.name || null,
        email: leadInfo.email || null,
        phone: leadInfo.phone || null,
        message: leadInfo.message || null,
        rawContent: leadInfo.rawContent || null,
        fields: {
          ...(leadInfo.fields || {}),
          sourceFolder: folderName || null
        }
      },
      emailFrom: from || null,
      emailDate: date,
      emailMessageId: messageId || null,
      status: 'new'
    };
  }

  async upsertExistingLead(existingLead, payload) {
    let changed = false;

    if (payload.emailSubject && existingLead.emailSubject !== payload.emailSubject) {
      existingLead.emailSubject = payload.emailSubject;
      changed = true;
    }

    if (payload.campaignName && existingLead.campaignName !== payload.campaignName) {
      existingLead.campaignName = payload.campaignName;
      changed = true;
    }

    if (payload.emailFrom && existingLead.emailFrom !== payload.emailFrom) {
      existingLead.emailFrom = payload.emailFrom;
      changed = true;
    }

    if (
      payload.emailDate &&
      (!existingLead.emailDate || new Date(existingLead.emailDate).getTime() !== new Date(payload.emailDate).getTime())
    ) {
      existingLead.emailDate = payload.emailDate;
      changed = true;
    }

    const existingLeadInfo = existingLead.leadInfo || {};
    const incomingLeadInfo = payload.leadInfo || {};
    const mergedFields = {
      ...(existingLeadInfo.fields || {}),
      ...(incomingLeadInfo.fields || {}),
    };

    const assignIfBetter = (key, prefersLonger = false) => {
      const currentValue = existingLeadInfo[key];
      const incomingValue = incomingLeadInfo[key];
      if (!incomingValue) return;

      if (!currentValue) {
        existingLeadInfo[key] = incomingValue;
        changed = true;
        return;
      }

      if (prefersLonger && String(incomingValue).length > String(currentValue).length) {
        existingLeadInfo[key] = incomingValue;
        changed = true;
      }
    };

    assignIfBetter('name');
    assignIfBetter('email');
    assignIfBetter('phone');
    assignIfBetter('message', true);
    assignIfBetter('rawContent', true);

    if (JSON.stringify(existingLeadInfo.fields || {}) !== JSON.stringify(mergedFields)) {
      existingLeadInfo.fields = mergedFields;
      changed = true;
    }

    existingLead.leadInfo = existingLeadInfo;

    if (changed) {
      await existingLead.save();
      return { lead: existingLead, action: 'updated' };
    }

    return { lead: existingLead, action: 'existing' };
  }

  /**
   * Process a single email: match subject to Admin subject mapping → assign lead to that clinic
   */
  async processEmail(email, folderName = null) {
    try {
      const parsed = await simpleParser(email);
      const rawSubject = parsed.subject || 'No Subject';
      const subject = this.normalizeSubject(rawSubject) || rawSubject;
      const messageId = parsed.messageId || null;
      const from = parsed.from ? parsed.from.text : null;
      const date = parsed.date || new Date();

      const folderCustomer = folderName ? await this.findCustomerByFolder(folderName) : null;
      const customer = folderCustomer || await this.findCustomerBySubject(subject);

      if (!customer) {
        if (folderName) {
          console.warn(`[Meta Leads] No folder or subject mapping for folder "${folderName}" and subject "${subject.substring(0, 80)}${subject.length > 80 ? '...' : ''}"`);
        }
        return null;
      }

      // Parse lead information (will return null values for missing fields)
      const leadInfo = this.parseLeadInfo(parsed, subject);
      const payload = this.buildLeadPayload(customer, subject, leadInfo, from, date, messageId, folderName);

      // Check if email already processed (only if messageId exists)
      if (messageId) {
        const existingLead = await MetaLead.findOne({
          emailMessageId: messageId
        });

        if (existingLead) {
          return this.upsertExistingLead(existingLead, payload);
        }
      }

      // Fallback dedupe: same customer + same email or phone + same day = treat as duplicate (avoid double leads from same person)
      const emailNorm = leadInfo.email ? leadInfo.email.trim().toLowerCase() : null;
      const phoneNorm = leadInfo.phone ? leadInfo.phone.replace(/\D/g, '').trim() : null;
      if (emailNorm || phoneNorm) {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);
        const sameDayQuery = {
          customerId: customer._id,
          emailDate: { $gte: dayStart, $lte: dayEnd }
        };
        const existingSameDay = await MetaLead.find(sameDayQuery).lean();
        for (const existing of existingSameDay) {
          const exEmail = (existing.leadInfo && existing.leadInfo.email) ? existing.leadInfo.email.trim().toLowerCase() : null;
          const exPhone = (existing.leadInfo && existing.leadInfo.phone) ? String(existing.leadInfo.phone).replace(/\D/g, '').trim() : null;
          if (emailNorm && exEmail === emailNorm) {
            const existingLead = await MetaLead.findById(existing._id);
            return this.upsertExistingLead(existingLead, payload);
          }
          if (phoneNorm && exPhone && phoneNorm === exPhone) {
            const existingLead = await MetaLead.findById(existing._id);
            return this.upsertExistingLead(existingLead, payload);
          }
        }
      }

      // Always create lead even if no information extracted (subject match is enough)
      // This ensures we track all leads regardless of email body content
      const lead = new MetaLead(payload);

      await lead.save();
      console.log(`[Meta Leads] Lead created for customer ${customer._id} (subject: "${subject.length > 50 ? subject.substring(0, 50) + '...' : subject}")`);
      return { lead, action: 'created' };
    } catch (error) {
      console.error('[Meta Leads] Error processing email:', error.message || error);
      if (error.code) console.error('[Meta Leads] Error code:', error.code);
      return null;
    }
  }

  /**
   * Disconnect from IMAP server
   */
  disconnect() {
    return new Promise((resolve) => {
      if (!this.imap || this.imap.state === 'disconnected') {
        this.imap = null;
        resolve();
        return;
      }

      try {
        this.imap.once('end', () => {
          this.imap = null;
          resolve();
        });

        this.imap.end();
      } catch (error) {
        this.imap = null;
        resolve();
      }
    });
  }

  /**
   * Check a specific mailbox/folder for new emails
   * @param {number} daysBack - How many days back to look (e.g. 2 = today + yesterday so we never miss leads)
   */
  async checkFolderForEmails(folderName, daysBack, result) {
    try {
      const { openedFolderName } = await this.openBoxWithFallback(folderName);

      return await new Promise((resolve) => {
        const searchCriteria = daysBack === null
          ? ['ALL']
          : (() => {
              const since = new Date();
              since.setDate(since.getDate() - (daysBack || 1));
              since.setHours(0, 0, 0, 0);
              return [['SINCE', since]];
            })();

        this.imap.search(searchCriteria, async (err, results) => {
          if (err) {
            console.error(`Error searching emails in "${openedFolderName}":`, err);
            result.errors.push(`Error searching emails in "${openedFolderName}": ${err.message}`);
            resolve(result);
            return;
          }

          if (!results || results.length === 0) {
            resolve(result);
            return;
          }

          result.emailsFound += results.length;

          const processedEmails = [];
          const processingPromises = [];

          const fetch = this.imap.fetch(results, {
            bodies: '',
            struct: true
          });

          fetch.on('message', (msg, seqno) => {
            const emailPromise = new Promise((resolveEmail) => {
              const done = () => {
                if (!resolved) {
                  resolved = true;
                  resolveEmail();
                }
              };
              let resolved = false;
              msg.on('body', async (stream, info) => {
                const buffer = [];
                stream.on('data', (chunk) => buffer.push(chunk));
                stream.once('end', async () => {
                  try {
                    const emailBuffer = Buffer.concat(buffer);
                    const processed = await this.processEmail(emailBuffer, openedFolderName);
                    result.emailsProcessed++;
                    if (processed?.lead) {
                      if (processed.action === 'created') {
                        result.leadsCreated++;
                      } else if (processed.action === 'updated') {
                        result.leadsUpdated++;
                      }
                      processedEmails.push(seqno);
                    }
                  } catch (e) {
                    console.error(`[Meta Leads] Error processing one email in "${openedFolderName}":`, e.message);
                    result.emailsProcessed++;
                  }
                  done();
                });
                stream.on('error', () => done());
              });
              msg.once('end', () => done());
            });
            processingPromises.push(emailPromise);
          });

          fetch.once('error', (err) => {
            console.error(`Error fetching emails from "${openedFolderName}":`, err);
            result.errors.push(`Error fetching emails from "${openedFolderName}": ${err.message}`);
            Promise.all(processingPromises).then(() => resolve(result)).catch(() => resolve(result));
          });

          fetch.once('end', async () => {
            try {
              await Promise.all(processingPromises);

              if (processedEmails.length > 0) {
                this.imap.addFlags(processedEmails, '\\Seen', (err) => {
                  if (err) {
                    console.error(`Error marking emails as read in "${openedFolderName}":`, err);
                    result.errors.push(`Error marking emails as read in "${openedFolderName}": ${err.message}`);
                  }
                  resolve(result);
                });
              } else {
                resolve(result);
              }
            } catch (error) {
              console.error(`Error processing emails in "${openedFolderName}":`, error);
              result.errors.push(`Error processing emails in "${openedFolderName}": ${error.message}`);
              resolve(result);
            }
          });
        });
      });
    } catch (error) {
      result.errors.push(`Error opening folder "${folderName}": ${error.message}`);
      return result;
    }
  }

  /**
   * Check for new emails across all folders
   * @param {number} daysBack - Number of days to look back (default: 1 for today only)
   */
  async checkForNewEmails(daysBack = 1) {
    const finalizeCheck = (result) => {
      const nowIso = new Date().toISOString();
      this.lastCheckCompletedAt = nowIso;
      this.lastResult = result;
      if (result?.errors?.length) {
        this.lastError = result.errors[result.errors.length - 1];
      }
      if (!result?.skipped && (!result?.errors || result.errors.length === 0)) {
        this.lastSuccessfulCheckAt = nowIso;
      }
      return result;
    };

    await this.recoverIfCheckIsStale();

    this.lastCheckStartedAt = new Date().toISOString();

    if (this.isChecking) {
      return finalizeCheck({ message: 'Check already in progress', skipped: true });
    }

    this.isChecking = true;
    
    const result = {
      emailsFound: 0,
      emailsProcessed: 0,
      leadsCreated: 0,
      leadsUpdated: 0,
      errors: [],
      skipped: false
    };

    return new Promise(async (resolve) => {
      try {
        await this.connect();
        
        // Get all folders/boxes
        this.imap.getBoxes((err, boxes) => {
          if (err) {
            console.error('Error getting folders:', err);
            result.errors.push(`Error getting folders: ${err.message}`);
            this.disconnect().finally(() => {
              this.isChecking = false;
              resolve(finalizeCheck(result));
            });
            return;
          }

          // List all folders
          const folderNames = [];
          
          // Helper function to recursively get folder names (matches cPanel webmail hierarchy)
          const getFolderNames = (boxes, prefix = '') => {
            for (const name in boxes) {
              const fullName = prefix ? `${prefix}${boxes[name].delimiter || '.'}${name}` : name;
              if (fullName && String(fullName).trim()) {
                folderNames.push(fullName);
              }
              if (boxes[name].children && typeof boxes[name].children === 'object') {
                getFolderNames(boxes[name].children, fullName || name);
              }
            }
          };
          
          getFolderNames(boxes);

          // Process folders sequentially to avoid connection issues
          const processFolders = async (index = 0) => {
            try {
              if (index >= folderNames.length) {
                // All folders processed - log summary so admin can see if leads are being picked up
                const msg = `[Meta Leads] Check done: ${result.emailsFound} email(s) found, ${result.leadsCreated} lead(s) created.`;
                if (result.errors.length) {
                  console.warn(msg, 'Errors:', result.errors);
                } else {
                  console.log(msg);
                }
                this.disconnect().finally(() => {
                  this.isChecking = false;
                  resolve(finalizeCheck(result));
                });
                return;
              }

              const folderName = folderNames[index];
              await this.checkFolderForEmails(folderName, daysBack, result);
              // Process next folder
              processFolders(index + 1);
            } catch (folderError) {
              console.error(`Error processing folder at index ${index}:`, folderError);
              result.errors.push(`Folder error: ${folderError.message}`);
              this.disconnect().finally(() => {
                this.isChecking = false;
                resolve(finalizeCheck(result));
              });
            }
          };

          // Start processing folders
          processFolders();
        });
      } catch (error) {
        console.error('[Meta Leads] Connection or check failed:', error.message);
        result.errors.push(`Error checking emails: ${error.message}`);
        this.disconnect().finally(() => {
          this.isChecking = false;
          resolve(finalizeCheck(result));
        });
      }
    });
  }

  async checkSpecificFolders(folderNames = [], daysBack = null) {
    const finalizeCheck = (result) => {
      const nowIso = new Date().toISOString();
      this.lastCheckCompletedAt = nowIso;
      this.lastResult = result;
      if (result?.errors?.length) {
        this.lastError = result.errors[result.errors.length - 1];
      }
      if (!result?.skipped && (!result?.errors || result.errors.length === 0)) {
        this.lastSuccessfulCheckAt = nowIso;
      }
      return result;
    };

    await this.recoverIfCheckIsStale();

    this.lastCheckStartedAt = new Date().toISOString();

    if (this.isChecking) {
      return finalizeCheck({ message: 'Check already in progress', skipped: true });
    }

    const uniqueFolders = [...new Set((folderNames || []).map((name) => String(name || '').trim()).filter(Boolean))];
    if (!uniqueFolders.length) {
      return finalizeCheck({
        emailsFound: 0,
        emailsProcessed: 0,
        leadsCreated: 0,
        leadsUpdated: 0,
        errors: ['No folders were provided for import.'],
        skipped: true,
        foldersChecked: []
      });
    }

    this.isChecking = true;

    const result = {
      emailsFound: 0,
      emailsProcessed: 0,
      leadsCreated: 0,
      leadsUpdated: 0,
      errors: [],
      skipped: false,
      foldersChecked: []
    };

    return new Promise(async (resolve) => {
      try {
        await this.connect();

        this.imap.getBoxes((err, boxes) => {
          if (err) {
            result.errors.push(`Error getting folders: ${err.message}. Falling back to direct folder open attempts.`);
            const fallbackResolvedFolders = uniqueFolders.map((folderName) => ({
              requestedFolder: folderName,
              resolvedFolder: folderName,
              matchedBy: 'fallback'
            }));
            result.foldersChecked = fallbackResolvedFolders.map((folder) => folder.resolvedFolder);

            const processFallbackFolders = async (index = 0) => {
              try {
                if (index >= fallbackResolvedFolders.length) {
                  this.disconnect().finally(() => {
                    this.isChecking = false;
                    resolve(finalizeCheck(result));
                  });
                  return;
                }

                const folderName = fallbackResolvedFolders[index].resolvedFolder;
                await this.checkFolderForEmails(folderName, daysBack, result);
                processFallbackFolders(index + 1);
              } catch (folderError) {
                result.errors.push(`Folder error: ${folderError.message}`);
                this.disconnect().finally(() => {
                  this.isChecking = false;
                  resolve(finalizeCheck(result));
                });
              }
            };

            processFallbackFolders();
            return;
          }

          const availableFolders = this.extractFolderNames(boxes);
          const resolvedFolders = this.resolveRequestedFolders(uniqueFolders, availableFolders);
          result.foldersChecked = resolvedFolders.map((folder) => folder.resolvedFolder);

          for (const unresolvedFolder of resolvedFolders.filter((folder) => folder.matchedBy === 'fallback')) {
            result.errors.push(`Mapped folder "${unresolvedFolder.requestedFolder}" was not found in IMAP folder list; attempted raw folder name as fallback.`);
          }

          const processFolders = async (index = 0) => {
            try {
              if (index >= resolvedFolders.length) {
                this.disconnect().finally(() => {
                  this.isChecking = false;
                  resolve(finalizeCheck(result));
                });
                return;
              }

              const folderName = resolvedFolders[index].resolvedFolder;
              await this.checkFolderForEmails(folderName, daysBack, result);
              processFolders(index + 1);
            } catch (folderError) {
              result.errors.push(`Folder error: ${folderError.message}`);
              this.disconnect().finally(() => {
                this.isChecking = false;
                resolve(finalizeCheck(result));
              });
            }
          };

          processFolders();
        });
      } catch (error) {
        result.errors.push(`Error checking emails: ${error.message}`);
        this.disconnect().finally(() => {
          this.isChecking = false;
          resolve(finalizeCheck(result));
        });
      }
    });
  }

  /**
   * Return all discoverable IMAP folders for admin mapping UI.
   */
  async getAvailableFolders() {
    if (!this.hasCredentials()) {
      throw new Error('Missing credentials: LEADS_EMAIL_PASS/EMAIL_PASS is not set.');
    }

    const folderNames = [];

    try {
      await this.connect();

      await new Promise((resolve, reject) => {
        this.imap.getBoxes((err, boxes) => {
          if (err) {
            reject(err);
            return;
          }

          const getFolderNames = (boxTree, prefix = '') => {
            for (const name in boxTree) {
              const fullName = prefix ? `${prefix}${boxTree[name].delimiter || '.'}${name}` : name;
              if (fullName && String(fullName).trim()) {
                folderNames.push(fullName);
              }
              if (boxTree[name].children && typeof boxTree[name].children === 'object') {
                getFolderNames(boxTree[name].children, fullName || name);
              }
            }
          };

          getFolderNames(boxes);
          resolve();
        });
      });

      return folderNames.sort((a, b) => a.localeCompare(b));
    } catch (error) {
      console.warn('[Meta Leads] Folder discovery failed, falling back to saved mapped folders:', error.message);
      const mappedFolders = await MetaLeadFolderMapping.find({ isActive: true })
        .distinct('folderName');
      return [...new Set(mappedFolders.map((folder) => String(folder || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Returns true if IMAP credentials are configured (so monitoring can run).
   * Must use same env vars as constructor (read at call time for production env).
   */
  hasCredentials() {
    const pass = process.env.LEADS_EMAIL_PASS || process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;
    return !!(pass && String(pass).trim());
  }

  /**
   * Start monitoring emails - look back 30 days so we never miss leads (e.g. server down, or emails that stayed unread)
   * Default interval 1 minute so portal updates quickly after email arrives at leads@clinimedia.ca
   * IMPORTANT: Runs on whichever server process calls this (e.g. production backend). Ensure LEADS_EMAIL_PASS
   * (or EMAIL_PASS) is set in production environment so the always-on backend processes leads.
   */
  startMonitoring(intervalMinutes = 1) {
    if (!this.hasCredentials()) {
      this.monitoringEnabled = false;
      console.error('[Meta Leads] ❌ Email monitoring NOT started: no password set.');
      console.error('[Meta Leads]    Set LEADS_EMAIL_PASS or EMAIL_PASS (or EMAIL_PASSWORD) in this server\'s environment.');
      console.error('[Meta Leads]    On production (e.g. Railway), add the variable in the project dashboard so leads are processed 24/7.');
      return;
    }
    this.monitoringEnabled = true;
    this.monitoringIntervalMinutes = intervalMinutes;
    this.lastMonitoringStartedAt = new Date().toISOString();
    const nodeEnv = process.env.NODE_ENV || 'development';
    const mailbox = (this.getImapConfig()).user;
    console.log(`[Meta Leads] ✅ Email monitoring started (NODE_ENV=${nodeEnv}, interval=${intervalMinutes} min). Mailbox: ${mailbox} (leads inbox, not notifications@).`);
    const daysBack = 30; // Look back 30 days (all emails, read or unread); dedup by messageId prevents duplicates
    // Check immediately on startup
    this.checkForNewEmails(daysBack);

    // Then check every N minutes
    this.checkInterval = setInterval(() => {
      this.checkForNewEmails(daysBack);
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop monitoring emails
   */
  stopMonitoring() {
    this.monitoringEnabled = false;
    this.monitoringIntervalMinutes = null;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.imap) {
      this.imap.end();
      this.imap = null;
    }
  }

  /**
   * Live IMAP smoke test for admin diagnostics.
   * Attempts login + open INBOX and returns mailbox counters.
   */
  async testImapConnection() {
    const cfg = this.getImapConfig();
    const response = {
      ok: false,
      mailboxUser: cfg.user,
      mailboxHost: cfg.host,
      mailboxPort: cfg.port,
      testedAt: new Date().toISOString(),
      inbox: null,
      error: null
    };

    if (!this.hasCredentials()) {
      response.error = 'Missing credentials: LEADS_EMAIL_PASS/EMAIL_PASS is not set.';
      return response;
    }

    return new Promise((resolve) => {
      const imap = new Imap(cfg);
      let settled = false;
      const done = (result) => {
        if (!settled) {
          settled = true;
          resolve(result);
        }
      };

      imap.once('ready', () => {
        imap.openBox('INBOX', true, (err, box) => {
          if (err) {
            response.error = `Connected, but failed to open INBOX: ${err.message}`;
            try { imap.end(); } catch (_) {}
            done(response);
            return;
          }
          response.ok = true;
          response.inbox = {
            total: box?.messages?.total ?? null,
            unread: box?.messages?.new ?? null
          };
          try { imap.end(); } catch (_) {}
          done(response);
        });
      });

      imap.once('error', (err) => {
        response.error = err?.message || 'Unknown IMAP error';
        done(response);
      });

      imap.once('end', () => done(response));

      try {
        imap.connect();
      } catch (err) {
        response.error = err?.message || 'Failed to start IMAP connection';
        done(response);
      }
    });
  }

  /**
   * Runtime status for production diagnostics.
   */
  getMonitoringStatus() {
    const cfg = this.getImapConfig();
    return {
      monitoringEnabled: this.monitoringEnabled,
      intervalMinutes: this.monitoringIntervalMinutes,
      hasCredentials: this.hasCredentials(),
      isChecking: this.isChecking,
      mailboxUser: cfg.user,
      mailboxHost: cfg.host,
      mailboxPort: cfg.port,
      lastMonitoringStartedAt: this.lastMonitoringStartedAt,
      lastCheckStartedAt: this.lastCheckStartedAt,
      lastCheckCompletedAt: this.lastCheckCompletedAt,
      lastSuccessfulCheckAt: this.lastSuccessfulCheckAt,
      lastError: this.lastError,
      lastResult: this.lastResult
    };
  }
}

module.exports = new MetaLeadsEmailService();


