/**
 * financialChatIntentClassifier.js
 * =========================================
 * Classifies user questions into one of 16 allowlisted intents.
 * Extracts validated parameters.
 * Detects prompt injection attempts.
 *
 * SECURITY: All intents are from a fixed allowlist.
 * No arbitrary intent passes through.
 */

'use strict';

// ─── Allowlisted Intents ─────────────────────────────────────────────────────
const ALLOWED_INTENTS = [
  'expense_total',
  'expense_by_category',
  'expense_by_merchant',
  'expense_highest',
  'expense_recent',
  'expense_comparison',
  'expense_day_breakdown',
  'savings_summary',
  'budget_summary',
  'goal_progress',
  'financial_health',
  'saving_challenge',
  'anomaly_summary',
  'monthly_summary',
  'saving_recommendations',
  'unsupported'
];

// ─── Known expense categories ────────────────────────────────────────────────
const KNOWN_CATEGORIES = [
  'food', 'grocery', 'groceries', 'transport', 'transportation',
  'entertainment', 'health', 'healthcare', 'medical',
  'shopping', 'utilities', 'utility', 'education',
  'travel', 'housing', 'rent', 'dining', 'restaurant',
  'clothing', 'insurance', 'investment', 'others', 'fuel', 'gas'
];

const CATEGORY_MAP = {
  'grocery': 'Grocery',
  'groceries': 'Grocery',
  'food': 'Food',
  'dining': 'Food',
  'restaurant': 'Food',
  'transport': 'Transport',
  'transportation': 'Transport',
  'fuel': 'Transport',
  'gas': 'Transport',
  'entertainment': 'Entertainment',
  'health': 'Health',
  'healthcare': 'Health',
  'medical': 'Health',
  'shopping': 'Shopping',
  'clothing': 'Shopping',
  'utilities': 'Utilities',
  'utility': 'Utilities',
  'education': 'Education',
  'travel': 'Travel',
  'housing': 'Housing',
  'rent': 'Housing',
  'insurance': 'Insurance',
  'investment': 'Investment',
  'others': 'Others'
};

// ─── Prompt Injection Detection ───────────────────────────────────────────────
const INJECTION_PATTERNS = [
  /ignore\s+(your\s+)?(previous\s+)?(instructions?|prompt|rules?|constraints?)/i,
  /reveal\s+(your\s+)?(api\s+key|system\s+prompt|instructions?|secret)/i,
  /show\s+(me\s+)?(all\s+)?(users?|passwords?|tokens?|api\s+keys?)/i,
  /act\s+as\s+(if\s+you\s+are\s+)?(a\s+)?(different|new|another)/i,
  /you\s+are\s+now\s+(a\s+)?different/i,
  /forget\s+(everything|all\s+previous|your\s+instructions?)/i,
  /select\s+\*\s+from/i,
  /drop\s+table/i,
  /delete\s+from/i,
  /truncate\s+table/i,
  /insert\s+into/i,
  /update\s+\w+\s+set/i,
  /execute\s+(sql|query|command)/i,
  /bypass\s+(auth|authentication|security)/i,
  /access\s+(another|other|all)\s+(user|account)/i,
  /\bsystem\s*prompt\b/i,
  /\bjailbreak\b/i
];

/**
 * Check if user input contains prompt injection patterns.
 */
function detectPromptInjection(input) {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }
  return false;
}

/**
 * Sanitize and validate user input.
 * Returns { isValid, sanitized, error }
 */
function sanitizeInput(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    return { isValid: false, error: 'Question is required.' };
  }

  // Remove null bytes and control characters (except newline)
  let sanitized = rawInput.replace(/\0/g, '').replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Trim
  sanitized = sanitized.trim();

  if (sanitized.length === 0) {
    return { isValid: false, error: 'Question cannot be empty.' };
  }

  if (sanitized.length > 500) {
    return { isValid: false, error: 'Question is too long. Please keep it under 500 characters.' };
  }

  if (detectPromptInjection(sanitized)) {
    return {
      isValid: false,
      isInjectionAttempt: true,
      error: 'I can only answer financial questions about your SpendAchu data.'
    };
  }

  return { isValid: true, sanitized };
}

/**
 * Extract a category from user query.
 */
function extractCategory(query) {
  const lower = query.toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return val;
  }
  // Try capitalized version
  const capMatch = query.match(/\b(on|for|in|under|category)\s+([A-Z][a-zA-Z]+)\b/);
  if (capMatch) return capMatch[2];
  return null;
}

/**
 * Extract merchant from query.
 * Looks for patterns like "at Swiggy", "from Amazon", "in Zomato"
 */
