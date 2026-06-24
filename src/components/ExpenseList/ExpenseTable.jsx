import React, { useState } from 'react';
import { 
  Search, 
  ArrowUpDown, 
  Trash2, 
  Edit3, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  FolderOpen 
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
  
  const ITEMS_PER_PAGE = 8;

  // 1. Apply Search and Filters
  const getFilteredExpenses = () => {
    return expenses.filter(e => {
      // Live search matches description
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const desc = (e.description || '').toLowerCase();
        const cat = e.category.toLowerCase();
        if (!desc.includes(query) && !cat.includes(query)) return false;
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
    setCurrentPage(1); // Reset page on sort
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

  const getCategoryClass = (cat) => {
    const cleanCat = cat.toLowerCase();
    if (cleanCat.startsWith('others')) return 'cat-others';
    if (['food', 'transport', 'rent', 'shopping', 'bills', 'entertainment'].includes(cleanCat)) {
      return `cat-${cleanCat}`;
    }
    return '';
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
            placeholder="Search descriptions..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        {/* Download CSV Report */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="outline-btn" 
            onClick={() => exportExpensesToCSV(sorted)}
            disabled={sorted.length === 0}
            title="Download filtered expenses to Excel/CSV"
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>

          <button 
            className="outline-btn" 
            style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
            onClick={() => {
              if (window.confirm('Are you sure you want to delete all expenses? This will permanently delete all entries.')) {
                onClearAllExpenses();
              }
            }}
            disabled={expenses.length === 0}
            title="Delete all expense entries to start fresh"
          >
            <Trash2 size={16} />
            <span>Clear All</span>
          </button>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="table-responsive">
        {paginatedItems.length === 0 ? (
          <div className="table-empty-state">
            <FolderOpen size={48} />
            <p>No matching expenses found.</p>
          </div>
        ) : (
          <table className="expenses-table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('date')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Date <ArrowUpDown size={12} />
                  </div>
                </th>
                <th>Description</th>
                <th>Category</th>
                <th>Method</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('amount')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Amount <ArrowUpDown size={12} />
                  </div>
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map(item => (
                <tr key={item.id}>
                  <td>{item.date}</td>
                  <td title={item.description}>{item.description || <span style={{ color: 'var(--text-muted)' }}>No description</span>}</td>
                  <td>
                    <span className={`category-badge ${getCategoryClass(item.category)}`}>
                      {item.category}
                    </span>
                  </td>
                  <td>
                    <span className="method-pill">{item.paymentMethod}</span>
                  </td>
                  <td style={{ fontWeight: '600' }}>{formatCurrency(item.amount)}</td>
                  <td>
                    <div className="actions-cell">
                      <button 
                        className="row-action-btn edit" 
                        onClick={() => onEditExpense(item)}
                        title="Edit entry"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button 
                        className="row-action-btn delete" 
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this expense?')) {
                            onDeleteExpense(item.id);
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
      {sorted.length > 0 && (
        <div className="pagination-container">
          <div>
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
    </div>
  );
}
