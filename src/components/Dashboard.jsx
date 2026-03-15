import { useState, useEffect } from 'react';
import { FileText, Trash2, Plus, IndianRupee, Receipt, Edit3, TrendingUp, Search, Copy, X, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { getAllBills, deleteBill, saveBill } from '../store';
import { formatCurrency, INVOICE_TYPES } from '../utils';
import { toast } from './Toast';

const STATUS_CONFIG = {
  unpaid: { label: 'Unpaid', icon: Clock, color: '#f59e0b', bg: '#fffbeb' },
  paid: { label: 'Paid', icon: CheckCircle, color: '#059669', bg: '#ecfdf5' },
  overdue: { label: 'Overdue', icon: AlertTriangle, color: '#dc2626', bg: '#fef2f2' },
};

export default function Dashboard({ onNew, onEdit, onDuplicate }) {
  const [bills, setBills] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [stats, setStats] = useState({ total: 0, tax: 0, count: 0, unpaid: 0 });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => { loadBills(); }, []);

  // Apply filters
  useEffect(() => {
    let result = bills;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(b =>
        (b.clientName || '').toLowerCase().includes(q) ||
        (b.invoiceNumber || '').toLowerCase().includes(q)
      );
    }
    if (typeFilter !== 'all') {
      result = result.filter(b => (b.invoiceType || 'tax-invoice') === typeFilter);
    }
    if (statusFilter !== 'all') {
      result = result.filter(b => (b.status || 'unpaid') === statusFilter);
    }
    if (dateFrom) result = result.filter(b => b.invoiceDate >= dateFrom);
    if (dateTo) result = result.filter(b => b.invoiceDate <= dateTo);
    setFiltered(result);
  }, [bills, search, typeFilter, statusFilter, dateFrom, dateTo]);

  const loadBills = async () => {
    try {
      const data = await getAllBills();
      setBills(data);
      const totalAmount = data.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
      const totalTax = data.reduce((sum, b) => sum + (b.totalTaxAmount || 0), 0);
      const unpaid = data.filter(b => (b.status || 'unpaid') !== 'paid').reduce((sum, b) => sum + (b.totalAmount || 0), 0);
      setStats({ total: totalAmount, tax: totalTax, count: data.length, unpaid });
    } catch {
      toast('Failed to load invoices', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this invoice? This cannot be undone.')) {
      try {
        await deleteBill(id);
        toast('Invoice deleted', 'success');
        loadBills();
      } catch { toast('Failed to delete', 'error'); }
    }
  };

  const handleView = (bill) => {
    if (bill.data) onEdit(bill);
    else toast('No editable data saved for this invoice', 'warning');
  };

  const cycleStatus = async (bill) => {
    const order = ['unpaid', 'paid', 'overdue'];
    const current = bill.status || 'unpaid';
    const next = order[(order.indexOf(current) + 1) % order.length];
    const updated = { ...bill, status: next };
    await saveBill(updated);
    toast(`Marked as ${STATUS_CONFIG[next].label}`, 'info');
    loadBills();
  };

  const clearFilters = () => {
    setSearch(''); setTypeFilter('all'); setStatusFilter('all'); setDateFrom(''); setDateTo('');
  };

  const hasFilters = search || typeFilter !== 'all' || statusFilter !== 'all' || dateFrom || dateTo;

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your local invoices</p>
        </div>
        <button className="btn btn-primary" onClick={onNew}>
          <Plus size={18} /> New Invoice
        </button>
      </div>

      <div className="stats-grid stats-grid-4">
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue"><IndianRupee size={22} /></div>
          <div>
            <p className="stat-label">Total Invoiced</p>
            <h2 className="stat-value">{formatCurrency(stats.total)}</h2>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-green"><TrendingUp size={22} /></div>
          <div>
            <p className="stat-label">Tax Collected</p>
            <h2 className="stat-value stat-value-green">{formatCurrency(stats.tax)}</h2>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-amber"><Clock size={22} /></div>
          <div>
            <p className="stat-label">Unpaid Amount</p>
            <h2 className="stat-value stat-value-amber">{formatCurrency(stats.unpaid)}</h2>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-purple"><Receipt size={22} /></div>
          <div>
            <p className="stat-label">Invoices</p>
            <h2 className="stat-value stat-value-purple">{stats.count}</h2>
          </div>
        </div>
      </div>

      <div className="glass-panel">
        <div className="table-header">
          <h3>Invoices</h3>
        </div>

        <div className="filters-bar">
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input type="text" placeholder="Search client or invoice no..." value={search}
              onChange={e => setSearch(e.target.value)} className="search-input" />
          </div>
          <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            {Object.entries(INVOICE_TYPES).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
          <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
          <input type="date" className="filter-date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From" />
          <input type="date" className="filter-date" value={dateTo} onChange={e => setDateTo(e.target.value)} title="To" />
          {hasFilters && (
            <button className="icon-btn icon-btn-red" onClick={clearFilters} title="Clear filters"><X size={15} /></button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <FileText size={48} />
            <p>{bills.length === 0 ? 'No invoices yet. Create your first invoice.' : 'No invoices match your filters.'}</p>
            {bills.length === 0 && (
              <button className="btn btn-primary" onClick={onNew}><Plus size={18} /> Create Invoice</button>
            )}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice No.</th>
                  <th>Type</th>
                  <th>Client</th>
                  <th>Amount</th>
                  <th>Tax</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(bill => {
                  const status = bill.status || 'unpaid';
                  const sc = STATUS_CONFIG[status];
                  const StatusIcon = sc.icon;
                  return (
                    <tr key={bill.id}>
                      <td className="text-muted">{new Date(bill.invoiceDate).toLocaleDateString('en-IN')}</td>
                      <td><span className="invoice-badge">{bill.invoiceNumber}</span></td>
                      <td><span className="type-badge">{(INVOICE_TYPES[bill.invoiceType || 'tax-invoice'])?.label}</span></td>
                      <td className="font-medium">{bill.clientName}</td>
                      <td className="font-bold">{formatCurrency(bill.totalAmount)}</td>
                      <td className="text-muted">{formatCurrency(bill.totalTaxAmount)}</td>
                      <td>
                        <button className="status-badge" style={{ background: sc.bg, color: sc.color }}
                          onClick={() => cycleStatus(bill)} title="Click to change status">
                          <StatusIcon size={13} /> {sc.label}
                        </button>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button className="icon-btn icon-btn-blue" onClick={() => handleView(bill)} title="Edit"><Edit3 size={15} /></button>
                          <button className="icon-btn icon-btn-blue" onClick={() => onDuplicate(bill)} title="Duplicate"><Copy size={15} /></button>
                          <button className="icon-btn icon-btn-red" onClick={() => handleDelete(bill.id)} title="Delete"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
