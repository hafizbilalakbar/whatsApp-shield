const COUNTRY_TIMEZONE_MAP = {
  '1': 'America/New_York',
  '7': 'Europe/Moscow',
  '20': 'Africa/Cairo',
  '27': 'Africa/Johannesburg',
  '30': 'Europe/Athens',
  '31': 'Europe/Amsterdam',
  '33': 'Europe/Paris',
  '34': 'Europe/Madrid',
  '36': 'Europe/Budapest',
  '39': 'Europe/Rome',
  '41': 'Europe/Zurich',
  '43': 'Europe/Vienna',
  '44': 'Europe/London',
  '45': 'Europe/Copenhagen',
  '46': 'Europe/Stockholm',
  '48': 'Europe/Warsaw',
  '49': 'Europe/Berlin',
  '51': 'America/Lima',
  '52': 'America/Mexico_City',
  '53': 'America/Havana',
  '54': 'America/Argentina/Buenos_Aires',
  '55': 'America/Sao_Paulo',
  '56': 'America/Santiago',
  '57': 'America/Bogota',
  '58': 'America/Caracas',
  '60': 'Asia/Kuala_Lumpur',
  '61': 'Australia/Sydney',
  '62': 'Asia/Jakarta',
  '63': 'Asia/Manila',
  '64': 'Pacific/Auckland',
  '65': 'Asia/Singapore',
  '66': 'Asia/Bangkok',
  '81': 'Asia/Tokyo',
  '82': 'Asia/Seoul',
  '84': 'Asia/Ho_Chi_Minh',
  '86': 'Asia/Shanghai',
  '90': 'Europe/Istanbul',
  '91': 'Asia/Kolkata',
  '92': 'Asia/Karachi',
  '93': 'Asia/Kabul',
  '94': 'Asia/Colombo',
  '95': 'Asia/Yangon',
  '212': 'Africa/Casablanca',
  '213': 'Africa/Algiers',
  '216': 'Africa/Tunis',
  '218': 'Africa/Tripoli',
  '234': 'Africa/Lagos',
  '254': 'Africa/Nairobi',
  '255': 'Africa/Dar_es_Salaam',
  '256': 'Africa/Kampala',
  '263': 'Africa/Harare',
  '351': 'Europe/Lisbon',
  '352': 'Europe/Luxembourg',
  '353': 'Europe/Dublin',
  '354': 'Atlantic/Reykjavik',
  '358': 'Europe/Helsinki',
  '370': 'Europe/Vilnius',
  '371': 'Europe/Riga',
  '372': 'Europe/Tallinn',
  '380': 'Europe/Kiev',
  '385': 'Europe/Zagreb',
  '386': 'Europe/Ljubljana',
  '387': 'Europe/Sarajevo',
  '389': 'Europe/Skopje',
  '420': 'Europe/Prague',
  '421': 'Europe/Bratislava',
  '852': 'Asia/Hong_Kong',
  '853': 'Asia/Macau',
  '855': 'Asia/Phnom_Penh',
  '856': 'Asia/Vientiane',
  '880': 'Asia/Dhaka',
  '886': 'Asia/Taipei',
  '966': 'Asia/Riyadh',
  '967': 'Asia/Aden',
  '971': 'Asia/Dubai',
  '972': 'Asia/Jerusalem',
  '973': 'Asia/Bahrain',
  '974': 'Asia/Qatar',
  '977': 'Asia/Kathmandu',
  '998': 'Asia/Tashkent',
};

const BUSINESS_HOUR_RANGES = {
  'America/New_York': { start: 9, end: 18 },
  'America/Chicago': { start: 9, end: 18 },
  'America/Denver': { start: 9, end: 18 },
  'America/Los_Angeles': { start: 9, end: 18 },
  'America/Argentina/Buenos_Aires': { start: 9, end: 18 },
  'America/Sao_Paulo': { start: 9, end: 18 },
  'America/Bogota': { start: 8, end: 17 },
  'America/Lima': { start: 8, end: 17 },
  'America/Mexico_City': { start: 8, end: 17 },
  'America/Caracas': { start: 8, end: 17 },
  'America/Santiago': { start: 9, end: 18 },
  'Europe/London': { start: 8, end: 18 },
  'Europe/Paris': { start: 9, end: 18 },
  'Europe/Berlin': { start: 8, end: 18 },
  'Europe/Madrid': { start: 9, end: 19 },
  'Europe/Rome': { start: 9, end: 19 },
  'Europe/Amsterdam': { start: 8, end: 18 },
  'Europe/Brussels': { start: 8, end: 18 },
  'Europe/Lisbon': { start: 9, end: 18 },
  'Europe/Dublin': { start: 8, end: 18 },
  'Europe/Athens': { start: 9, end: 17 },
  'Europe/Budapest': { start: 8, end: 17 },
  'Europe/Warsaw': { start: 8, end: 17 },
  'Europe/Prague': { start: 8, end: 17 },
  'Europe/Stockholm': { start: 8, end: 17 },
  'Europe/Copenhagen': { start: 8, end: 16 },
  'Europe/Helsinki': { start: 8, end: 17 },
  'Europe/Vienna': { start: 8, end: 17 },
  'Europe/Zurich': { start: 8, end: 18 },
  'Europe/Bucharest': { start: 9, end: 18 },
  'Europe/Kiev': { start: 9, end: 18 },
  'Europe/Istanbul': { start: 9, end: 18 },
  'Europe/Moscow': { start: 9, end: 18 },
  'Asia/Dubai': { start: 9, end: 18 },
  'Asia/Riyadh': { start: 9, end: 17 },
  'Asia/Qatar': { start: 8, end: 17 },
  'Asia/Bahrain': { start: 8, end: 17 },
  'Asia/Karachi': { start: 9, end: 18 },
  'Asia/Kolkata': { start: 9, end: 18 },
  'Asia/Dhaka': { start: 9, end: 18 },
  'Asia/Kathmandu': { start: 9, end: 17 },
  'Asia/Colombo': { start: 8, end: 17 },
  'Asia/Kabul': { start: 8, end: 16 },
  'Asia/Tehran': { start: 9, end: 17 },
  'Asia/Almaty': { start: 9, end: 18 },
  'Asia/Tashkent': { start: 9, end: 18 },
  'Asia/Shanghai': { start: 9, end: 18 },
  'Asia/Hong_Kong': { start: 9, end: 18 },
  'Asia/Taipei': { start: 9, end: 18 },
  'Asia/Singapore': { start: 9, end: 18 },
  'Asia/Kuala_Lumpur': { start: 9, end: 18 },
  'Asia/Bangkok': { start: 8, end: 17 },
  'Asia/Ho_Chi_Minh': { start: 8, end: 17 },
  'Asia/Phnom_Penh': { start: 8, end: 17 },
  'Asia/Vientiane': { start: 8, end: 17 },
  'Asia/Jakarta': { start: 8, end: 17 },
  'Asia/Manila': { start: 8, end: 17 },
  'Asia/Yangon': { start: 8, end: 17 },
  'Asia/Seoul': { start: 9, end: 18 },
  'Asia/Tokyo': { start: 9, end: 18 },
  'Australia/Sydney': { start: 8, end: 18 },
  'Pacific/Auckland': { start: 8, end: 17 },
  'Africa/Cairo': { start: 9, end: 17 },
  'Africa/Lagos': { start: 8, end: 17 },
  'Africa/Nairobi': { start: 8, end: 17 },
  'Africa/Johannesburg': { start: 8, end: 17 },
  'Africa/Casablanca': { start: 9, end: 18 },
  'Africa/Algiers': { start: 8, end: 17 },
  'Africa/Tunis': { start: 8, end: 17 },
  'Africa/Tripoli': { start: 8, end: 17 },
  'Africa/Harare': { start: 8, end: 17 },
  'Africa/Dar_es_Salaam': { start: 8, end: 17 },
  'Africa/Kampala': { start: 8, end: 17 },
};

