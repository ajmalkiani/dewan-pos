// ========================================================
// Dewan Mobile POS - Receipt Download, PDF, Share & WhatsApp Module
// ========================================================

window.currentReceiptData = null;

// Utility to get current active invoice number
function getCurrentInvoiceNumber() {
  if (window.currentReceiptData?.invoiceNo) {
    return window.currentReceiptData.invoiceNo;
  }
  // Try extracting from DOM if not set in state
  const invEl = document.querySelector('#printableReceiptArea b');
  if (invEl && invEl.textContent.trim()) {
    return invEl.textContent.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  }
  return 'INV-' + Date.now().toString().slice(-6);
}

// 1. DOWNLOAD RECEIPT AS IMAGE (PNG) - Works on PC and Mobile
async function downloadReceiptAsImage() {
  const container = document.getElementById('printableReceiptArea');
  if (!container || !container.innerText.trim()) {
    showToast('No receipt to download', 'error');
    return;
  }

  const btn = document.getElementById('btnDownloadReceiptPng');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span class="hidden sm:inline">Saving...</span>';
  }

  try {
    if (typeof html2canvas === 'undefined') {
      throw new Error('Image generator library is still loading. Please try again.');
    }

    const invoiceNo = getCurrentInvoiceNumber();
    const canvas = await html2canvas(container, {
      scale: 2.5, // 2.5x high resolution for crisp thermal typography
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      windowWidth: container.scrollWidth,
      windowHeight: container.scrollHeight
    });

    const fileName = `Dewan_Receipt_${invoiceNo}.png`;

    // Modern Blob-based download for mobile and PC
    if (canvas.toBlob) {
      canvas.toBlob((blob) => {
        if (!blob) throw new Error('Failed to create image blob');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = fileName;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        showToast(`Receipt image saved: ${fileName}`, 'success');
      }, 'image/png');
    } else {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`Receipt image saved: ${fileName}`, 'success');
    }
  } catch (err) {
    console.error('Download image error:', err);
    showToast(err.message || 'Failed to save receipt image', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

// 2. DOWNLOAD RECEIPT AS PDF - Works on PC and Mobile
async function downloadReceiptAsPdf() {
  const container = document.getElementById('printableReceiptArea');
  if (!container || !container.innerText.trim()) {
    showToast('No receipt to download', 'error');
    return;
  }

  const btn = document.getElementById('btnDownloadReceiptPdf');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span class="hidden sm:inline">PDF...</span>';
  }

  try {
    if (typeof html2canvas === 'undefined') {
      throw new Error('Generator library not ready. Please try again.');
    }

    const invoiceNo = getCurrentInvoiceNumber();
    const canvas = await html2canvas(container, {
      scale: 2.5,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false
    });

    const imgData = canvas.toDataURL('image/png');
    const fileName = `Dewan_Receipt_${invoiceNo}.pdf`;

    const jsPDFClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (jsPDFClass) {
      // Standard 80mm thermal receipt roll width
      const pdfWidth = 80;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      const doc = new jsPDFClass({
        orientation: 'portrait',
        unit: 'mm',
        format: [pdfWidth, pdfHeight + 6]
      });

      doc.addImage(imgData, 'PNG', 0, 3, pdfWidth, pdfHeight);
      doc.save(fileName);
      showToast(`Receipt PDF saved: ${fileName}`, 'success');
    } else {
      // Fallback: trigger system print/save dialog
      window.print();
    }
  } catch (err) {
    console.error('Download PDF error:', err);
    showToast(err.message || 'Failed to create PDF. Using print dialog.', 'error');
    window.print();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

// 3. SHARE RECEIPT (MOBILE NATIVE SHARE / WHATSAPP / PHOTOS / FILES)
async function shareReceiptMobile() {
  const container = document.getElementById('printableReceiptArea');
  if (!container || !container.innerText.trim()) {
    showToast('No receipt to share', 'error');
    return;
  }

  const invoiceNo = getCurrentInvoiceNumber();
  const fileName = `Dewan_Receipt_${invoiceNo}.png`;

  const btn = document.getElementById('btnShareReceiptMobile');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span class="hidden sm:inline">Sharing...</span>';
  }

  try {
    if (typeof html2canvas === 'undefined') {
      throw new Error('Library not loaded yet.');
    }

    const canvas = await html2canvas(container, {
      scale: 2.5,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false
    });

    // Check if Web Share API with file sharing is supported (Android Chrome, iOS Safari)
    if (navigator.share && navigator.canShare && canvas.toBlob) {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (blob) {
        const file = new File([blob], fileName, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `Dewan Mobile Receipt - ${invoiceNo}`,
            text: `Receipt #${invoiceNo} from Dewan Mobile POS`,
            files: [file]
          });
          showToast('Receipt shared successfully!', 'success');
          return;
        }
      }
    }

    // If Web Share is not supported or device is desktop PC, fallback to image download
    downloadReceiptAsImage();
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn('Share error:', err);
      // User cancelled share dialog is AbortError, otherwise fallback to download
      downloadReceiptAsImage();
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

// 4. SEND RECEIPT VIA WHATSAPP (WITH FORMATTED BILL TEXT)
function sendReceiptViaWhatsApp() {
  const receipt = window.currentReceiptData;
  const invoiceNo = getCurrentInvoiceNumber();

  let customerPhone = '';
  let billText = '';

  if (receipt && receipt.type === 'sale' && receipt.sale) {
    const sale = receipt.sale;
    const shop = receipt.shop || {};
    customerPhone = sale.customerPhone || '';

    const lines = [
      `🧾 *${shop.name || 'DEWAN MOBILE'} - CASH RECEIPT*`,
      `---------------------------------`,
      `📄 *Invoice #:* ${sale.invoiceNo}`,
      `📅 *Date:* ${sale.date}`,
      `👤 *Salesman:* ${sale.salesmanName || 'Staff'}`,
      sale.customerName ? `🧑 *Customer:* ${sale.customerName}` : null,
      `💳 *Payment:* ${sale.paymentMethod || 'Cash'}`,
      `---------------------------------`,
      `🛍️ *ITEMS:*`
    ].filter(Boolean);

    (sale.items || []).forEach((it, idx) => {
      lines.push(`${idx + 1}. *${it.name}*`);
      lines.push(`   ${it.quantity} × Rs. ${Number(it.unitPrice).toLocaleString()} = *Rs. ${Number(it.totalPrice).toLocaleString()}*`);
    });

    lines.push(`---------------------------------`);
    lines.push(`Subtotal: Rs. ${Number(sale.subtotal).toLocaleString()}`);
    if (sale.discount > 0) {
      lines.push(`Discount: - Rs. ${Number(sale.discount).toLocaleString()}`);
    }
    lines.push(`💰 *NET TOTAL: Rs. ${Number(sale.totalAmount).toLocaleString()}*`);
    lines.push(`---------------------------------`);
    if (shop.address) lines.push(`📍 ${shop.address}`);
    if (shop.phone) lines.push(`📞 ${shop.phone}`);
    lines.push(`✨ Thank you for choosing Dewan Mobile!`);

    billText = lines.join('\n');
  } else if (receipt && receipt.type === 'repair' && receipt.repair) {
    const rep = receipt.repair;
    const shop = receipt.shop || {};
    customerPhone = rep.customerPhone || '';

    const lines = [
      `🔧 *${shop.name || 'DEWAN MOBILE'} - REPAIR TICKET*`,
      `---------------------------------`,
      `🎫 *Ticket #:* ${rep.ticketNo}`,
      `📅 *Date:* ${rep.date}`,
      `🧑 *Customer:* ${rep.customerName || '-'}`,
      `📱 *Device:* ${rep.deviceBrand} ${rep.deviceModel}`,
      `🔍 *Fault:* ${rep.faultDescription}`,
      `---------------------------------`,
      `💰 *Estimated Cost:* Rs. ${Number(rep.estimatedCost || 0).toLocaleString()}`,
      `💵 *Advance Paid:* Rs. ${Number(rep.advancePaid || 0).toLocaleString()}`,
      `⚖️ *Balance Due:* Rs. ${Number((rep.estimatedCost || 0) - (rep.advancePaid || 0)).toLocaleString()}`,
      `---------------------------------`,
      `📞 ${shop.phone || '0300-1234567'}`,
      `✨ Thank you!`
    ];
    billText = lines.join('\n');
  } else {
    // Extract plain text from receipt container
    const container = document.getElementById('printableReceiptArea');
    billText = container ? container.innerText.trim() : `Dewan Mobile Receipt #${invoiceNo}`;
  }

  // Format phone number (Pakistani format 03XX... -> 923XX...)
  let formattedPhone = customerPhone.replace(/[^0-9]/g, '');
  if (formattedPhone.startsWith('03')) {
    formattedPhone = '92' + formattedPhone.slice(1);
  }

  // If no phone number is attached to sale, prompt user
  if (!formattedPhone || formattedPhone.length < 10) {
    const input = prompt('Enter customer WhatsApp mobile number (e.g. 03001234567):', customerPhone || '');
    if (input === null) return; // cancelled
    formattedPhone = input.replace(/[^0-9]/g, '');
    if (formattedPhone.startsWith('03')) {
      formattedPhone = '92' + formattedPhone.slice(1);
    }
  }

  const encodedText = encodeURIComponent(billText);
  let waUrl = '';
  if (formattedPhone && formattedPhone.length >= 10) {
    waUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`;
  } else {
    waUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
  }

  window.open(waUrl, '_blank');
  showToast('Opening WhatsApp with receipt bill...', 'info');
}

// 5. COPY RECEIPT TEXT TO CLIPBOARD
async function copyReceiptText() {
  const container = document.getElementById('printableReceiptArea');
  if (!container || !container.innerText.trim()) {
    showToast('No receipt to copy', 'error');
    return;
  }

  const text = container.innerText.trim();
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    showToast('Receipt text copied to clipboard!', 'success');
  } catch (err) {
    showToast('Unable to copy to clipboard', 'error');
  }
}

// 6. OPEN FULL RECEIPT IMAGE IN NEW TAB (GREAT FOR MOBILE LONG-PRESS TO SAVE TO PHOTOS)
async function openReceiptImageInNewTab() {
  const container = document.getElementById('printableReceiptArea');
  if (!container || !container.innerText.trim()) {
    showToast('No receipt found', 'error');
    return;
  }

  try {
    if (typeof html2canvas === 'undefined') {
      throw new Error('Image library not ready');
    }
    const canvas = await html2canvas(container, {
      scale: 2.5,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false
    });

    const dataUrl = canvas.toDataURL('image/png');
    const newTab = window.open();
    if (newTab) {
      newTab.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Dewan Mobile Receipt - ${getCurrentInvoiceNumber()}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { margin: 0; background: #0f172a; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; font-family: sans-serif; color: white; }
            img { max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); background: white; }
            p { margin-top: 15px; font-size: 13px; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" alt="Receipt">
          <p>💡 Tip: Long-press or right-click the receipt image to save to your photos or files.</p>
        </body>
        </html>
      `);
      newTab.document.close();
    } else {
      downloadReceiptAsImage();
    }
  } catch (err) {
    downloadReceiptAsImage();
  }
}

// 7. PRINT RECEIPT
function printReceipt() {
  window.print();
}

// Expose functions globally on window object
window.downloadReceiptAsImage = downloadReceiptAsImage;
window.downloadReceiptAsPdf = downloadReceiptAsPdf;
window.shareReceiptMobile = shareReceiptMobile;
window.sendReceiptViaWhatsApp = sendReceiptViaWhatsApp;
window.copyReceiptText = copyReceiptText;
window.openReceiptImageInNewTab = openReceiptImageInNewTab;
window.printReceipt = printReceipt;
