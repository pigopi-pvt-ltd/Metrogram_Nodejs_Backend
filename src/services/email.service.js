import nodemailer from 'nodemailer';

class EmailService {
  constructor() {
    this.transporter = null;
  }

  getTransporter() {
    if (!this.transporter) {
      const host = process.env.EMAIL_HOST || 'smtp.zoho.in';
      const port = Number(process.env.EMAIL_PORT) || 465;
      const secure = process.env.EMAIL_SECURE === 'true' || port === 465;
      const user = process.env.EMAIL_ID_SENDER;
      const pass = process.env.GOOGLE_APP_PASSWORD;

      if (!user || !pass) {
        console.warn('[EmailService] EMAIL_ID_SENDER or GOOGLE_APP_PASSWORD not configured. Emails will fail.');
      }

      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass
        }
      });
    }

    return this.transporter;
  }

  /**
   * Send a password reset OTP or link email
   * @param {Object} options
   * @param {string} options.to - Recipient email
   * @param {string} options.name - Recipient user name
   * @param {string} options.otp - 6 digit reset OTP
   * @param {number} options.expiresInMinutes - Expiry time in minutes
   */
  async sendPasswordResetEmail({ to, name, otp, expiresInMinutes = 10 }) {
    const transporter = this.getTransporter();
    const sender = process.env.EMAIL_ID_SENDER || 'noreply@pigo-pi.com';

    const subject = 'Password Reset Code - MetroGram';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #0d9488; margin: 0; font-size: 24px;">MetroGram</h2>
          <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">Healthcare & Diagnostic Services</p>
        </div>

        <p style="font-size: 16px; color: #1e293b; margin-bottom: 16px;">Hello <strong>${name || 'User'}</strong>,</p>
        <p style="font-size: 15px; color: #334155; line-height: 1.5; margin-bottom: 24px;">
          We received a request to reset your MetroGram account password. Use the verification code below to proceed with setting a new password:
        </p>

        <div style="text-align: center; margin: 30px 0; background-color: #f8fafc; padding: 20px; border-radius: 6px; border: 1px dashed #cbd5e1;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0f172a; font-family: monospace;">
            ${otp}
          </span>
          <p style="font-size: 13px; color: #ef4444; margin: 12px 0 0 0;">
            This code expires in <strong>${expiresInMinutes} minutes</strong>.
          </p>
        </div>

        <p style="font-size: 14px; color: #64748b; line-height: 1.5;">
          If you did not request a password reset, please ignore this email or reach out to support if you suspect unauthorized activity.
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 16px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
          &copy; ${new Date().getFullYear()} MetroGram. All rights reserved.
        </p>
      </div>
    `;

    const mailOptions = {
      from: `"MetroGram Support" <${sender}>`,
      to,
      subject,
      html
    };

    return await transporter.sendMail(mailOptions);
  }

  /**
   * Send a password changed confirmation email
   * @param {Object} options
   * @param {string} options.to
   * @param {string} options.name
   */
  async sendPasswordChangedConfirmation({ to, name }) {
    const transporter = this.getTransporter();
    const sender = process.env.EMAIL_ID_SENDER || 'noreply@pigo-pi.com';

    const subject = 'Your MetroGram Password Was Changed';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #0d9488; margin: 0; font-size: 24px;">MetroGram</h2>
          <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">Healthcare & Diagnostic Services</p>
        </div>

        <p style="font-size: 16px; color: #1e293b; margin-bottom: 16px;">Hello <strong>${name || 'User'}</strong>,</p>
        <p style="font-size: 15px; color: #334155; line-height: 1.5; margin-bottom: 20px;">
          This is a confirmation that your account password was successfully changed on <strong>${new Date().toUTCString()}</strong>.
        </p>

        <p style="font-size: 14px; color: #ef4444; line-height: 1.5; margin-bottom: 24px;">
          If you did not make this change, please contact our support team immediately to secure your account.
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 16px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
          &copy; ${new Date().getFullYear()} MetroGram. All rights reserved.
        </p>
      </div>
    `;

    const mailOptions = {
      from: `"MetroGram Support" <${sender}>`,
      to,
      subject,
      html
    };

    return await transporter.sendMail(mailOptions);
  }

  /**
   * Send an invoice / receipt email with PDF attachment
   * @param {Object} options
   * @param {string} options.to - Recipient email
   * @param {string} options.name - Recipient name
   * @param {Buffer} options.pdfBuffer - PDF file buffer
   * @param {string} options.filename - PDF attachment filename
   * @param {Object} options.receiptData - Receipt metadata for the email body
   */
  async sendReceiptEmail({ to, name, pdfBuffer, filename, receiptData }) {
    if (!to) {
      console.warn('[EmailService] sendReceiptEmail called without recipient email. Skipping.');
      return null;
    }

    const transporter = this.getTransporter();
    const sender = process.env.EMAIL_ID_SENDER || 'noreply@metrogram.in';

    const itemLabel = receiptData?.itemType === 'CARD' ? 'Health Card Membership' : 'Diagnostic Service Booking';
    const itemName = receiptData?.itemName || 'Healthcare Service';
    const receiptNumber = receiptData?.receiptNumber || 'N/A';
    const amountPaid = Number(receiptData?.amountPaid || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    const subject = `Your Payment Receipt: ${receiptNumber} - MetroGram`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #0f766e;">
          <h2 style="color: #0f766e; margin: 0; font-size: 24px; letter-spacing: 0.5px;">METROGRAM</h2>
          <p style="color: #64748b; margin: 4px 0 0 0; font-size: 13px;">Healthcare & Diagnostic Excellence</p>
        </div>

        <p style="font-size: 16px; color: #1e293b; margin-bottom: 12px;">Hello <strong>${name || 'Valued Customer'}</strong>,</p>
        <p style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
          Thank you for choosing <strong>MetroGram</strong>! We have successfully received your payment for your <strong>${itemLabel}</strong>. Your official receipt has been generated and is attached to this email as a PDF.
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 18px; margin: 20px 0;">
          <h3 style="font-size: 14px; color: #0f766e; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">Transaction Summary</h3>
          <table style="width: 100%; font-size: 13px; color: #334155; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Receipt Number:</td>
              <td style="padding: 6px 0; font-weight: bold; text-align: right; font-family: monospace;">${receiptNumber}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Item / Service:</td>
              <td style="padding: 6px 0; font-weight: bold; text-align: right;">${itemName}</td>
            </tr>
            ${receiptData?.cardNumber ? `
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Card Number:</td>
              <td style="padding: 6px 0; font-weight: bold; text-align: right; font-family: monospace;">${receiptData.cardNumber}</td>
            </tr>
            ` : ''}
            ${receiptData?.sampleType ? `
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Sample Type:</td>
              <td style="padding: 6px 0; text-align: right;">${receiptData.sampleType}</td>
            </tr>
            ` : ''}
            ${receiptData?.collectionType ? `
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Collection Method:</td>
              <td style="padding: 6px 0; text-align: right;">${receiptData.collectionType === 'HOME_COLLECTION' ? 'Home Sample Collection' : 'Lab Visit'}</td>
            </tr>
            ` : ''}
            <tr style="border-top: 1px dashed #cbd5e1;">
              <td style="padding: 10px 0 4px 0; font-size: 14px; font-weight: bold; color: #0f172a;">Amount Paid:</td>
              <td style="padding: 10px 0 4px 0; font-size: 15px; font-weight: bold; color: #0f766e; text-align: right;">INR ${amountPaid}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 20px;">
          Please retain the attached PDF receipt for your records and for verification during sample collection or healthcare service appointments.
        </p>

        <p style="font-size: 13px; color: #334155; margin-bottom: 4px;">
          Need assistance or have questions? Contact us at <a href="mailto:contact@metrogram.in" style="color: #0f766e; text-decoration: none;">contact@metrogram.in</a> or call <strong>+91 9798144621</strong>.
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 14px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
          &copy; ${new Date().getFullYear()} MetroGram. All rights reserved.<br/>
          94 sharda niwas, Braham asthani road pillar -68 Igims patna -800014
        </p>
      </div>
    `;

    const mailOptions = {
      from: `"MetroGram Receipts" <${sender}>`,
      to,
      subject,
      html,
      attachments: [
        {
          filename: filename || `Receipt_${receiptNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    return await transporter.sendMail(mailOptions);
  }

  /**
   * Send Diagnostic Test Result Report Email to Customer
   * @param {Object} options
   * @param {string} options.to - Recipient email
   * @param {string} options.name - Patient / Customer name
   * @param {string} options.testName - Diagnostic test name
   * @param {string} options.bookingCode - Booking code
   * @param {string} options.reportUrl - Cloudinary download / view URL
   * @param {Buffer} [options.pdfBuffer] - Optional attached PDF buffer
   * @param {string} [options.filename] - Optional filename for attachment
   */
  async sendTestReportEmail({ to, name, testName, bookingCode, reportUrl, pdfBuffer, filename }) {
    if (!to) {
      console.warn('[EmailService] sendTestReportEmail called without recipient email. Skipping.');
      return null;
    }

    const transporter = this.getTransporter();
    const sender = process.env.EMAIL_ID_SENDER || 'reports@metrogram.in';

    const subject = `Your Diagnostic Test Report is Ready: ${testName || 'Lab Investigation'} - MetroGram`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #0f766e;">
          <h2 style="color: #0f766e; margin: 0; font-size: 24px; letter-spacing: 0.5px;">METROGRAM</h2>
          <p style="color: #64748b; margin: 4px 0 0 0; font-size: 13px;">Diagnostic & Laboratory Excellence</p>
        </div>

        <p style="font-size: 16px; color: #1e293b; margin-bottom: 12px;">Hello <strong>${name || 'Valued Patient'}</strong>,</p>
        <p style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
          Your diagnostic test investigation is complete. The certified laboratory report for <strong>${testName || 'your booked test'}</strong> (Booking Ref: <code>${bookingCode}</code>) is now ready.
        </p>

        <div style="background-color: #f0fdfa; border: 1px solid #99f6e4; border-radius: 6px; padding: 18px; margin: 20px 0; text-align: center;">
          <h3 style="font-size: 15px; color: #0f766e; margin: 0 0 8px 0;">Test Report Ready for Download</h3>
          <p style="font-size: 13px; color: #334155; margin: 0 0 16px 0;">
            ${pdfBuffer ? 'Your official test report is attached to this email as a PDF.' : 'You can view and download your verified report using the link below.'}
          </p>
          ${reportUrl ? `
          <a href="${reportUrl}" target="_blank" style="display: inline-block; background-color: #0f766e; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-weight: bold; font-size: 14px;">
            View / Download Report PDF
          </a>
          ` : ''}
        </div>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 18px; margin: 20px 0; font-size: 13px; color: #334155;">
          <p style="margin: 0 0 6px 0;"><strong>Booking Reference:</strong> <span style="font-family: monospace;">${bookingCode}</span></p>
          <p style="margin: 0 0 6px 0;"><strong>Test Investigation:</strong> ${testName || 'Lab Test'}</p>
          <p style="margin: 0;"><strong>Status:</strong> <span style="color: #059669; font-weight: bold;">COMPLETED</span></p>
        </div>

        <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 20px;">
          You can also download this report anytime by logging into your account on the MetroGram mobile app or web portal under <em>My Bookings</em>.
        </p>

        <p style="font-size: 13px; color: #334155; margin-bottom: 4px;">
          Please consult your physician with this report for medical evaluation. For any assistance, reach us at <a href="mailto:contact@metrogram.in" style="color: #0f766e; text-decoration: none;">contact@metrogram.in</a> or call <strong>+91 9798144621</strong>.
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 14px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
          &copy; ${new Date().getFullYear()} MetroGram. All rights reserved.<br/>
          94 sharda niwas, Braham asthani road pillar -68 Igims patna -800014
        </p>
      </div>
    `;

    const attachments = [];
    if (pdfBuffer) {
      attachments.push({
        filename: filename || `Test_Report_${bookingCode}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      });
    }

    const mailOptions = {
      from: `"MetroGram Diagnostic Reports" <${sender}>`,
      to,
      subject,
      html,
      attachments
    };

    return await transporter.sendMail(mailOptions);
  }
}

export default new EmailService();
