/**
 * ai.js
 * Intelligent client-side AI helper for Personal Expense Tracker.
 * Performs NLP keyword-based auto-categorization and advanced heuristic analytics.
 */

// Category keywords vocabulary
const KEYWORD_MAP = {
  Food: [
    'grocery', 'groceries', 'food', 'dinner', 'lunch', 'breakfast', 'starbucks', 
    'coffee', 'restaurant', 'cafe', 'pizza', 'burger', 'sushi', 'eat', 'eats', 
    'swiggy', 'zomato', 'bakery', 'supermarket', 'diner', 'subway store', 'mcdonald'
  ],
  Transport: [
    'uber', 'cab', 'taxi', 'lyft', 'petrol', 'gas', 'diesel', 'fuel', 'metro', 
    'subway', 'train', 'flight', 'airline', 'bus', 'toll', 'parking', 'commute',
    'transit', 'railway', 'locomotive'
  ],
  Rent: [
    'rent', 'apartment', 'house rent', 'roommate', 'landlord', 'flat rent', 'lease',
    'mortgage', 'maintenance charge'
  ],
  Shopping: [
    'amazon', 'flipkart', 'mall', 'clothes', 'shirt', 'shoe', 'pant', 'target', 
    'walmart', 'nike', 'adidas', 'gadget', 'electronics', 'purchase', 'ebay',
    'ikea', 'furniture', 'gift', 'boutique'
  ],
  Bills: [
    'electricity', 'water', 'wifi', 'internet', 'phone bill', 'gas bill', 
    'subscription', 'youtube premium', 'spotify', 'netflix', 'prime video', 
    'mobile bill', 'recharge', 'insurance', 'tax', 'mobile recharge'
  ],
  Entertainment: [
    'movie', 'cinema', 'theatre', 'club', 'concert', 'game', 'steam', 'playstation', 
    'xbox', 'pub', 'bar', 'party', 'bowling', 'museum', 'park', 'amusement', 
    'show', 'gaming', 'arcade', 'drinks'
  ]
};

