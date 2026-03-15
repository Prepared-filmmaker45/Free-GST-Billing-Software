import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { numberToWords, formatCurrency, INVOICE_TYPES } from '../utils';

const InvoicePreview = React.forwardRef(({ profile, client, details, items, totals, invoiceType = 'tax-invoice', customTerms }, ref) => {
  const businessState = profile?.state?.trim().toLowerCase();
  const clientState = client?.state?.trim().toLowerCase();
  const isInterstate = businessState && clientState && businessState !== clientState;
  const typeConfig = INVOICE_TYPES[invoiceType] || INVOICE_TYPES['tax-invoice'];
  const showGST = typeConfig.showGST;
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Generate UPI QR code
  useEffect(() => {
    if (!profile?.upiId || !totals.total) {
      setQrDataUrl('');
      return;
    }
    const upiUrl = `upi://pay?pa=${encodeURIComponent(profile.upiId)}&pn=${encodeURIComponent(profile.businessName || '')}&am=${totals.total.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Payment for ${details?.invoiceNumber || 'Invoice'}`)}`;
    QRCode.toDataURL(upiUrl, { width: 120, margin: 1, errorCorrectionLevel: 'M' })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [profile?.upiId, profile?.businessName, totals.total, details?.invoiceNumber]);

  const accentColors = {
    'tax-invoice': '#1e40af',
    'proforma': '#7c3aed',
    'bill-of-supply': '#0f766e',
    'credit-note': '#be123c',
  };
  const accent = accentColors[invoiceType] || accentColors['tax-invoice'];

  return (
    <div className="invoice-preview-container" ref={ref} id="invoice-preview">
      <div style={{ height: '6px', background: `linear-gradient(90deg, ${accent}, ${accent}cc, ${accent}88)` }} />

      {/* Header */}
      <div className="inv-header">
        <div className="inv-header-left">
          {profile?.logo && (
            <img src={profile.logo} alt="Logo" style={{
              maxHeight: '52px', maxWidth: '160px', objectFit: 'contain', marginBottom: '0.75rem', display: 'block'
            }} />
          )}
          <h1 className="inv-title" style={{ color: accent }}>{typeConfig.title}</h1>
          {invoiceType === 'proforma' && (
            <p style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic', marginBottom: '0.75rem' }}>
              This is not a tax invoice. For estimation purposes only.
            </p>
          )}
          {invoiceType === 'credit-note' && details?.originalInvoiceRef && (
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
              Against Invoice: <strong style={{ color: '#334155' }}>{details.originalInvoiceRef}</strong>
            </p>
          )}
          <div className="inv-meta">
            <div className="inv-meta-row">
              <span className="inv-meta-label">No.</span>
              <span className="inv-meta-value">{details?.invoiceNumber}</span>
            </div>
            <div className="inv-meta-row">
              <span className="inv-meta-label">Date</span>
              <span className="inv-meta-value">
                {details?.invoiceDate ? new Date(details.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
              </span>
            </div>
            {details?.dueDate && (
              <div className="inv-meta-row">
                <span className="inv-meta-label">Due Date</span>
                <span className="inv-meta-value">
                  {new Date(details.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="inv-header-right">
          <h2 className="inv-business-name">{profile?.businessName || 'Your Business'}</h2>
          <div className="inv-business-details">
            {profile?.address && <p>{profile.address}</p>}
            {profile?.state && <p>{profile.state}</p>}
            {profile?.gstin && <p>GSTIN: <strong>{profile.gstin}</strong></p>}
            {profile?.pan && <p>PAN: <strong>{profile.pan}</strong></p>}
            {profile?.email && <p>{profile.email}</p>}
            {profile?.phone && <p>Ph: {profile.phone}</p>}
          </div>
        </div>
      </div>

      {/* Billing parties */}
      <div className="inv-parties">
        <div className="inv-party">
          <h4 className="inv-section-label">BILL TO</h4>
          <p className="inv-party-name">{client?.name || 'Client Name'}</p>
          <div className="inv-party-details">
            {client?.address && <p style={{ whiteSpace: 'pre-line' }}>{client.address}</p>}
            {client?.state && <p>{client.state}</p>}
            {client?.gstin && <p>GSTIN: <strong>{client.gstin}</strong></p>}
          </div>
        </div>
        <div className="inv-party inv-party-right">
          <h4 className="inv-section-label">PLACE OF SUPPLY</h4>
          <p className="inv-party-name">{details?.placeOfSupply || client?.state || '-'}</p>
          {showGST && isInterstate && <span className="inv-tax-badge">Interstate (IGST)</span>}
          {showGST && !isInterstate && businessState && clientState && <span className="inv-tax-badge inv-tax-badge-green">Intrastate (CGST + SGST)</span>}
        </div>
      </div>

      {/* Items table */}
      <table className="inv-table">
        <thead>
          <tr>
            <th className="inv-th" style={{ width: '4%' }}>#</th>
            <th className="inv-th" style={{ width: showGST ? '28%' : '38%' }}>Description</th>
            <th className="inv-th inv-th-center" style={{ width: '10%' }}>HSN/SAC</th>
            <th className="inv-th inv-th-center" style={{ width: '7%' }}>Qty</th>
            <th className="inv-th inv-th-right" style={{ width: '13%' }}>Rate</th>
            <th className="inv-th inv-th-right" style={{ width: '10%' }}>Disc.</th>
            {showGST && <th className="inv-th inv-th-center" style={{ width: '8%' }}>GST</th>}
            <th className="inv-th inv-th-right" style={{ width: showGST ? '15%' : '18%' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const lineAmount = item.quantity * item.rate;
            const discount = item.discount || 0;
            const afterDiscount = lineAmount - discount;
            return (
              <tr key={item.id} className={index % 2 === 0 ? 'inv-tr-even' : ''}>
                <td className="inv-td inv-td-muted">{index + 1}</td>
                <td className="inv-td inv-td-name">{item.name || '-'}</td>
                <td className="inv-td inv-td-center inv-td-muted">{item.hsn || '-'}</td>
                <td className="inv-td inv-td-center">{item.quantity}</td>
                <td className="inv-td inv-td-right">{formatCurrency(item.rate)}</td>
                <td className="inv-td inv-td-right">{discount > 0 ? formatCurrency(discount) : '-'}</td>
                {showGST && (
                  <td className="inv-td inv-td-center">
                    <span className="inv-gst-pill">{item.taxPercent}%</span>
                  </td>
                )}
                <td className="inv-td inv-td-right inv-td-amount">{formatCurrency(afterDiscount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals section */}
      <div className="inv-totals-section">
        <div className="inv-words">
          <h4 className="inv-section-label">AMOUNT IN WORDS</h4>
          <p className="inv-words-text">{numberToWords(totals.total)}</p>
          {/* UPI QR Code */}
          {qrDataUrl && (
            <div style={{ marginTop: '1.25rem' }}>
              <h4 className="inv-section-label">SCAN TO PAY (UPI)</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <img src={qrDataUrl} alt="UPI QR" style={{ width: '90px', height: '90px', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1.5 }}>
                  <p style={{ margin: 0, color: '#94a3b8' }}>UPI ID:</p>
                  <p style={{ margin: 0, color: '#334155', fontWeight: 600, fontSize: '0.75rem' }}>{profile.upiId}</p>
                  <p style={{ margin: '0.25rem 0 0', color: '#94a3b8' }}>{formatCurrency(totals.total)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="inv-totals">
          <div className="inv-total-row">
            <span>Subtotal</span>
            <span>{formatCurrency(totals.subtotal)}</span>
          </div>
          {totals.totalDiscount > 0 && (
            <div className="inv-total-row" style={{ color: '#dc2626' }}>
              <span>Discount</span>
              <span>- {formatCurrency(totals.totalDiscount)}</span>
            </div>
          )}
          {showGST && (
            isInterstate ? (
              <div className="inv-total-row">
                <span>IGST</span>
                <span>{formatCurrency(totals.igst)}</span>
              </div>
            ) : (
              <>
                <div className="inv-total-row">
                  <span>CGST</span>
                  <span>{formatCurrency(totals.cgst)}</span>
                </div>
                <div className="inv-total-row">
                  <span>SGST</span>
                  <span>{formatCurrency(totals.sgst)}</span>
                </div>
              </>
            )
          )}
          <div className="inv-total-row inv-total-final">
            <span>{invoiceType === 'credit-note' ? 'Credit Amount' : 'Total Due'}</span>
            <span style={{ color: accent }}>{formatCurrency(totals.total)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="inv-footer">
        <div className="inv-footer-left">
          {profile?.bankName && (
            <div className="inv-footer-block">
              <h4 className="inv-section-label">BANK DETAILS</h4>
              <div className="inv-footer-details">
                <p><span className="inv-detail-label">Bank:</span> {profile.bankName}</p>
                <p><span className="inv-detail-label">A/C No:</span> {profile.accountNumber}</p>
                <p><span className="inv-detail-label">IFSC:</span> {profile.ifsc}</p>
                {profile.pan && <p><span className="inv-detail-label">PAN:</span> {profile.pan}</p>}
              </div>
            </div>
          )}
          {customTerms && (
            <div className="inv-footer-block">
              <h4 className="inv-section-label">TERMS & CONDITIONS</h4>
              <p className="inv-terms">{customTerms}</p>
            </div>
          )}
        </div>
        <div className="inv-signature">
          {profile?.signature ? (
            <>
              <p className="inv-sig-label">Authorized Signatory</p>
              <img src={profile.signature} alt="Signature" style={{
                maxHeight: '60px', maxWidth: '180px', objectFit: 'contain',
                display: 'block', marginLeft: 'auto', marginBottom: '0.4rem'
              }} />
            </>
          ) : (
            <>
              <p className="inv-sig-label">Authorized Signatory</p>
              <div className="inv-sig-line" />
            </>
          )}
          <p className="inv-sig-name">{profile?.businessName}</p>
        </div>
      </div>

      {/* Watermark for proforma */}
      {invoiceType === 'proforma' && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%) rotate(-35deg)',
          fontSize: '5rem', fontWeight: 800, color: 'rgba(124, 58, 237, 0.04)',
          pointerEvents: 'none', whiteSpace: 'nowrap', letterSpacing: '0.1em'
        }}>
          ESTIMATE
        </div>
      )}
    </div>
  );
});

export default InvoicePreview;
