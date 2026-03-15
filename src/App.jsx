import { useState, useEffect } from 'react';
import { Home, FileText, Settings, Plus } from 'lucide-react';
import Dashboard from './components/Dashboard';
import InvoiceGenerator from './components/InvoiceGenerator';
import SettingsView from './components/SettingsView';
import ToastContainer from './components/Toast';
import { getProfile } from './store';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [profile, setProfile] = useState(null);
  const [editingBill, setEditingBill] = useState(null);

  useEffect(() => {
    getProfile().then(setProfile);
  }, []);

  const handleNewInvoice = () => {
    setEditingBill(null);
    setCurrentView('new');
  };

  const handleEditInvoice = (bill) => {
    setEditingBill(bill);
    setCurrentView('new');
  };

  const handleDuplicateInvoice = (bill) => {
    // Deep clone and clear the id/invoice number so it creates a new one
    const clone = JSON.parse(JSON.stringify(bill));
    clone._isDuplicate = true;
    setEditingBill(clone);
    setCurrentView('new');
  };

  const navItems = [
    { id: 'dashboard', icon: Home, label: 'Dashboard' },
    { id: 'new', icon: Plus, label: 'New Invoice', onClick: handleNewInvoice },
  ];

  return (
    <div className="app-layout">
      <div className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <FileText size={22} />
          </div>
          <div>
            <h2 className="sidebar-title">GST Biller</h2>
            <p className="sidebar-subtitle">Local Workspace</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-btn ${currentView === item.id ? 'nav-btn-active' : ''}`}
              onClick={item.onClick || (() => setCurrentView(item.id))}
            >
              <item.icon size={18} /> {item.label}
            </button>
          ))}
          <button
            className={`nav-btn nav-btn-bottom ${currentView === 'settings' ? 'nav-btn-active' : ''}`}
            onClick={() => setCurrentView('settings')}
          >
            <Settings size={18} /> Settings
          </button>
        </nav>
      </div>

      <div className="main-content">
        {currentView === 'dashboard' && (
          <Dashboard
            onNew={handleNewInvoice}
            onEdit={handleEditInvoice}
            onDuplicate={handleDuplicateInvoice}
          />
        )}
        {currentView === 'new' && (
          <InvoiceGenerator
            onBack={() => { setEditingBill(null); setCurrentView('dashboard'); }}
            profile={profile}
            editingBill={editingBill}
          />
        )}
        {currentView === 'settings' && (
          <SettingsView onSaved={(p) => setProfile(p)} />
        )}
      </div>
      <ToastContainer />
    </div>
  );
}

export default App;
