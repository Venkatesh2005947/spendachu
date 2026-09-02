import { useState, useEffect, useRef, useCallback } from 'react';
import { dbService } from '../../services/db';
import './AskSpendAchu.css';

const BOT_AVATAR = '🤖';
const USER_AVATAR = '👤';

// Suggested quick-tap questions shown in empty state and chips
const DEFAULT_SUGGESTIONS = [
  'How much did I spend this month?',
  'What is my highest spending category?',
  'How much budget is remaining?',
  'What is my savings rate?',
  'How are my financial goals progressing?',
  'Compare this month with last month.'
];

// Format number as Indian currency
function formatINR(amount) {
  if (amount == null || isNaN(amount)) return '₹0';
  return '₹' + Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Render metric summary cards inline in messages
function MetricCard({ metrics, intent }) {
  if (!metrics) return null;

  const cards = [];

  if (intent === 'expense_total' || intent === 'expense_by_category') {
    if (metrics.amount != null) {
      cards.push({ label: 'Total Spent', value: formatINR(metrics.amount), icon: '💸' });
    }
    if (metrics.transactionCount != null) {
      cards.push({ label: 'Transactions', value: metrics.transactionCount, icon: '📋' });
    }
  }

  if (intent === 'savings_summary') {
    if (metrics.amount != null) {
      cards.push({ label: 'Total Saved', value: formatINR(metrics.amount), icon: '💰' });
    }
    if (metrics.savingsRate != null) {
      cards.push({ label: 'Savings Rate', value: `${metrics.savingsRate}%`, icon: '📈' });
    }
  }

  if (intent === 'budget_summary') {
    if (metrics.remaining != null) {
      cards.push({ label: 'Remaining', value: formatINR(metrics.remaining), icon: '💳' });
    }
    if (metrics.usedPercent != null) {
      cards.push({ label: 'Used', value: `${metrics.usedPercent}%`, icon: '📊' });
    }
  }

  if (intent === 'goal_progress') {
    if (metrics.activeGoals != null) {
      cards.push({ label: 'Active Goals', value: metrics.activeGoals, icon: '🎯' });
    }
    if (metrics.completedGoals != null) {
      cards.push({ label: 'Completed', value: metrics.completedGoals, icon: '✅' });
    }
  }

  if (intent === 'financial_health') {
    if (metrics.score != null) {
      cards.push({ label: 'Health Score', value: `${metrics.score}/100`, icon: '❤️' });
    }
    if (metrics.level) {
      cards.push({ label: 'Level', value: metrics.level, icon: '⭐' });
    }
  }

  if (intent === 'expense_comparison' && metrics.direction) {
    const arrow = metrics.direction === 'increase' ? '↑' : metrics.direction === 'decrease' ? '↓' : '→';
    if (metrics.percentageChange != null) {
      cards.push({
        label: 'Change',
        value: `${arrow} ${Math.abs(metrics.percentageChange)}%`,
        icon: metrics.direction === 'increase' ? '📈' : '📉',
        highlight: metrics.direction
      });
    }
  }

  if (cards.length === 0) return null;

  return (
    <div className="asa-metric-cards">
      {cards.map((card, i) => (
        <div
          key={i}
          className={`asa-metric-card ${card.highlight === 'increase' ? 'asa-metric-danger' : card.highlight === 'decrease' ? 'asa-metric-success' : ''}`}
        >
          <span className="asa-metric-icon">{card.icon}</span>
          <div>
            <div className="asa-metric-value">{card.value}</div>
            <div className="asa-metric-label">{card.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Typing indicator animation
function TypingIndicator() {
  return (
    <div className="asa-message asa-message-bot">
      <div className="asa-avatar">{BOT_AVATAR}</div>
      <div className="asa-bubble asa-bubble-bot asa-typing">
        <span></span><span></span><span></span>
      </div>
    </div>
  );
}

// Format answer text with line breaks
function AnswerText({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="asa-answer-text">
      {lines.map((line, i) => (
        <p key={i} className={line === '' ? 'asa-spacer' : ''}>
          {line || '\u00A0'}
        </p>
      ))}
    </div>
  );
}

export default function AskSpendAchu() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(DEFAULT_SUGGESTIONS);
  const [charCount, setCharCount] = useState(0);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Load suggestions on mount
  useEffect(() => {
    dbService.getChatSuggestions()
      .then(res => {
        if (res.suggestions?.length > 0) setSuggestions(res.suggestions);
      })
      .catch(() => {}); // Use defaults on error
  }, []);

  // Handle sending a question
  const sendMessage = useCallback(async (question) => {
    const q = (question || input).trim();
    if (!q || isLoading) return;

    setInput('');
    setCharCount(0);

    // Add user message
    const userMsg = { id: Date.now(), role: 'user', content: q };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await dbService.sendChatMessage(q);

      if (response.success && response.data) {
        const d = response.data;
        const botMsg = {
          id: Date.now() + 1,
          role: 'assistant',
          content: d.answer,
          intent: d.intent,
          metrics: d.metrics,
          period: d.period,
          suggestedQuestions: d.suggestedQuestions || [],
          hasEnoughData: d.hasEnoughData,
          missingData: d.missingData || []
        };
        setMessages(prev => [...prev, botMsg]);
        if (d.suggestedQuestions?.length > 0) {
          setSuggestions(d.suggestedQuestions);
        }
      } else {
        throw new Error(response.error || 'Unknown error');
      }
    } catch (err) {
      const errMsg = {
        id: Date.now() + 1,
        role: 'error',
        content: err.message || 'Something went wrong. Please try again.',
        originalQuestion: q
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading]);

  // Handle retry
  const handleRetry = useCallback((question) => {
    setMessages(prev => prev.filter(m => m.role !== 'error'));
    sendMessage(question);
  }, [sendMessage]);

  // Handle clear conversation
  const handleClear = useCallback(async () => {
    try {
      await dbService.clearChatSession();
    } catch {
      // Non-critical
    }
    setMessages([]);
    setSuggestions(DEFAULT_SUGGESTIONS);
    setInput('');
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    if (val.length <= 500) {
      setInput(val);
      setCharCount(val.length);
    }
  };

  return (
    <div className="asa-container">
      {/* Header */}
      <div className="asa-header">
        <div className="asa-header-left">
          <div className="asa-header-avatar">🤖</div>
          <div>
            <h2 className="asa-header-title">Ask SpendAchu</h2>
            <p className="asa-header-sub">Answers from your real financial data</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            className="asa-clear-btn"
            onClick={handleClear}
            title="Clear conversation"
          >
            🗑️ Clear
          </button>
        )}
      </div>

      {/* Chat area */}
      <div className="asa-messages" role="log" aria-live="polite" aria-label="Chat messages">
        {messages.length === 0 && !isLoading && (
          <div className="asa-empty">
            <div className="asa-empty-icon">💬</div>
            <h3 className="asa-empty-title">Ask me anything about your finances</h3>
            <p className="asa-empty-sub">I'll answer using only your real SpendAchu data. No guessing.</p>
            <div className="asa-suggestion-grid">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  className="asa-suggestion-chip"
                  onClick={() => sendMessage(s)}
                  disabled={isLoading}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="asa-message asa-message-user">
                <div className="asa-bubble asa-bubble-user">{msg.content}</div>
                <div className="asa-avatar asa-avatar-user">{USER_AVATAR}</div>
              </div>
            );
          }

          if (msg.role === 'error') {
            return (
              <div key={msg.id} className="asa-message asa-message-bot">
                <div className="asa-avatar">{BOT_AVATAR}</div>
                <div className="asa-bubble asa-bubble-error">
                  <span className="asa-error-icon">⚠️</span>
                  <span>{msg.content}</span>
                  <button
                    className="asa-retry-btn"
                    onClick={() => handleRetry(msg.originalQuestion)}
                  >
                    Try again
                  </button>
                </div>
              </div>
            );
          }

          // Assistant message
          return (
            <div key={msg.id} className="asa-message asa-message-bot">
              <div className="asa-avatar">{BOT_AVATAR}</div>
              <div className="asa-bubble asa-bubble-bot">
                {!msg.hasEnoughData && msg.missingData?.length > 0 && (
                  <div className="asa-no-data-badge">📭 Insufficient data</div>
                )}
                <AnswerText text={msg.content} />
                <MetricCard metrics={msg.metrics} intent={msg.intent} />
                {msg.suggestedQuestions?.length > 0 && (
                  <div className="asa-followup-chips">
                    <span className="asa-followup-label">Ask next:</span>
                    {msg.suggestedQuestions.slice(0, 3).map((q, i) => (
                      <button
                        key={i}
                        className="asa-followup-chip"
                        onClick={() => sendMessage(q)}
                        disabled={isLoading}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion chips (when chat has messages) */}
      {messages.length > 0 && !isLoading && (
        <div className="asa-bottom-chips">
          {DEFAULT_SUGGESTIONS.slice(0, 3).map((s, i) => (
            <button
              key={i}
              className="asa-suggestion-chip asa-suggestion-chip-sm"
              onClick={() => sendMessage(s)}
              disabled={isLoading}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="asa-input-area">
        <div className="asa-input-wrapper">
          <textarea
            ref={inputRef}
            className="asa-input"
            placeholder="Ask about your expenses..."
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={500}
            disabled={isLoading}
            aria-label="Type your financial question"
          />
          {charCount > 400 && (
            <span className="asa-char-count" aria-live="polite">{charCount}/500</span>
          )}
        </div>
        <button
          className="asa-send-btn"
          onClick={() => sendMessage()}
          disabled={!input.trim() || isLoading}
          aria-label="Send message"
          title="Send (Enter)"
        >
          {isLoading ? (
            <span className="asa-send-spinner" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>

      {/* Disclaimer */}
      <p className="asa-disclaimer">
        SpendAchu provides budgeting insights and not professional financial advice. All answers are based on your recorded data only.
      </p>
    </div>
  );
}
