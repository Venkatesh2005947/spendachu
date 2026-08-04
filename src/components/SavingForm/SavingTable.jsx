import React, { useState } from 'react';
import { 
  Search, 
  ArrowUpDown,
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  FolderOpen,
  Coins,
  ArrowUp,
  X,
  CheckCircle2
} from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';

export default function SavingTable({ 
  savings = [], 
  onDeleteSaving,
  onClearAllSavings
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState('date'); // 'date' or 'amount'
  const [sortAsc, setSortAsc] = useState(false); // Default descending for recent first
  const [selectedTx, setSelectedTx] = useState(null); // Selected transaction for detail modal
  
  const ITEMS_PER_PAGE = 8;

  // 1. Apply Search Filter
  const getFilteredSavings = () => {
    return savings.filter(s => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const desc = (s.description || '').toLowerCase();
        return desc.includes(query);
      }
      return true;
    });
  };

  // 2. Apply Sorting
  const getSortedSavings = (filteredList) => {
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

  const filtered = getFilteredSavings();
  const sorted = getSortedSavings(filtered);

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
      {/* Header with Search, Sort, Clear All */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        {/* Live Search */}
        <div className="search-input-container" style={{ maxWidth: '320px', width: '100%' }}>
          <Search size={16} />
          <input
            type="text"
            className="form-control"
            placeholder="Search savings notes..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        {/* Sort & Actions */}
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
            style={{ color: 'var(--danger)', borderColor: 'var(--danger)', fontSize: '13px', padding: '8px 12px' }}
            onClick={() => {
              if (window.confirm('Are you sure you want to delete all savings entries?')) {
                onClearAllSavings();
              }
            }}
            disabled={savings.length === 0}
            title="Delete all savings entries to start fresh"
          >
            <Trash2 size={14} />
            <span>Clear All Savings</span>
          </button>
        </div>
      </div>

      {/* Template Savings Transaction List */}
      {paginatedItems.length === 0 ? (
        <div className="table-empty-state">
          <FolderOpen size={48} />
          <p>No savings recorded yet.</p>
        </div>
      ) : (
        <div className="tx-list-container">
          {paginatedItems.map(item => {
            const displayTitle = item.description || 'Savings Deposit';

            return (
              <div 
                key={item.id} 
                className="tx-item-card"
                onClick={() => setSelectedTx(item)}
                title="Click to view details or delete"
              >
                <div className="tx-left-section">
                  {/* Green Circle Icon for Savings */}
                  <div 
                    className="tx-icon-circle-wrapper"
                    style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}
                  >
                    <Coins size={22} />
                    <div className="tx-badge-indicator income">
                      <ArrowUp size={10} strokeWidth={3} />
                    </div>
                  </div>

                  {/* Title and Subtitle */}
                  <div className="tx-info-block">
                    <div className="tx-title">{displayTitle}</div>
                    <div className="tx-subtitle">
                      Savings Deposit
                    </div>
                  </div>
                </div>

                {/* Amount in Green and Date */}
                <div className="tx-right-section">
                  <div className="tx-amount income">+{formatCurrency(item.amount)}</div>
                  <div className="tx-date-time">
                    {item.date}
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

      {/* Saving Details & Action Modal */}
      {selectedTx && (
        <div className="modal-overlay" style={{ zIndex: 12000 }} onClick={() => setSelectedTx(null)}>
          <div 
            className="glass-card modal-container" 
            onClick={(e) => e.stopPropagation()}
            style={{ width: '90%', maxWidth: '440px', padding: '24px', borderRadius: '24px', animation: 'scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            {/* Header Banner */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: '900', color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '1px' }}>Savings Details</span>
              <button 
                onClick={() => setSelectedTx(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Main Details Summary Card */}
            <div className="tx-modal-header-bg" style={{ background: 'rgba(16, 185, 129, 0.08)' }}>
              <div 
                style={{ 
                  width: '60px', 
                  height: '60px', 
                  borderRadius: '50%', 
                  background: 'rgba(16, 185, 129, 0.18)', 
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Coins size={30} />
              </div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)' }}>
                {selectedTx.description || 'Savings Deposit'}
              </h2>
              <div style={{ fontSize: '24px', fontWeight: '900', color: '#10b981' }}>
                +{formatCurrency(selectedTx.amount)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--success)' }}>
                <CheckCircle2 size={16} />
                <span>Savings Deposited</span>
              </div>
            </div>

            {/* Field Details Grid */}
            <div className="tx-modal-grid">
              <div className="tx-modal-field">
                <label>Date</label>
                <span>{selectedTx.date}</span>
              </div>
              <div className="tx-modal-field">
                <label>Type</label>
                <span>Savings Entry</span>
              </div>
            </div>

            {selectedTx.description && (
              <div className="tx-modal-field" style={{ marginBottom: '24px' }}>
                <label>Short Note</label>
                <span>{selectedTx.description}</span>
              </div>
            )}

            {/* Action Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                className="outline-btn" 
                style={{ width: '100%', justifyContent: 'center', padding: '12px', borderRadius: '14px', fontSize: '14px', borderColor: 'var(--error)', color: 'var(--error)' }}
                onClick={() => {
                  const txToDelete = selectedTx;
                  if (window.confirm('Are you sure you want to delete this saving entry?')) {
                    setSelectedTx(null);
                    onDeleteSaving(txToDelete.id);
                  }
                }}
              >
                <Trash2 size={16} />
                <span>Delete Saving Entry</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
