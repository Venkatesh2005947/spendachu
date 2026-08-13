/**
 * financialChatAIProvider.js
 * =========================================
 * Multi-provider AI abstraction for response formatting.
 *
 * SECURITY:
 * - The AI model ONLY receives the verified financial result (numbers, not raw DB data).
 * - The AI model NEVER receives: JWT tokens, API keys, database schema, raw SQL,
 *   another user's data, system prompt details, or receipt images.
 * - AI call is non-blocking. Timeout falls back to deterministic response.
 * - The AI is ONLY used to format text — all calculations are done server-side.
 *
 * Supported providers:
 * - deterministic (default, always works, no external API)
 * - gemini (Google AI API)
 */

'use strict';

const https = require('https');

const PROVIDER = (process.env.FINANCIAL_ASSISTANT_PROVIDER || 'deterministic').toLowerCase();
const MODEL = process.env.FINANCIAL_ASSISTANT_MODEL || 'gemini-1.5-flash';
const API_KEY = process.env.FINANCIAL_ASSISTANT_API_KEY || '';
const TIMEOUT_MS = parseInt(process.env.FINANCIAL_ASSISTANT_TIMEOUT_MS || '10000');
const ENABLE_AI_FORMATTING = (process.env.ENABLE_AI_RESPONSE_FORMATTING || 'true') === 'true';

// ─── Deterministic Response Formatter ───────────────────────────────────────

/**
 * Convert a verified financial result into a clear, rule-based text response.
 * This is the fallback when AI is disabled or unavailable.
 */
