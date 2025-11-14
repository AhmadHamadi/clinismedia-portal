const Imap = require('imap');
const { simpleParser } = require('mailparser');
const MetaLead = require('../models/MetaLead');
const MetaLeadSubjectMapping = require('../models/MetaLeadSubjectMapping');
require('dotenv').config();

class MetaLeadsEmailService {
  constructor() {
    // IMAP configuration for leads@clinimedia.ca
    // Uses same password as notifications email (EMAIL_PASS or EMAIL_PASSWORD)
    // Uses same host as notifications email (EMAIL_HOST)
    // But uses different user: leads@clinimedia.ca (vs notifications@clinimedia.ca)
    // And uses IMAP port 993 (vs SMTP port 465)
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
            
            // Map to specific fields if not already set
            if (key.includes('full name') || (key.includes('name') && !key.includes('email') && !key.includes('phone'))) {
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
   * Find customer by email subject
   */
  async findCustomerBySubject(subject) {
    try {
      // Try exact match first
      let mapping = await MetaLeadSubjectMapping.findOne({
        emailSubject: subject,
        isActive: true
      }).populate('customerId');

      if (mapping && mapping.customerId) {
        return mapping.customerId;
      }

      // Try case-insensitive match
      mapping = await MetaLeadSubjectMapping.findOne({
        emailSubjectLower: subject.toLowerCase(),
        isActive: true
      }).populate('customerId');

      if (mapping && mapping.customerId) {
        return mapping.customerId;
      }

      // Try partial match (subject contains mapping)
      const mappings = await MetaLeadSubjectMapping.find({ isActive: true })
        .populate('customerId');
      
      for (const map of mappings) {
        if (subject.toLowerCase().includes(map.emailSubjectLower) ||
            map.emailSubjectLower.includes(subject.toLowerCase())) {
          return map.customerId;
        }
      }

      return null;
    } catch (error) {
      console.error('Error finding customer by subject:', error);
      return null;
    }
  }

  /**
   * Process a single email
   */
  async processEmail(email) {
    try {
      const parsed = await simpleParser(email);
      const subject = parsed.subject || 'No Subject';
      const messageId = parsed.messageId || null;
      const from = parsed.from ? parsed.from.text : null;
      const date = parsed.date || new Date();

      // Find customer by subject
      const customer = await this.findCustomerBySubject(subject);
      
      if (!customer) {
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

      // Always create lead even if no information extracted (subject match is enough)
      // This ensures we track all leads regardless of email body content
      const lead = new MetaLead({
        customerId: customer._id,
        emailSubject: subject,
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
   * Check a specific mailbox/folder for new emails (today only)
   */
  async checkFolderForEmails(folderName, daysBack, result) {
    return new Promise((resolve) => {
      this.imap.openBox(folderName, false, (err, box) => {
        if (err) {
          resolve(result);
          return;
        }

        // Search for unread emails from today only (not looking at previous emails)
        const since = new Date();
        since.setHours(0, 0, 0, 0);

        this.imap.search(['UNSEEN', ['SINCE', since]], async (err, results) => {
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

          // Track processed emails so we can mark them as read
          const processedEmails = [];
          const processingPromises = [];
          
          // Fetch emails
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
                  }
                  // Always track as processed - we'll mark it as read even if no lead was created
                  // This prevents reprocessing the same emails
                  processedEmails.push(seqno);
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
          
          // Helper function to recursively get folder names
          const getFolderNames = (boxes, prefix = '') => {
            for (const name in boxes) {
              const fullName = prefix ? `${prefix}${boxes[name].delimiter}${name}` : name;
              folderNames.push(fullName);
              if (boxes[name].children) {
                getFolderNames(boxes[name].children, fullName);
              }
            }
          };
          
          getFolderNames(boxes);

          // Process folders sequentially to avoid connection issues
          const processFolders = async (index = 0) => {
            if (index >= folderNames.length) {
              // All folders processed
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
          };

          // Start processing folders
          processFolders();
        });
      } catch (error) {
        console.error('Error checking emails:', error);
        result.errors.push(`Error checking emails: ${error.message}`);
        this.disconnect().finally(() => {
          this.isChecking = false;
          resolve(result);
        });
      }
    });
  }

  /**
   * Start monitoring emails
   */
  startMonitoring(intervalMinutes = 5) {
    // Check immediately (only today's emails)
    this.checkForNewEmails(1);

    // Then check periodically (only today's emails)
    this.checkInterval = setInterval(() => {
      this.checkForNewEmails(1);
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

