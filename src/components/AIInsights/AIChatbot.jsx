import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Sparkles, User, HelpCircle } from 'lucide-react';
import { dbService } from '../../services/db';

export default function AIChatbot({ expenses, budgets }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: "Hello! I'm Achu, your AI Financial Advisor. Ask me anything about your spending, budget status, or savings goals! 💸",
      timestamp: Date.now()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const quickQuestions = [
    "How much did I spend this month?",
    "Am I over budget?",
    "What is my highest expense category?",
    "Give me saving tips"
  ];

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend) => {
    if (!textToSend.trim()) return;

    const userMsg = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      // 1. Try to query the backend endpoint (which connects to Gemini)
      const response = await dbService.sendAIChatMessage(textToSend);
      
      const botMsg = {
        id: `bot_${Date.now()}`,
        sender: 'bot',
        text: response.reply,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      // 2. Fall back to smart client-side local advisor if backend Gemini is not configured/offline
      console.warn("Gemini API endpoint unavailable. Falling back to local Heuristic Advisor.");
      
      const localReply = generateLocalAdvisorResponse(textToSend);
      const botMsg = {
        id: `bot_${Date.now()}`,
        sender: 'bot',
        text: localReply,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, botMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateLocalAdvisorResponse = (prompt) => {
    const text = prompt.toLowerCase();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Filter current month expenses
    const thisMonthExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const thisMonthTotal = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const globalLimit = budgets.global || 30000;
    const remaining = globalLimit - thisMonthTotal;

    // Highest category calculation
    const categoryTotals = {};
    thisMonthExpenses.forEach(e => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });
    let highestCat = "None";
    let highestAmt = 0;
    Object.entries(categoryTotals).forEach(([cat, amt]) => {
      if (amt > highestAmt) {
        highestAmt = amt;
        highestCat = cat;
      }
    });

    if (/\b(how much|spent|spend|damage|total)\b/i.test(text)) {
      return `Total spending for this month (${now.toLocaleString('default', { month: 'long' })}) is **₹${thisMonthTotal.toLocaleString()}** out of your **₹${globalLimit.toLocaleString()}** budget. You have **₹${remaining.toLocaleString()}** remaining.`;
    }

    if (/\b(budget|limit|over)\b/i.test(text)) {
      if (thisMonthTotal >= globalLimit) {
        return `🚨 **Danger Zone!** You have exceeded your monthly budget of ₹${globalLimit.toLocaleString()} by ₹${Math.abs(remaining).toLocaleString()}! Please halt unnecessary spending immediately.`;
      }
      if (thisMonthTotal >= globalLimit * 0.8) {
        return `⚠️ **Caution**: You have used **${((thisMonthTotal/globalLimit)*100).toFixed(0)}%** of your global budget limit. You have ₹${remaining.toLocaleString()} remaining before you go out of budget.`;
      }
      return `✅ **Healthy**: Your budget status is healthy. You have spent ₹${thisMonthTotal.toLocaleString()} (${((thisMonthTotal/globalLimit)*100).toFixed(0)}%) of your global limit. ₹${remaining.toLocaleString()} remaining.`;
    }

    if (/\b(highest|max|most|category)\b/i.test(text)) {
      if (highestCat === "None") {
        return "You have no expenses recorded for this month yet!";
      }
      return `Your highest spending category this month is **${highestCat}** with a total of **₹${highestAmt.toLocaleString()}** spent.`;
    }

    if (/\b(tip|save|advice|recommend)\b/i.test(text)) {
      if (highestCat === 'Food') {
        return "💡 **Tip**: Food delivery bills are piling up. Cook at home for a week to save up to ₹1,500!";
      }
      if (highestCat === 'Shopping') {
        return "💡 **Tip**: Lock your shopping carts! Wait 48 hours before purchasing items on Amazon to avoid impulse buys.";
      }
      if (highestCat === 'Transport') {
        return "💡 **Tip**: Use public transport or pool rides. Car fuels and cab charges are your biggest wallet drainers.";
      }
      return "💡 **Tip**: Track your minor recurring subscriptions. Canceling unused services is the fastest way to save ₹500/month!";
    }

    if (/\b(hi|hello|hey|greetings)\b/i.test(text)) {
      return "Hello! I'm here and ready to help you optimize your wallet. Ask me about your spending, budgets, or ask for saving tips!";
    }

    return "I can help you analyze your budget stats. Try asking:\n• *'How much did I spend this month?'*\n• *'What is my highest category?'*\n• *'Give me saving tips'*";
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="glow-effect"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'var(--accent-primary)',
          color: 'white',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 8px 32px rgba(99, 102, 241, 0.4)',
          zIndex: 9999,
          transition: 'transform 0.2s'
        }}
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </button>

      {/* Expanded Chat Dialog */}
      {isOpen && (
        <div
          className="glass-card glow-card"
          style={{
            position: 'fixed',
            bottom: '96px',
            right: '24px',
            width: '380px',
            height: '500px',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 9999,
            overflow: 'hidden',
            boxShadow: '0 12px 48px rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.15)'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ padding: '6px', background: 'rgba(99, 102, 241, 0.2)', borderRadius: 'var(--radius-sm)', color: 'var(--accent-primary)', display: 'flex' }}>
                <Sparkles size={16} />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 'bold' }}>Achu Advisor</h3>
                <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>AI Finance Coach</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages Container */}
          <div
            style={{
              flex: 1,
              padding: '20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  gap: '8px',
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row'
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: msg.sender === 'user' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '12px',
                    flexShrink: 0
                  }}
                >
                  {msg.sender === 'user' ? <User size={14} /> : <Sparkles size={14} style={{ color: 'var(--accent-primary)' }} />}
                </div>

                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '16px',
                    borderTopRightRadius: msg.sender === 'user' ? '4px' : '16px',
                    borderTopLeftRadius: msg.sender === 'bot' ? '4px' : '16px',
                    background: msg.sender === 'user' ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-primary)',
                    fontSize: '13.5px',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-line',
                    border: msg.sender === 'user' ? 'none' : '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  <span dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-start' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={14} className="glow-effect" />
                </div>
                <div style={{ padding: '12px 16px', borderRadius: '16px', borderTopLeftRadius: '4px', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <span className="dot" style={{ width: '6px', height: '6px', background: 'var(--text-secondary)', borderRadius: '50%', display: 'inline-block', animation: 'bounce 1.4s infinite ease-in-out both' }}></span>
                  <span className="dot" style={{ width: '6px', height: '6px', background: 'var(--text-secondary)', borderRadius: '50%', display: 'inline-block', animation: 'bounce 1.4s infinite ease-in-out both 0.2s' }}></span>
                  <span className="dot" style={{ width: '6px', height: '6px', background: 'var(--text-secondary)', borderRadius: '50%', display: 'inline-block', animation: 'bounce 1.4s infinite ease-in-out both 0.4s' }}></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Questions Chips */}
          {messages.length === 1 && (
            <div style={{ padding: '0 20px 12px 20px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {quickQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q)}
                  style={{
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    borderRadius: '20px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    color: 'var(--accent-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(99, 102, 241, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(99, 102, 241, 0.08)';
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Footer Input Bar */}
          <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputValue);
              }}
              style={{ display: 'flex', gap: '8px' }}
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask Achu anything..."
                disabled={isLoading}
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                style={{
                  background: 'var(--accent-primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  opacity: (!inputValue.trim() || isLoading) ? 0.6 : 1
                }}
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