function deterministic(intent, financialResult, period) {
  const periodLabel = period?.label || 'the selected period';

  try {
    switch (intent) {
      case 'expense_total': {
        if (!financialResult.hasEnoughData) return financialResult.friendlyMessage;
        return `You spent ${financialResult.totalFormatted} in ${periodLabel} across ${financialResult.transactionCount} transaction${financialResult.transactionCount !== 1 ? 's' : ''}.`;
      }

      case 'expense_by_category': {
        if (!financialResult.hasEnoughData) return financialResult.friendlyMessage;
        const top = financialResult.topCategory;
        if (!top) return `No category expenses found for ${periodLabel}.`;
        const lines = [`Here is your spending by category for ${periodLabel}:`];
        financialResult.categories.slice(0, 6).forEach(c => {
          lines.push(`• ${c.category}: ${c.totalFormatted} (${c.percentage}%, ${c.count} transaction${c.count !== 1 ? 's' : ''})`);
        });
        lines.push(`\nTotal: ${financialResult.grandTotalFormatted}`);
        return lines.join('\n');
      }

      case 'expense_by_merchant': {
        if (!financialResult.hasEnoughData) return financialResult.friendlyMessage;
        return `You spent ${financialResult.totalFormatted} at "${financialResult.merchant}" in ${periodLabel} across ${financialResult.transactionCount} transaction${financialResult.transactionCount !== 1 ? 's' : ''}.`;
      }

      case 'expense_highest': {
        if (!financialResult.hasEnoughData) return financialResult.friendlyMessage;
        const h = financialResult.highest;
        const merchantStr = h.merchant ? ` at ${h.merchant}` : '';
        return `Your highest expense in ${periodLabel} was ${h.amountFormatted}${merchantStr} on ${h.date} under ${h.category}.`;
      }

      case 'expense_recent': {
        if (!financialResult.hasEnoughData) return financialResult.friendlyMessage;
        const lines = [`Here are your ${financialResult.count} most recent expenses:`];
        financialResult.transactions.forEach(t => {
          const merchantStr = t.merchant ? ` at ${t.merchant}` : '';
          lines.push(`• ${t.date}: ${t.amountFormatted}${merchantStr} (${t.category})`);
        });
        return lines.join('\n');
      }

      case 'expense_comparison': {
        if (!financialResult.hasEnoughData) {
          return 'Not enough data to compare the two periods.';
        }
        const { currentPeriod, previousPeriod, comparison } = financialResult;
        const dir = comparison.direction;
        const arrow = dir === 'increase' ? '↑' : dir === 'decrease' ? '↓' : '→';
        return `Expense Comparison:\n• ${currentPeriod.label}: ${currentPeriod.totalFormatted} (${currentPeriod.transactionCount} transactions)\n• ${previousPeriod.label}: ${previousPeriod.totalFormatted} (${previousPeriod.transactionCount} transactions)\n\n${arrow} ${dir === 'unchanged' ? 'No change' : `${comparison.percentageChange !== null ? Math.abs(comparison.percentageChange) + '%' : ''} ${dir}`} (${comparison.differenceFormatted} ${dir})`;
      }

      case 'expense_day_breakdown': {
        if (!financialResult.hasEnoughData) return financialResult.friendlyMessage;
        const hd = financialResult.highestDay;
        return `Your highest spending day in ${periodLabel} was ${hd.date} with ${hd.totalFormatted} across ${hd.transactionCount} transaction${hd.transactionCount !== 1 ? 's' : ''}.`;
      }

      case 'savings_summary': {
        if (!financialResult.hasEnoughData) return financialResult.friendlyMessage;
        const rateStr = financialResult.savingsRate != null
          ? ` Your savings rate is ${financialResult.savingsRate}%.`
          : '';
        return `You saved ${financialResult.totalSavingsFormatted} in ${periodLabel} across ${financialResult.savingsCount} saving${financialResult.savingsCount !== 1 ? 's' : ''} entr${financialResult.savingsCount !== 1 ? 'ies' : 'y'}.${rateStr}`;
      }

      case 'budget_summary': {
        if (!financialResult.hasEnoughData) return financialResult.friendlyMessage;
        const exceeded = financialResult.isExceeded ? '🚨 Budget exceeded! ' : '';
        const lines = [
          `${exceeded}Budget Summary for ${financialResult.year}-${String(financialResult.month).padStart(2, '0')}:`,
          `• Monthly budget: ${financialResult.globalBudgetFormatted}`,
          `• Total spent: ${financialResult.totalSpentFormatted} (${financialResult.budgetUsedPercent}%)`,
          `• Remaining: ${financialResult.remainingFormatted}`
        ];
        if (financialResult.nearLimitCategories?.length > 0) {
          lines.push(`\n⚠️ Near limit: ${financialResult.nearLimitCategories.map(c => c.category).join(', ')}`);
        }
        if (financialResult.exceededCategories?.length > 0) {
          lines.push(`🚨 Exceeded: ${financialResult.exceededCategories.map(c => c.category).join(', ')}`);
        }
        return lines.join('\n');
      }

      case 'goal_progress': {
        if (!financialResult.hasEnoughData) return financialResult.friendlyMessage;
        if (financialResult.goals.length === 0) return 'You have no financial goals yet.';
        const lines = [`Your Financial Goals (${financialResult.activeCount} active, ${financialResult.completedCount} completed):`];
        financialResult.goals.slice(0, 5).forEach(g => {
          const monthlyStr = g.monthlyNeeded ? ` — save ${g.monthlyNeededFormatted}/month` : '';
          lines.push(`• ${g.name}: ${g.savedFormatted} / ${g.targetFormatted} (${g.progressPercent}%)${monthlyStr}`);
        });
        return lines.join('\n');
      }

      case 'financial_health': {
        if (!financialResult.hasEnoughData) {
          return financialResult.friendlyMessage || 'Not enough data to calculate your financial health score yet.';
        }
        const lines = [
          `Your Financial Health Score: ${financialResult.totalScore}/100 — ${financialResult.level}`,
          '',
          'Component breakdown:',
          `• Budget Control: ${financialResult.components?.budgetControl?.score || 0}/30`,
          `• Savings Habit: ${financialResult.components?.savingsHabit?.score || 0}/25`,
          `• Spending Control: ${financialResult.components?.spendingControl?.score || 0}/20`,
          `• Goal Progress: ${financialResult.components?.goalProgress?.score || 0}/15`,
          `• Tracking Consistency: ${financialResult.components?.trackingConsistency?.score || 0}/10`
        ];
        if (financialResult.suggestions?.length > 0) {
          lines.push('\nTop Suggestions:');
          financialResult.suggestions.slice(0, 2).forEach(s => lines.push(`• ${s}`));
        }
        return lines.join('\n');
      }

      case 'saving_challenge': {
        if (!financialResult.hasEnoughData) return financialResult.friendlyMessage;
        const c = financialResult.challenge;
        return `Current Challenge: "${c.name}"\nProgress: ${c.progressPercent}% (${c.savedAmount ? '₹' + c.savedAmount.toLocaleString('en-IN') : '₹0'} / ${c.targetAmount ? '₹' + c.targetAmount.toLocaleString('en-IN') : '₹0'})`;
      }

      case 'anomaly_summary': {
        if (!financialResult.hasEnoughData) return `No unusual or large expenses found in ${periodLabel}.`;
        if (financialResult.anomalyCount === 0) return `No unusual large expenses (≥₹50,000) found in ${periodLabel}. Your spending looks normal.`;
        const lines = [`Found ${financialResult.anomalyCount} large transaction${financialResult.anomalyCount !== 1 ? 's' : ''} in ${periodLabel} (≥₹50,000):`];
        financialResult.anomalies.slice(0, 5).forEach(a => {
          lines.push(`• ${a.date}: ${a.amountFormatted} — ${a.category}${a.merchant ? ' at ' + a.merchant : ''}`);
        });
        return lines.join('\n');
      }

      case 'monthly_summary': {
        if (!financialResult.hasEnoughData) return `No financial data found for ${periodLabel}.`;
        const lines = [
          `Financial Summary — ${financialResult.label}:`,
          `• Total Expenses: ${financialResult.totalExpensesFormatted}`,
          `• Total Savings: ${financialResult.totalSavingsFormatted}`
        ];
        if (financialResult.savingsRate != null) {
          lines.push(`• Savings Rate: ${financialResult.savingsRate}%`);
        }
        if (financialResult.budget) {
          lines.push(`• Budget Used: ${financialResult.budget.usedPercent}% (${financialResult.budget.isExceeded ? '🚨 Exceeded' : `${financialResult.totalExpensesFormatted} of ${financialResult.budget.global ? '₹' + Number(financialResult.budget.global).toLocaleString('en-IN') : 'not set'}` })`);
        }
        if (financialResult.topCategory) {
          lines.push(`• Top Category: ${financialResult.topCategory.category} (${financialResult.topCategory.totalFormatted})`);
        }
        if (financialResult.activeGoals > 0) {
          lines.push(`• Active Goals: ${financialResult.activeGoals}`);
        }
        return lines.join('\n');
      }

      case 'saving_recommendations': {
        if (!financialResult.hasEnoughData) return 'Not enough data to generate saving recommendations yet. Log more expenses!';
        const lines = ['Here are your personalized saving recommendations:'];
        financialResult.recommendations.forEach((r, i) => {
          lines.push(`\n${i + 1}. ${r.reason}`);
          lines.push(`   📊 ${r.metric}`);
          lines.push(`   ✅ ${r.action}`);
          if (r.potentialSaving) lines.push(`   💰 Potential saving: ${r.potentialSaving}`);
        });
        if (financialResult.disclaimer) {
          lines.push(`\n⚠️ ${financialResult.disclaimer}`);
        }
        return lines.join('\n');
      }

      case 'unsupported':
      default:
        return "I can answer questions about your expenses, savings, budget, financial goals, health score, and more. Try asking:\n• \"How much did I spend this month?\"\n• \"What is my highest spending category?\"\n• \"How much budget is remaining?\"";
    }
  } catch (err) {
    console.error('[FinancialChat] Deterministic formatter error:', err.message);
    return 'Your financial data has been analyzed. Please check the details above.';
  }
}

