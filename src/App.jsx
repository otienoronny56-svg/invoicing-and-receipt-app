import { useState, useEffect } from 'react';
import { App as CapApp } from '@capacitor/app';
import Dashboard from './components/Dashboard';
import InvoiceGenerator from './components/InvoiceGenerator';
import { Briefcase, Sun, Moon } from 'lucide-react';

function App() {
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'generator'
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [lastBackPress, setLastBackPress] = useState(0);
  const [showExitToast, setShowExitToast] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Android Back Button Handling
  useEffect(() => {
    const backListener = CapApp.addListener('backButton', () => {
      if (currentView === 'generator') {
        // If in generator, go back to dashboard
        setSelectedCompany(null);
        setCurrentView('dashboard');
      } else {
        // If in dashboard, implement double-tap to exit
        const now = Date.now();
        if (now - lastBackPress < 2000) {
          CapApp.exitApp();
        } else {
          setLastBackPress(now);
          setShowExitToast(true);
          setTimeout(() => setShowExitToast(false), 2000);
        }
      }
    });

    return () => {
      backListener.then(l => l.remove());
    };
  }, [currentView, lastBackPress]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleSelectCompany = (company) => {
    setSelectedCompany(company);
    setCurrentView('generator');
  };

  const handleBackToDashboard = () => {
    setSelectedCompany(null);
    setCurrentView('dashboard');
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="flex items-center gap-4">
          <div className="header-brand" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }} onClick={handleBackToDashboard}>
            <Briefcase className="text-accent" size={28} color="var(--accent)" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ lineHeight: 1 }}>ProInvoice</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--accent)', fontWeight: 600, marginTop: '2px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>by Ronny</span>
            </div>
          </div>
          
          <button className="btn btn-secondary" onClick={toggleTheme} style={{ padding: '0.5rem', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
        {currentView === 'generator' && selectedCompany && (
          <div className="header-actions">
            <div className="working-as" style={{ color: 'var(--text-secondary)' }}>
              <span className="hide-mobile">Working as: </span>
              <strong style={{ color: 'var(--text-primary)' }}>{selectedCompany.name}</strong>
            </div>
            <button className="btn btn-secondary switch-btn" onClick={handleBackToDashboard}>
              <span className="hide-mobile">Switch Company</span>
              <span className="show-mobile">Switch</span>
            </button>
          </div>
        )}
      </header>
      
      <main className="container">
        {currentView === 'dashboard' && (
          <Dashboard onSelectCompany={handleSelectCompany} />
        )}
        {currentView === 'generator' && selectedCompany && (
          <InvoiceGenerator company={selectedCompany} onBack={handleBackToDashboard} />
        )}
      </main>

      {/* Press Back Again Toast */}
      {showExitToast && (
        <div style={{
          position: 'fixed',
          bottom: '50px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '25px',
          zIndex: 10000,
          fontSize: '0.9rem',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
          animation: 'fadeIn 0.3s ease'
        }}>
          Press back again to exit
        </div>
      )}
    </div>
  );
}

export default App;
