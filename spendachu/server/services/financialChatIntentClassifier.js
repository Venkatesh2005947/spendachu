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
 * Normalize Tanglish (Tamil written in English) to English keywords
 * so the intent classifier can understand them.
 */
function normalizeTanglish(query) {
  let q = query;

  // ─── Date expressions ───────────────────────────────────────────────────────
  q = q.replace(/\binnikku\b/gi, 'today');
  q = q.replace(/\binniku\b/gi, 'today');
  q = q.replace(/\binna\b/gi, 'today');
  q = q.replace(/\bnethu\b/gi, 'yesterday');
  q = q.replace(/\bnethalikku\b/gi, 'yesterday');
  q = q.replace(/\bippo\b/gi, 'this month');
  q = q.replace(/\bthis\s+month\s+la\b/gi, 'this month');
  q = q.replace(/\blast\s+month\s+la\b/gi, 'last month');
  q = q.replace(/\bite\s+maasam\b/gi, 'this month');
  q = q.replace(/\bkadantha\s+maasam\b/gi, 'last month');
  q = q.replace(/\bite\s+vaaram\b/gi, 'this week');
  q = q.replace(/\bkadantha\s+vaaram\b/gi, 'last week');

  // ─── Spending / Expense keywords ────────────────────────────────────────────
  q = q.replace(/\bevlo\b/gi, 'how much');
  q = q.replace(/\bevvalo\b/gi, 'how much');
  q = q.replace(/\benna\s+amount\b/gi, 'how much');
  q = q.replace(/\bsearch\s+panni\b/gi, 'show');
  q = q.replace(/\bsollu\b/gi, 'tell me');
  q = q.replace(/\bsolla\b/gi, 'tell');
  q = q.replace(/\bkaatu\b/gi, 'show');
  q = q.replace(/\bkaattu\b/gi, 'show');
  q = q.replace(/\bpaarungo\b/gi, 'show');
  q = q.replace(/\bpaar\b/gi, 'show');
  q = q.replace(/\bvanginen\b/gi, 'spent');
  q = q.replace(/\bsela\s+pannen\b/gi, 'spent');
  q = q.replace(/\bsela\s+panninen\b/gi, 'spent');
  q = q.replace(/\bsela\s+pannuvom\b/gi, 'spending');
  q = q.replace(/\bselav\b/gi, 'expense');
  q = q.replace(/\bselavugal\b/gi, 'expenses');
  q = q.replace(/\bsela\b/gi, 'expense');
  q = q.replace(/\bspend\s+panninen\b/gi, 'spent');
  q = q.replace(/\bspend\s+pannen\b/gi, 'spent');
  q = q.replace(/\bspend\s+pannuvom\b/gi, 'spending');
  q = q.replace(/\bspend\s+panni\b/gi, 'spent');
  q = q.replace(/\bkoduthen\b/gi, 'paid');
  q = q.replace(/\bkodu\b/gi, 'paid');
  q = q.replace(/\bvangichen\b/gi, 'bought');
  q = q.replace(/\bvaanginaen\b/gi, 'bought');
  q = q.replace(/\bshopping\s+panni\b/gi, 'shopping spent');
  q = q.replace(/\btransaction\s+panni\b/gi, 'transactions');

  // ─── Savings keywords ────────────────────────────────────────────────────────
  q = q.replace(/\bsavings\s+sollu\b/gi, 'savings summary');
  q = q.replace(/\bsavings\s+pathi\b/gi, 'savings');
  q = q.replace(/\bsemippu\b/gi, 'savings');
  q = q.replace(/\bsemicchen\b/gi, 'saved');
  q = q.replace(/\bsemichu\b/gi, 'saved');
  q = q.replace(/\bsave\s+panninen\b/gi, 'saved');
  q = q.replace(/\bsave\s+panni\b/gi, 'saved');
  q = q.replace(/\bevlo\s+save\b/gi, 'how much saved');

  // ─── Budget keywords ─────────────────────────────────────────────────────────
  q = q.replace(/\bbudget\s+balance\b/gi, 'budget remaining');
  q = q.replace(/\bbudget\s+iruku\b/gi, 'budget remaining');
  q = q.replace(/\bbudget\s+michi\b/gi, 'budget remaining');
  q = q.replace(/\bbudget\s+exceed\s+pannitaen\b/gi, 'exceeded budget');
  q = q.replace(/\bbudget\s+pathi\b/gi, 'budget');
  q = q.replace(/\bbudget\s+sollu\b/gi, 'budget summary');
  q = q.replace(/\bbudget\s+kaatu\b/gi, 'budget summary');

  // ─── Goal keywords ───────────────────────────────────────────────────────────
  q = q.replace(/\bgoal\s+progress\s+kaatu\b/gi, 'goal progress');
  q = q.replace(/\bgoal\s+pathi\b/gi, 'goal progress');
  q = q.replace(/\bgoal\s+sollu\b/gi, 'goal progress');
  q = q.replace(/\blakshiyam\b/gi, 'goal');
  q = q.replace(/\blatchiyam\b/gi, 'goal');

  // ─── Financial health ─────────────────────────────────────────────────────────
  q = q.replace(/\bfinancial\s+health\s+sollu\b/gi, 'financial health score');
  q = q.replace(/\bhealth\s+score\s+enna\b/gi, 'financial health score');
  q = q.replace(/\ben\s+score\b/gi, 'my score');
  q = q.replace(/\bscore\s+enna\b/gi, 'what is my score');

  // ─── Comparison keywords ─────────────────────────────────────────────────────
  q = q.replace(/\bcompare\s+pannu\b/gi, 'compare');
  q = q.replace(/\bcompare\s+panni\b/gi, 'compare');
  q = q.replace(/\bkooduthal\b/gi, 'increased');
  q = q.replace(/\bkuaindhuchu\b/gi, 'decreased');
  q = q.replace(/\bkammi\b/gi, 'less');
  q = q.replace(/\bziyaadha\b/gi, 'more');
  q = q.replace(/\bjaasthi\b/gi, 'more');

  // ─── Summary keywords ────────────────────────────────────────────────────────
  q = q.replace(/\bsummary\s+sollu\b/gi, 'summary');
  q = q.replace(/\boverview\s+kaatu\b/gi, 'overview');
  q = q.replace(/\bummachi\b/gi, 'total');
  q = q.replace(/\bmotham\b/gi, 'total');
  q = q.replace(/\bkudukka\b/gi, 'give me');

  // ─── Recent expenses ────────────────────────────────────────────────────────
  q = q.replace(/\brecent\s+expenses\s+kaatu\b/gi, 'show recent expenses');
  q = q.replace(/\blatest\s+expenses\s+kaatu\b/gi, 'show latest expenses');

  // ─── Category keywords (Tamil) ───────────────────────────────────────────────
  q = q.replace(/\bsaapadu\b/gi, 'food');
  q = q.replace(/\bsapaad\b/gi, 'food');
  q = q.replace(/\bunavu\b/gi, 'food');
  q = q.replace(/\bpetrol\b/gi, 'transport');
  q = q.replace(/\bpayanam\b/gi, 'transport');

  return q;
}

