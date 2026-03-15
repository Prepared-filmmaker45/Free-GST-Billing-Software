import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, Trash2, Download, Save, UserPlus, Users } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { saveBill, getNextInvoiceNumber, getTermsTemplates, getAllClients, saveClient, getProfile } from '../store';
import { INDIAN_STATES, INVOICE_TYPES } from '../utils';
import { ensureToken, findOrCreateFolder, uploadPDF } from '../services/googleDrive';
import InvoicePreview from './InvoicePreview';
import { toast } from './Toast';

export default function InvoiceGenerator({ onBack, profile, editingBill }) {
  const [invoiceType, setInvoiceType] = useState('tax-invoice');
  const [client, setClient] = useState({ name: '', address: '', state: '', gstin: '' });
  const [details, setDetails] = useState({
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    placeOfSupply: '',
    originalInvoiceRef: '',
  });

  const [items, setItems] = useState([
    { id: Date.now().toString(), name: '', hsn: '', quantity: 1, rate: 0, discount: 0, taxPercent: 18 }
  ]);

  const [totals, setTotals] = useState({ subtotal: 0, totalDiscount: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });
  const [saving, setSaving] = useState(false);
  const [termsTemplates, setTermsTemplates] = useState([]);
  const [selectedTermsId, setSelectedTermsId] = useState('');
  const [customTerms, setCustomTerms] = useState('');
  const [savedClients, setSavedClients] = useState([]);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const printRef = useRef(null);

  const typeConfig = INVOICE_TYPES[invoiceType];
  const showGST = typeConfig?.showGST !== false;

  // Load terms templates and saved clients
  useEffect(() => {
    getTermsTemplates().then(templates => {
      setTermsTemplates(templates);
      if (templates.length > 0 && !selectedTermsId) {
        setSelectedTermsId(templates[0].id);
        setCustomTerms(templates[0].content);
      }
    });
    getAllClients().then(setSavedClients);
  }, []);

  // Initialize from editing bill or generate new number
  useEffect(() => {
    if (editingBill?.data) {
      const d = editingBill.data;
      setClient(d.client);
      setItems(d.items);
      setInvoiceType(d.invoiceType || 'tax-invoice');
      if (d.customTerms !== undefined) setCustomTerms(d.customTerms);

      if (editingBill._isDuplicate) {
        const type = d.invoiceType || 'tax-invoice';
        const prefix = INVOICE_TYPES[type]?.prefix || 'INV';
        getNextInvoiceNumber(prefix).then(num => {
          setDetails({ ...d.details, invoiceNumber: num, invoiceDate: new Date().toISOString().split('T')[0] });
        });
      } else {
        setDetails(d.details);
      }
    } else {
      getNextInvoiceNumber('INV').then(num => {
        setDetails(prev => ({ ...prev, invoiceNumber: num }));
      });
    }
  }, [editingBill]);

  const handleTypeChange = async (type) => {
    setInvoiceType(type);
    const prefix = INVOICE_TYPES[type]?.prefix || 'INV';
    const num = await getNextInvoiceNumber(prefix);
    setDetails(prev => ({ ...prev, invoiceNumber: num }));
  };

  // Recalculate totals
  useEffect(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let taxTotal = 0;

    items.forEach(item => {
      const amount = item.quantity * item.rate;
      const discount = item.discount || 0;
      const afterDiscount = amount - discount;
      subtotal += amount;
      totalDiscount += discount;
      if (showGST) {
        taxTotal += (afterDiscount * (item.taxPercent || 0)) / 100;
      }
    });

    const businessState = profile?.state?.trim().toLowerCase();
    const clientState = client?.state?.trim().toLowerCase();
    const isInterstate = businessState && clientState && businessState !== clientState;

    setTotals({
      subtotal,
      totalDiscount,
      cgst: isInterstate ? 0 : taxTotal / 2,
      sgst: isInterstate ? 0 : taxTotal / 2,
      igst: isInterstate ? taxTotal : 0,
      total: subtotal - totalDiscount + taxTotal
    });
  }, [items, client.state, profile?.state, showGST]);

  const handleItemChange = (id, field, value) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const addItem = () => {
    setItems(prev => [...prev, {
      id: Date.now().toString(), name: '', hsn: '', quantity: 1, rate: 0, discount: 0,
      taxPercent: showGST ? 18 : 0
    }]);
  };

  const removeItem = (id) => {
    if (items.length > 1) setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleTermsSelect = (templateId) => {
    setSelectedTermsId(templateId);
    const tpl = termsTemplates.find(t => t.id === templateId);
    if (tpl) setCustomTerms(tpl.content);
  };

  const selectSavedClient = (cli) => {
    setClient({ name: cli.name, address: cli.address, state: cli.state, gstin: cli.gstin });
    setShowClientPicker(false);
    toast(`Loaded client: ${cli.name}`, 'info');
  };

  const handleSaveClient = async () => {
    if (!client.name.trim()) { toast('Enter client name first', 'warning'); return; }
    await saveClient({ name: client.name, address: client.address, state: client.state, gstin: client.gstin });
    toast(`Client "${client.name}" saved!`, 'success');
    setSavedClients(await getAllClients());
  };

  const saveInvoiceToDB = async () => {
    const bill = {
      id: details.invoiceNumber,
      clientName: client.name,
      invoiceNumber: details.invoiceNumber,
      invoiceDate: details.invoiceDate,
      invoiceType,
      totalAmount: totals.total,
      totalTaxAmount: totals.cgst + totals.sgst + totals.igst,
      status: 'unpaid',
      data: { profile, client, details, items, totals, invoiceType, customTerms }
    };
    await saveBill(bill);
  };

  // Upload PDF to Google Drive if configured
  const uploadToGoogleDrive = async (pdfBlob, fileName) => {
    try {
      const latestProfile = await getProfile();
      const clientId = latestProfile.googleClientId;
      const folderName = latestProfile.googleDriveFolder || 'GST Biller Invoices';
      if (!clientId) return; // Not configured, skip silently

      const hasToken = await ensureToken(clientId);
      if (!hasToken) {
        toast('Google Drive: Please reconnect in Settings', 'warning');
        return;
      }

      const folderId = await findOrCreateFolder(folderName);
      await uploadPDF(fileName, pdfBlob, folderId);
      toast('Uploaded to Google Drive!', 'success');
    } catch (err) {
      console.error('Google Drive upload error:', err);
      toast('Google Drive upload failed: ' + err.message, 'warning');
    }
  };

  const generatePDF = async () => {
    if (!printRef.current) return;
    try {
      setSaving(true);
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        letterRendering: 1,
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('invoice-preview');
          if (el) el.style.letterSpacing = 'normal';
          clonedDoc.querySelectorAll('*').forEach(node => { node.style.letterSpacing = 'normal'; });
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      if (imgHeight <= pdfPageHeight) {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
      } else {
        let heightLeft = imgHeight;
        let position = 0;
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfPageHeight;
        while (heightLeft > 0) {
          position -= pdfPageHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
          heightLeft -= pdfPageHeight;
        }
      }

      const fileName = `${typeConfig.prefix}_${details.invoiceNumber.replace(/\//g, '-')}.pdf`;
      pdf.save(fileName);
      await saveInvoiceToDB();
      toast('Invoice downloaded & saved!', 'success');

      // Auto-upload to Google Drive
      const pdfBlob = pdf.output('blob');
      uploadToGoogleDrive(pdfBlob, fileName);

    } catch (err) {
      console.error(err);
      toast('Failed to generate PDF.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOnly = async () => {
    try {
      setSaving(true);
      await saveInvoiceToDB();
      toast('Invoice saved!', 'success');
      onBack();
    } catch (err) {
      console.error(err);
      toast('Failed to save.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="generator-container">
      <div className="generator-toolbar">
        <button className="btn btn-secondary" onClick={onBack}><ArrowLeft size={18} /> Back</button>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={handleSaveOnly} disabled={saving}><Save size={18} /> Save Only</button>
          <button className="btn btn-primary" onClick={generatePDF} disabled={saving}>
            <Download size={18} /> {saving ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </div>

      <div className="split-view">
        <div className="editor-pane">

          {/* Invoice Type */}
          <div className="glass-panel p-6 mb-6">
            <h3 className="section-title">Invoice Type</h3>
            <div className="type-selector">
              {Object.entries(INVOICE_TYPES).map(([key, val]) => (
                <button key={key} className={`type-chip ${invoiceType === key ? 'type-chip-active' : ''}`}
                  onClick={() => handleTypeChange(key)}>{val.label}</button>
              ))}
            </div>
            <p className="type-desc">{typeConfig?.description}</p>
          </div>

          {/* Client Details */}
          <div className="glass-panel p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="section-title" style={{ margin: 0 }}>Billed To</h3>
              <div className="flex gap-2">
                {savedClients.length > 0 && (
                  <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                    onClick={() => setShowClientPicker(!showClientPicker)}>
                    <Users size={15} /> {showClientPicker ? 'Hide' : 'Saved Clients'}
                  </button>
                )}
                <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                  onClick={handleSaveClient} title="Save current client for future use">
                  <UserPlus size={15} /> Save Client
                </button>
              </div>
            </div>

            {/* Client picker dropdown */}
            {showClientPicker && savedClients.length > 0 && (
              <div className="client-picker">
                {savedClients.map(cli => (
                  <button key={cli.id} className="client-picker-item" onClick={() => selectSavedClient(cli)}>
                    <strong>{cli.name}</strong>
                    <span>{cli.state}{cli.gstin ? ` | ${cli.gstin}` : ''}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="form-group full-width">
                <label className="form-label">Client Name</label>
                <input type="text" className="form-input" value={client.name}
                  onChange={(e) => setClient({ ...client, name: e.target.value })} placeholder="Company or Individual" />
              </div>
              <div className="form-group full-width">
                <label className="form-label">Billing Address</label>
                <textarea rows="2" className="form-input" value={client.address}
                  onChange={(e) => setClient({ ...client, address: e.target.value })} placeholder="Full billing address" />
              </div>
              <div className="form-group">
                <label className="form-label">State</label>
                <select className="form-input" value={client.state} onChange={(e) => setClient({ ...client, state: e.target.value })}>
                  <option value="">Select State</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">GSTIN</label>
                <input type="text" className="form-input" value={client.gstin}
                  onChange={(e) => setClient({ ...client, gstin: e.target.value.toUpperCase() })} placeholder="Optional" maxLength={15} />
              </div>
            </div>
          </div>

          {/* Invoice Details */}
          <div className="glass-panel p-6 mb-6">
            <h3 className="section-title">Invoice Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Invoice Number</label>
                <input type="text" className="form-input" value={details.invoiceNumber}
                  onChange={(e) => setDetails({ ...details, invoiceNumber: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Invoice Date</label>
                <input type="date" className="form-input" value={details.invoiceDate}
                  onChange={(e) => setDetails({ ...details, invoiceDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input type="date" className="form-input" value={details.dueDate}
                  onChange={(e) => setDetails({ ...details, dueDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Place of Supply</label>
                <select className="form-input" value={details.placeOfSupply}
                  onChange={(e) => setDetails({ ...details, placeOfSupply: e.target.value })}>
                  <option value="">Defaults to Client State</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {invoiceType === 'credit-note' && (
                <div className="form-group full-width">
                  <label className="form-label">Original Invoice Reference</label>
                  <input type="text" className="form-input" value={details.originalInvoiceRef}
                    onChange={(e) => setDetails({ ...details, originalInvoiceRef: e.target.value })} placeholder="e.g. INV/2025-26/0001" />
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="glass-panel p-6 mb-6">
            <h3 className="section-title">Line Items</h3>
            {items.map((item) => (
              <div key={item.id} className="line-item-row">
                <div className="line-item-field" style={{ flex: 2.5 }}>
                  <label className="form-label">Description</label>
                  <input type="text" className="form-input" value={item.name}
                    onChange={(e) => handleItemChange(item.id, 'name', e.target.value)} />
                </div>
                <div className="line-item-field" style={{ flex: 1 }}>
                  <label className="form-label">HSN/SAC</label>
                  <input type="text" className="form-input" value={item.hsn}
                    onChange={(e) => handleItemChange(item.id, 'hsn', e.target.value)} />
                </div>
                <div className="line-item-field" style={{ flex: 0.8 }}>
                  <label className="form-label">Qty</label>
                  <input type="number" min="1" className="form-input" value={item.quantity}
                    onChange={(e) => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="line-item-field" style={{ flex: 1.2 }}>
                  <label className="form-label">Rate</label>
                  <input type="number" min="0" className="form-input" value={item.rate}
                    onChange={(e) => handleItemChange(item.id, 'rate', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="line-item-field" style={{ flex: 1 }}>
                  <label className="form-label">Discount</label>
                  <input type="number" min="0" className="form-input" value={item.discount}
                    onChange={(e) => handleItemChange(item.id, 'discount', parseFloat(e.target.value) || 0)} />
                </div>
                {showGST && (
                  <div className="line-item-field" style={{ flex: 0.8 }}>
                    <label className="form-label">Tax %</label>
                    <select className="form-input" value={item.taxPercent}
                      onChange={(e) => handleItemChange(item.id, 'taxPercent', parseFloat(e.target.value) || 0)}>
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </div>
                )}
                <div className="line-item-field line-item-delete">
                  <button className="icon-btn icon-btn-red" onClick={() => removeItem(item.id)} title="Remove"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
            <button className="btn btn-secondary mt-2" onClick={addItem}><Plus size={18} /> Add Item</button>
          </div>

          {/* Terms */}
          <div className="glass-panel p-6 mb-6">
            <h3 className="section-title">Terms & Conditions</h3>
            {termsTemplates.length > 0 && (
              <div className="form-group">
                <label className="form-label">Load from Template</label>
                <select className="form-input" value={selectedTermsId} onChange={(e) => handleTermsSelect(e.target.value)}>
                  <option value="">-- Custom --</option>
                  {termsTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Terms (appears on invoice)</label>
              <textarea rows="5" className="form-input" value={customTerms}
                onChange={(e) => { setCustomTerms(e.target.value); setSelectedTermsId(''); }}
                placeholder="Enter or paste your terms & conditions..." />
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div className="preview-pane">
          <div className="preview-scaler">
            <InvoicePreview ref={printRef} profile={profile} client={client} details={details}
              items={items} totals={totals} invoiceType={invoiceType} customTerms={customTerms} />
          </div>
        </div>
      </div>
    </div>
  );
}