// ─── Gemini API Call ─────────────────────────────────────────────────────────

/**
 * Build a minimal, safe prompt for Gemini.
 * Contains ONLY verified financial results — no raw DB data, no schema, no SQL.
 */
function buildGeminiPrompt(intent, financialResult, period, userQuestion) {
  // Sanitize user question before sending to external API
  const safeQuestion = (userQuestion || '')
    .substring(0, 200)
    .replace(/[<>{}[\]]/g, '');

  // Detect if question is in Tanglish
  const tanglishMarkers = /\b(evlo|evvalo|sollu|solla|kaatu|kaattu|panninen|pannen|panni|koduthen|vangichen|sela|selav|semippu|michi|pathi|enna|ippo|innikku|inniku|nethu|maasam|vaaram|lakshiyam|motham|jaasthi|kammi)\b/i;
  const isInTanglish = tanglishMarkers.test(userQuestion || '');

  const languageInstruction = isInTanglish
    ? `The user asked in Tanglish (Tamil mixed with English). Reply naturally in Tanglish — use simple Tamil words mixed with English numbers and financial terms. Example style: "Neenga ₹2,450 spend panninga this month la. Food category la jaasthi sela pannirukeenga." Keep it friendly and short.`
    : `Reply in clear English in 2-3 sentences.`;

  const systemInstruction = `You are SpendAchu's friendly financial assistant. 
Your task: convert the following verified financial data into a clear, friendly response.
Rules:
- Use ONLY the numbers provided. Do NOT invent, estimate, or add new figures.
- Use Indian Rupee formatting (₹1,23,456).
- Be concise and helpful.
- Do NOT mention database, SQL, or technical details.
- If data says hasEnoughData is false, report the friendlyMessage as-is.
- ${languageInstruction}`;

  const dataContext = JSON.stringify({
    intent,
    period: period?.label || 'selected period',
    result: financialResult
  }, null, 2);

  return {
    system: systemInstruction,
    user: `User question: "${safeQuestion}"\n\nVerified financial data:\n${dataContext}\n\nPlease provide a clear, friendly response using only these numbers.`
  };
}

