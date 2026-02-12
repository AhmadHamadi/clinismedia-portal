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
const MetaLeadSubjectMapping = require('../models/MetaLeadSubjectMapping');
require('dotenv').config();

class MetaLeadsEmailService {
  constructor() {
    // Leads inbox: default leads@clinimedia.ca, password from EMAIL_PASS. Override with LEADS_EMAIL_* in .env if needed.
    const leadsEmailUser = process.env.LEADS_EMAIL_USER || 'leads@clinimedia.ca';
    const leadsEmailPass = process.env.LEADS_EMAIL_PASS || process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;
    const leadsEmailHost = process.env.LEADS_EMAIL_HOST || process.env.EMAIL_HOST || 'mail.clinimedia.ca';
    const leadsEmailPort = parseInt(process.env.LEADS_EMAIL_IMAP_PORT) || 993;
    
    this.imapConfig = {
      user: leadsEmailUser,
      password: leadsEmailPass,
      host: leadsEmailHost,
      port: leadsEmailPort,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    };
    
    // Validate password is set
    if (!leadsEmailPass) {
      console.error('Warning: Leads email password not set! Set EMAIL_PASS, EMAIL_PASSWORD, or LEADS_EMAIL_PASS in .env');
    }
    
    this.imap = null;
    this.isChecking = false;
    this.checkInterval = null;
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

      this.imap = new Imap(this.imapConfig);

      this.imap.once('ready', () => {
        console.log(`[Meta Leads] Connected to ${this.imapConfig.user} (IMAP). Checking for new lead emails...`);
        resolve(this.imap);
      });

      this.imap.once('error', (err) => {
        // Handle connection reset errors gracefully
        if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
          // Clear the connection so it will reconnect next time
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
        text = htmlContent.replace(/<[^>]*>/g, ' ') // Remove HTML tags
                 .replace(/&nbsp;/g, ' ')   // Replace &nbsp;
                 .replace(/&amp;/g, '&')    // Replace &amp;
                 .replace(/&lt;/g, '<')     // Replace &lt;
                 .replace(/&gt;/g, '>')     // Replace &gt;
                 .replace(/&quot;/g, '"')   // Replace &quot;
                 .replace(/&#39;/g, "'")    // Replace &#39;
                 .replace(/\s+/g, ' ')      // Normalize whitespace
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
    // Pattern 1: "Full Name: Khawaja Ahsan" or "Name: John Doe"
    const namePatterns = [
      /(?:full\s+name|name|first\s+name|last\s+name)[\s:]*([^\n\r]+?)(?:\n|$)/i,
      /^[^:\n]*name[^:\n]*:\s*(.+?)(?:\n|$)/im,
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
            if (key.includes('full name') || (key.includes('name') && !key.includes('email') && !key.includes('phone') && !key.includes('campaign'))) {
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
          if (!leadInfo.name && fromInfo.name) {
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
      }
    } catch (e) {
      // Not JSON, that's fine - we already parsed key-value pairs
    }

    // Clean up and validate extracted values (only if they exist)
    if (leadInfo.name) {
      leadInfo.name = leadInfo.name.replace(/^["']|["']$/g, '').trim();
      // If name is empty after cleaning, set to null
      if (!leadInfo.name || leadInfo.name.length === 0) {
        leadInfo.name = null;
      }
    } else {
      leadInfo.name = null; // Ensure it's explicitly null
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
   * Normalize email subject for matching: trim, collapse whitespace, strip control chars
   * So "CliniMedia  -  Burlington..." or "CliniMedia - Burlington...\r" still match
   */
  normalizeSubject(subject) {
    if (!subject || typeof subject !== 'string') return '';
    return subject
      .replace(/\r\n|\r|\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
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
   * Process a single email: match subject to Admin subject mapping → assign lead to that clinic
   */
  async processEmail(email) {
    try {
      const parsed = await simpleParser(email);
      const rawSubject = parsed.subject || 'No Subject';
      const subject = this.normalizeSubject(rawSubject) || rawSubject;
      const messageId = parsed.messageId || null;
      const from = parsed.from ? parsed.from.text : null;
      const date = parsed.date || new Date();

      const customer = await this.findCustomerBySubject(subject);

      if (!customer) {
        // Logged in findCustomerBySubject; return null so caller can track no-mapping count
        return null;
      }

      // Check if email already processed (only if messageId exists)
      if (messageId) {
        const existingLead = await MetaLead.findOne({
          emailMessageId: messageId
        });

        if (existingLead) {
          return existingLead;
        }
      }

      // Parse lead information (will return null values for missing fields)
      const leadInfo = this.parseLeadInfo(parsed, subject);

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
            return await MetaLead.findById(existing._id);
          }
          if (phoneNorm && exPhone && phoneNorm === exPhone) {
            return await MetaLead.findById(existing._id);
          }
        }
      }

      // Always create lead even if no information extracted (subject match is enough)
      // This ensures we track all leads regardless of email body content
      const lead = new MetaLead({
        customerId: customer._id,
        emailSubject: subject,
        campaignName: (leadInfo.campaignName && leadInfo.campaignName.trim()) ? leadInfo.campaignName.trim() : null,
        leadInfo: {
          name: leadInfo.name || null,
          email: leadInfo.email || null,
          phone: leadInfo.phone || null,
          message: leadInfo.message || null,
          rawContent: leadInfo.rawContent || null,
          fields: leadInfo.fields || {}
        },
        emailFrom: from || null,
        emailDate: date,
        emailMessageId: messageId || null,
        status: 'new'
      });

      await lead.save();
      console.log(`[Meta Leads] Lead created for customer ${customer._id} (subject: "${subject.length > 50 ? subject.substring(0, 50) + '...' : subject}")`);
      return lead;
    } catch (error) {
      console.error('Error processing email:', error);
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
    return new Promise((resolve) => {
      this.imap.openBox(folderName, false, (err, box) => {
        if (err) {
          resolve(result);
          return;
        }

        // Any email (unread or read) received with a subject that matches admin mapping → lead for that clinic
        const since = new Date();
        since.setDate(since.getDate() - (daysBack || 1));
        since.setHours(0, 0, 0, 0);

        this.imap.search([['SINCE', since]], async (err, results) => {
          if (err) {
            console.error(`Error searching emails in "${folderName}":`, err);
            result.errors.push(`Error searching emails in "${folderName}": ${err.message}`);
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
              msg.on('body', async (stream, info) => {
                const buffer = [];
                stream.on('data', (chunk) => {
                  buffer.push(chunk);
                });

                stream.once('end', async () => {
                  const emailBuffer = Buffer.concat(buffer);
                  const lead = await this.processEmail(emailBuffer);
                  result.emailsProcessed++;
                  if (lead) {
                    result.leadsCreated++;
                    // Only mark as read when we actually created/found a lead for a clinic
                    // So emails with no matching subject stay unread and can be retried after adding a mapping
                    processedEmails.push(seqno);
                  }
                  resolveEmail();
                });
              });
            });
            processingPromises.push(emailPromise);
          });

          fetch.once('error', (err) => {
            console.error(`Error fetching emails from "${folderName}":`, err);
            result.errors.push(`Error fetching emails from "${folderName}": ${err.message}`);
            resolve(result);
          });

          fetch.once('end', async () => {
            // Wait for all emails to finish processing before marking as read
            try {
              await Promise.all(processingPromises);
              
              // Mark all processed emails as SEEN (read)
              if (processedEmails.length > 0) {
                this.imap.addFlags(processedEmails, '\\Seen', (err) => {
                  if (err) {
                    console.error(`Error marking emails as read in "${folderName}":`, err);
                    result.errors.push(`Error marking emails as read in "${folderName}": ${err.message}`);
                  }
                  resolve(result);
                });
              } else {
                resolve(result);
              }
            } catch (error) {
              console.error(`Error processing emails in "${folderName}":`, error);
              result.errors.push(`Error processing emails in "${folderName}": ${error.message}`);
              resolve(result);
            }
          });
        });
      });
    });
  }

  /**
   * Check for new emails across all folders
   * @param {number} daysBack - Number of days to look back (default: 1 for today only)
   */
  async checkForNewEmails(daysBack = 1) {
    if (this.isChecking) {
      return { message: 'Check already in progress', skipped: true };
    }

    this.isChecking = true;
    
    const result = {
      emailsFound: 0,
      emailsProcessed: 0,
      leadsCreated: 0,
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
              resolve(result);
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
                  resolve(result);
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
                resolve(result);
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
          resolve(result);
        });
      }
    });
  }

  /**
   * Start monitoring emails - look back 7 days so we never miss leads (e.g. server down, or emails that stayed unread)
   * Default interval 3 minutes so portal updates soon after email arrives at leads@clinimedia.ca
   */
  startMonitoring(intervalMinutes = 3) {
    const daysBack = 7; // Look back 7 days (all emails, read or unread); dedup by messageId prevents duplicates
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
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.imap) {
      this.imap.end();
      this.imap = null;
    }
  }
}

module.exports = new MetaLeadsEmailService();

