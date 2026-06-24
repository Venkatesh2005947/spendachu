import React from 'react';

export default function ExpenseFilters({ 
  filters, 
  setFilters,
  categories = ['Food', 'Transport', 'Rent', 'Shopping', 'Bills', 'Entertainment', 'Others'],
  methods = ['Card', 'UPI', 'Cash', 'Bank Transfer']
}) {

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className="filters-wrapper">
      {/* Date Range Selector */}
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Time Period</label>
        <select 
          className="form-control"
          value={filters.dateRange}
          onChange={(e) => handleFilterChange('dateRange', e.target.value)}
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="weekly">Weekly (Last 7 Days)</option>
          <option value="monthly">Monthly (Current Month)</option>
          <option value="custom">Custom Date Range</option>
        </select>
      </div>

      {/* Custom dates shown if custom selected */}
      {filters.dateRange === 'custom' && (
        <>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Start Date</label>
            <input 
              type="date"
              className="form-control"
              value={filters.customStart || ''}
              onChange={(e) => handleFilterChange('customStart', e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>End Date</label>
            <input 
              type="date"
              className="form-control"
              value={filters.customEnd || ''}
              onChange={(e) => handleFilterChange('customEnd', e.target.value)}
            />
          </div>
        </>
      )}

      {/* Category Filter */}
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Category</label>
        <select 
          className="form-control"
          value={filters.category}
          onChange={(e) => handleFilterChange('category', e.target.value)}
        >
          <option value="all">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Payment Method Filter */}
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Payment Method</label>
        <select 
          className="form-control"
          value={filters.paymentMethod}
          onChange={(e) => handleFilterChange('paymentMethod', e.target.value)}
        >
          <option value="all">All Methods</option>
          {methods.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Min Amount */}
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Min Amount</label>
        <input 
          type="number" 
          placeholder="Min"
          className="form-control"
          value={filters.minAmount || ''}
          onChange={(e) => handleFilterChange('minAmount', e.target.value)}
        />
      </div>

      {/* Max Amount */}
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Max Amount</label>
        <input 
          type="number" 
          placeholder="Max"
          className="form-control"
          value={filters.maxAmount || ''}
          onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
        />
      </div>
    </div>
  );
}