export const aiService = {
  /**
   * Predict expense category based on its description
   * @param {string} description 
   * @returns {string|null} Predicted category
   */
  predictCategory(description) {
    if (!description) return null;
    const cleanDesc = description.toLowerCase().trim();
    
    // Match exact phrase or token matches
    for (const [category, keywords] of Object.entries(KEYWORD_MAP)) {
      for (const keyword of keywords) {
        if (cleanDesc.includes(keyword)) {
          return category;
        }
      }
    }
    
    return null; // Return null if no matching category keyword found
  },

  /**
   * Parses natural language sentences into expense parameters.
   * @param {string} text 
   * @returns {Object|null}
   */
  parseNaturalLanguageExpense(text) {
    if (!text) return null;
    const cleanText = text.toLowerCase().trim();

    // 1. Extract Amount
    let amount = null;
    const amountRegex = /(?:rs\.?|rupees?|\$|₹)?\s*(\d+(?:\.\d{1,2})?)\s*(?:rs\.?|rupees?|\$|₹)?/gi;
    let match;
    while ((match = amountRegex.exec(cleanText)) !== null) {
      const val = parseFloat(match[1]);
      if (val > 0) {
        amount = val;
        break; 
      }
    }

    // 2. Extract Payment Method
    let paymentMethod = 'Cash'; // Default
    if (/\b(card|credit|debit|visa|mastercard|swipe)\b/i.test(cleanText)) {
      paymentMethod = 'Card';
    } else if (/\b(upi|gpay|google pay|paytm|phonepe|online|netbanking|bank)\b/i.test(cleanText)) {
      paymentMethod = 'UPI';
    }

    // 3. Extract Date
    let date = new Date().toISOString().split('T')[0]; // Default: today
    if (/\byesterday\b/i.test(cleanText)) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      date = yesterday.toISOString().split('T')[0];
    } else if (/\bday before yesterday\b/i.test(cleanText)) {
      const dbYesterday = new Date();
      dbYesterday.setDate(dbYesterday.getDate() - 2);
      date = dbYesterday.toISOString().split('T')[0];
    } else if (/\b(last week|a week ago)\b/i.test(cleanText)) {
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      date = lastWeek.toISOString().split('T')[0];
    }

    // 4. Extract Category and Description
    let descClean = text;
    // Remove amount text
    descClean = descClean.replace(/(?:rs\.?|rupees?|\$|₹)?\s*\d+(?:\.\d{1,2})?\s*(?:rs\.?|rupees?|\$|₹)?/gi, '');
    // Remove grammatical structures
    descClean = descClean.replace(/\b(spent|paid|for|on|by|using|with|of|bought|purchased)\b/gi, '');
    // Remove payment methods
    descClean = descClean.replace(/\b(card|credit|debit|visa|mastercard|swipe|upi|gpay|google pay|paytm|phonepe|online|netbanking|bank|cash|hand)\b/gi, '');
    // Remove date keywords
    descClean = descClean.replace(/\b(today|yesterday|day before yesterday|last week|a week ago)\b/gi, '');
    // Clean whitespace
    descClean = descClean.replace(/\s+/g, ' ').trim();

    let description = descClean || "Expense";
    let category = this.predictCategory(description) || 'Others';

    return {
      amount,
      description,
      date,
      category,
      paymentMethod
    };
  },

  /**
   * Analyzes user expenses and budgets to generate smart dashboard insights.
   * @param {Array} expenses 
   * @param {Object} budgets 
   * @returns {Object} AI report with summaries and custom tips
   */
  generateInsights(expenses, budgets) {
    if (!expenses || expenses.length === 0) {
      return {
        summary: "Wow! Zero expenses! Keep your savings growing like a champ! 😇",
        tips: [
          "Set up category budgets in the 'Budgeting' settings so you don't overspend!",
          "Pro-tip: type 'Swiggy pizza' or 'Uber auto' and watch our AI categorise it instantly!"
        ],
        highestCategory: "None",
        comparisonText: "No data yet, start tracking!",
        hasAlerts: false,
        alerts: []
      };
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // 1. Group expenses by current month and previous month
    const thisMonthExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const lastMonthExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      const lm = currentMonth === 0 ? 11 : currentMonth - 1;
      const ly = currentMonth === 0 ? currentYear - 1 : currentYear;
      return d.getMonth() === lm && d.getFullYear() === ly;
    });

    const thisMonthTotal = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const lastMonthTotal = lastMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

    // 2. Group current month by category
    const categoryTotals = {};
    thisMonthExpenses.forEach(e => {
      const catKey = e.category.startsWith('Others') ? 'Others' : e.category;
      categoryTotals[catKey] = (categoryTotals[catKey] || 0) + e.amount;
    });

    // 3. Find highest category
    let highestCat = "None";
    let highestAmt = 0;
    Object.entries(categoryTotals).forEach(([cat, amt]) => {
      if (amt > highestAmt) {
        highestAmt = amt;
        highestCat = cat;
      }
    });

    // 4. Calculate month-over-month comparison
    let comparisonText = "";
    let percentChange = 0;
    if (lastMonthTotal > 0) {
      percentChange = ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;
      if (percentChange > 0) {
        comparisonText = `Your monthly spending is ${percentChange.toFixed(0)}% higher than last month (Spent ₹${thisMonthTotal.toFixed(0)} vs ₹${lastMonthTotal.toFixed(0)})!`;
      } else if (percentChange < 0) {
        comparisonText = `Nice! Your spending decreased by ${Math.abs(percentChange).toFixed(0)}% compared to last month (Spent ₹${thisMonthTotal.toFixed(0)} vs ₹${lastMonthTotal.toFixed(0)})!`;
      } else {
        comparisonText = `Your spending is exactly identical to last month (Spent ₹${thisMonthTotal.toFixed(0)}).`;
      }
    } else {
      comparisonText = `This month's damage is ₹${thisMonthTotal.toFixed(0)}. Keep tracking!`;
    }

    // 5. Generate active budget alerts
    const alerts = [];
    const globalLimit = budgets.global || 30000;
    if (thisMonthTotal >= globalLimit) {
      alerts.push({
        type: 'danger',
        message: `🚨 Global Budget Blown! ₹${thisMonthTotal.toFixed(0)} out of ₹${globalLimit} spent! Stop spending!`
      });
    } else if (thisMonthTotal >= globalLimit * 0.8) {
      alerts.push({
        type: 'warning',
        message: `⚠️ Danger Zone Approaching! Spent ${(thisMonthTotal / globalLimit * 100).toFixed(0)}% of your monthly limit!`
      });
    }

    // Category budget alerts
    Object.keys(budgets).forEach(cat => {
      if (cat === 'global') return;
      const catLimit = budgets[cat];
      const catSpent = categoryTotals[cat] || 0;
      if (catLimit > 0) {
        if (catSpent >= catLimit) {
          alerts.push({
            type: 'danger',
            message: `🚨 Over budget in ${cat}! Spent ₹${catSpent.toFixed(0)} of ₹${catLimit}. Pocket is blank!`
          });
        } else if (catSpent >= catLimit * 0.8) {
          alerts.push({
            type: 'warning',
            message: `⚠️ Warning in ${cat}! Used ${(catSpent / catLimit * 100).toFixed(0)}% of limit.`
          });
        }
      }
    });

    // 6. Generate dynamic savings advice & tips based on spending
    const tips = [];
    if (highestCat !== "None" && categoryTotals[highestCat] > 0) {
      if (highestCat === 'Food') {
        tips.push("💡 **Wallet Rule**: Cut down on daily restaurant runs. Time to learn to cook noodles! 🍜");
      } else if (highestCat === 'Transport') {
        tips.push("💡 **Wallet Rule**: Petrol is liquid gold! Walk or use public transit when you can. 🚶‍♂️");
      } else if (highestCat === 'Shopping') {
        tips.push("💡 **Wallet Rule**: Wait 48 hours before checking out your cart. Avoid impulsive shopping! 🛒");
      } else if (highestCat === 'Bills') {
        tips.push("💡 **Wallet Rule**: Netflix, Spotify, Prime... unsubscribe from unused services! 📺");
      } else if (highestCat === 'Entertainment') {
        tips.push("💡 **Wallet Rule**: Skip expensive clubs. Try potlucks or park walks! 🌳");
      }
    }

    if (thisMonthTotal > globalLimit * 0.5) {
      tips.push("💡 **Meme Warning**: Spending crossed 50%! Leaving the safe zone! Start controlling now. ⚠️");
    } else {
      tips.push("💡 **Meme Warning**: Super! Your wallet is under control at this rate! 👍");
    }

    // Construct primary AI summary sentence (Funny, one-liner)
    let summary = `Ayyayo Kaasu Pochu! Total Spent: ₹${thisMonthTotal.toFixed(0)}. `;
    if (highestCat !== "None" && highestCat !== "undefined") {
      const catSpent = categoryTotals[highestCat] || 0;
      if (highestCat === 'Food') {
        summary += `Swiggy and Zomato are eating your savings! There is a massive hole in your wallet! 🍕`;
      } else if (highestCat === 'Transport') {
        summary += `The Uber driver is going to hang your picture on his wall! Heavy damage on transport! 🚗`;
      } else if (highestCat === 'Rent') {
        summary += `Rent paid! Your landlord is buying treats, but you have an empty plate! 🏠`;
      } else if (highestCat === 'Shopping') {
        summary += `Amazon boxes are piling up at your door, and your savings box is crying! 🛍️`;
      } else if (highestCat === 'Bills') {
        summary += `Electricity, wifi, subscriptions... these bills are eating you alive! ⚡`;
      } else if (highestCat === 'Entertainment') {
        summary += `Heavy damage on socials and entertainment! Your pocket is crying! 🎬`;
      } else {
        summary += `Highest damage is in ${highestCat} (₹${catSpent.toFixed(0)}). Your pocket is crying! 💸`;
      }
    } else {
      summary += "So far, your wallet is in the safe zone! Keep it up! 🛡️";
    }

    return {
      summary,
      tips,
      highestCategory: highestCat,
      comparisonText,
      hasAlerts: alerts.length > 0,
      alerts
    };
  },

  /**
   * Generates a daily spending forecast trajectory for the current month.
   * @param {Array} expenses 
   * @param {Object} budgets 
   * @returns {Object} Forecast line data and summary
   */
  getSpendingForecast(expenses, budgets) {
    if (!expenses || expenses.length === 0) {
      return { forecastData: [], isProjectedOverBudget: false, projectedTotal: 0 };
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const todayDate = now.getDate();

    // Filter current month expenses
    const thisMonthExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    // Group current month spending by day (1 to todayDate)
    const dailySpend = {};
    thisMonthExpenses.forEach(e => {
      const day = new Date(e.date).getDate();
      dailySpend[day] = (dailySpend[day] || 0) + e.amount;
    });

    // Calculate cumulative sum so far
    let cumulativeSum = 0;
    const actualLine = [];
    for (let day = 1; day <= todayDate; day++) {
      cumulativeSum += (dailySpend[day] || 0);
      actualLine.push({ day, actual: cumulativeSum });
    }

    // Forecast velocity (average daily spending)
    const averageVelocity = cumulativeSum / todayDate;
    
    // Project until the end of the month
    const forecastData = [];
    
    // Include actual data in forecast line up to today
    for (let day = 1; day <= todayDate; day++) {
      let actualVal = actualLine[day - 1].actual;
      forecastData.push({
        day,
        actual: actualVal,
        projected: actualVal
      });
    }

    // Project days from today + 1 to end of month
    let projectedSum = cumulativeSum;
    for (let day = todayDate + 1; day <= daysInMonth; day++) {
      projectedSum += averageVelocity;
      forecastData.push({
        day,
        projected: Math.round(projectedSum)
      });
    }

    const globalLimit = budgets.global || 30000;
    const isProjectedOverBudget = projectedSum > globalLimit;

    return {
      forecastData,
      isProjectedOverBudget,
      projectedTotal: Math.round(projectedSum),
      averageDailySpend: Math.round(averageVelocity)
    };
  },

  /**
   * Generates savings challenges dynamically based on spending categories.
   * @param {Array} expenses 
   * @returns {Array} Challenges with recommendations
   */
  getSavingsChallenges(expenses) {
    const challenges = [
      {
        id: 'food_fast',
        title: 'Noodle Week 🍜',
        description: 'Do not spend money on food delivery or restaurants for the next 5 days.',
        category: 'Food',
        targetDays: 5,
        targetSavings: 1500,
        rewardBadge: 'Master Chef 🍳'
      },
      {
        id: 'shopping_freeze',
        title: 'Cart Lockout 🔒',
        description: 'Do not buy anything from online shopping malls for 7 days.',
        category: 'Shopping',
        targetDays: 7,
        targetSavings: 2500,
        rewardBadge: 'Ascetic Monk 🧘‍♂️'
      },
      {
        id: 'transport_walk',
        title: 'Eco Walker 🚶‍♂️',
        description: 'Walk or cycle for short distances instead of calling an Uber for 3 days.',
        category: 'Transport',
        targetDays: 3,
        targetSavings: 600,
        rewardBadge: 'Carbon Cutter 🍃'
      },
      {
        id: 'entertainment_home',
        title: 'Living Room Cinema 🍿',
        description: 'Skip going out to movies or bars this weekend; host a home movie night instead.',
        category: 'Entertainment',
        targetDays: 2,
        targetSavings: 1000,
        rewardBadge: 'Couch Potato 🥔'
      }
    ];

    if (!expenses || expenses.length === 0) {
      return challenges.map(c => ({ ...c, isRecommended: false }));
    }

    // Mark challenges as recommended if the user spends highly in that category
    const categoryTotals = {};
    expenses.forEach(e => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });

    let highestCat = null;
    let highestAmt = 0;
    Object.entries(categoryTotals).forEach(([cat, amt]) => {
      if (amt > highestAmt) {
        highestAmt = amt;
        highestCat = cat;
      }
    });

    return challenges.map(c => ({
      ...c,
      isRecommended: c.category === highestCat
    }));
  }
};
