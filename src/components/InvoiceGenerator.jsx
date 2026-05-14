import { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { Download, Plus, Trash2, Clock, FileText, Mail, MessageCircle, CheckCircle, Circle, Share2, Receipt, Calendar } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import jsPDF from 'jspdf';
import { saveInvoice, getInvoices, deleteInvoice } from '../utils/storage';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

// Pure programmatic PDF — no html2canvas, works on Android WebView 100%
const buildPDFBlob = (inv, company, isReceipt) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = 210, margin = 15, contentW = 210 - 2 * 15;
  const hexToRgb = (hex) => {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#1e293b');
    return r ? { r: parseInt(r[1],16), g: parseInt(r[2],16), b: parseInt(r[3],16) } : { r:30, g:41, b:59 };
  };
  const a = hexToRgb(company.accentColor);
  const docNum = isReceipt ? (inv.invoiceNumber||'').replace('INV-','RCPT-') : (inv.invoiceNumber||'');
  let y = margin;
  // HEADER
  doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.setTextColor(a.r,a.g,a.b);
  doc.text(company.name||'Company', margin, y+8);
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(71,85,105);
  let ay = y+14;
  if(company.address){doc.text(company.address,margin,ay);ay+=4.5;}
  if(company.phone){doc.text('Phone: '+company.phone,margin,ay);ay+=4.5;}
  if(company.email){doc.text('Email: '+company.email,margin,ay);}
  doc.setFont('helvetica','bold'); doc.setFontSize(24); doc.setTextColor(a.r,a.g,a.b);
  doc.text(isReceipt?'RECEIPT':'INVOICE', pageW-margin, y+8, {align:'right'});
  if(isReceipt){doc.setFontSize(11);doc.setTextColor(16,185,129);doc.text('PAID',pageW-margin,y+18,{align:'right'});}
  y+=36;
  doc.setDrawColor(203,213,225); doc.setLineWidth(0.4); doc.line(margin,y,pageW-margin,y); y+=8;
  // BILLED TO
  doc.setFontSize(7);doc.setFont('helvetica','bold');doc.setTextColor(100,116,139);doc.text('BILLED TO',margin,y);
  doc.setFontSize(10);doc.setFont('helvetica','bold');doc.setTextColor(15,23,42);doc.text(inv.clientName||'Client',margin,y+6);
  doc.setFontSize(8);doc.setFont('helvetica','normal');doc.setTextColor(71,85,105);
  if(inv.clientAddress)doc.text(inv.clientAddress,margin,y+12);
  if(inv.clientEmail)doc.text(inv.clientEmail,margin,y+17);
  // META RIGHT
  const rx=pageW-margin; let my=y+6;
  [['Date:',inv.date||''],[isReceipt?'Receipt #:':'Invoice #:',docNum],['Due Date:',inv.dueDate||'']].forEach(([l,v])=>{
    doc.setFont('helvetica','bold');doc.setTextColor(15,23,42);doc.setFontSize(8);doc.text(l,rx-38,my);
    doc.setFont('helvetica','normal');doc.text(v,rx,my,{align:'right'});my+=6;
  });
  y+=30;
  // TABLE HEADER
  doc.setFillColor(a.r,a.g,a.b);doc.rect(margin,y,contentW,8,'F');
  doc.setFontSize(8);doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);
  const C={d:margin+3,q:margin+contentW*0.62,p:margin+contentW*0.78,t:margin+contentW};
  doc.text('Description',C.d,y+5.5);doc.text('Qty',C.q,y+5.5,{align:'right'});
  doc.text('Price',C.p,y+5.5,{align:'right'});doc.text('Amount',C.t,y+5.5,{align:'right'});
  y+=8;
  // TABLE ROWS
  (inv.items||[]).forEach((item,i)=>{
    if(i%2===0){doc.setFillColor(248,250,252);doc.rect(margin,y,contentW,9,'F');}
    doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(51,65,85);
    const amt=(Number(item.quantity||0)*Number(item.price||0)).toFixed(2);
    doc.text(item.description||'',C.d,y+6);
    doc.text(String(item.quantity||0),C.q,y+6,{align:'right'});
    doc.text('Ksh '+Number(item.price||0).toFixed(2),C.p,y+6,{align:'right'});
    doc.text('Ksh '+amt,C.t,y+6,{align:'right'});
    y+=9;
  });
  y+=4;
  // TOTAL
  const total=(inv.items||[]).reduce((s,i)=>s+Number(i.quantity||0)*Number(i.price||0),0);
  const tx=pageW-margin-60;
  doc.setDrawColor(a.r,a.g,a.b);doc.setLineWidth(0.5);doc.line(tx,y,pageW-margin,y);y+=5;
  doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(a.r,a.g,a.b);
  doc.text('Total Due:',tx,y+5);doc.text('Ksh '+total.toFixed(2),pageW-margin,y+5,{align:'right'});
  doc.line(tx,y+8,pageW-margin,y+8);y+=18;
  // PAYMENT DETAILS
  if(company.paymentDetails){
    doc.setDrawColor(a.r,a.g,a.b);doc.setLineWidth(1);doc.line(margin,y,margin,y+22);doc.setLineWidth(0.1);
    doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(a.r,a.g,a.b);doc.text('PAYMENT DETAILS',margin+4,y+5);
    doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(71,85,105);
    const lines=doc.splitTextToSize(company.paymentDetails,contentW*0.65);
    doc.text(lines,margin+4,y+10);y+=lines.length*4.5+14;
  }
  // NOTES
  if(inv.notes){
    doc.setDrawColor(226,232,240);doc.setLineWidth(0.3);doc.line(margin,y,pageW-margin,y);y+=5;
    doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(100,116,139);
    doc.text(inv.notes,pageW/2,y,{align:'center'});
  }
  return doc.output('blob');
};