const DEFAULT_BUSINESS_HOURS = { start: 9, end: 18 };

const ACCOUNT_AGE_THRESHOLDS = [
  { maxDays: 7, maxDaily: 15, label: 'new' },
  { maxDays: 30, maxDaily: 30, label: 'young' },
  { maxDays: 90, maxDaily: 60, label: 'establishing' },
  { maxDays: 180, maxDaily: 100, label: 'mature' },
  { maxDays: Infinity, maxDaily: 150, label: 'veteran' },
];

class HealthMonitor {
  constructor(loadDataFn) {
    this.loadData = loadDataFn;
    this._cache = new Map();
    this._cacheTTL = 30000;
    this._pauseState = null;
    this._metricsHistory = [];
    this._maxHistoryLength = 1000;
  }

  _getData() {
    const now = Date.now();
    if (this._cache.has('data') && (now - this._cache.get('timestamp')) < this._cacheTTL) {
      return this._cache.get('data');
    }
    const data = this.loadData();
    this._cache.set('data', data);
    this._cache.set('timestamp', now);
    return data;
  }

  _getContacts() {
    const data = this._getData();
    return Array.isArray(data.contacts) ? data.contacts : [];
  }

  _getCampaigns() {
    const data = this._getData();
    return Array.isArray(data.campaigns) ? data.campaigns : [];
  }

  _getSettings() {
    const data = this._getData();
    return data.settings || {};
  }

  _clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  _daysSince(isoDate) {
    if (!isoDate) return 0;
    const created = new Date(isoDate);
    const now = new Date();
    return Math.max(0, Math.floor((now - created) / 86400000));
  }

  _getAccountAgeTier(createdAt) {
    const days = this._daysSince(createdAt);
    for (const tier of ACCOUNT_AGE_THRESHOLDS) {
      if (days <= tier.maxDays) return tier;
    }
    return ACCOUNT_AGE_THRESHOLDS[ACCOUNT_AGE_THRESHOLDS.length - 1];
  }

  _getAllMessages() {
    const campaigns = this._getCampaigns();
    const messages = [];
    for (const campaign of campaigns) {
      if (campaign.results && Array.isArray(campaign.results)) {
        for (const msg of campaign.results) {
          messages.push({ ...msg, campaignId: campaign.id, campaignPhone: campaign.phone });
        }
      }
    }
    return messages;
  }

  _getConversationMessages(phone) {
    const campaigns = this._getCampaigns();
    const normalizedPhone = phone.replace(/\D/g, '');
    const messages = [];
    for (const campaign of campaigns) {
      const campaignPhone = (campaign.phone || '').replace(/\D/g, '');
      if (campaignPhone === normalizedPhone && campaign.results && Array.isArray(campaign.results)) {
        for (const msg of campaign.results) {
          messages.push({ ...msg, campaignId: campaign.id });
        }
      }
    }
    messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return messages;
  }

  _getContactByPhone(phone) {
    const contacts = this._getContacts();
    const normalized = phone.replace(/\D/g, '');
    return contacts.find(c => (c.phone || '').replace(/\D/g, '') === normalized) || null;
  }

  _calculateDeliveryScore(messages) {
    if (messages.length === 0) return 100;
    const sentMessages = messages.filter(m => m.from === 'user' || m.from === 'ai');
    if (sentMessages.length === 0) return 100;
    const deliveredCount = sentMessages.filter(m =>
      m.status === 'sent' || m.status === 'delivered' || m.status === 'read' || !m.waError
    ).length;
    return this._clamp(Math.round((deliveredCount / sentMessages.length) * 100), 0, 100);
  }

  _calculateReplyRate(messages) {
    if (messages.length === 0) return 0;
    const sentByUs = messages.filter(m => m.from === 'user' || m.from === 'ai');
    const receivedFromThem = messages.filter(m => m.from === 'them');
    if (sentByUs.length === 0) return 0;
    const uniqueSentDays = new Set(
      sentByUs.map(m => {
        const d = new Date(m.timestamp);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })
    ).size;
    if (uniqueSentDays === 0) return 0;
    const repliesPerDay = receivedFromThem.length / uniqueSentDays;
    const score = this._clamp(Math.round(repliesPerDay * 40), 0, 100);
    return score;
  }

