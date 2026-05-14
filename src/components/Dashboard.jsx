import { useState, useRef, useEffect } from 'react';
import { getCompanies, saveCompany } from '../utils/storage';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Image as ImageIcon, Building, ChevronRight, Edit2 } from 'lucide-react';

export default function Dashboard({ onSelectCompany }) {
  const [companies, setCompanies] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newCompany, setNewCompany] = useState({ name: '', email: '', phone: '', address: '', logo: '', accentColor: '#3b82f6', logoSize: 80, paymentDetails: '' });
  const fileInputRef = useRef(null);

  useEffect(() => {
    setCompanies(getCompanies());
  }, []);

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewCompany({ ...newCompany, logo: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const openAddForm = () => {
    setEditingId(null);
    setNewCompany({ name: '', email: '', phone: '', address: '', logo: '', accentColor: '#3b82f6', logoSize: 80, paymentDetails: '' });
    setIsAdding(true);
  };

  const openEditForm = (e, company) => {
    e.stopPropagation(); // prevent selecting the company
    setEditingId(company.id);
    setNewCompany({ ...company });
    setIsAdding(true);
  };

  const handleSaveCompany = (e) => {
    e.preventDefault();
    if (!newCompany.name) return;
    
    const companyToSave = { ...newCompany, id: editingId || uuidv4() };
    const updatedCompanies = saveCompany(companyToSave);
    setCompanies(updatedCompanies);
    setIsAdding(false);
    setEditingId(null);
  };

  if (isAdding) {
    return (
      <div className="glass-panel animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h2 className="flex items-center gap-2 mb-8">
          <Building color="var(--accent)" /> {editingId ? 'Edit Business Details' : 'Add New Business'}
        </h2>
        
        <form onSubmit={handleSaveCompany} className="flex-col gap-6">
          <div className="flex items-center gap-6 mb-8">
            <div className="company-logo" style={{ width: 100, height: 100, cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
              {newCompany.logo ? (
                <img src={newCompany.logo} alt="Logo preview" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }} />
              ) : (
                <ImageIcon size={32} color="var(--text-secondary)" />
              )}
            </div>
            <div className="flex-col gap-2">
              <label>Company Logo (Optional)</label>
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleLogoUpload} style={{ display: 'none' }} />
              <div className="flex gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                  Upload Image
                </button>
                {newCompany.logo && (
                  <button type="button" className="btn btn-danger" onClick={() => setNewCompany({ ...newCompany, logo: '' })}>
                    Remove Logo
                  </button>
                )}
              </div>
            </div>
          </div>

          {newCompany.logo && (
            <div className="form-group mb-2">
              <div className="flex justify-between">
                <label>Logo Size on Invoice</label>
                <span className="text-secondary" style={{fontSize: '0.85rem'}}>{newCompany.logoSize || 80}px</span>
              </div>
              <input 
                type="range" min="40" max="250" 
                value={newCompany.logoSize || 80} 
                onChange={e => setNewCompany({...newCompany, logoSize: Number(e.target.value)})} 
                style={{ padding: 0 }}
              />
            </div>
          )}

          <div className="form-group">
            <label>Business Name</label>
            <input required type="text" placeholder="Acme Corp" value={newCompany.name} onChange={e => setNewCompany({...newCompany, name: e.target.value})} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label>Email Address</label>
              <input type="email" placeholder="contact@acme.com" value={newCompany.email} onChange={e => setNewCompany({...newCompany, email: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input type="text" placeholder="+1 234 567 890" value={newCompany.phone} onChange={e => setNewCompany({...newCompany, phone: e.target.value})} />
            </div>
          </div>

          <div className="form-group">
            <label>Business Address</label>
            <textarea rows="3" placeholder="123 Business St, City" value={newCompany.address} onChange={e => setNewCompany({...newCompany, address: e.target.value})}></textarea>
          </div>

          <div className="form-group">
            <label>Payment Details (Optional)</label>
            <textarea rows="3" placeholder="e.g. Please make payment via M-PESA.&#10;Till Number: 123456" value={newCompany.paymentDetails} onChange={e => setNewCompany({...newCompany, paymentDetails: e.target.value})}></textarea>
          </div>
          
          <div className="form-group">
            <label>Brand Accent Color</label>
            <input type="color" value={newCompany.accentColor} onChange={e => setNewCompany({...newCompany, accentColor: e.target.value})} style={{ padding: '0', height: '40px', width: '100px', cursor: 'pointer' }} />
          </div>

          <div className="flex justify-between mt-8">
            <button type="button" className="btn btn-secondary" onClick={() => setIsAdding(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editingId ? 'Update Business' : 'Save Business'}</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1>Your Businesses</h1>
          <p>Select a business to generate and manage invoices.</p>
        </div>
        <button className="btn btn-primary" onClick={openAddForm}>
          <Plus size={18} /> Add Business
        </button>
      </div>

      {companies.length === 0 ? (
        <div className="glass-panel text-center" style={{ padding: '4rem 2rem' }}>
          <Building size={48} color="var(--text-secondary)" style={{ margin: '0 auto 1rem auto' }} />
          <h3>No businesses found</h3>
          <p className="mb-4">Get started by adding your first business profile.</p>
          <button className="btn btn-primary" onClick={openAddForm}>
            Add Business
          </button>
        </div>
      ) : (
        <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {companies.map(company => (
            <div key={company.id} className="company-card" style={{ position: 'relative' }} onClick={() => onSelectCompany(company)}>
              <button 
                className="btn btn-secondary" 
                style={{ position: 'absolute', top: '10px', right: '10px', padding: '0.5rem', border: 'none', background: 'transparent' }}
                onClick={(e) => openEditForm(e, company)}
                title="Edit Business"
              >
                <Edit2 size={16} color="var(--text-secondary)" />
              </button>
              
              <div className="company-logo" style={{ borderColor: company.accentColor }}>
                {company.logo ? (
                  <img src={company.logo} alt={company.name} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }} />
                ) : (
                  <Building size={32} color={company.accentColor || 'var(--text-secondary)'} />
                )}
              </div>
              <div>
                <h3 style={{ marginBottom: '0.2rem' }}>{company.name}</h3>
                <p style={{ fontSize: '0.85rem' }}>{company.email || 'No email set'}</p>
              </div>
              <div className="flex items-center gap-2 mt-4" style={{ color: 'var(--accent)', fontSize: '0.9rem', fontWeight: 500 }}>
                Select <ChevronRight size={16} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
