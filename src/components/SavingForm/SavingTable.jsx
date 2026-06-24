import React, { useState } from 'react';
import { 
  Search, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  FolderOpen 
} from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';

export default function SavingTable({ 
  savings, 
  onDeleteSaving,
  onClearAllSavings
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  
  const ITEMS_PER_PAGE = 8;

  // Apply Search Filter on Short Note
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

  const filtered = getFilteredSavings();

  // Paginate
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedItems = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  return (
    <div className="glass-card expenses-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        {/* Live Search */}
        <div className="search-input-container" style={{ maxWidth: '300px', width: '100%' }}>
          <Search size={16} />
          <input
            type="text"
            className="form-control"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        {/* Clear All Savings */}
        <div>
          <button 
            className="outline-btn" 
            style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
            onClick={() => {
              if (window.confirm('Are you sure you want to delete all savings?')) {
                onClearAllSavings();
              }
            }}
            disabled={savings.length === 0}
            title="Delete all savings entries to start fresh"
          >
            <Trash2 size={16} />
            <span>Clear All Savings</span>
          </button>
        </div>
      </div>

      {/* Savings Table */}
      <div className="table-responsive">
        {paginatedItems.length === 0 ? (
          <div className="table-empty-state">
            <FolderOpen size={48} />
            <p>No savings recorded yet.</p>
          </div>
        ) : (
          <table className="expenses-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Short Note</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map(item => (
                <tr key={item.id}>
                  <td>{item.date}</td>
                  <td title={item.description}>{item.description || <span style={{ color: 'var(--text-muted)' }}>No details</span>}</td>
                  <td style={{ fontWeight: '600', color: 'var(--success)' }}>{formatCurrency(item.amount)}</td>
                  <td>
                    <div className="actions-cell">
                      <button 
                        className="row-action-btn delete" 
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this saving entry?')) {
                            onDeleteSaving(item.id);
                          }
                        }}
                        title="Delete entry"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination controls */}
      {filtered.length > 0 && (
        <div className="pagination-container">
          <div>
            Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, filtered.length)} of {filtered.length} entries
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
    </div>
  );
}