const generateNextInvoiceNumber = (historyList) => {
  if (!historyList || historyList.length === 0) return 'INV-0001';
  let maxNum = 0;
  historyList.forEach(inv => {
    const match = inv.invoiceNumber.match(/\d+$/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (num > maxNum) maxNum = num;
    }
  });
  return `INV-${String(maxNum + 1).padStart(4, '0')}`;
};

export default function InvoiceGenerator({ company }) {
  const [activeTab, setActiveTab] = useState('create'); // 'create', 'history'
  const [history, setHistory] = useState(() => getInvoices(company.id));
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'paid', 'unpaid'
  const [summaryPeriod, setSummaryPeriod] = useState('all'); // 'all', 'week', 'month', 'year'
  const [isReceiptMode, setIsReceiptMode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareModal, setShareModal] = useState(null); // null or invoice object
  const [shareMessage, setShareMessage] = useState('');
  const [scale, setScale] = useState(1);
  const wrapperRef = useRef(null);
  const previewRef = useRef(null);
  const pdfRef = useRef(null);

  const [invoiceData, setInvoiceData] = useState(() => ({
    invoiceNumber: generateNextInvoiceNumber(getInvoices(company.id)),
    date: format(new Date(), 'yyyy-MM-dd'),
    dueDate: format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    clientName: '',
    clientAddress: '',
    clientEmail: '',
    items: [{ id: uuidv4(), description: '', quantity: 1, price: 0 }],
    notes: 'Thank you for your business!',
  }));

  const handleToggleStatus = (invoice) => {
    const newStatus = invoice.status === 'paid' ? 'unpaid' : 'paid';
    const updatedInvoice = { ...invoice, status: newStatus };
    const updatedHistory = saveInvoice(updatedInvoice);
    setHistory(updatedHistory.filter(i => i.companyId === company.id));
  };
  
  useEffect(() => {
    const updateScale = () => {
      if (wrapperRef.current) {
        const availableWidth = wrapperRef.current.offsetWidth - 64;
        const sheetWidth = 794;
        if (availableWidth < sheetWidth) {
          setScale(availableWidth / sheetWidth);
        } else {
          setScale(1);
        }
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    const observer = new ResizeObserver(updateScale);
    if (wrapperRef.current) observer.observe(wrapperRef.current);
    
    return () => {
      window.removeEventListener('resize', updateScale);
      observer.disconnect();
    };
  }, [activeTab, isReceiptMode, invoiceData]);

  const handleViewOldInvoice = (inv) => {
    setInvoiceData(inv);
    setIsReceiptMode(false);
    setActiveTab('create');
  };

  const handleGenerateReceiptFromHistory = (inv) => {
    setInvoiceData(inv);
    setIsReceiptMode(true);
    setActiveTab('create');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNewInvoice = () => {
    setInvoiceData({
      invoiceNumber: generateNextInvoiceNumber(history),
      date: format(new Date(), 'yyyy-MM-dd'),
      dueDate: format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      clientName: '',
      clientAddress: '',
      clientEmail: '',
      items: [{ id: uuidv4(), description: '', quantity: 1, price: 0 }],
      notes: 'Thank you for your business!',
    });
    setActiveTab('create');
  };

  const handleDeleteOldInvoice = (id) => {
    if (window.confirm('Are you sure you want to delete this invoice record?')) {
      const updatedInvoices = deleteInvoice(id);
      setHistory(updatedInvoices.filter(i => i.companyId === company.id));
    }
  };

  const handleShareWhatsApp = (inv) => {
    const text = `Hello ${inv.clientName || ''}, here are the details for Invoice ${inv.invoiceNumber}:\n\nTotal Due: Ksh ${inv.total.toFixed(2)}\nDue Date: ${inv.dueDate}\n\nPlease let me know if you need the PDF copy. Thank you!`;
    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  };

  const handleShareEmail = (inv) => {
    const subject = `Invoice ${inv.invoiceNumber} from ${company.name}`;
    const body = `Hello ${inv.clientName || ''},\n\nHere are the details for your invoice:\nInvoice Number: ${inv.invoiceNumber}\nDate: ${inv.date}\nTotal Due: Ksh ${inv.total.toFixed(2)}\n\nPlease let me know if you need the PDF copy.\n\nBest regards,\n${company.name}`;
    const mailtoLink = `mailto:${inv.clientEmail || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
  };

  const handleShareUniversal = (inv) => {
    const docType = inv.status === 'paid' ? 'Receipt' : 'Invoice';
    const defaultMsg = `Hello ${inv.clientName || 'there'},\n\nPlease find your ${docType} (${inv.invoiceNumber}) attached.\n\nAmount: Ksh ${(inv.total || 0).toFixed(2)}\nDue Date: ${inv.dueDate || ''}\n\nThank you for your business!\n\n— ${company.name}`;
    setShareMessage(defaultMsg);
    setShareModal(inv);
  };

  const executeShare = async (inv) => {
    setShareModal(null);
    setIsGenerating(true);
    
    // Sync state to match the invoice being shared
    setInvoiceData(inv);
    setIsReceiptMode(inv.status === 'paid');
    
    const docType = inv.status === 'paid' ? 'Receipt' : 'Invoice';
    const fileName = `${inv.invoiceNumber}_${docType}.pdf`;

    try {
      // Use pure jsPDF - no html2canvas, works on Android WebView 100%
      const pdfBlob = buildPDFBlob(inv, company, inv.status === 'paid');
      setIsGenerating(false);

      // NATIVE APK SHARING (Capacitor)
      if (Capacitor.isNativePlatform()) {
        const reader = new FileReader();
        reader.readAsDataURL(pdfBlob);
        reader.onloadend = async () => {
          try {
            const base64data = reader.result.split(',')[1];
            const fileResult = await Filesystem.writeFile({
              path: fileName,
              data: base64data,
              directory: Directory.Cache
            });
            await Share.share({
              title: fileName,
              text: `Hello ${inv.clientName || ''}, please find your ${docType} attached.`,
              url: fileResult.uri,
            });
          } catch (e) {
            console.error('Native share error', e);
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url; a.download = fileName; a.click();
            URL.revokeObjectURL(url);
          }
        };
        return;
      }

      // WEB: Try Web Share API with file attachment
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName, text: `Hello ${inv.clientName || ''}, please find your ${docType} attached.` });
        return;
      }

      // FALLBACK: Force download (desktop Chrome on HTTP)
      const blobUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = blobUrl; link.download = fileName;
      document.body.appendChild(link); link.click();
      document.body.removeChild(link); URL.revokeObjectURL(blobUrl);
      alert(`✅ "${fileName}" has been downloaded!\n\nAttach it manually when you share via WhatsApp or Email.`);

    } catch (err) {
      setIsGenerating(false);
      if (err.name !== 'AbortError') {
        console.error('PDF Share failed:', err);
        alert('Could not generate the PDF: ' + err.message);
      }
    }
  };


  const calculateSubtotal = () => {
    return invoiceData.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  };

  const handleAddItem = () => {
    setInvoiceData({
      ...invoiceData,
      items: [...invoiceData.items, { id: uuidv4(), description: '', quantity: 1, price: 0 }]
    });
  };

  const handleRemoveItem = (id) => {
    setInvoiceData({
      ...invoiceData,
      items: invoiceData.items.filter(item => item.id !== id)
    });
  };

  const handleItemChange = (id, field, value) => {
    setInvoiceData({
      ...invoiceData,
      items: invoiceData.items.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      )
    });
  };

  const renderInvoiceSheet = (ref, currentScale = 1) => (
    <div className="invoice-sheet" ref={ref} style={{ padding: '40px', zoom: currentScale, position: 'relative', backgroundColor: 'white' }}>
      {isReceiptMode && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) rotate(-15deg)',
          border: '10px solid rgba(16, 185, 129, 0.2)',
          color: 'rgba(16, 185, 129, 0.2)',
          fontSize: '8rem',
          fontWeight: 900,
          padding: '1rem 4rem',
          borderRadius: '30px',
          pointerEvents: 'none',
          zIndex: 10,
          letterSpacing: '0.1em'
        }}>
          PAID
        </div>
      )}
      
      <div className="flex justify-between items-start">
        {company.logo ? (
          <div className="flex items-center gap-6" style={{ maxWidth: '70%' }}>
            <img src={company.logo} alt="Company Logo" className="invoice-logo" style={{ height: `${company.logoSize || 80}px`, objectFit: 'contain' }} />
            <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: '1.5' }}>
              <p style={{ fontWeight: 700, color: '#0f172a', fontSize: '1.1rem', margin: 0, marginBottom: '0.25rem' }}>{company.name}</p>
              {company.address && <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{company.address}</p>}
              {company.phone && <p style={{ margin: 0 }}>Phone: {company.phone}</p>}
              {company.email && <p style={{ margin: 0 }}>Email: {company.email}</p>}
            </div>
          </div>
        ) : (
          <div>
            <h1 style={{ color: company.accentColor || '#1e293b', fontSize: '1.5rem', fontWeight: 700, margin: 0, marginBottom: '0.5rem' }}>{company.name}</h1>
            <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: '1.5' }}>
              {company.address && <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{company.address}</p>}
              {company.phone && <p style={{ margin: 0 }}>Phone: {company.phone}</p>}
              {company.email && <p style={{ margin: 0 }}>Email: {company.email}</p>}
            </div>
          </div>
        )}
        <div className="text-right">
          <h2 style={{ color: company.accentColor || '#1e293b', fontSize: '2.5rem', fontWeight: 700, margin: 0, letterSpacing: '0.05em' }}>
            {isReceiptMode ? 'RECEIPT' : 'INVOICE'}
          </h2>
        </div>
      </div>

      <hr style={{ border: 0, borderTop: '2px solid #cbd5e1', margin: '2rem 0' }} />

      <div className="flex justify-between items-start mb-8">
        <div>
          <h4 style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Billed To</h4>
          <p style={{ fontWeight: 700, color: '#0f172a', fontSize: '1rem', margin: 0 }}>{invoiceData.clientName || 'Client Name'}</p>
          {invoiceData.clientAddress && <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: '#475569', margin: '0.25rem 0 0 0' }}>{invoiceData.clientAddress}</p>}
          {invoiceData.clientEmail && <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0.25rem 0 0 0' }}>{invoiceData.clientEmail}</p>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '0.5rem 2rem', fontSize: '0.85rem', color: '#0f172a' }}>
          <span style={{ fontWeight: 600 }}>Date:</span>
          <span style={{ textAlign: 'right' }}>{invoiceData.date}</span>
          <span style={{ fontWeight: 600 }}>{isReceiptMode ? 'Receipt #:' : 'Invoice #:'}</span>
          <span style={{ textAlign: 'right' }}>
            {isReceiptMode ? invoiceData.invoiceNumber.replace('INV-', 'RCPT-') : invoiceData.invoiceNumber}
          </span>
          <span style={{ fontWeight: 600 }}>Due Date:</span>
          <span style={{ textAlign: 'right' }}>{invoiceData.dueDate}</span>
        </div>
      </div>

      <table className="invoice-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
        <thead>
          <tr>
            <th style={{ backgroundColor: company.accentColor || '#1e293b', color: 'white', padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600 }}>Description</th>
            <th style={{ backgroundColor: company.accentColor || '#1e293b', color: 'white', padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: 600 }}>Qty</th>
            <th style={{ backgroundColor: company.accentColor || '#1e293b', color: 'white', padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: 600 }}>Price</th>
            <th style={{ backgroundColor: company.accentColor || '#1e293b', color: 'white', padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: 600 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoiceData.items.map((item) => (
            <tr key={item.id}>
              <td style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', color: '#334155', fontSize: '0.9rem' }}>{item.description || 'Item description'}</td>
              <td style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', color: '#334155', fontSize: '0.9rem', textAlign: 'right' }}>{item.quantity}</td>
              <td style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', color: '#334155', fontSize: '0.9rem', textAlign: 'right' }}>Ksh {Number(item.price).toFixed(2)}</td>
              <td style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', color: '#334155', fontSize: '0.9rem', textAlign: 'right' }}>Ksh {(item.quantity * item.price).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ width: '300px', marginLeft: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 1rem', fontSize: '0.9rem', color: '#334155', fontWeight: 600 }}>
          <span>Subtotal:</span>
          <span>Ksh {subtotal.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', fontSize: '1rem', fontWeight: 700, color: company.accentColor || '#1e293b', borderTop: `2px solid ${company.accentColor || '#1e293b'}`, borderBottom: `2px solid ${company.accentColor || '#1e293b'}`, marginTop: '0.5rem' }}>
          <div className="flex-col"><span>Total</span><span>Due:</span></div>
          <div className="flex-col" style={{ textAlign: 'right' }}><span>Ksh</span><span>{subtotal.toFixed(2)}</span></div>
        </div>
      </div>

      {company.paymentDetails && (
        <div style={{ backgroundColor: '#f8fafc', borderLeft: `4px solid ${company.accentColor || '#1e293b'}`, padding: '1.25rem', marginTop: '2rem', width: '65%' }}>
          <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.75rem', fontWeight: 700, color: company.accentColor || '#1e293b', letterSpacing: '0.05em', margin: 0 }}>Payment Details</h4>
          <p style={{ whiteSpace: 'pre-wrap', color: '#475569', fontSize: '0.85rem', margin: 0, marginTop: '0.5rem', lineHeight: '1.5' }}>{company.paymentDetails}</p>
        </div>
      )}

      {invoiceData.notes && (
        <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.85rem', textAlign: 'center' }}>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{invoiceData.notes}</p>
        </div>
      )}
    </div>
  );

  const handleGeneratePDF = async () => {
    setIsGenerating(true);
    
    // Save to history first
    const isNew = !history.find(inv => inv.id === invoiceData.id);
    if (isNew) {
      const newInvoice = {
        ...invoiceData,
        id: uuidv4(),
        companyId: company.id,
        total: calculateSubtotal(),
        status: 'unpaid',
        createdAt: new Date().toISOString()
      };
      const updatedHistory = saveInvoice(newInvoice);
      setHistory(updatedHistory.filter(i => i.companyId === company.id));
    }

    const fileName = `${invoiceData.invoiceNumber}_${isReceiptMode ? 'Receipt' : 'Invoice'}.pdf`;

    try {
      // Use pure jsPDF — no html2canvas needed
      const pdfBlob = buildPDFBlob(invoiceData, company, isReceiptMode);
      setIsGenerating(false);

      // Trigger download
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      alert(`✅ "${fileName}" saved to your downloads!`);
    } catch (err) {
      console.error('PDF Generation failed:', err);
      setIsGenerating(false);
      alert('Failed to generate PDF: ' + err.message);
    }
  };


  const subtotal = calculateSubtotal();

  if (activeTab === 'history') {
    const filterByPeriod = (inv) => {
      if (summaryPeriod === 'all') return true;
      const invDate = new Date(inv.date);
      const now = new Date();
      if (summaryPeriod === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return invDate >= weekAgo;
      }
      if (summaryPeriod === 'month') {
        return invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear();
      }
      if (summaryPeriod === 'year') {
        return invDate.getFullYear() === now.getFullYear();
      }
      return true;
    };

    const periodHistory = history.filter(filterByPeriod);

    const totalPaid = periodHistory
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.total, 0);
    
    const totalUnpaid = periodHistory
      .filter(inv => (inv.status || 'unpaid') === 'unpaid')
      .reduce((sum, inv) => sum + inv.total, 0);
    
    const totalInvoiced = totalPaid + totalUnpaid;

    const filteredHistory = history
      .filter(inv => {
        const matchesSearch = inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (inv.clientName && inv.clientName.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesDate = !dateFilter || inv.date === dateFilter;
        const matchesStatus = statusFilter === 'all' || (inv.status || 'unpaid') === statusFilter;
        return matchesSearch && matchesDate && matchesStatus;
      })
      .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

    return (
      <div className="animate-fade-in">
        {/* Financial Summary */}
        <div className="flex justify-between items-center mb-4">
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Financial Overview</h3>
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-secondary" />
            <select 
              value={summaryPeriod} 
              onChange={(e) => setSummaryPeriod(e.target.value)}
              className="search-input"
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem', width: 'auto' }}
            >
              <option value="all">All Time</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="glass-panel stat-card" style={{ borderLeftColor: '#10b981' }}>
            <label>Total Collected</label>
            <div className="stat-value text-success">Ksh {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="glass-panel stat-card" style={{ borderLeftColor: '#ef4444' }}>
            <label>Pending Payments</label>
            <div className="stat-value text-danger">Ksh {totalUnpaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="glass-panel stat-card">
            <label>Total Invoiced</label>
            <div className="stat-value">Ksh {totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 style={{ margin: 0 }}>Invoice History</h2>
          <button 
            className="btn btn-primary" 
            onClick={handleNewInvoice} 
            style={{ width: '100%', sm: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem' }}
          >
            <Plus size={20} /> Create New Invoice
          </button>
        </div>

        <div className="glass-panel mb-8" style={{ padding: '1rem' }}>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex flex-col sm:flex-row gap-3">
              <div className="flex flex-col gap-1.5 flex-1">
                <label style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.6 }}>STATUS</label>
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="search-input"
                  style={{ width: '100%' }}
                >
                  <option value="all">All Statuses</option>
                  <option value="paid">Paid Only</option>
                  <option value="unpaid">Unpaid Only</option>
                </select>
              </div>
              
              <div className="flex flex-col gap-1.5 flex-1">
                <label style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.6 }}>DATE</label>
                <div className="flex gap-2">
                  <input 
                    type="date" 
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="search-input"
                    style={{ flex: 1 }}
                  />
                  {dateFilter && (
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '0.5rem', fontSize: '0.75rem' }}
                      onClick={() => setDateFilter('')}
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-1.5">
              <label style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.6 }}>SEARCH CLIENT OR INVOICE #</label>
              <input 
                type="text" 
                placeholder="Ex: INV-001 or Sony Sugar..." 
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: activeTab === 'history' && window.innerWidth < 768 ? '0' : '1.5rem', background: activeTab === 'history' && window.innerWidth < 768 ? 'transparent' : 'var(--panel-bg)', border: activeTab === 'history' && window.innerWidth < 768 ? 'none' : '1px solid var(--panel-border)' }}>
          {filteredHistory.length === 0 ? (
            <div className="text-center py-8 glass-panel">
              <Clock size={48} color="var(--text-secondary)" style={{ margin: '0 auto 1rem auto' }} />
              <p>{searchTerm ? 'No invoices match your search.' : 'No invoices generated yet for this business.'}</p>
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="desktop-history-table">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>#</th>
                      <th>Status</th>
                      <th>Invoice #</th>
                      <th>Date</th>
                      <th>Client</th>
                      <th className="text-right">Total</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((inv, index) => (
                      <tr key={inv.id}>
                        <td className="text-secondary font-bold">#{filteredHistory.length - index}</td>
                        <td>
                          <span className={`status-badge ${inv.status || 'unpaid'}`}>
                            {(inv.status || 'unpaid').toUpperCase()}
                          </span>
                        </td>
                        <td className="font-medium text-accent">{inv.invoiceNumber}</td>
                        <td>{inv.date}</td>
                        <td className="font-medium">{inv.clientName || 'Unknown Client'}</td>
                        <td className="text-right font-bold text-lg">Ksh {inv.total.toLocaleString()}</td>
                        <td className="text-right flex gap-2 justify-end">
                          <button 
                            className="btn btn-secondary" 
                            style={{ 
                              padding: '0.4rem 0.6rem', 
                              background: inv.status === 'paid' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(156, 163, 175, 0.1)',
                              color: inv.status === 'paid' ? '#10b981' : 'var(--text-secondary)',
                              borderColor: 'transparent'
                            }} 
                            onClick={() => handleToggleStatus(inv)} 
                            title={inv.status === 'paid' ? 'Mark as Unpaid' : 'Mark as Paid'}
                          >
                            {inv.status === 'paid' ? <CheckCircle size={16} /> : <Circle size={16} />}
                          </button>
                          
                          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem', color: 'var(--accent)', background: 'rgba(59, 130, 246, 0.1)', borderColor: 'transparent' }} onClick={() => handleShareUniversal(inv)} title="Share">
                            <Share2 size={16} />
                          </button>
                          
                          <button className="btn btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', fontWeight: 600 }} onClick={() => handleViewOldInvoice(inv)}>View / Edit</button>
                          
                          {inv.status === 'paid' && (
                            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'transparent' }} onClick={() => handleGenerateReceiptFromHistory(inv)} title="Generate Receipt">
                              <Receipt size={16} />
                            </button>
                          )}
                          
                          <button className="btn btn-danger" style={{ padding: '0.4rem 0.6rem', borderColor: 'transparent' }} onClick={() => handleDeleteOldInvoice(inv.id)} title="Delete Invoice">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="mobile-history-list">
                {filteredHistory.map((inv, index) => (
                  <div key={inv.id} className={`history-card ${inv.status || 'unpaid'}`}>
                    <div className="history-card-index">#{filteredHistory.length - index}</div>
                    <div className="history-card-content">
                      <div className="history-card-row mb-2">
                        <span className="history-card-number text-accent">#{filteredHistory.length - index} • {inv.invoiceNumber}</span>
                        <span className={`status-badge ${inv.status || 'unpaid'}`}>
                          {(inv.status || 'unpaid').toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="history-card-client text-xl font-bold mb-1">{inv.clientName || 'Unknown Client'}</div>
                      <div className="text-secondary text-sm mb-4">{inv.date}</div>
                      
                      <div className="history-card-row pt-4 border-t border-dashed" style={{ borderColor: 'var(--panel-border)' }}>
                        <span className="history-card-total text-2xl">Ksh {inv.total.toLocaleString()}</span>
                        <div className="flex gap-3">
                          <button 
                            className="btn btn-secondary" 
                            style={{ 
                              padding: '0.75rem', 
                              background: inv.status === 'paid' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(156, 163, 175, 0.1)',
                              color: inv.status === 'paid' ? '#10b981' : 'var(--text-secondary)',
                              borderColor: 'transparent',
                              borderRadius: '12px'
                            }} 
                            onClick={() => handleToggleStatus(inv)}
                          >
                            {inv.status === 'paid' ? <CheckCircle size={20} /> : <Circle size={20} />}
                          </button>
                          
                          <button className="btn btn-secondary" style={{ padding: '0.75rem', color: 'var(--accent)', background: 'rgba(59, 130, 246, 0.1)', borderColor: 'transparent', borderRadius: '12px' }} onClick={() => handleShareUniversal(inv)}>
                            <Share2 size={20} />
                          </button>
                          
                          <button className="btn btn-secondary" style={{ padding: '0.75rem 1.25rem', fontSize: '0.9rem', fontWeight: 700, borderRadius: '12px' }} onClick={() => handleViewOldInvoice(inv)}>View</button>

                          {inv.status === 'paid' && (
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '0.75rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'transparent', borderRadius: '12px' }} 
                              onClick={() => handleGenerateReceiptFromHistory(inv)}
                            >
                              <Receipt size={20} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="invoice-layout animate-fade-in">
      {/* Editor Panel */}
      <div className="glass-panel">
        <div className="flex justify-between items-center mb-6">
          <h3>Invoice Details</h3>
          <button className="btn btn-secondary" onClick={() => setActiveTab('history')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
            <Clock size={16} /> History
          </button>
        </div>
        
        <div className="form-group">
          <label>Client Name</label>
          <input type="text" placeholder="Client Name or Company" value={invoiceData.clientName} onChange={e => setInvoiceData({...invoiceData, clientName: e.target.value})} />
        </div>
        
        <div className="form-group">
          <label>Client Email</label>
          <input type="email" placeholder="client@example.com" value={invoiceData.clientEmail} onChange={e => setInvoiceData({...invoiceData, clientEmail: e.target.value})} />
        </div>

        <div className="form-group">
          <label>Client Address</label>
          <textarea rows="2" placeholder="Client Address" value={invoiceData.clientAddress} onChange={e => setInvoiceData({...invoiceData, clientAddress: e.target.value})}></textarea>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="form-group">
            <label>Invoice Number</label>
            <input type="text" value={invoiceData.invoiceNumber} onChange={e => setInvoiceData({...invoiceData, invoiceNumber: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Invoice Date</label>
            <input type="date" value={invoiceData.date} onChange={e => setInvoiceData({...invoiceData, date: e.target.value})} />
          </div>
        </div>

        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h4>Line Items</h4>
          </div>
          
          <div className="flex-col gap-4">
            {invoiceData.items.map((item, index) => (
              <div key={item.id} className="flex gap-2 items-start p-4" style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
                <div className="flex-col gap-2 flex" style={{ flex: 1 }}>
                  <input type="text" placeholder="Description" value={item.description} onChange={e => handleItemChange(item.id, 'description', e.target.value)} />
                  <div className="flex gap-2">
                    <input type="number" min="1" placeholder="Qty" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', Number(e.target.value))} style={{ width: '80px' }} />
                    <input type="number" min="0" step="0.01" placeholder="Price" value={item.price} onChange={e => handleItemChange(item.id, 'price', Number(e.target.value))} style={{ flex: 1 }} />
                  </div>
                </div>
                <button className="btn btn-danger" onClick={() => handleRemoveItem(item.id)} style={{ padding: '0.75rem' }} disabled={invoiceData.items.length === 1}>
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
          
          <button className="btn btn-secondary w-full mt-4" onClick={handleAddItem}>
            <Plus size={18} /> Add Item
          </button>
        </div>

        <div className="form-group mt-8">
          <label>Notes / Terms</label>
          <textarea rows="2" value={invoiceData.notes} onChange={e => setInvoiceData({...invoiceData, notes: e.target.value})}></textarea>
        </div>
        
        <button className="btn btn-primary w-full mt-8" onClick={handleGeneratePDF} style={{ padding: '1rem', fontSize: '1.1rem' }}>
          {isReceiptMode ? <Receipt size={20} style={{ marginRight: '0.5rem' }} /> : <Download size={20} style={{ marginRight: '0.5rem' }} />}
          {isReceiptMode ? 'Generate Official Receipt' : 'Generate PDF Invoice'}
        </button>
        {isReceiptMode && (
          <button className="btn btn-secondary w-full mt-2" onClick={() => setIsReceiptMode(false)}>
            Switch back to Invoice
          </button>
        )}
      </div>

      {/* Preview Panel */}
      <div className="invoice-preview-wrapper" ref={wrapperRef}>
        {renderInvoiceSheet(previewRef, scale)}
      </div>

      {/* Hidden PDF Capture - must be at 0,0 so Android WebView can render it */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '794px', opacity: 0, pointerEvents: 'none', zIndex: -1, overflow: 'hidden' }}>
        {renderInvoiceSheet(pdfRef, 1)}
      </div>

      {/* Share Message Modal */}
      {shareModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9998, display: 'flex',
          alignItems: 'flex-end', justifyContent: 'center', padding: '1rem'
        }} onClick={() => setShareModal(null)}>
          <div style={{
            background: 'var(--panel-bg)', backdropFilter: 'blur(20px)',
            borderRadius: '20px 20px 0 0', padding: '1.5rem', width: '100%',
            maxWidth: '600px', border: '1px solid var(--panel-border)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>📤 Share Message</h3>
              <button onClick={() => setShareModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>×</button>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Edit your message before sharing. It will be copied to your clipboard automatically.</p>
            <textarea
              value={shareMessage}
              onChange={e => setShareMessage(e.target.value)}
              rows={7}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: '10px',
                border: '1px solid var(--panel-border)', background: 'rgba(0,0,0,0.2)',
                color: 'var(--text-primary)', fontSize: '0.9rem', resize: 'vertical',
                fontFamily: 'var(--font-family)', lineHeight: 1.5
              }}
            />
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => {
                  navigator.clipboard?.writeText(shareMessage);
                  setShareModal(null);
                  alert('✅ Message copied to clipboard!');
                }}
              >
                Copy Only
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 2 }}
                onClick={() => {
                  navigator.clipboard?.writeText(shareMessage);
                  executeShare(shareModal);
                }}
              >
                <Share2 size={16} style={{ marginRight: '0.4rem' }} />
                Copy & Share PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isGenerating && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
          backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', 
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' 
        }}>
          <div className="animate-spin mb-4" style={{ width: '40px', height: '40px', border: '4px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
          <p style={{ fontSize: '1.2rem', fontWeight: 600 }}>Generating PDF...</p>
          <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>This will only take a moment</p>
        </div>
      )}
    </div>
  );
}