/**
 * Detect if a query is in Tanglish (contains Tamil-flavored words mixed with English).
 */
function isTanglish(query) {
  const tanglishMarkers = [
    /\b(evlo|evvalo|sollu|solla|kaatu|kaattu|panninen|pannen|panni|koduthen|vangichen|sela|selav|semippu|michi|pathi|enna|ippo|innikku|inniku|nethu|maasam|vaaram|lakshiyam|latchiyam|motham|ziyaadha|jaasthi|kammi)\b/i
  ];
  return tanglishMarkers.some(p => p.test(query));
}

/**
 * Main intent classification function.
 * Returns { intent, params }
 */
function classifyIntent(query, conversationContext = {}) {
  // Normalize Tanglish before classifying
  const normalized = normalizeTanglish(query);
  const lower = normalized.toLowerCase();

  // 1. Anomaly / unusual
  if (/\b(anomal|unusual|suspicious|large\s+expense|high.value|alert|flag)/i.test(normalized)) {
    return { intent: 'anomaly_summary', params: {} };
  }

  // 2. Saving recommendations
  if (/\b(recomm|suggest|advice|tip|save\s+more|reduce\s+spend|cut\s+back|where\s+can\s+i\s+save|practical\s+saving)/i.test(normalized)) {
    return { intent: 'saving_recommendations', params: {} };
  }

  // 3. Financial health
  if (/\b(health\s+score|financial\s+health|health\s+report|score|why\s+did\s+my\s+score|which\s+area\s+needs)/i.test(normalized)) {
    return { intent: 'financial_health', params: {} };
  }

  // 4. Goal progress
  if (/\b(goal|target|saving\s+goal|progress|on\s+schedule|behind\s+schedule|how\s+much\s+more\s+(?:do\s+i\s+need|to\s+save))/i.test(normalized)) {
    return { intent: 'goal_progress', params: {} };
  }

  // 5. Saving challenge
  if (/\b(challenge|saving\s+challenge|my\s+challenge)/i.test(normalized)) {
    return { intent: 'saving_challenge', params: {} };
  }

  // 6. Budget summary
  if (/\b(budget|budget\s+remaining|budget\s+left|exceeded\s+budget|over\s+budget|close\s+to\s+limit|under\s+budget)/i.test(normalized)) {
    return { intent: 'budget_summary', params: {} };
  }

  // 7. Expense comparison
  if (/\b(compare|comparison|vs|versus|last\s+month\s+vs|this\s+month\s+vs|more\s+than\s+last|less\s+than\s+last|increased|decreased)/i.test(normalized)) {
    return { intent: 'expense_comparison', params: {} };
  }

  // 8. Monthly summary
  if (/\b(summary|overview|breakdown|month\s+in\s+review|financial\s+summary)/i.test(normalized)) {
    return { intent: 'monthly_summary', params: {} };
  }

  // 9. Savings summary
  if (/\b(sav(ings?|ed)|saving\s+rate|how\s+much\s+(did\s+i\s+save|i\s+saved)|savings\s+this|income)/i.test(normalized)) {
    return { intent: 'savings_summary', params: {} };
  }

  // 10. Day breakdown
  if (/\b(which\s+day|what\s+day|highest\s+day|most\s+expensive\s+day|day\s+did\s+i\s+spend)/i.test(normalized)) {
    return { intent: 'expense_day_breakdown', params: {} };
  }

  // 11. Recent expenses
  if (/\b(latest|recent|last\s+few|show\s+my\s+expenses?|list\s+expenses?|what\s+did\s+i\s+spend\s+on\b)/i.test(normalized) &&
      !/\b(month|week|year|today|yesterday|category)\b/.test(lower)) {
    return { intent: 'expense_recent', params: { limit: extractLimit(normalized) } };
  }

  // 12. Highest expense
  if (/\b(highest|biggest|largest|maximum|most\s+expensive)\s+(expense|transaction|purchase|spending)/i.test(normalized)) {
    return { intent: 'expense_highest', params: {} };
  }

  // 13. Expense by merchant
  const merchantAtPatterns = /\b(?:at|from)\s+[A-Z][a-zA-Z\s&]{1,30}/i;
  const hasMerchant = merchantAtPatterns.test(normalized) && extractMerchant(normalized);
  if (hasMerchant && /\b(spend|spent|paid|bought|purchased)/i.test(normalized)) {
    return { intent: 'expense_by_merchant', params: { merchant: extractMerchant(normalized) } };
  }

  // 14. Expense by category
  const category = extractCategory(normalized);
  if (category && /\b(spend|spent|paid|expenses?|cost|how\s+much)/i.test(normalized)) {
    return { intent: 'expense_by_category', params: { category } };
  }

  // 15. Expense total — broad natural language patterns
  if (/\b(how\s+much\s+did\s+i\s+spend|total\s+(expense|spending)|spent\s+(this|last|in|today|yesterday)|expense\s+total|how\s+much\s+today|today\s+(spending|expense)|today's\s+(spending|expense)|how\s+much\s+this\s+month|how\s+much\s+last\s+month|how\s+much\s+spent|my\s+spending|my\s+expense)/i.test(normalized)) {
    if (conversationContext.previousIntent === 'expense_by_category' && conversationContext.previousCategory) {
      return {
        intent: 'expense_by_category',
        params: { category: conversationContext.previousCategory }
      };
    }
    return { intent: 'expense_total', params: {} };
  }

  // 16. Context-based fallback
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

  // Generic spending query — matches spend/spending/spent/expenses/cost/paid/transaction
  if (/\b(spend(ing)?|spent|expenses?|transactions?|purchased?|paid|cost)\b/i.test(normalized)) {
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
  normalizeTanglish,
  isTanglish,
  ALLOWED_INTENTS
};
