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
}

export default new EmailService();