  _calculateMessageQualityScore(messages) {
    if (messages.length === 0) return 80;
    const sentMessages = messages.filter(m => m.from === 'user' || m.from === 'ai');
    if (sentMessages.length === 0) return 80;

    let totalScore = 0;
    let scored = 0;

    const avgLength = sentMessages.reduce((sum, m) => sum + (m.text || '').length, 0) / sentMessages.length;
    const lengthScore = avgLength >= 10 && avgLength <= 500 ? 100 :
                        avgLength > 500 ? this._clamp(100 - (avgLength - 500) / 20, 0, 100) :
                        avgLength > 0 ? this._clamp(avgLength * 10, 20, 100) : 20;
    totalScore += lengthScore;
    scored++;

    const texts = sentMessages.map(m => (m.text || '').toLowerCase().trim());
    const uniqueTexts = new Set(texts);
    const uniquenessRatio = texts.length > 0 ? uniqueTexts.size / texts.length : 1;
    const duplicateScore = this._clamp(Math.round(uniquenessRatio * 100), 0, 100);
    totalScore += duplicateScore;
    scored++;

    const avgWords = sentMessages.reduce((sum, m) => {
      const words = (m.text || '').split(/\s+/).filter(Boolean).length;
      return sum + words;
    }, 0) / sentMessages.length;
    const wordScore = avgWords >= 2 && avgWords <= 100 ? 100 :
                      avgWords > 100 ? this._clamp(100 - (avgWords - 100) / 5, 30, 100) :
                      avgWords > 0 ? this._clamp(avgWords * 30, 20, 100) : 20;
    totalScore += wordScore;
    scored++;

    const timestamps = sentMessages.map(m => new Date(m.timestamp).getTime()).sort((a, b) => a - b);
    if (timestamps.length >= 2) {
      let burstCount = 0;
      for (let i = 1; i < timestamps.length; i++) {
        if (timestamps[i] - timestamps[i - 1] < 1000) burstCount++;
      }
      const burstRatio = burstCount / (timestamps.length - 1);
      const timingScore = this._clamp(Math.round((1 - burstRatio) * 100), 0, 100);
      totalScore += timingScore;
      scored++;
    }

    return scored > 0 ? this._clamp(Math.round(totalScore / scored), 0, 100) : 80;
  }

  _calculateBlockReportScore(messages, contact) {
    const totalOutbound = messages.filter(m => m.from === 'user' || m.from === 'ai').length;
    if (totalOutbound === 0) return 100;

    let blockIndicators = 0;
    if (contact && contact.status === 'blocked') blockIndicators += 5;

    const sentMessages = messages.filter(m => m.from === 'user' || m.from === 'ai');
    const failedMessages = sentMessages.filter(m => m.status === 'failed' || m.waError);
    if (failedMessages.length > 0) {
      blockIndicators += Math.min(failedMessages.length, 10);
    }

    const recentFailed = failedMessages.filter(m => {
      const msgDate = new Date(m.timestamp);
      return (Date.now() - msgDate.getTime()) < 86400000;
    });
    if (recentFailed.length >= 3) blockIndicators += 5;

    const blockRate = blockIndicators / Math.max(totalOutbound, 1);
    const score = this._clamp(Math.round(100 - blockRate * 200), 0, 100);
    return score;
  }

  _calculateActivityConsistency(createdAt) {
    const days = this._daysSince(createdAt);
    if (days === 0) return 50;
    const campaigns = this._getCampaigns();
    const activeDays = new Set(
      campaigns
        .filter(c => c.timestamp)
        .map(c => {
          const d = new Date(c.timestamp);
          return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        })
    ).size;
    const activityRatio = Math.min(activeDays / Math.max(days, 1), 1);
    const consistencyScore = Math.round(activityRatio * 80 + (days > 7 ? 20 : days / 7 * 20));
    return this._clamp(consistencyScore, 10, 100);
  }

  calculateAccountHealth() {
    try {
      const messages = this._getAllMessages();
      const contacts = this._getContacts();

      const deliveryRate = this._calculateDeliveryScore(messages);

      let replyRateSum = 0;
      let replyRateCount = 0;
      for (const contact of contacts) {
        if (contact.phone) {
          const convMessages = this._getConversationMessages(contact.phone);
          if (convMessages.length > 0) {
            replyRateSum += this._calculateReplyRate(convMessages);
            replyRateCount++;
          }
        }
      }
      const avgReplyRate = replyRateCount > 0 ? replyRateSum / replyRateCount : 0;

      const qualityScore = this._calculateMessageQualityScore(messages);

      let blockScoreSum = 0;
      let blockScoreCount = 0;
      for (const contact of contacts) {
        if (contact.phone) {
          const convMessages = this._getConversationMessages(contact.phone);
          blockScoreSum += this._calculateBlockReportScore(convMessages, contact);
          blockScoreCount++;
        }
      }
      const avgBlockScore = blockScoreCount > 0 ? blockScoreSum / blockScoreCount : 100;

      const oldestCampaign = this._getCampaigns().reduce((oldest, c) => {
        if (!c.timestamp) return oldest;
        return !oldest || new Date(c.timestamp) < new Date(oldest) ? c.timestamp : oldest;
      }, null);
      const accountAge = oldestCampaign || new Date().toISOString();
      const activityScore = this._calculateActivityConsistency(accountAge);

      const healthScore = this._clamp(
        Math.round(
          deliveryRate * 0.30 +
          avgReplyRate * 0.25 +
          qualityScore * 0.20 +
          avgBlockScore * 0.15 +
          activityScore * 0.10
        ),
        0,
        100
      );

      const tier = this._getAccountAgeTier(accountAge);
      const maxDaily = tier.maxDaily;

      const metrics = {
        score: healthScore,
        deliveryRate,
        replyRate: this._clamp(Math.round(avgReplyRate), 0, 100),
        qualityScore,
        blockScore: avgBlockScore,
        activityConsistency: activityScore,
        accountAgeDays: this._daysSince(accountAge),
        accountAgeTier: tier.label,
        maxDailyMessages: maxDaily,
        totalMessages: messages.length,
        totalContacts: contacts.length,
        timestamp: new Date().toISOString(),
      };

      this._metricsHistory.push(metrics);
      if (this._metricsHistory.length > this._maxHistoryLength) {
        this._metricsHistory = this._metricsHistory.slice(-this._maxHistoryLength);
      }

      return metrics;
    } catch (err) {
      return {
        score: 0,
        deliveryRate: 0,
        replyRate: 0,
        qualityScore: 0,
        blockScore: 0,
        activityConsistency: 0,
        accountAgeDays: 0,
        accountAgeTier: 'unknown',
        maxDailyMessages: 15,
        totalMessages: 0,
        totalContacts: 0,
        timestamp: new Date().toISOString(),
        error: err.message,
      };
    }
  }