/**
 * Call Gemini API with timeout.
 */
function callGemini(prompt) {
  return new Promise((resolve, reject) => {
    if (!API_KEY) {
      return reject(new Error('Gemini API key not configured'));
    }

    const requestBody = JSON.stringify({
      contents: [
        {
          parts: [
            { text: `${prompt.system}\n\n${prompt.user}` }
          ]
        }
      ],
      generationConfig: {
        maxOutputTokens: 300,
        temperature: 0.1  // Low temperature for accuracy
      }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            resolve(text.trim());
          } else {
            reject(new Error('Empty response from Gemini'));
          }
        } catch (e) {
          reject(new Error('Failed to parse Gemini response'));
        }
      });
    });

    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy(new Error('Gemini API timeout'));
    });

    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

// ─── Main Provider Function ───────────────────────────────────────────────────

/**
 * Format a financial result as a human-readable response.
 * Falls back to deterministic if AI is unavailable or disabled.
 *
 * @param {string} intent - Classified intent
 * @param {object} financialResult - Verified result from analytics service
 * @param {object} period - { startDate, endDate, label }
 * @param {string} userQuestion - Original user question (sanitized)
 * @returns {Promise<string>} - Formatted response
 */
async function formatResponse(intent, financialResult, period, userQuestion) {
  // Always compute deterministic response as baseline
  const deterministicAnswer = deterministic(intent, financialResult, period);

  // Return deterministic if AI formatting is disabled or provider is deterministic
  if (!ENABLE_AI_FORMATTING || PROVIDER === 'deterministic') {
    return deterministicAnswer;
  }

  // Try Gemini formatting
  if (PROVIDER === 'gemini' && API_KEY) {
    try {
      const prompt = buildGeminiPrompt(intent, financialResult, period, userQuestion);
      const aiAnswer = await callGemini(prompt);
      if (aiAnswer && aiAnswer.length > 10) {
        return aiAnswer;
      }
    } catch (err) {
      console.warn('[FinancialChat] AI formatting failed, using deterministic fallback:', err.message);
    }
  }

  // Fallback
  return deterministicAnswer;
}

/**
 * Get provider status info.
 */
function getProviderStatus() {
  return {
    provider: PROVIDER,
    aiEnabled: ENABLE_AI_FORMATTING && PROVIDER !== 'deterministic',
    model: PROVIDER !== 'deterministic' ? MODEL : 'deterministic',
    hasApiKey: !!API_KEY,
    timeoutMs: TIMEOUT_MS
  };
}

module.exports = {
  formatResponse,
  deterministic,
  getProviderStatus
};
