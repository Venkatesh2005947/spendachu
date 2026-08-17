import { useState, useRef, useCallback, useEffect } from 'react';
import { dbService } from '../../services/db';
import './AICopilotDrawer.css';

// Quick suggestion pills shown in the empty state and bottom chip bar
const QUICK_SUGGESTIONS = [
  'Add ₹200 for tea',
  'Fuel 300 rs',
  'This month\'s total',
  'Iniku evlo spend pannen?',
  'Lunch 150 Transport',
  'Show today\'s expenses',
];

const BOT_SUGGESTIONS_AFTER = [
  'This month\'s total',
  'Iniku evlo spend?',
  'Add ₹100 for snacks',
];

// Render reply text — turn **bold** and *italic* markers into styled spans
function ReplyText({ text }) {
  if (!text) return null;
  // Split on **bold** and *italic* (simple inline parser)
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <span className="acd-reply-text">
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        return part;
      })}
    </span>
  );
}

// Thinking dots animation with label
function ThinkingBubble() {
  return (
    <div className="acd-msg acd-msg-bot">
      <div className="acd-msg-avatar">⚡</div>
      <div className="acd-msg-bubble acd-thinking">
        <div className="acd-dots">
          <span className="acd-dot" />
          <span className="acd-dot" />
          <span className="acd-dot" />
        </div>
        <span className="acd-thinking-label">Analyzing…</span>
      </div>
    </div>
  );
}

export default function AICopilotDrawer({ onExpenseAdded }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom whenever messages change
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 40);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || isLoading) return;

    setInput('');

    // Add user bubble
    const userMsg = { id: Date.now(), role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await dbService.sendAgentMessage(msg);

      const botMsg = {
        id: Date.now() + 1,
        role: 'bot',
        content: res.reply || 'Done!',
        type: res.type || 'chat',   // 'success' | 'insight' | 'chat'
        data: res.data || null
      };

      setMessages(prev => [...prev, botMsg]);

      // If an expense was added → trigger dashboard refresh
      if (res.type === 'success' && res.data?.action === 'ADD_EXPENSE' && onExpenseAdded) {
        onExpenseAdded();
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'error',
        content: err.message || 'Something went wrong. Please try again.',
        originalMsg: msg
      }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, isLoading, onExpenseAdded]);

  const handleRetry = useCallback((originalMsg) => {
    setMessages(prev => prev.filter(m => m.role !== 'error'));
    sendMessage(originalMsg);
  }, [sendMessage]);

  const handleClear = () => {
    setMessages([]);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* ── Floating Trigger ──────────────────────────────────── */}
      {!isOpen && (
        <button
          id="ai-copilot-trigger"
          className="acd-trigger"
          onClick={() => setIsOpen(true)}
          aria-label="Open AI Copilot"
          title="SpendAchu AI Copilot"
        >
          <span className="acd-trigger-icon">⚡</span>
          <span>Ask AI</span>
        </button>
      )}

      {/* ── Backdrop ──────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="acd-backdrop"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Drawer Panel ──────────────────────────────────────── */}
      {isOpen && (
        <div
          className="acd-drawer"
          role="dialog"
          aria-label="SpendAchu AI Copilot"
          aria-modal="true"
        >
          {/* Header */}
          <div className="acd-header">
            <div className="acd-header-left">
              <div className="acd-header-icon">⚡</div>
              <div>
                <p className="acd-header-title">Spendachu Copilot</p>
                <p className="acd-header-subtitle">Log expenses · Get summaries · Ask anything</p>
              </div>
            </div>
            <div className="acd-header-right">
              <span className="acd-model-badge">Gemini Flash</span>
              {messages.length > 0 && (
                <button className="acd-clear-btn" onClick={handleClear} title="Clear chat">
                  🗑️
                </button>
              )}
              <button
                id="ai-copilot-close"
                className="acd-close-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Close AI Copilot"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            className="acd-messages"
            role="log"
            aria-live="polite"
            aria-label="Copilot conversation"
          >
            {/* Empty state */}
            {messages.length === 0 && !isLoading && (
              <div className="acd-empty">
                <div className="acd-empty-icon">⚡</div>
                <h3 className="acd-empty-title">What can I help with?</h3>
                <p className="acd-empty-sub">
                  Log expenses in plain language, get spending summaries,<br />
                  or ask anything — in English, Tamil, or Tanglish!
                </p>
                <div className="acd-quick-chips">
                  {QUICK_SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      className="acd-quick-chip"
                      onClick={() => sendMessage(s)}
                      disabled={isLoading}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message list */}
            {messages.map((msg) => {
              // User message
              if (msg.role === 'user') {
                return (
                  <div key={msg.id} className="acd-msg acd-msg-user">
                    <div className="acd-msg-avatar">🙂</div>
                    <div className="acd-msg-bubble">
                      {msg.content}
                    </div>
                  </div>
                );
              }

              // Error message
              if (msg.role === 'error') {
                return (
                  <div key={msg.id} className="acd-msg acd-msg-bot">
                    <div className="acd-msg-avatar">⚡</div>
                    <div className="acd-error-bubble">
                      <span>⚠️ {msg.content}</span>
                      <button
                        className="acd-retry-btn"
                        onClick={() => handleRetry(msg.originalMsg)}
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                );
              }

              // Bot message
              const isSuccess = msg.type === 'success';
              const isInsight = msg.type === 'insight';

              return (
                <div key={msg.id} className="acd-msg acd-msg-bot">
                  <div className="acd-msg-avatar">⚡</div>
                  <div>
                    <div className="acd-msg-bubble">
                      <ReplyText text={msg.content} />
                    </div>
                    {/* Tool chip */}
                    {isSuccess && msg.data && (
                      <div className={`acd-tool-chip acd-tool-chip-success`}>
                        ✓ Expense logged · ₹{Number(msg.data.amount).toLocaleString('en-IN')} · {msg.data.category}
                      </div>
                    )}
                    {isInsight && (
                      <div className={`acd-tool-chip acd-tool-chip-insight`}>
                        📊 Summary from your data
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Thinking indicator */}
            {isLoading && <ThinkingBubble />}

            <div ref={messagesEndRef} />
          </div>

          {/* Bottom suggestion chips (shown after conversation starts) */}
          {messages.length > 0 && !isLoading && (
            <div className="acd-bottom-chips">
              {BOT_SUGGESTIONS_AFTER.map((s, i) => (
                <button
                  key={i}
                  className="acd-chip"
                  onClick={() => sendMessage(s)}
                  disabled={isLoading}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input area */}
          <div className="acd-input-area">
            <div className="acd-input-wrap">
              <textarea
                ref={inputRef}
                id="ai-copilot-input"
                className="acd-input"
                placeholder="e.g. Spent 150 for lunch, Fuel 300 rs, Iniku evlo spend?"
                value={input}
                onChange={e => {
                  if (e.target.value.length <= 500) setInput(e.target.value);
                }}
                onKeyDown={handleKeyDown}
                rows={1}
                maxLength={500}
                disabled={isLoading}
                aria-label="Type your message"
              />
            </div>
            <button
              id="ai-copilot-send"
              className="acd-send-btn"
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
              title="Send (Enter)"
            >
              {isLoading ? (
                <span className="acd-send-spinner" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
