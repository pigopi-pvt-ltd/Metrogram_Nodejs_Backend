import PDFDocument from 'pdfkit';
import { COMPANY_INFO } from '../../constants/companyInfo.js';

class ReceiptPdfService {
  /**
   * Format Currency (INR)
   */
  formatCurrency(num) {
    const n = Number(num) || 0;
    return `INR ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /**
   * Format Date
   */
  formatDate(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  /**
   * Generate PDF Receipt stream and return buffer
   * @param {Object} receiptData
   * @returns {Promise<Buffer>}
   */
  async generateReceiptBuffer(receiptData) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 35,
          margins: { top: 30, bottom: 20, left: 35, right: 35 },
          autoFirstPage: true,
          info: {
            Title: `Receipt - ${receiptData.receiptNumber}`,
            Author: COMPANY_INFO.legalName,
            Subject: 'Payment & Service Receipt'
          }
        });

        const buffers = [];
        doc.on('data', chunk => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', err => reject(err));

        this.renderReceipt(doc, receiptData);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Render the visual structure of the receipt (Strict single-page layout)
   */
  renderReceipt(doc, data) {
    const primaryColor = '#0F766E'; // Deep teal
    const brandColor = '#0369A1'; // Deep sky blue
    const darkColor = '#1E293B'; // Slate dark
    const mutedColor = '#64748B'; // Muted slate
    const lightBg = '#F8FAFC';
    const borderColor = '#E2E8F0';

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 35;
    const contentWidth = pageWidth - margin * 2;

    // --- TOP BANNER / ACCENT LINE ---
    doc.rect(0, 0, pageWidth, 5).fill(primaryColor);

    // --- COMPANY HEADER (TOP SECTION) ---
    let y = 25;

    // Company Legal Name & Brand
    doc.fontSize(15).font('Helvetica-Bold').fillColor(primaryColor);
    doc.text(COMPANY_INFO.legalName, margin, y, { lineBreak: false });
    y += 18;

    doc.fontSize(10.5).font('Helvetica-Bold').fillColor(brandColor);
    doc.text(`Brand: ${COMPANY_INFO.brandName}`, margin, y, { lineBreak: false });
    y += 15;

    // CIN Number
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(darkColor);
    doc.text('CIN Number: ', margin, y, { continued: true });
    doc.font('Helvetica').fillColor('#334155').text(COMPANY_INFO.cin);
    y += 13;

    // Address
    doc.fontSize(8).font('Helvetica').fillColor(mutedColor);
    doc.text(`Address: ${COMPANY_INFO.address}`, margin, y, { width: contentWidth - 170, lineBreak: false });
    y += 12;

    // Contact & Email
    doc.text(`Contact: ${COMPANY_INFO.contact}   |   Email: ${COMPANY_INFO.email}`, margin, y, { lineBreak: false });

    // RECEIPT BADGE (Top Right)
    const badgeX = pageWidth - margin - 150;
    const badgeY = 25;
    doc.roundedRect(badgeX, badgeY, 150, 46, 5).fillAndStroke('#F0FDFA', '#99F6E4');
    doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryColor);
    doc.text('PAYMENT RECEIPT', badgeX, badgeY + 9, { width: 150, align: 'center', lineBreak: false });
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(data.paymentStatus === 'PAID' ? '#059669' : '#D97706');
    doc.text(`STATUS: ${data.paymentStatus || 'PAID'}`, badgeX, badgeY + 26, { width: 150, align: 'center', lineBreak: false });

    // DIVIDER LINE
    y += 18;
    doc.moveTo(margin, y).lineTo(pageWidth - margin, y).strokeColor(borderColor).lineWidth(1).stroke();
    y += 12;

    // --- RECEIPT & CUSTOMER META INFO (2 COLUMNS) ---
    const colWidth = (contentWidth - 20) / 2;
    const leftColX = margin;
    const rightColX = margin + colWidth + 20;

    // Left Column: Receipt Information
    doc.fontSize(9.5).font('Helvetica-Bold').fillColor(darkColor).text('RECEIPT DETAILS', leftColX, y, { lineBreak: false });
    let rY = y + 14;

    const printMetaRow = (label, value, colX, curY) => {
      doc.fontSize(8).font('Helvetica-Bold').fillColor(mutedColor).text(label, colX, curY, { width: 90, lineBreak: false });
      doc.font('Helvetica').fillColor(darkColor).text(value || 'N/A', colX + 90, curY, { width: colWidth - 90, lineBreak: false, ellipsis: true });
      return curY + 12.5;
    };

    rY = printMetaRow('Receipt No:', data.receiptNumber, leftColX, rY);
    rY = printMetaRow('Date of Issue:', this.formatDate(data.receiptDate), leftColX, rY);
    if (data.orderId) {
      rY = printMetaRow('Order ID:', data.orderId, leftColX, rY);
    }
    if (data.cfPaymentId) {
      rY = printMetaRow('Transaction ID:', data.cfPaymentId, leftColX, rY);
    }
    if (data.paymentMethod) {
      rY = printMetaRow('Payment Method:', data.paymentMethod, leftColX, rY);
    }

    // Right Column: Customer & Patient Information
    doc.fontSize(9.5).font('Helvetica-Bold').fillColor(darkColor).text('CUSTOMER & PATIENT DETAILS', rightColX, y, { lineBreak: false });
    let cY = y + 14;

    cY = printMetaRow('Customer Name:', data.customerName, rightColX, cY);
    if (data.customerPhone) {
      cY = printMetaRow('Contact Phone:', data.customerPhone, rightColX, cY);
    }
    if (data.customerEmail) {
      cY = printMetaRow('Email Address:', data.customerEmail, rightColX, cY);
    }
    if (data.customerAddress) {
      cY = printMetaRow('Address:', data.customerAddress, rightColX, cY);
    }

    y = Math.max(rY, cY) + 10;

    // --- ITEM DETAILS SECTION (TABLE) ---
    doc.moveTo(margin, y).lineTo(pageWidth - margin, y).strokeColor(borderColor).lineWidth(1).stroke();
    y += 10;

    doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor);
    doc.text(
      data.itemType === 'CARD' ? 'HEALTH CARD SUBSCRIPTION DETAILS' : 'DIAGNOSTIC SERVICE BOOKING DETAILS',
      margin,
      y,
      { lineBreak: false }
    );
    y += 15;

    // Table Header
    doc.rect(margin, y, contentWidth, 20).fill('#F1F5F9');
    doc.fontSize(8).font('Helvetica-Bold').fillColor(darkColor);
    doc.text('ITEM DESCRIPTION', margin + 8, y + 6, { width: contentWidth * 0.45, lineBreak: false });
    doc.text('TYPE / VALIDITY', margin + contentWidth * 0.48, y + 6, { width: contentWidth * 0.25, lineBreak: false });
    doc.text('AMOUNT', margin + contentWidth * 0.75, y + 6, { width: contentWidth * 0.23, align: 'right', lineBreak: false });
    y += 20;

    // Table Body Box
    const itemBoxHeight = 52;
    const itemBoxY = y;
    doc.rect(margin, itemBoxY, contentWidth, itemBoxHeight).fillAndStroke('#FFFFFF', borderColor);
    y = itemBoxY + 8;

    doc.fontSize(9).font('Helvetica-Bold').fillColor(darkColor);
    doc.text(data.itemName || 'Healthcare Service', margin + 8, y, { width: contentWidth * 0.45, lineBreak: false });

    doc.fontSize(7.5).font('Helvetica').fillColor(mutedColor);
    if (data.itemDescription) {
      doc.text(data.itemDescription, margin + 8, y + 13, { width: contentWidth * 0.45, height: 26, ellipsis: true });
    }

    // Mid column (Attributes)
    doc.fontSize(8).font('Helvetica').fillColor(darkColor);
    if (data.itemType === 'CARD') {
      doc.text(`Plan: ${data.planType || 'STANDARD'}`, margin + contentWidth * 0.48, y, { lineBreak: false });
      doc.text(`Card No: ${data.cardNumber || 'N/A'}`, margin + contentWidth * 0.48, y + 12, { lineBreak: false });
      doc.text(`Validity: ${data.validityInDays ? `${data.validityInDays} Days` : 'N/A'}`, margin + contentWidth * 0.48, y + 24, { lineBreak: false });
    } else {
      doc.text(`Sample: ${data.sampleType || 'Standard'}`, margin + contentWidth * 0.48, y, { lineBreak: false });
      doc.text(`Collection: ${data.collectionType || 'LAB_VISIT'}`, margin + contentWidth * 0.48, y + 12, { lineBreak: false });
      if (data.scheduledDate) {
        doc.text(
          `Date: ${this.formatDate(data.scheduledDate)} ${data.timeSlot ? `(${data.timeSlot})` : ''}`,
          margin + contentWidth * 0.48,
          y + 24,
          { lineBreak: false }
        );
      }
    }

    // Amount column
    doc.fontSize(9.5).font('Helvetica-Bold').fillColor(darkColor);
    doc.text(this.formatCurrency(data.amountPaid), margin + contentWidth * 0.75, y + 8, {
      width: contentWidth * 0.23,
      align: 'right',
      lineBreak: false
    });

    y = itemBoxY + itemBoxHeight + 10;

    // --- ADDITIONAL INFO / PATIENT DETAILS BOX (FOR SERVICES) ---
    if (data.itemType === 'SERVICE' && data.patientDetails) {
      const patientBoxHeight = 44;
      doc.rect(margin, y, contentWidth, patientBoxHeight).fillAndStroke('#F8FAFC', borderColor);
      const pY = y + 6;
      doc.fontSize(8).font('Helvetica-Bold').fillColor(primaryColor).text('PATIENT & SAMPLE COLLECTION INFORMATION', margin + 8, pY, { lineBreak: false });

      const pat = data.patientDetails;
      const patText = `Patient: ${pat.name || 'N/A'}  |  Age/Gender: ${pat.age || 'N/A'} / ${pat.gender || 'N/A'}  |  Phone: ${pat.phone || 'N/A'}`;
      doc.fontSize(7.5).font('Helvetica').fillColor(darkColor).text(patText, margin + 8, pY + 12, { lineBreak: false });

      if (data.collectionAddress) {
        doc.text(`Collection Address: ${data.collectionAddress}`, margin + 8, pY + 23, { width: contentWidth - 16, lineBreak: false, ellipsis: true });
      }
      y += patientBoxHeight + 10;
    }

    // --- PAYMENT BREAKDOWN / TOTALS ---
    const totalBoxWidth = 230;
    const totalBoxX = pageWidth - margin - totalBoxWidth;
    let tY = y;

    const printTotalLine = (label, value, isBold = false, isAccent = false) => {
      doc.fontSize(isBold ? 9 : 8)
        .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(isAccent ? primaryColor : (isBold ? darkColor : mutedColor))
        .text(label, totalBoxX, tY, { width: 110, lineBreak: false });

      doc.fontSize(isBold ? 9 : 8)
        .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(isAccent ? primaryColor : darkColor)
        .text(value, totalBoxX + 110, tY, { width: 120, align: 'right', lineBreak: false });

      tY += 13;
    };

    if (data.originalPrice && data.originalPrice > data.amountPaid) {
      printTotalLine('Original Price:', this.formatCurrency(data.originalPrice));
      const discount = data.originalPrice - data.amountPaid;
      printTotalLine('Health Card Discount:', `- ${this.formatCurrency(discount)}`, false, true);
    }

    printTotalLine('Subtotal:', this.formatCurrency(data.amountPaid));
    printTotalLine('Taxes / GST (Included):', 'INR 0.00');

    doc.moveTo(totalBoxX, tY).lineTo(totalBoxX + totalBoxWidth, tY).strokeColor(borderColor).lineWidth(1).stroke();
    tY += 3;

    // Net Total Highlighting Box
    const netBoxHeight = 22;
    doc.rect(totalBoxX, tY, totalBoxWidth, netBoxHeight).fill(lightBg);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(darkColor).text('TOTAL PAID:', totalBoxX + 6, tY + 6, { lineBreak: false });
    doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor).text(this.formatCurrency(data.amountPaid), totalBoxX + 100, tY + 6, {
      width: totalBoxWidth - 108,
      align: 'right',
      lineBreak: false
    });

    tY += netBoxHeight + 15;

    // --- AUTHORIZED SIGNATURE & TERMS BOX (Placed nicely before footer) ---
    const signY = Math.max(tY, 680);

    // Terms & Conditions
    // Ample width so each line fits smoothly without awkward single-word wraps
    const signX = margin;
    const termsWidth = 330;
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(darkColor).text('Terms & Conditions:', signX, signY, { lineBreak: false });
    doc.fontSize(7).font('Helvetica').fillColor(mutedColor);
    doc.text(
      '1. This document serves as an official electronic receipt for services/subscriptions rendered.',
      signX,
      signY + 11,
      { width: termsWidth }
    );
    doc.text(
      '2. Keep this receipt for sample verification and health card authentication.',
      signX,
      signY + 21,
      { width: termsWidth }
    );
    doc.text(
      '3. All diagnostic services and health card memberships are governed by MetroGram policies.',
      signX,
      signY + 31,
      { width: termsWidth }
    );

    // Signature (Right side)
    const authWidth = 190;
    const authX = pageWidth - margin - authWidth;
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(darkColor).text(
      `For ${COMPANY_INFO.legalName}`,
      authX,
      signY,
      { width: authWidth, align: 'right', lineBreak: false }
    );
    doc.fontSize(7).font('Helvetica-Oblique').fillColor(mutedColor).text(
      `(Brand: ${COMPANY_INFO.brandName})`,
      authX,
      signY + 11,
      { width: authWidth, align: 'right', lineBreak: false }
    );
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(primaryColor).text(
      'Authorized Signatory',
      authX,
      signY + 38,
      { width: authWidth, align: 'right', lineBreak: false }
    );

    // --- FOOTER NOTE (Bottom of page, safely within 800-815 range) ---
    const footerY = 795;
    doc.moveTo(margin, footerY - 5).lineTo(pageWidth - margin, footerY - 5).strokeColor(borderColor).lineWidth(0.5).stroke();
    doc.fontSize(7).font('Helvetica').fillColor(mutedColor);
    doc.text(
      `${COMPANY_INFO.legalName} • Brand: ${COMPANY_INFO.brandName} • CIN: ${COMPANY_INFO.cin} • Helpline: ${COMPANY_INFO.contact} • Email: ${COMPANY_INFO.email}`,
      margin,
      footerY,
      { width: contentWidth, align: 'center', lineBreak: false }
    );
  }
}

export default new ReceiptPdfService();
