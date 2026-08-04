import React, { useState } from 'react';
import { 
  Search, 
  ArrowUpDown, 
  Trash2, 
  Edit3, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  FolderOpen,
  Utensils,
  Car,
  Home,
  ShoppingBag,
  FileText,
  Film,
  CreditCard,
  ArrowDown,
  X,
  CheckCircle2
} from 'lucide-react';
import { formatCurrency, exportExpensesToCSV, isDateInRange } from '../../utils/helpers';

export default function ExpenseTable({ 
  expenses, 
  filters, 
  setFilters, 
  onEditExpense, 
  onDeleteExpense,
  onClearAllExpenses
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState('date'); // 'date' or 'amount'
  const [sortAsc, setSortAsc] = useState(false); // Default descending for recent first
  const [selectedTx, setSelectedTx] = useState(null); // Selected transaction for detail modal
  
  const ITEMS_PER_PAGE = 8;

  // Category Icon & Color Resolver matching modern template design
  const getCategoryConfig = (cat = '') => {
    const clean = cat.toLowerCase();
    if (clean.includes('food') || clean.includes('restaurant') || clean.includes('grocery') || clean.includes('dining')) {
      return { icon: Utensils, bg: 'rgba(245, 158, 11, 0.12)', color: '#d97706' };
    }
    if (clean.includes('transport') || clean.includes('fuel') || clean.includes('uber') || clean.includes('cab')) {
      return { icon: Car, bg: 'rgba(59, 130, 246, 0.12)', color: '#2563eb' };
    }
    if (clean.includes('rent') || clean.includes('house') || clean.includes('housing')) {
      return { icon: Home, bg: 'rgba(139, 92, 246, 0.12)', color: '#7c3aed' };
    }
    if (clean.includes('shopping') || clean.includes('clothes') || clean.includes('store')) {
      return { icon: ShoppingBag, bg: 'rgba(236, 72, 153, 0.12)', color: '#db2777' };
    }
    if (clean.includes('bill') || clean.includes('utility') || clean.includes('tax') || clean.includes('electricity')) {
      return { icon: FileText, bg: 'rgba(16, 185, 129, 0.12)', color: '#059669' };
    }
    if (clean.includes('entertainment') || clean.includes('movie') || clean.includes('game')) {
      return { icon: Film, bg: 'rgba(6, 182, 212, 0.12)', color: '#0891b2' };
    }
    return { icon: CreditCard, bg: 'rgba(113, 113, 122, 0.12)', color: '#71717a' };
  };

  // 1. Apply Search and Filters
  const getFilteredExpenses = () => {
    return expenses.filter(e => {
      // Live search matches description or category or merchant
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const desc = (e.description || '').toLowerCase();
        const cat = (e.category || '').toLowerCase();
        const merchant = (e.merchant || '').toLowerCase();
        if (!desc.includes(query) && !cat.includes(query) && !merchant.includes(query)) return false;
      }

      // Category filter
      if (filters.category !== 'all') {
        if (filters.category === 'Others') {
          if (!e.category.startsWith('Others')) return false;
        } else if (e.category !== filters.category) {
          return false;
        }
      }

      // Payment Method filter
      if (filters.paymentMethod !== 'all' && e.paymentMethod !== filters.paymentMethod) return false;

      // Amount Range filters
      if (filters.minAmount && e.amount < parseFloat(filters.minAmount)) return false;
      if (filters.maxAmount && e.amount > parseFloat(filters.maxAmount)) return false;

      // Date Range filters
      const customRange = { start: filters.customStart, end: filters.customEnd };
      if (!isDateInRange(e.date, filters.dateRange, customRange)) return false;

      return true;
    });
  };

  // 2. Apply Sorting
  const getSortedExpenses = (filteredList) => {
    return [...filteredList].sort((a, b) => {
      let comparison = 0;
      if (sortKey === 'amount') {
        comparison = a.amount - b.amount;
      } else {
        // Date sorting
        comparison = new Date(a.date) - new Date(b.date);
      }
      return sortAsc ? comparison : -comparison;
    });
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
    setCurrentPage(1);
  };

  const filtered = getFilteredExpenses();
  const sorted = getSortedExpenses(filtered);

  // 3. Paginate
  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedItems = sorted.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  return (
    <div className="glass-card expenses-card" style={{ padding: '24px', borderRadius: '24px' }}>
      {/* Header with Search, Sort, CSV Export, Clear All */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        {/* Live Search */}
        <div className="search-input-container" style={{ maxWidth: '320px', width: '100%' }}>
          <Search size={16} />
          <input
            type="text"
            className="form-control"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        {/* Sort & Action controls */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            className="outline-btn"
            onClick={() => handleSort('date')}
            title="Sort by Date"
            style={{ fontSize: '13px', padding: '8px 12px' }}
          >
            <ArrowUpDown size={14} />
            <span>Sort Date {sortKey === 'date' ? (sortAsc ? '↑' : '↓') : ''}</span>
          </button>

          <button 
            className="outline-btn"
            onClick={() => handleSort('amount')}
            title="Sort by Amount"
            style={{ fontSize: '13px', padding: '8px 12px' }}
          >
            <ArrowUpDown size={14} />
            <span>Sort Amount {sortKey === 'amount' ? (sortAsc ? '↑' : '↓') : ''}</span>
          </button>

          <button 
            className="outline-btn" 
            onClick={() => exportExpensesToCSV(sorted)}
            disabled={sorted.length === 0}
            title="Download filtered expenses to Excel/CSV"
            style={{ fontSize: '13px', padding: '8px 12px' }}
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          <button 
            className="outline-btn" 
            style={{ color: 'var(--danger)', borderColor: 'var(--danger)', fontSize: '13px', padding: '8px 12px' }}
            onClick={() => {
              if (window.confirm('Are you sure you want to delete all expenses? This will permanently delete all entries.')) {
                onClearAllExpenses();
              }
            }}
            disabled={expenses.length === 0}
            title="Delete all expense entries to start fresh"
          >
            <Trash2 size={14} />
            <span>Clear All</span>
          </button>
        </div>
      </div>

      {/* Template Transaction List */}
      {paginatedItems.length === 0 ? (
        <div className="table-empty-state">
          <FolderOpen size={48} />
          <p>No matching expenses found.</p>
        </div>
      ) : (
        <div className="tx-list-container">
          {paginatedItems.map(item => {
            const cfg = getCategoryConfig(item.category);
            const IconComp = cfg.icon;
            const displayTitle = item.merchant || item.description || item.category;

            return (
              <div 
                key={item.id} 
                className="tx-item-card"
                onClick={() => setSelectedTx(item)}
                title="Click to view details or edit/delete"
              >
                <div className="tx-left-section">
                  {/* Category Circle Icon */}
                  <div 
                    className="tx-icon-circle-wrapper"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    <IconComp size={22} />
                    <div className="tx-badge-indicator expense">
                      <ArrowDown size={10} strokeWidth={3} />
                    </div>
                  </div>

                  {/* Title and Subtitle */}
                  <div className="tx-info-block">
                    <div className="tx-title">{displayTitle}</div>
                    <div className="tx-subtitle">
                      <span style={{ color: 'var(--success)', fontWeight: '700' }}>Completed</span>
                      <span>•</span>
                      <span>{item.category}</span>
                      <span>•</span>
                      <span>{item.paymentMethod || 'Cash'}</span>
                    </div>
                  </div>
                </div>

                {/* Amount and Time/Date */}
                <div className="tx-right-section">
                  <div className="tx-amount expense">-{formatCurrency(item.amount)}</div>
                  <div className="tx-date-time">
                    {item.time || item.date}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination controls */}
      {sorted.length > 0 && (
        <div className="pagination-container" style={{ marginTop: '20px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, sorted.length)} of {sorted.length} entries
          </div>
          <div className="pagination-buttons">
            <button 
              className="outline-btn" 
              style={{ padding: '6px 12px' }} 
              onClick={handlePrevPage}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              className="outline-btn" 
              style={{ padding: '6px 12px' }} 
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Transaction Details & Action Modal */}
      {selectedTx && (
        <div className="modal-overlay" style={{ zIndex: 12000 }} onClick={() => setSelectedTx(null)}>
          <div 
            className="glass-card modal-container" 
            onClick={(e) => e.stopPropagation()}
            style={{ width: '90%', maxWidth: '440px', padding: '24px', borderRadius: '24px', animation: 'scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            {/* Header Banner */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: '900', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Transaction Details</span>
              <button 
                onClick={() => setSelectedTx(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Main Details Summary Card */}
            {(() => {
              const cfg = getCategoryConfig(selectedTx.category);
              const IconComp = cfg.icon;
              return (
                <div className="tx-modal-header-bg">
                  <div 
                    style={{ 
                      width: '60px', 
                      height: '60px', 
                      borderRadius: '50%', 
                      background: cfg.bg, 
                      color: cfg.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <IconComp size={30} />
                  </div>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)' }}>
                    {selectedTx.merchant || selectedTx.description || selectedTx.category}
                  </h2>
                  <div style={{ fontSize: '24px', fontWeight: '900', color: '#ef4444' }}>
                    -{formatCurrency(selectedTx.amount)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--success)' }}>
                    <CheckCircle2 size={16} />
                    <span>Payment Completed</span>
                  </div>
                </div>
              );
            })()}

            {/* Field Details Grid */}
            <div className="tx-modal-grid">
              <div className="tx-modal-field">
                <label>Date & Time</label>
                <span>{selectedTx.date} {selectedTx.time ? `• ${selectedTx.time}` : ''}</span>
              </div>
              <div className="tx-modal-field">
                <label>Category</label>
                <span>{selectedTx.category}</span>
              </div>
              <div className="tx-modal-field">
                <label>Payment Method</label>
                <span>{selectedTx.paymentMethod || 'Cash'}</span>
              </div>
              <div className="tx-modal-field">
                <label>Tax Amount</label>
                <span>{selectedTx.tax ? formatCurrency(selectedTx.tax) : '₹0.00'}</span>
              </div>
            </div>

            {selectedTx.description && (
              <div className="tx-modal-field" style={{ marginBottom: '24px' }}>
                <label>Notes / Description</label>
                <span>{selectedTx.description}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button 
                className="glow-btn" 
                style={{ justifyContent: 'center', padding: '12px', borderRadius: '14px', fontSize: '14px' }}
                onClick={() => {
                  const txToEdit = selectedTx;
                  setSelectedTx(null);
                  onEditExpense(txToEdit);
                }}
              >
                <Edit3 size={16} />
                <span>Edit Entry</span>
              </button>

              <button 
                className="outline-btn" 
                style={{ justifyContent: 'center', padding: '12px', borderRadius: '14px', fontSize: '14px', borderColor: 'var(--error)', color: 'var(--error)' }}
                onClick={() => {
                  const txToDelete = selectedTx;
                  if (window.confirm('Are you sure you want to delete this expense entry?')) {
                    setSelectedTx(null);
                    onDeleteExpense(txToDelete.id);
                  }
                }}
              >
                <Trash2 size={16} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
