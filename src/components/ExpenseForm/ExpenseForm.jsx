import React, { useState, useEffect } from 'react';
import { Sparkles, X, PlusCircle } from 'lucide-react';
import { aiService } from '../../services/ai';

export default function ExpenseForm({ expense, onClose, onSave }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [paymentMethod, setPaymentMethod] = useState('Card');
  const [description, setDescription] = useState('');
  
  const [aiPredicted, setAiPredicted] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (expense) {
      setDate(expense.date);
      setAmount(expense.amount.toString());
      
      if (expense.category.startsWith('Others')) {
        setCategory('Others');
        const match = expense.category.match(/\(([^)]+)\)/);
        setCustomCategory(match ? match[1] : '');
      } else {
        setCategory(expense.category);
        setCustomCategory('');
      }

      setPaymentMethod(expense.paymentMethod);
      setDescription(expense.description || '');
      setAiPredicted(false);
    }
  }, [expense]);

  // AI Predictor logic triggered when description changes
  const handleDescriptionChange = (e) => {
    const descValue = e.target.value;
    setDescription(descValue);

    if (descValue.trim().length > 2) {
      const predicted = aiService.predictCategory(descValue);
      if (predicted) {
        setCategory(predicted);
        setAiPredicted(true);
      } else {
        setAiPredicted(false);
      }
    } else {
      setAiPredicted(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const amtFloat = parseFloat(amount);
    if (isNaN(amtFloat) || amtFloat <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    if (!date) {
      setError('Please select a valid date.');
      return;
    }

    const payload = {
      date,
      amount: amtFloat,
      category: category === 'Others' && customCategory.trim() ? `Others (${customCategory.trim()})` : category,
      paymentMethod,
      description: description.trim()
    };

    try {
      onSave(payload);
    } catch (err) {
      setError(err.message || 'Failed to save expense.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="glass-card modal-container">
        <div className="modal-header">
          <h2>{expense ? 'Edit Expense' : 'Add New Expense'}</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="alert-pill danger" style={{ marginBottom: '20px' }}>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Amount input */}
          <div className="form-group">
            <label htmlFor="amount">Amount</label>
            <input
              id="amount"
              type="number"
              step="0.01"
              required
              className="form-control"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ fontSize: '18px', fontWeight: 'bold' }}
            />
          </div>

          {/* Description input with AI categorizer */}
          <div className="form-group" style={{ position: 'relative' }}>
            <label htmlFor="description">Description / Notes</label>
            <input
              id="description"
              type="text"
              className="form-control"
              placeholder="e.g. Coffee at Starbucks, Electricity bill, Uber ride"
              value={description}
              onChange={handleDescriptionChange}
              style={{ paddingRight: aiPredicted ? '135px' : '16px' }}
            />
            {aiPredicted && (
              <span className="ai-predicted-badge" title="Auto-categorized by AI">
                <Sparkles size={11} />
                <span>AI Categorized</span>
              </span>
            )}
          </div>

          {/* Category & Payment Method row */}
          <div className="form-control-row">
            <div className="form-group">
              <label htmlFor="category">Category</label>
              <select
                id="category"
                className="form-control"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setAiPredicted(false); // Reset prediction flag on manual user select
                }}
              >
                <option value="Food">Food</option>
                <option value="Transport">Transport</option>
                <option value="Rent">Rent</option>
                <option value="Shopping">Shopping</option>
                <option value="Bills">Bills</option>
                <option value="Entertainment">Entertainment</option>
                <option value="Others">Others</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="paymentMethod">Payment Method</label>
              <select
                id="paymentMethod"
                className="form-control"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="Card">Card</option>
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>
          </div>

          {/* Conditional custom category specifier input */}
          {category === 'Others' && (
            <div className="form-group" style={{ marginTop: '0px', marginBottom: '20px' }}>
              <label htmlFor="customCategory">Spent on (Specify details/category)</label>
              <input
                id="customCategory"
                type="text"
                required
                className="form-control"
                placeholder="e.g. Gift, Books, Medical, Donation"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
              />
            </div>
          )}

          {/* Date input */}
          <div className="form-group">
            <label htmlFor="date">Date</label>
            <input
              id="date"
              type="date"
              required
              className="form-control"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Submit Action */}
          <button type="submit" className="glow-btn" style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}>
            <PlusCircle size={18} />
            <span>{expense ? 'Save Changes' : 'Add Expense'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
