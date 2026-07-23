const path = require('path');
const fs = require('fs');

class ComplianceService {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(__dirname, '..');
    this.suppressionFile = path.join(this.dataDir, 'suppression_list.json');
    this.blockedFile = path.join(this.dataDir, 'blocked_contacts.json');
    this.optOutLogFile = path.join(this.dataDir, 'opt_out_log.json');
    this._suppressionList = new Set();
    this._blockedContacts = new Set();
    this._optOutLog = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.suppressionFile)) {
        const data = JSON.parse(fs.readFileSync(this.suppressionFile, 'utf8'));
        this._suppressionList = new Set(Array.isArray(data) ? data : []);
      }
    } catch (e) { console.error('[COMPLIANCE] Error loading suppression list:', e.message); }
    try {
      if (fs.existsSync(this.blockedFile)) {
        const data = JSON.parse(fs.readFileSync(this.blockedFile, 'utf8'));
        this._blockedContacts = new Set(Array.isArray(data) ? data : []);
      }
    } catch (e) { console.error('[COMPLIANCE] Error loading blocked contacts:', e.message); }
    try {
      if (fs.existsSync(this.optOutLogFile)) {
        this._optOutLog = JSON.parse(fs.readFileSync(this.optOutLogFile, 'utf8'));
      }
    } catch (e) { console.error('[COMPLIANCE] Error loading opt-out log:', e.message); }
  }

  saveSuppressionList() {
    try {
      fs.writeFileSync(this.suppressionFile, JSON.stringify([...this._suppressionList], null, 2), 'utf8');
    } catch (e) { console.error('[COMPLIANCE] Error saving suppression list:', e.message); }
  }

  saveBlockedContacts() {
    try {
      fs.writeFileSync(this.blockedFile, JSON.stringify([...this._blockedContacts], null, 2), 'utf8');
    } catch (e) { console.error('[COMPLIANCE] Error saving blocked contacts:', e.message); }
  }

  saveOptOutLog() {
    try {
      this._optOutLog = this._optOutLog.slice(-1000);
      fs.writeFileSync(this.optOutLogFile, JSON.stringify(this._optOutLog, null, 2), 'utf8');
    } catch (e) { console.error('[COMPLIANCE] Error saving opt-out log:', e.message); }
  }

  addToSuppressionList(contactId, phone, reason = 'manual') {
    this._suppressionList.add(contactId);
    this.saveSuppressionList();
    this._optOutLog.push({
      contactId, phone, reason, timestamp: new Date().toISOString()
    });
    this.saveOptOutLog();
    console.log(`[COMPLIANCE] ${contactId} added to suppression list. Reason: ${reason}`);
  }

  removeFromSuppressionList(contactId) {
    this._suppressionList.delete(contactId);
    this.saveSuppressionList();
  }

  isSuppressed(contactId) {
    return this._suppressionList.has(contactId);
  }

  blockContact(contactId, phone, reason = 'manual') {
    this._blockedContacts.add(contactId);
    this.saveBlockedContacts();
    this.addToSuppressionList(contactId, phone, `blocked: ${reason}`);
    console.log(`[COMPLIANCE] ${contactId} blocked. Reason: ${reason}`);
  }

  unblockContact(contactId) {
    this._blockedContacts.delete(contactId);
    this.removeFromSuppressionList(contactId);
    this.saveBlockedContacts();
  }

  isBlocked(contactId) {
    return this._blockedContacts.has(contactId);
  }

  canSendMessage(contactId, phone, contact = {}) {
    if (this.isBlocked(contactId)) {
      return { allowed: false, reason: 'Contact is blocked', code: 'BLOCKED' };
    }
    if (this.isSuppressed(contactId)) {
      return { allowed: false, reason: 'Contact has opted out', code: 'OPTED_OUT' };
    }
    if (contact.optedOut === true) {
      return { allowed: false, reason: 'Contact has opted out (profile flag)', code: 'OPTED_OUT' };
    }
    return { allowed: true, reason: null, code: null };
  }

  recordMessageSent(contactId, phone, templateId) {
    // Track send time for rate limiting
  }

  getStats() {
    return {
      suppressedCount: this._suppressionList.size,
      blockedCount: this._blockedContacts.size,
      totalOptOuts: this._optOutLog.length
    };
  }
}

module.exports = ComplianceService;