function extractMerchant(query) {
  const merchantPatterns = [
    /\b(?:at|from|in|on|to)\s+([A-Z][a-zA-Z\s&]{1,50}?)(?:\?|$|\s+(?:this|last|in|for|between|and|the))/i,
    /\b(?:spent at|paid to|bought from|purchase from|order from)\s+([A-Z][a-zA-Z\s&]{1,50})/i,
    /(?:merchant|store|shop|vendor)\s+(?:called|named|is)\s+([a-zA-Z\s&]{1,50})/i
  ];

  for (const pattern of merchantPatterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      const merchant = match[1].trim().replace(/\s+/g, ' ');
      if (merchant.length >= 2 && merchant.length <= 100) {
        return merchant;
      }
    }
  }
  return null;
}

/**
 * Extract a limit number (for recent expenses).
 */
function extractLimit(query) {
  const patterns = [
    /(?:show|list|get|give)\s+(?:me\s+)?(?:the\s+)?(?:last|latest|recent)\s+(\d+)/i,
    /(\d+)\s+(?:latest|recent|last)\s+(?:expense|transaction)s?/i,
    /top\s+(\d+)/i
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match) {
      const n = parseInt(match[1]);
      if (n >= 1 && n <= 20) return n;
    }
  }
  return 5; // default
}

/**
 * Main intent classification function.
 * Returns { intent, params }
 */
function classifyIntent(query, conversationContext = {}) {
  const lower = query.toLowerCase();

  // 1. Anomaly / unusual
  if (/\b(anomal|unusual|suspicious|large\s+expense|high.value|alert|flag)/i.test(query)) {
    return { intent: 'anomaly_summary', params: {} };
  }

  // 2. Saving recommendations
  if (/\b(recomm|suggest|advice|tip|save\s+more|reduce\s+spend|cut\s+back|where\s+can\s+i\s+save|practical\s+saving)/i.test(query)) {
    return { intent: 'saving_recommendations', params: {} };
  }

  // 3. Financial health
  if (/\b(health\s+score|financial\s+health|health\s+report|score|why\s+did\s+my\s+score|which\s+area\s+needs)/i.test(query)) {
    return { intent: 'financial_health', params: {} };
  }

  // 4. Goal progress
  if (/\b(goal|target|saving\s+goal|progress|on\s+schedule|behind\s+schedule|how\s+much\s+more\s+(?:do\s+i\s+need|to\s+save))/i.test(query)) {
    return { intent: 'goal_progress', params: {} };
  }

  // 5. Saving challenge
  if (/\b(challenge|saving\s+challenge|my\s+challenge)/i.test(query)) {
    return { intent: 'saving_challenge', params: {} };
  }

  // 6. Budget summary
  if (/\b(budget|budget\s+remaining|budget\s+left|exceeded\s+budget|over\s+budget|close\s+to\s+limit|under\s+budget)/i.test(query)) {
    return { intent: 'budget_summary', params: {} };
  }

  // 7. Expense comparison
  if (/\b(compare|comparison|vs|versus|last\s+month\s+vs|this\s+month\s+vs|more\s+than\s+last|less\s+than\s+last|increased|decreased)/i.test(query)) {
    return { intent: 'expense_comparison', params: {} };
  }

  // 8. Monthly summary
  if (/\b(summary|overview|breakdown|month\s+in\s+review|financial\s+summary)/i.test(query)) {
    return { intent: 'monthly_summary', params: {} };
  }

  // 9. Savings summary
  if (/\b(sav(ings?|ed)|saving\s+rate|how\s+much\s+(did\s+i\s+save|i\s+saved)|savings\s+this|income)/i.test(query)) {
    return { intent: 'savings_summary', params: {} };
  }

  // 10. Day breakdown
  if (/\b(which\s+day|what\s+day|highest\s+day|most\s+expensive\s+day|day\s+did\s+i\s+spend)/i.test(query)) {
    return { intent: 'expense_day_breakdown', params: {} };
  }

  // 11. Recent expenses
  if (/\b(latest|recent|last\s+few|show\s+my\s+expenses?|list\s+expenses?|what\s+did\s+i\s+spend\s+on\b)/i.test(query) &&
      !/\b(month|week|year|today|yesterday|category)\b/.test(lower)) {
    return { intent: 'expense_recent', params: { limit: extractLimit(query) } };
  }

  // 12. Highest expense
  if (/\b(highest|biggest|largest|maximum|most\s+expensive)\s+(expense|transaction|purchase|spending)/i.test(query)) {
    return { intent: 'expense_highest', params: {} };
  }

  // 13. Expense by merchant
  const merchantAtPatterns = /\b(?:at|from)\s+[A-Z][a-zA-Z\s&]{1,30}/i;
  const hasMerchant = merchantAtPatterns.test(query) && extractMerchant(query);
  if (hasMerchant && /\b(spend|spent|paid|bought|purchased)/i.test(query)) {
    return { intent: 'expense_by_merchant', params: { merchant: extractMerchant(query) } };
  }

  // 14. Expense by category — check for known category + spending context
  const category = extractCategory(query);
  if (category && /\b(spend|spent|paid|expenses?|cost|how\s+much)/i.test(query)) {
    return { intent: 'expense_by_category', params: { category } };
  }

  // 15. Expense total (fallback for spending questions)
  if (/\b(how\s+much\s+did\s+i\s+spend|total\s+(expense|spending)|spent\s+(this|last|in|today|yesterday)|expense\s+total)/i.test(query)) {
    // Context inheritance: if previous intent was by_category, inherit
    if (conversationContext.previousIntent === 'expense_by_category' && conversationContext.previousCategory) {
      return {
        intent: 'expense_by_category',
        params: { category: conversationContext.previousCategory }
      };
    }
    return { intent: 'expense_total', params: {} };
  }

  // 16. Context-based fallback — "what about last month?" after expense question
  if (/\bwhat\s+about\b/.test(lower) || /\band\s+(last|this|in)\b/.test(lower)) {
    if (conversationContext.previousIntent && conversationContext.previousIntent !== 'unsupported') {
      return {
        intent: conversationContext.previousIntent,
        params: {
          category: conversationContext.previousCategory || null,
          merchant: conversationContext.previousMerchant || null,
          goalId: conversationContext.previousGoalId || null
        },
        inheritedContext: true
      };
    }
  }

  // Generic spending query
  if (/\b(spend|spent|expense|transaction|purchase|paid|cost)\b/i.test(query)) {
    return { intent: 'expense_total', params: {} };
  }

  return { intent: 'unsupported', params: {} };
}