  analyzeConversationQuality(phone) {
    try {
      if (!phone) throw new Error('Phone number is required');

      const messages = this._getConversationMessages(phone);
      const contact = this._getContactByPhone(phone);

      if (messages.length === 0) {
        return {
          phone,
          hasData: false,
          overallScore: 0,
          messageNaturalness: 0,
          responseTimeScore: 0,
          engagementDepth: 0,
          sentimentTrend: 'unknown',
          languageMatch: 0,
          details: { totalMessages: 0, sentByUs: 0, receivedFromThem: 0 },
          timestamp: new Date().toISOString(),
        };
      }

      const messageNaturalness = this._calculateNaturalness(messages);
      const responseTimeScore = this._calculateResponseTime(messages);
      const engagementDepth = this._calculateEngagementDepth(messages);
      const sentimentTrend = this._calculateSentimentTrend(messages);
      const languageMatch = this._calculateLanguageMatch(messages);

      const overallScore = this._clamp(
        Math.round(
          messageNaturalness * 0.25 +
          responseTimeScore * 0.25 +
          engagementDepth * 0.25 +
          (sentimentTrend === 'improving' ? 100 : sentimentTrend === 'stable' ? 70 : 30) * 0.10 +
          languageMatch * 0.15
        ),
        0,
        100
      );

      return {
        phone,
        contactId: contact?.id || null,
        contactName: contact?.name || null,
        hasData: true,
        overallScore,
        messageNaturalness,
        responseTimeScore,
        engagementDepth,
        sentimentTrend,
        languageMatch,
        details: {
          totalMessages: messages.length,
          sentByUs: messages.filter(m => m.from === 'user' || m.from === 'ai').length,
          receivedFromThem: messages.filter(m => m.from === 'them').length,
          avgMessageLength: Math.round(
            messages.reduce((sum, m) => sum + (m.text || '').length, 0) / messages.length
          ),
          firstMessage: messages[0]?.timestamp || null,
          lastMessage: messages[messages.length - 1]?.timestamp || null,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return {
        phone,
        hasData: false,
        overallScore: 0,
        error: err.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  _calculateNaturalness(messages) {
    const sentMessages = messages.filter(m => m.from === 'user' || m.from === 'ai');
    if (sentMessages.length === 0) return 0;

    const lengths = sentMessages.map(m => (m.text || '').length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / lengths.length;
    const stdDev = Math.sqrt(variance);

    const lengthVarietyScore = stdDev > 5 ? 100 : stdDev > 2 ? 70 : 40;

    const avgWordCount = sentMessages.reduce((sum, m) => {
      return sum + (m.text || '').split(/\s+/).filter(Boolean).length;
    }, 0) / sentMessages.length;

    const naturalWordScore = avgWordCount >= 3 && avgWordCount <= 50 ? 100 :
                             avgWordCount > 50 ? Math.max(60, 100 - (avgWordCount - 50)) :
                             Math.max(30, avgWordCount * 10);

    const hasEmoji = sentMessages.some(m => /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(m.text || ''));
    const noEmoji = sentMessages.every(m => !/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(m.text || ''));
    const emojiBalance = (hasEmoji && !noEmoji) ? 80 : 60;

    return this._clamp(Math.round(lengthVarietyScore * 0.4 + naturalWordScore * 0.4 + emojiBalance * 0.2), 0, 100);
  }

  _calculateResponseTime(messages) {
    const sorted = [...messages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const responseTimes = [];

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if ((prev.from === 'user' || prev.from === 'ai') && curr.from === 'them') {
        const diff = new Date(curr.timestamp) - new Date(prev.timestamp);
        responseTimes.push(diff);
      }
    }

    if (responseTimes.length === 0) return 50;

    const avgMs = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const avgMinutes = avgMs / 60000;

    if (avgMinutes < 1) return 100;
    if (avgMinutes < 5) return 95;
    if (avgMinutes < 30) return 90;
    if (avgMinutes < 60) return 80;
    if (avgMinutes < 180) return 65;
    if (avgMinutes < 1440) return 50;
    if (avgMinutes < 4320) return 35;
    return 20;
  }

  _calculateEngagementDepth(messages) {
    if (messages.length < 2) return 20;

    let exchanges = 0;
    let currentStreak = 0;

    for (let i = 1; i < messages.length; i++) {
      const prevFrom = messages[i - 1].from;
      const currFrom = messages[i].from;
      if (prevFrom !== currFrom && (prevFrom === 'them' || currFrom === 'them')) {
        exchanges++;
        currentStreak++;
      } else {
        currentStreak = 0;
      }
    }

    const totalMessages = messages.length;
    const exchangeRatio = exchanges / totalMessages;

    const maxStreak = this._calculateMaxExchangeStreak(messages);
    const streakScore = Math.min(maxStreak * 15, 100);

    const ratioScore = this._clamp(Math.round(exchangeRatio * 200), 0, 100);

    return this._clamp(Math.round(ratioScore * 0.6 + streakScore * 0.4), 0, 100);
  }

  _calculateMaxExchangeStreak(messages) {
    let maxStreak = 0;
    let currentStreak = 0;

    for (let i = 1; i < messages.length; i++) {
      const prevFrom = messages[i - 1].from;
      const currFrom = messages[i].from;
      if (prevFrom !== currFrom && (prevFrom === 'them' || currFrom === 'them')) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    return maxStreak;
  }

  _calculateSentimentTrend(messages) {
    if (messages.length < 4) return 'stable';

    const theirMessages = messages.filter(m => m.from === 'them');
    if (theirMessages.length < 2) return 'stable';

    const midpoint = Math.floor(theirMessages.length / 2);
    const firstHalf = theirMessages.slice(0, midpoint);
    const secondHalf = theirMessages.slice(midpoint);

    const positiveWords = ['thank', 'thanks', 'great', 'good', 'love', 'excellent', 'perfect', 'wonderful', 'awesome', 'amazing', 'appreciate', 'happy', 'glad', 'yes', 'ok', 'okay', 'sure', 'please', 'help', 'interested', 'great', 'nice', 'best', 'fantastic', 'brilliant', 'superb'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'poor', 'angry', 'frustrated', 'annoyed', 'disappointed', 'unacceptable', 'useless', 'scam', 'spam', 'block', 'report', 'stop', 'no', 'never', 'wrong', 'broken', 'fail', 'failed', 'problem', 'issue'];

    const scoreHalf = (msgs) => {
      const totalWords = msgs.reduce((sum, m) => sum + (m.text || '').split(/\s+/).filter(Boolean).length, 0);
      if (totalWords === 0) return 0;
      const positiveCount = msgs.reduce((sum, m) => {
        const text = (m.text || '').toLowerCase();
        return sum + positiveWords.filter(w => text.includes(w)).length;
      }, 0);
      const negativeCount = msgs.reduce((sum, m) => {
        const text = (m.text || '').toLowerCase();
        return sum + negativeWords.filter(w => text.includes(w)).length;
      }, 0);
      return (positiveCount - negativeCount) / Math.max(totalWords, 1);
    };

    const firstScore = scoreHalf(firstHalf);
    const secondScore = scoreHalf(secondHalf);

    const diff = secondScore - firstScore;
    if (diff > 0.01) return 'improving';
    if (diff < -0.01) return 'declining';
    return 'stable';
  }

  _calculateLanguageMatch(messages) {
    const theirMessages = messages.filter(m => m.from === 'them');
    if (theirMessages.length === 0) return 50;

    const theirText = theirMessages.map(m => (m.text || '').toLowerCase()).join(' ');
    const ourMessages = messages.filter(m => m.from === 'user' || m.from === 'ai');
    const ourText = ourMessages.map(m => (m.text || '').toLowerCase()).join(' ');

    if (!theirText || !ourText) return 50;

    const theirChars = new Set(theirText.split(''));
    const ourChars = new Set(ourText.split(' '));

    const theirWords = theirText.split(/\s+/).filter(w => w.length > 2);
    const ourWords = ourText.split(/\s+/).filter(w => w.length > 2);

    if (theirWords.length === 0 || ourWords.length === 0) return 50;

    const theirWordSet = new Set(theirWords);
    const ourWordSet = new Set(ourWords);
    const intersection = [...theirWordSet].filter(w => ourWordSet.has(w));
    const union = new Set([...theirWordSet, ...ourWordSet]);
    const jaccard = union.size > 0 ? intersection.length / union.size : 0;

    const hasScriptMatch = this._hasSameScript(theirText, ourText);
    const scriptBonus = hasScriptMatch ? 30 : 0;

    const score = this._clamp(Math.round(jaccard * 70 + 30 + scriptBonus), 0, 100);
    return score;
  }

  _hasSameScript(text1, text2) {
    const getScript = (text) => {
      const scripts = { latin: 0, arabic: 0, cyrillic: 0, cjk: 0, devanagari: 0, thai: 0, other: 0 };
      for (const char of text) {
        const code = char.charCodeAt(0);
        if (code >= 0x0041 && code <= 0x024F) scripts.latin++;
        else if (code >= 0x0600 && code <= 0x06FF) scripts.arabic++;
        else if (code >= 0x0400 && code <= 0x04FF) scripts.cyrillic++;
        else if (code >= 0x4E00 && code <= 0x9FFF) scripts.cjk++;
        else if (code >= 0x0900 && code <= 0x097F) scripts.devanagari++;
        else if (code >= 0x0E00 && code <= 0x0E7F) scripts.thai++;
        else scripts.other++;
      }
      return scripts;
    };

    const s1 = getScript(text1);
    const s2 = getScript(text2);

    const dominant1 = Object.entries(s1).reduce((a, b) => b[1] > a[1] ? b : a, ['other', 0]);
    const dominant2 = Object.entries(s2).reduce((a, b) => b[1] > a[1] ? b : a, ['other', 0]);

    return dominant1[0] === dominant2[0];
  }

  getRecommendations() {
    try {
      const health = this.calculateAccountHealth();
      const messages = this._getAllMessages();
      const contacts = this._getContacts();
      const settings = this._getSettings();
      const recommendations = [];

      if (health.deliveryRate < 80) {
        const reductionPct = Math.round((80 - health.deliveryRate) * 0.5);
        recommendations.push({
          id: 'reduce_volume',
          severity: health.deliveryRate < 50 ? 'critical' : 'warning',
          category: 'volume',
          title: 'Reduce daily message volume',
          description: `Delivery rate is ${health.deliveryRate}%. Reduce daily volume by ${reductionPct}% to improve deliverability.`,
          action: `Reduce daily message volume by ${reductionPct}%`,
          impact: 'high',
          priority: 1,
        });
      }

      const sentToday = messages.filter(m => {
        const msgDate = new Date(m.timestamp).toDateString();
        return msgDate === new Date().toDateString() && (m.from === 'user' || m.from === 'ai');
      }).length;

      if (health.accountAgeTier === 'new' && sentToday > 15) {
        recommendations.push({
          id: 'new_account_limit',
          severity: 'critical',
          category: 'volume',
          title: 'New account volume exceeded',
          description: `Account is new (${health.accountAgeDays} days). Sent ${sentToday} messages today, exceeding safe limit of 15.`,
          action: 'Pause outreach and wait 24 hours before resuming',
          impact: 'high',
          priority: 1,
        });
      }

      if (health.qualityScore < 60) {
        recommendations.push({
          id: 'improve_templates',
          severity: 'warning',
          category: 'content',
          title: 'Message quality needs improvement',
          description: `Quality score is ${health.qualityScore}/100. Messages may appear spammy or repetitive.`,
          action: 'Switch to value-first templates with personalization',
          impact: 'high',
          priority: 2,
        });
      }

      if (health.replyRate < 30) {
        recommendations.push({
          id: 'low_engagement',
          severity: health.replyRate < 10 ? 'critical' : 'warning',
          category: 'engagement',
          title: 'Low reply rate detected',
          description: `Reply rate is ${health.replyRate}%. Contacts are not responding to messages.`,
          action: 'Review messaging approach and consider pausing for 48 hours',
          impact: 'high',
          priority: 2,
        });
      }

      if (health.blockScore < 70) {
        const blockedContacts = contacts.filter(c => c.status === 'blocked');
        recommendations.push({
          id: 'blocked_pattern',
          severity: 'critical',
          category: 'safety',
          title: 'Block/report rate elevated',
          description: `${blockedContacts.length} contacts have blocked the account. Safety score: ${health.blockScore}/100.`,
          action: 'Review blocked numbers pattern and pause outbound for 72 hours',
          impact: 'high',
          priority: 1,
        });
      }

      if (health.activityConsistency < 40) {
        recommendations.push({
          id: 'inconsistent_activity',
          severity: 'info',
          category: 'schedule',
          title: 'Inconsistent messaging activity',
          description: 'Activity pattern is irregular. Consistent daily outreach improves account reputation.',
          action: 'Maintain consistent daily messaging schedule within safe limits',
          impact: 'medium',
          priority: 3,
        });
      }

      const avgDelay = settings.antiBan?.messageDelay || { min: 2, max: 5 };
      if (avgDelay.max < 3 && health.score < 70) {
        recommendations.push({
          id: 'increase_delay',
          severity: 'warning',
          category: 'timing',
          title: 'Message delay too short',
          description: `Current max delay is ${avgDelay.max}s. For accounts with health score ${health.score}, longer delays are recommended.`,
          action: 'Increase delay between messages to 5-10 seconds',
          impact: 'medium',
          priority: 3,
        });
      }

      const recentCampaigns = this._getCampaigns().filter(c => {
        if (!c.timestamp) return false;
        return (Date.now() - new Date(c.timestamp).getTime()) < 3600000;
      });

      const messagesLastHour = recentCampaigns.reduce((sum, c) => {
        return sum + (c.results || []).filter(r => r.from === 'user' || r.from === 'ai').length;
      }, 0);

      if (messagesLastHour > 30) {
        recommendations.push({
          id: 'burst_detected',
          severity: 'critical',
          category: 'timing',
          title: 'Message burst detected',
          description: `${messagesLastHour} messages sent in the last hour. High burst patterns trigger WhatsApp restrictions.`,
          action: 'Pause outreach for 2-4 hours and resume with lower frequency',
          impact: 'high',
          priority: 1,
        });
      }

      if (health.score >= 80 && sentToday < health.maxDailyMessages * 0.5) {
        recommendations.push({
          id: 'safe_to_scale',
          severity: 'success',
          category: 'growth',
          title: 'Safe to increase volume',
          description: `Health score is ${health.score}/100. Account can safely handle more messages.`,
          action: `Gradually increase daily volume up to ${health.maxDailyMessages} messages`,
          impact: 'medium',
          priority: 4,
        });
      }

      recommendations.sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, info: 2, success: 3 };
        const sevA = severityOrder[a.severity] ?? 4;
        const sevB = severityOrder[b.severity] ?? 4;
        if (sevA !== sevB) return sevA - sevB;
        return a.priority - b.priority;
      });

      return {
        healthScore: health.score,
        totalRecommendations: recommendations.length,
        critical: recommendations.filter(r => r.severity === 'critical').length,
        warnings: recommendations.filter(r => r.severity === 'warning').length,
        recommendations,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return {
        healthScore: 0,
        totalRecommendations: 0,
        critical: 0,
        warnings: 0,
        recommendations: [],
        error: err.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  checkAutoPause() {
    try {
      const health = this.calculateAccountHealth();
      const messages = this._getAllMessages();
      const settings = this._getSettings();
      const now = Date.now();

      const pauseConditions = [];
      let shouldPause = false;

      if (health.score < 30) {
        shouldPause = true;
        pauseConditions.push({
          reason: 'Health score critically low',
          detail: `Account health score is ${health.score}/100, below critical threshold of 30.`,
          severity: 'critical',
        });
      }

      if (health.deliveryRate < 40) {
        shouldPause = true;
        pauseConditions.push({
          reason: 'Delivery rate critically low',
          detail: `Only ${health.deliveryRate}% of messages are being delivered.`,
          severity: 'critical',
        });
      }

      if (health.blockScore < 40) {
        shouldPause = true;
        pauseConditions.push({
          reason: 'Block rate critically high',
          detail: `Block/report safety score is ${health.blockScore}/100.`,
          severity: 'critical',
        });
      }

      const sentLast24h = messages.filter(m => {
        const msgTime = new Date(m.timestamp).getTime();
        return (now - msgTime) < 86400000 && (m.from === 'user' || m.from === 'ai');
      }).length;

      if (sentLast24h > health.maxDailyMessages * 1.5) {
        shouldPause = true;
        pauseConditions.push({
          reason: 'Daily volume exceeded safe limit',
          detail: `Sent ${sentLast24h} messages in 24h, exceeding ${Math.round(health.maxDailyMessages * 1.5)} safe maximum.`,
          severity: 'critical',
        });
      }

      const failedLastHour = messages.filter(m => {
        const msgTime = new Date(m.timestamp).getTime();
        return (now - msgTime) < 3600000 && m.status === 'failed';
      }).length;

      if (failedLastHour >= 5) {
        shouldPause = true;
        pauseConditions.push({
          reason: 'High failure rate in recent window',
          detail: `${failedLastHour} messages failed in the last hour.`,
          severity: 'critical',
        });
      }

      if (settings.monitoring?.autoPauseOnRisk && health.score < (settings.monitoring?.banRiskThreshold || 70)) {
        shouldPause = true;
        pauseConditions.push({
          reason: 'Auto-pause triggered by risk threshold',
          detail: `Health score ${health.score} is below configured risk threshold of ${settings.monitoring?.banRiskThreshold || 70}.`,
          severity: 'warning',
        });
      }

      const resumeConditions = [];
      if (shouldPause) {
        const lowestSeverity = pauseConditions.some(p => p.severity === 'critical') ? 'critical' : 'warning';
        const pauseHours = lowestSeverity === 'critical' ? 24 : 8;

        resumeConditions.push({
          condition: 'Health score recovery',
          description: `Health score must reach at least 50 (currently ${health.score}).`,
          metric: 'healthScore',
          threshold: 50,
          current: health.score,
        });
        resumeConditions.push({
          condition: 'Time elapsed',
          description: `Minimum ${pauseHours} hours pause time required.`,
          metric: 'pauseDurationHours',
          threshold: pauseHours,
          current: 0,
        });
        resumeConditions.push({
          condition: 'Delivery rate recovery',
          description: `Delivery rate must reach at least 70% (currently ${health.deliveryRate}%).`,
          metric: 'deliveryRate',
          threshold: 70,
          current: health.deliveryRate,
        });
      }

      const existingPause = this._pauseState;
      if (shouldPause && (!existingPause || existingPause.status === 'resumed')) {
        this._pauseState = {
          status: 'paused',
          pausedAt: new Date().toISOString(),
          pauseReasons: pauseConditions,
          resumeConditions,
          healthSnapshot: health,
        };
      } else if (!shouldPause && existingPause && existingPause.status === 'paused') {
        const allMet = resumeConditions.every(cond => {
          if (cond.metric === 'healthScore') return health.score >= cond.threshold;
          if (cond.metric === 'deliveryRate') return health.deliveryRate >= cond.threshold;
          if (cond.metric === 'pauseDurationHours') {
            const elapsed = (Date.now() - new Date(existingPause.pausedAt).getTime()) / 3600000;
            return elapsed >= cond.threshold;
          }
          return true;
        });

        if (allMet) {
          this._pauseState = {
            ...existingPause,
            status: 'resumed',
            resumedAt: new Date().toISOString(),
          };
        }
      }

      return {
        isPaused: this._pauseState?.status === 'paused',
        pauseState: this._pauseState,
        shouldPause,
        pauseConditions,
        resumeConditions,
        healthSnapshot: health,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return {
        isPaused: false,
        pauseState: null,
        shouldPause: false,
        pauseConditions: [],
        resumeConditions: [],
        healthSnapshot: null,
        error: err.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  getOutreachSchedule() {
    try {
      const campaigns = this._getCampaigns();
      const contacts = this._getContacts();
      const health = this.calculateAccountHealth();
      const settings = this._getSettings();

      const countryStats = {};
      for (const contact of contacts) {
        const country = contact.country || 'Unknown';
        if (!countryStats[country]) {
          countryStats[country] = { count: 0, phones: [], timezone: null, countryCode: null };
        }
        countryStats[country].count++;
        countryStats[country].phones.push(contact.phone);
      }

      for (const campaign of campaigns) {
        const cc = campaign.countryCode || 'Unknown';
        if (countryStats[cc]) {
          countryStats[cc].timezone = this._getTimezoneForCountry(cc);
        }
      }

      for (const [country, stats] of Object.entries(countryStats)) {
        if (!stats.timezone) {
          const firstPhone = stats.phones[0] || '';
          const phoneDigits = firstPhone.replace(/\D/g, '');
          for (const [cc, tz] of Object.entries(COUNTRY_TIMEZONE_MAP)) {
            if (phoneDigits.startsWith(cc)) {
              stats.timezone = tz;
              stats.countryCode = cc;
              break;
            }
          }
        }
        if (!stats.timezone) {
          stats.timezone = 'UTC';
        }
      }

      const hourlyMessageDistribution = {};
      for (let h = 0; h < 24; h++) hourlyMessageDistribution[h] = 0;

      for (const campaign of campaigns) {
        for (const result of campaign.results || []) {
          if (result.from === 'user' || result.from === 'ai') {
            const hour = new Date(result.timestamp).getHours();
            hourlyMessageDistribution[hour] = (hourlyMessageDistribution[hour] || 0) + 1;
          }
        }
      }

      const countrySchedules = {};
      for (const [country, stats] of Object.entries(countryStats)) {
        const tz = stats.timezone;
        const hours = BUSINESS_HOUR_RANGES[tz] || DEFAULT_BUSINESS_HOURS;

        const safeWindows = this._calculateSafeWindows(hours, hourlyMessageDistribution, health);

        const accountTier = this._getAccountAgeTier(
          campaigns.length > 0 ? campaigns.reduce((min, c) =>
            !c.timestamp || new Date(c.timestamp) > new Date(min) ? min : c.timestamp
          , campaigns[0].timestamp) : new Date().toISOString()
        );

        const maxDaily = Math.min(accountTier.maxDaily, Math.round(health.maxDailyMessages * (health.score / 100)));

        countrySchedules[country] = {
          country,
          timezone: tz,
          totalContacts: stats.count,
          businessHours: hours,
          safeWindows,
          recommendedDailyVolume: Math.min(maxDaily, stats.count),
          accountAgeTier: accountTier.label,
          restrictions: this._getScheduleRestrictions(health, accountTier, settings),
        };
      }

      const globalSafeWindows = this._calculateSafeWindows(
        DEFAULT_BUSINESS_HOURS,
        hourlyMessageDistribution,
        health
      );

      const nextOptimalWindow = this._findNextOptimalWindow(countrySchedules);

      return {
        healthScore: health.score,
        accountAgeTier: this._getAccountAgeTier(campaigns[0]?.timestamp || new Date().toISOString()).label,
        globalSafeWindows,
        countrySchedules,
        hourlyDistribution: hourlyMessageDistribution,
        totalContacts: contacts.length,
        nextOptimalWindow,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return {
        healthScore: 0,
        accountAgeTier: 'unknown',
        globalSafeWindows: [],
        countrySchedules: {},
        hourlyDistribution: {},
        totalContacts: 0,
        nextOptimalWindow: null,
        error: err.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  _getTimezoneForCountry(countryCode) {
    return COUNTRY_TIMEZONE_MAP[countryCode] || 'UTC';
  }

  _calculateSafeWindows(businessHours, hourlyDistribution, health) {
    const windows = [];
    const { start, end } = businessHours;

    const totalMessages = Object.values(hourlyDistribution).reduce((a, b) => a + b, 0);
    const avgPerHour = totalMessages / 24;

    for (let h = start; h < end; h++) {
      const hourMessages = hourlyDistribution[h] || 0;
      const intensity = avgPerHour > 0 ? hourMessages / avgPerHour : 1;
      const congestion = intensity > 1.5 ? 'high' : intensity > 0.8 ? 'medium' : 'low';

      let safetyRating = 'good';
      if (congestion === 'high' || health.score < 50) safetyRating = 'avoid';
      else if (congestion === 'medium' || health.score < 70) safetyRating = 'moderate';

      windows.push({
        hour: h,
        hourLabel: `${String(h).padStart(2, '0')}:00`,
        congestion,
        messageCount: hourMessages,
        safetyRating,
        recommendedDelay: health.score < 50 ? 10 : health.score < 70 ? 5 : 3,
      });
    }

    return windows;
  }

  _getScheduleRestrictions(health, accountTier, settings) {
    const restrictions = [];

    if (accountTier.label === 'new') {
      restrictions.push({
        type: 'volume_cap',
        description: 'New accounts limited to 15 messages/day for first 7 days',
        value: 15,
      });
    }

    if (health.score < 50) {
      restrictions.push({
        type: 'health_cap',
        description: `Health score ${health.score}/100 - volume reduced to ${Math.round(health.maxDailyMessages * 0.5)} messages/day`,
        value: Math.round(health.maxDailyMessages * 0.5),
      });
    }

    if (settings.rateLimiting?.enabled) {
      restrictions.push({
        type: 'rate_limit',
        description: `Rate limited to ${settings.rateLimiting.maxPerHour || 30}/hour, ${settings.rateLimiting.maxPerDay || 200}/day`,
        hourly: settings.rateLimiting.maxPerHour || 30,
        daily: settings.rateLimiting.maxPerDay || 200,
      });
    }

    if (settings.sessionSafety?.businessHoursOnly) {
      restrictions.push({
        type: 'business_hours',
        description: `Business hours only: ${settings.sessionSafety.businessHours?.start || '09:00'} - ${settings.sessionSafety.businessHours?.end || '18:00'}`,
        hours: settings.sessionSafety.businessHours || { start: '09:00', end: '18:00' },
      });
    }

    return restrictions;
  }

  _findNextOptimalWindow(countrySchedules) {
    const now = new Date();
    let bestWindow = null;
    let bestScore = -1;

    for (const schedule of Object.values(countrySchedules)) {
      for (const window of schedule.safeWindows) {
        if (window.safetyRating === 'avoid') continue;
        const windowHour = window.hour;
        const currentHour = now.getHours();
        let hoursUntil = windowHour - currentHour;
        if (hoursUntil <= 0) hoursUntil += 24;

        const score = (window.safetyRating === 'good' ? 3 : 2) - (hoursUntil / 24);
        if (score > bestScore) {
          bestScore = score;
          bestWindow = {
            country: schedule.country,
            timezone: schedule.timezone,
            hour: window.hour,
            hourLabel: window.hourLabel,
            hoursUntilWindow: hoursUntil,
            safetyRating: window.safetyRating,
            recommendedDelay: window.recommendedDelay,
          };
        }
      }
    }

    return bestWindow;
  }

  getDailyReport() {
    try {
      const health = this.calculateAccountHealth();
      const recommendations = this.getRecommendations();
      const autoPause = this.checkAutoPause();
      const schedule = this.getOutreachSchedule();
      const messages = this._getAllMessages();
      const contacts = this._getContacts();

      const today = new Date().toDateString();
      const todayMessages = messages.filter(m => new Date(m.timestamp).toDateString() === today);
      const todaySent = todayMessages.filter(m => m.from === 'user' || m.from === 'ai');
      const todayReceived = todayMessages.filter(m => m.from === 'them');
      const todayFailed = todayMessages.filter(m => m.status === 'failed');

      const yesterday = new Date(Date.now() - 86400000).toDateString();
      const yesterdayMessages = messages.filter(m => new Date(m.timestamp).toDateString() === yesterday);
      const yesterdaySent = yesterdayMessages.filter(m => m.from === 'user' || m.from === 'ai');
      const yesterdayReceived = yesterdayMessages.filter(m => m.from === 'them');

      const volumeChange = yesterdaySent.length > 0
        ? Math.round(((todaySent.length - yesterdaySent.length) / yesterdaySent.length) * 100)
        : 0;
      const replyChange = yesterdayReceived.length > 0
        ? Math.round(((todayReceived.length - yesterdayReceived.length) / yesterdayReceived.length) * 100)
        : 0;

      const topCountries = {};
      for (const contact of contacts) {
        const country = contact.country || 'Unknown';
        if (!topCountries[country]) topCountries[country] = { total: 0, sent: 0, received: 0 };
        topCountries[country].total++;
      }

      for (const msg of todayMessages) {
        const contact = contacts.find(c => {
          const normalized = (c.phone || '').replace(/\D/g, '');
          return msg.number?.replace(/\D/g, '') === normalized;
        });
        if (contact) {
          const country = contact.country || 'Unknown';
          if (!topCountries[country]) topCountries[country] = { total: 0, sent: 0, received: 0 };
          if (msg.from === 'user' || msg.from === 'ai') topCountries[country].sent++;
          if (msg.from === 'them') topCountries[country].received++;
        }
      }

      const sortedCountries = Object.entries(topCountries)
        .sort(([, a], [, b]) => b.total - a.total)
        .slice(0, 5)
        .map(([country, stats]) => ({ country, ...stats }));

      const journeyBreakdown = {
        new_lead: contacts.filter(c => c.journey === 'new_lead').length,
        contacted: contacts.filter(c => c.journey === 'contacted').length,
        interested: contacts.filter(c => c.journey === 'interested').length,
        negotiation: contacts.filter(c => c.journey === 'negotiation').length,
        converted: contacts.filter(c => c.journey === 'converted').length,
        closed: contacts.filter(c => c.journey === 'closed').length,
      };

      const recentMetrics = this._metricsHistory.slice(-24);
      const healthTrend = recentMetrics.length >= 2
        ? recentMetrics[recentMetrics.length - 1].score - recentMetrics[0].score
        : 0;

      return {
        date: today,
        health,
        summary: {
          messagesSentToday: todaySent.length,
          messagesReceivedToday: todayReceived.length,
          messagesFailedToday: todayFailed.length,
          deliveryRateToday: todaySent.length > 0
            ? Math.round(((todaySent.length - todayFailed.length) / todaySent.length) * 100)
            : 100,
          replyRateToday: todaySent.length > 0
            ? Math.round((todayReceived.length / todaySent.length) * 100)
            : 0,
          volumeChangeFromYesterday: volumeChange,
          replyChangeFromYesterday: replyChange,
          uniqueContactsMessaged: new Set(todaySent.map(m => m.number)).size,
        },
        trends: {
          healthTrend: healthTrend > 0 ? 'improving' : healthTrend < 0 ? 'declining' : 'stable',
          healthTrendDelta: healthTrend,
          dataPoints: recentMetrics.length,
        },
        topCountries: sortedCountries,
        journeyBreakdown,
        recommendations: recommendations.recommendations.slice(0, 5),
        autoPause: {
          isPaused: autoPause.isPaused,
          reasons: autoPause.pauseConditions.map(p => p.reason),
        },
        schedule: {
          nextOptimalWindow: schedule.nextOptimalWindow,
          totalContacts: schedule.totalContacts,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return {
        date: new Date().toDateString(),
        health: { score: 0, error: err.message },
        summary: {
          messagesSentToday: 0,
          messagesReceivedToday: 0,
          messagesFailedToday: 0,
          deliveryRateToday: 0,
          replyRateToday: 0,
          volumeChangeFromYesterday: 0,
          replyChangeFromYesterday: 0,
          uniqueContactsMessaged: 0,
        },
        trends: { healthTrend: 'unknown', healthTrendDelta: 0, dataPoints: 0 },
        topCountries: [],
        journeyBreakdown: {},
        recommendations: [],
        autoPause: { isPaused: false, reasons: [] },
        schedule: { nextOptimalWindow: null, totalContacts: 0 },
        error: err.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

module.exports = HealthMonitor;
