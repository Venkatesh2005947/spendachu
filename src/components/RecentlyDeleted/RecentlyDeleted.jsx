import React, { useState } from 'react';
import { RotateCcw, Trash2, FolderOpen, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';

export default function RecentlyDeleted({ 
  trash, 
  onRestore, 
  onPermanentDelete,
  onClearTrash
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  // Paginate
  const totalPages = Math.ceil(trash.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedItems = trash.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const getRemainingDays = (deletedAt) => {
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const timePassed = Date.now() - deletedAt;
    const timeLeft = THIRTY_DAYS - timePassed;
    const daysLeft = Math.ceil(timeLeft / (24 * 60 * 60 * 1000));
    return daysLeft > 0 ? `${daysLeft}d left` : 'expiring';
  };

  return (
    <div className="glass-card expenses-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} style={{ color: 'var(--text-muted)' }} />
          <span>Recently Deleted Recovery</span>
        </h3>

        {/* Clear Trash */}
        <div>
          <button 
            className="outline-btn" 
            style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
            onClick={() => {
              if (window.confirm('Are you sure you want to permanently empty the trash? This action is irreversible.')) {
                onClearTrash();
              }
            }}
            disabled={trash.length === 0}
            title="Permanently empty trash"
          >
            <Trash2 size={16} />
            <span>Empty Trash</span>
          </button>
        </div>
      </div>

      {/* Trash Table */}
      <div className="table-responsive">
        {paginatedItems.length === 0 ? (
          <div className="table-empty-state">
            <FolderOpen size={48} />
            <p>Trash is empty.</p>
          </div>
        ) : (
          <table className="expenses-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Description / Note</th>
                <th>Amount</th>
                <th>Auto-Purge</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map(item => {
                const original = item.item;
                const isExpense = item.type === 'expense';
                return (
                  <tr key={item.id}>
                    <td>{original.date}</td>
                    <td>
                      <span className="method-pill" style={{ 
                        textTransform: 'uppercase', 
                        fontSize: '10px', 
                        fontWeight: 'bold',
                        background: isExpense ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        color: isExpense ? 'var(--danger)' : 'var(--success)',
                        border: '1px solid currentColor'
                      }}>
                        {item.type}
                      </span>
                    </td>
                    <td title={original.description || ''}>
                      {original.description || <span style={{ color: 'var(--text-muted)' }}>No details</span>}
                    </td>
                    <td style={{ fontWeight: '600', color: isExpense ? 'var(--text-primary)' : 'var(--success)' }}>
                      {formatCurrency(original.amount)}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                      {getRemainingDays(item.deletedAt)}
                    </td>
                    <td>
                      <div className="actions-cell">
                        {/* Restore Button */}
                        <button 
                          className="row-action-btn edit" 
                          onClick={() => onRestore(item.id)}
                          title="Restore entry"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 12px',
                            background: 'var(--accent-primary)',
                            color: '#000000',
                            border: '2px solid #000000',
                            fontWeight: 'bold',
                            boxShadow: '1px 1px 0px #000000'
                          }}
                        >
                          <RotateCcw size={13} />
                          <span style={{ fontSize: '11px' }}>Restore</span>
                        </button>
                        
                        {/* Final Delete Button */}
                        <button 
                          className="row-action-btn delete" 
                          onClick={() => {
                            if (window.confirm('Are you sure you want to permanently delete this item? This cannot be restored.')) {
                              onPermanentDelete(item.id);
                            }
                          }}
                          title="Permanently delete entry"
                          style={{
                            padding: '6px',
                            borderRadius: 'var(--radius-sm)'
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination controls */}
      {trash.length > 0 && (
        <div className="pagination-container">
          <div>
            Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, trash.length)} of {trash.length} entries
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