/**
 * Validate and return a safe intent from the allowlist.
 */
function validateIntent(rawIntent) {
  if (ALLOWED_INTENTS.includes(rawIntent)) {
    return rawIntent;
  }
  return 'unsupported';
}

/**
 * Get suggested follow-up questions based on intent.
 */
function getSuggestedQuestions(intent, category = null) {
  const suggestions = {
    expense_total: [
      'Which category did I spend the most on?',
      'How does this compare to last month?',
      'How much budget is remaining?'
    ],
    expense_by_category: [
      `What was ${category ? category + ' spending' : 'my spending'} last month?`,
      'Which category increased the most?',
      'How much budget is remaining?'
    ],
    expense_by_merchant: [
      'What is my highest expense this month?',
      'Show my recent expenses.',
      'How much did I spend on Food?'
    ],
    expense_highest: [
      'Show my recent expenses.',
      'How much did I spend this month?',
      'Any unusual expenses?'
    ],
    expense_recent: [
      'How much did I spend this month?',
      'What is my highest spending category?',
      'How much budget is remaining?'
    ],
    expense_comparison: [
      'Which category increased the most?',
      'What is my savings rate?',
      'How much budget is remaining?'
    ],
    expense_day_breakdown: [
      'What is my highest expense?',
      'How much did I spend this month?',
      'Which category is highest?'
    ],
    savings_summary: [
      'How is my financial health?',
      'How are my financial goals progressing?',
      'How much did I spend this month?'
    ],
    budget_summary: [
      'Which categories are near the limit?',
      'How much did I spend this month?',
      'How can I reduce spending?'
    ],
    goal_progress: [
      'How much should I save per month?',
      'What is my savings rate?',
      'How is my financial health?'
    ],
    financial_health: [
      'Which area needs improvement?',
      'How much did I save this month?',
      'How are my financial goals?'
    ],
    saving_challenge: [
      'How much did I save this month?',
      'How are my financial goals?',
      'What is my savings rate?'
    ],
    anomaly_summary: [
      'How much did I spend this month?',
      'Show my recent expenses.',
      'What is my highest expense?'
    ],
    monthly_summary: [
      'How does this compare to last month?',
      'How much budget is remaining?',
      'How are my financial goals?'
    ],
    saving_recommendations: [
      'How much can I save this month?',
      'How much budget is remaining?',
      'What is my savings rate?'
    ],
    unsupported: [
      'How much did I spend this month?',
      'What is my highest spending category?',
      'How much budget is remaining?'
    ]
  };

  return suggestions[intent] || suggestions.unsupported;
}

module.exports = {
  sanitizeInput,
  classifyIntent,
  validateIntent,
  extractCategory,
  extractMerchant,
  extractLimit,
  getSuggestedQuestions,
  detectPromptInjection,
  ALLOWED_INTENTS
};
