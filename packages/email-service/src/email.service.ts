import { Injectable, Logger, Inject } from '@nestjs/common';
import type {
  EmailProvider,
  SendEmailResult,
} from './interfaces/email-provider.interface';
import { EMAIL_PROVIDER } from './constants';

export interface EmailResponse {
  success: boolean;
  message: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @Inject(EMAIL_PROVIDER)
    private readonly emailProvider: EmailProvider,
  ) {}

  // Sender Profiles
  private readonly SENDERS = {
    DEFAULT: 'Unlistedstox <no-reply@unlistedstox.com>',
    WELCOME: 'Unlistedstox Team <hello@unlistedstox.com>',
    KYC: 'Unlistedstox KYC <no-reply@unlistedstox.com>',
    DEMAT: 'Unlistedstox Demat <no-reply@unlistedstox.com>',
    BANK: 'Unlistedstox Bank <no-reply@unlistedstox.com>',
    ORDERS: 'Unlistedstox Orders <no-reply@unlistedstox.com>',
    PORTFOLIO: 'Unlistedstox Portfolio <no-reply@unlistedstox.com>',
    PAYMENTS: 'Unlistedstox Payments <no-reply@unlistedstox.com>',
  };

  private readonly fromEmail = process.env.EMAIL_FROM || this.SENDERS.DEFAULT;

  // Brand Colors & Assets
  private readonly COLORS = {
    PRIMARY: '#16a34a', // Emerald 600
    PRIMARY_DARK: '#15803d', // Emerald 700
    BACKGROUND: '#f8fafc', // Slate 50
    TEXT_DARK: '#0f172a', // Slate 900
    TEXT_MUTED: '#475569', // Slate 600
    BORDER: '#e2e8f0', // Slate 200
  };

  private readonly LOGO_URL = 'https://www.unlistedstox.com/logo.png';

  /**
   * Wraps email content in the premium standard brand layout
   */
  private getStandardLayout(title: string, content: string, preheader?: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
          body { font-family: 'Inter', sans-serif; background-color: ${this.COLORS.BACKGROUND}; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
          .container { width: 100%; table-layout: fixed; background-color: ${this.COLORS.BACKGROUND}; padding: 40px 0; }
          .content-card { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 600px; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); border: 1px solid ${this.COLORS.BORDER}; }
          .header { background-color: #ffffff; padding: 32px 40px; text-align: center; border-bottom: 1px solid ${this.COLORS.BORDER}; }
          .logo { height: 40px; width: auto; }
          .body { padding: 48px 40px; }
          h1 { color: ${this.COLORS.TEXT_DARK}; font-size: 24px; font-weight: 800; margin-top: 0; margin-bottom: 24px; letter-spacing: -0.025em; line-height: 1.2; }
          p { color: ${this.COLORS.TEXT_MUTED}; font-size: 16px; line-height: 1.6; margin-bottom: 24px; }
          .footer { text-align: center; padding: 32px 40px; color: ${this.COLORS.TEXT_MUTED}; font-size: 13px; }
          .button { background-color: ${this.COLORS.PRIMARY}; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: 600; display: inline-block; font-size: 15px; }
          .highlight-box { background-color: #f0fdf4; border-left: 4px solid ${this.COLORS.PRIMARY}; padding: 24px; border-radius: 8px; margin: 32px 0; }
          .preheader { display: none; max-height: 0px; overflow: hidden; }
        </style>
      </head>
      <body>
        ${preheader ? `<span class="preheader">${preheader}</span>` : ''}
        <div class="container">
          <table class="content-card" align="center" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td class="header">
                <img src="${this.LOGO_URL}" alt="Unlistedstox" class="logo" onerror="this.style.display='none'">
              </td>
            </tr>
            <tr>
              <td class="body">
                <h1>${title}</h1>
                ${content}
              </td>
            </tr>
            <tr>
              <td class="footer">
                <p>&copy; ${new Date().getFullYear()} SMC Unlisted Stox. All rights reserved.</p>
                <p>SMC House, 11/6B, Shanti Chamber, Pusa Road, New Delhi – 110005</p>
                <div style="margin-top: 16px;">
                  <a href="https://unlistedstox.com/support" style="color: ${this.COLORS.TEXT_MUTED}; text-decoration: underline;">Contact Support</a>
                </div>
              </td>
            </tr>
          </table>
        </div>
      </body>
      </html>
    `;
  }

  async sendEmail(to: string, subject: string, html: string, from?: string, idempotencyKey?: string) {
    try {
      this.logger.log(`Sending email to ${to} with subject: ${subject} via ${this.emailProvider.providerName}`);
      const result: SendEmailResult = await this.emailProvider.send({
        from: from || this.fromEmail,
        to: [to],
        subject,
        html,
        idempotencyKey,
      });

      if (!result.success) {
        this.logger.error(`Failed to send email to ${to}:`, result.error);
        return { success: false, error: result.error };
      }

      this.logger.log(`Email sent successfully to ${to}. ID: ${result.messageId}`);
      return { success: true, data: { id: result.messageId } };
    } catch (err) {
      this.logger.error(`Exception while sending email to ${to}:`, err);
      return { success: false, error: err };
    }
  }

  async sendWelcomeEmail(user: { email: string; fullName: string }) {
    const subject = 'Welcome to SMC Unlisted Stox!';
    const title = `Welcome, ${user.fullName}!`;
    const content = `
      <p>Thank you for joining <strong>SMC Unlisted Stox</strong>, India's premier platform for unlisted equity investments.</p>
      <p>You can now explore dozens of pre-IPO opportunities, track your portfolio, and stay ahead of the market in real-time.</p>
      
      <div style="margin: 32px 0; text-align: center;">
        <a href="https://unlistedstox.com/dashboard" class="button">Go to Dashboard</a>
      </div>

      <div class="highlight-box">
        <p style="margin: 0; color: #166534; font-weight: 600;">Pro Tip: Complete your KYC today to unlock investment limits and get priority access to hot upcoming IPOs.</p>
      </div>

      <p>If you have any questions, our dedicated relationship managers are here to help you every step of the way.</p>
    `;
    const html = this.getStandardLayout(title, content, "Welcome to India's premier pre-IPO platform.");
    return this.sendEmail(user.email, subject, html, this.SENDERS.WELCOME);
  }

  private getDisplayOrderNumber(order: any): string {
    if (!order) return '';
    if (order.orderNumber && typeof order.orderNumber === 'string') {
      return order.orderNumber;
    }
    if (order.id && typeof order.id === 'string') {
      return order.id.startsWith('c') && order.id.length > 15
        ? `ORD-${order.id.slice(-6).toUpperCase()}`
        : order.id.toUpperCase();
    }
    return '';
  }

  async sendOrderConfirmationEmail(order: any, user: { email: string; name: string | null }) {
    const orderNum = this.getDisplayOrderNumber(order);
    const subject = `Order Confirmed: ${order.stockName} [#${orderNum}]`;
    const title = 'Order Confirmed';
    
    const content = `
      <p>Hi ${user.name || 'Investor'},</p>
      <p>Thank you for choosing SMC Unlisted Stox. Your payment has been verified and your order is now confirmed. Our operations team will begin processing it shortly.</p>
      
      <div style="background-color: #f9f9f9; padding: 24px; border-radius: 12px; margin: 32px 0; border: 1px solid ${this.COLORS.BORDER};">
        <h3 style="margin-top: 0; color: ${this.COLORS.TEXT_DARK}; border-bottom: 1px solid ${this.COLORS.BORDER}; padding-bottom: 12px; font-size: 18px;">Investment Summary</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
          <tr>
            <td style="padding: 10px 0; color: ${this.COLORS.TEXT_MUTED}; font-size: 14px;">Order ID:</td>
            <td style="padding: 10px 0; text-align: right; font-weight: 600; color: ${this.COLORS.TEXT_DARK}; font-size: 14px;">#${orderNum}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: ${this.COLORS.TEXT_MUTED}; font-size: 14px;">Asset:</td>
            <td style="padding: 10px 0; text-align: right; font-weight: 600; color: ${this.COLORS.TEXT_DARK}; font-size: 14px;">${order.stockName}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: ${this.COLORS.TEXT_MUTED}; font-size: 14px;">Quantity:</td>
            <td style="padding: 10px 0; text-align: right; font-weight: 600; color: ${this.COLORS.TEXT_DARK}; font-size: 14px;">${order.quantity}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: ${this.COLORS.TEXT_MUTED}; font-size: 14px; border-top: 1px solid ${this.COLORS.BORDER}; margin-top: 10px;">Total Amount:</td>
            <td style="padding: 10px 0; text-align: right; font-weight: 800; color: ${this.COLORS.PRIMARY}; font-size: 20px; border-top: 1px solid ${this.COLORS.BORDER}; margin-top: 10px;">₹${order.totalAmount.toLocaleString()}</td>
          </tr>
        </table>
      </div>

      <div class="highlight-box">
        <p style="margin: 0; color: #166534; font-weight: 600;">Next Steps: Once your payment is verified, our compliance team will initiate the share transfer to your Demat account.</p>
      </div>

      <div style="text-align: center; margin-top: 32px;">
        <a href="https://unlistedstox.com/dashboard/orders" class="button">Track Order Progress</a>
      </div>
    `;

    const html = this.getStandardLayout(title, content, `Confirmation for order #${orderNum}`);
    return this.sendEmail(user.email, subject, html, this.SENDERS.ORDERS, `payment-confirmed-${order.id}`);
  }

  async sendOrderStatusUpdateEmail(order: any, user: any, status: string) {
    const orderNum = this.getDisplayOrderNumber(order);
    const isPaid = status === 'PAID';
    const isCompleted = status === 'COMPLETED';
    
    const subject = isCompleted 
      ? `Shares Allotted: ${order.stockName} [#${orderNum}]`
      : `Update on Order #${orderNum}: ${status}`;

    const title = isCompleted ? 'Investment Allotted' : 'Order Update';
    
    const content = `
      <p>Hi ${user.name || 'Investor'},</p>
      <p>The status of your investment in <strong>${order.stockName}</strong> has been updated to: <span style="font-weight: 800; color: ${this.COLORS.PRIMARY}; font-size: 1.1em;">${status}</span>.</p>
      
      <div style="background-color: #f9f9f9; padding: 24px; border-radius: 12px; margin: 32px 0; border: 1px solid ${this.COLORS.BORDER};">
        <p style="margin: 8px 0; font-size: 14px;"><strong>Order ID:</strong> #${orderNum}</p>
        <p style="margin: 8px 0; font-size: 14px;"><strong>Asset:</strong> ${order.stockName}</p>
        ${isPaid ? `<p style="margin: 8px 0; color: ${this.COLORS.PRIMARY}; font-weight: 700; font-size: 14px;">✓ Payment Verified</p>` : ''}
        ${isCompleted ? `<p style="margin: 8px 0; color: ${this.COLORS.PRIMARY}; font-weight: 700; font-size: 14px;">✓ Shares Allotted to Demat</p>` : ''}
      </div>

      <div class="highlight-box">
        <p style="margin: 0; color: #166534; font-weight: 600;">${isCompleted 
          ? 'Your shares are now credited to your linked Demat account and reflected in your portfolio.' 
          : 'Our team is working on the next steps. You will be notified of further status changes.'}
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        <a href="https://unlistedstox.com/dashboard/portfolio" class="button">View Portfolio</a>
      </div>
    `;

    const sender = isCompleted ? this.SENDERS.PORTFOLIO : this.SENDERS.ORDERS;
    const html = this.getStandardLayout(title, content, `The status of your order #${orderNum} is now ${status}.`);
    return this.sendEmail(user.email, subject, html, sender);
  }

  async sendOrderReceiptEmail(order: any, user: any) {
    const orderNum = this.getDisplayOrderNumber(order);
    const subject = `Investment Receipt: ${order.stockName} [#${orderNum}]`;
    const title = 'Payment Receipt';
    
    const content = `
      <p>Hi ${user.name},</p>
      <p>Your payment for the investment in <strong>${order.stockName}</strong> has been successfully processed. Please find your receipt details below.</p>
      
      <div style="background-color: #f9f9f9; padding: 24px; border-radius: 12px; margin: 32px 0; border: 1px solid ${this.COLORS.BORDER};">
        <h3 style="margin-top: 0; color: ${this.COLORS.TEXT_DARK}; border-bottom: 1px solid ${this.COLORS.BORDER}; padding-bottom: 12px; font-size: 18px;">Receipt Details</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
          <tr>
            <td style="padding: 10px 0; color: ${this.COLORS.TEXT_MUTED}; font-size: 14px;">Order ID:</td>
            <td style="padding: 10px 0; text-align: right; font-weight: 600; color: ${this.COLORS.TEXT_DARK}; font-size: 14px;">#${orderNum}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: ${this.COLORS.TEXT_MUTED}; font-size: 14px;">Quantity:</td>
            <td style="padding: 10px 0; text-align: right; font-weight: 600; color: ${this.COLORS.TEXT_DARK}; font-size: 14px;">${order.quantity}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: ${this.COLORS.TEXT_MUTED}; font-size: 14px;">Price Per Share:</td>
            <td style="padding: 10px 0; text-align: right; font-weight: 600; color: ${this.COLORS.TEXT_DARK}; font-size: 14px;">₹${order.pricePerShare}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: ${this.COLORS.TEXT_MUTED}; font-size: 14px; border-top: 1px solid ${this.COLORS.BORDER}; margin-top: 10px;">Total Paid:</td>
            <td style="padding: 10px 0; text-align: right; font-weight: 800; color: ${this.COLORS.PRIMARY}; font-size: 20px; border-top: 1px solid ${this.COLORS.BORDER}; margin-top: 10px;">₹${order.totalAmount.toLocaleString()}</td>
          </tr>
          ${order.shareTransferReferenceNo ? `
          <tr>
            <td style="padding: 10px 0; color: ${this.COLORS.TEXT_MUTED}; font-size: 14px;">Transfer Referance No.:</td>
            <td style="padding: 10px 0; text-align: right; font-weight: 600; color: ${this.COLORS.TEXT_DARK}; font-size: 14px;">${order.shareTransferReferenceNo}</td>
          </tr>` : ''}
        </table>
      </div>

      <div class="highlight-box">
        <p style="margin: 0; color: #166534; font-weight: 600;">Verification: Your purchase is now being verified for share allotment. You will receive another notification once the shares are credited to your Demat.</p>
      </div>

      <p>The shares will be reflected in your portfolio shortly. Thank you for investing with us.</p>
    `;

    const html = this.getStandardLayout(title, content, `Receipt for investment in ${order.stockName}`);
    return this.sendEmail(user.email, subject, html, this.SENDERS.PAYMENTS);
  }

  async sendKycVerifiedEmail(user: { email: string; fullName: string }) {
    const subject = 'KYC Verified - SMC Unlisted Stox';
    const title = 'Congratulations!';
    const content = `
      <p>Hi ${user.fullName},</p>
      <p>Your KYC documents have been successfully verified via DigiLocker. You have successfully unlocked the world of pre-IPO investing!</p>
      
      <div class="highlight-box">
        <p style="margin: 0; color: #166534; font-weight: 600;">Account Status: Fully Verified. You can now place orders for any unlisted shares or curated baskets on our platform.</p>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="https://unlistedstox.com/stocks" class="button">Browse Stocks</a>
      </div>
      
      <p>Happy Investing,<br><strong>SMC Unlisted Stox Compliance Team</strong></p>
    `;
    const html = this.getStandardLayout(title, content, "Your identity verification is successful.");
    return this.sendEmail(user.email, subject, html, this.SENDERS.KYC);
  }

  async sendKycRejectedEmail(user: { email: string; fullName: string }, reason: string) {
    const subject = 'KYC Rejection Notice - SMC Unlisted Stox';
    const title = 'Action Required: KYC Update';
    const content = `
      <p>Hi ${user.fullName},</p>
      <p>We regret to inform you that your KYC verification was not successful. Please review the details below to rectify the issue.</p>
      
      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 24px; border-radius: 8px; margin: 32px 0;">
        <h4 style="margin-top: 0; color: #991b1b; font-size: 16px;">Reason for Rejection</h4>
        <p style="margin: 0; color: #b91c1c; font-weight: 500;">${reason}</p>
      </div>

      <p>To avoid further delays, please log in to your dashboard and re-submit your documents with the corrected information.</p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="https://unlistedstox.com/kyc" class="button" style="background-color: #ef4444;">Update KYC Info</a>
      </div>
      
      <p>If you need assistance, please reply to this email or contact support.</p>
    `;
    const html = this.getStandardLayout(title, content, "Important update regarding your KYC verification.");
    return this.sendEmail(user.email, subject, html, this.SENDERS.KYC);
  }

  async sendKycPendingEmail(user: { email: string; fullName: string }) {
    const subject = 'KYC Submission Received - SMC Unlisted Stox';
    const title = 'KYC Received';
    const content = `
      <p>Hi ${user.fullName},</p>
      <p>We have successfully received your KYC submission via DigiLocker. Our compliance team is currently reviewing your application to ensure full security and compliance.</p>
      
      <div class="highlight-box">
        <p style="margin: 0; color: #166534; font-weight: 600;">Processing: This typically takes 24-48 business hours. You will receive an email notification once the verification process is complete.</p>
      </div>
      
      <p>Thank you for your patience while we verify your account.</p>
    `;
    const html = this.getStandardLayout(title, content, "Your documents have been submitted for review.");
    return this.sendEmail(user.email, subject, html, this.SENDERS.KYC);
  }

  async sendKycStatusUpdateEmail(user: { email: string; fullName: string }, status: string) {
    const isVerified = status === 'VERIFIED';
    const subject = isVerified ? 'KYC Verified - SMC Unlisted Stox' : 'KYC Status Update';
    const title = isVerified ? 'Congratulations!' : 'KYC Update';
    const message = isVerified 
      ? 'Your KYC documents have been successfully verified. You are now eligible to start investing in the unlisted market!'
      : `Your KYC status has been updated to: <span style="font-weight: 700; color: ${this.COLORS.PRIMARY};">${status}</span>. Please log in to check if any additional action is required.`;

    const content = `
      <p>Hi ${user.fullName},</p>
      <p>${message}</p>
      
      ${isVerified ? `
      <div class="highlight-box">
        <p style="margin: 0; color: #166534; font-weight: 600;">Account Status: Fully Verified. You now have unrestricted access to India's top pre-IPO opportunities.</p>
      </div>
      <div style="text-align: center; margin: 32px 0;">
        <a href="https://unlistedstox.com/stocks" class="button">Explore All Stocks</a>
      </div>
      ` : `
      <div style="text-align: center; margin: 32px 0;">
        <a href="https://unlistedstox.com/dashboard" class="button">Check Status Details</a>
      </div>
      `}
    `;
    const html = this.getStandardLayout(title, content, `Important update regarding your KYC status: ${status}`);
    return this.sendEmail(user.email, subject, html, this.SENDERS.KYC);
  }

  async sendBankStatusEmail(
    user: { email: string; fullName: string | null },
    status: 'VERIFIED' | 'REJECTED',
    reason?: string,
    bankData?: any,
  ) {
    const isVerified = status === 'VERIFIED';
    const subject = isVerified ? 'Bank Account Verified - SMC Unlisted Stox' : 'Bank Verification Rejected';
    const title = isVerified ? 'Bank Verified' : 'Bank Verification Update';
    const content = `
      <p>Hi ${user.fullName || 'User'},</p>
      <p>The verification for your bank account ending in **${bankData?.accNo?.slice(-4) || '****'}** has been ${isVerified ? 'successfully completed' : 'rejected'}.</p>
      
      ${!isVerified && reason ? `
      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; border-radius: 8px; margin: 24px 0;">
        <p style="margin: 0; color: #b91c1c; font-weight: 500;"><strong>Reason:</strong> ${reason}</p>
      </div>
      ` : ''}

      <div class="highlight-box">
        <p style="margin: 0; color: #166534; font-weight: 600;">${isVerified 
          ? 'Successful: You can now use this account for all your investment transactions and redemptions.' 
          : 'Action Items: Please review the reason above and re-submit your bank details to enable transactions.'}
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        <a href="https://unlistedstox.com/dashboard" class="button">${isVerified ? 'Go to Dashboard' : 'Update Bank Info'}</a>
      </div>
    `;
    const html = this.getStandardLayout(title, content, `Bank account verification status update: ${status}`);
    return this.sendEmail(user.email, subject, html, this.SENDERS.BANK);
  }

  async sendDematLinkedEmail(user: any, dematData: any) {
    const subject = 'Demat Account Review Initiated - SMC Unlisted Stox';
    const title = 'Verification Initiated';
    const content = `
      <p>Hi ${user.fullName || 'User'},</p>
      <p>We have successfully received your request to link your Demat account (**${dematData.accountNumber.replace(/.(?=.{4})/g, '*')}**).</p>
      
      <div class="highlight-box">
        <p style="margin: 0; color: #166534; font-weight: 600;">Status: Under Admin Review. We are verifying the documentation to ensure the safety and accuracy of your future share transfers.</p>
      </div>

      <p>Estimated processing time: <strong>24-48 Business Hours</strong>. You will receive another update once the verification is complete.</p>
    `;
    const html = this.getStandardLayout(title, content, "We have initiated a review of your demat linking request.");
    return this.sendEmail(user.email, subject, html, this.SENDERS.DEMAT);
  }

  async sendBankLinkedEmail(user: any, bankData: any) {
    const subject = 'Bank Account Review Initiated - SMC Unlisted Stox';
    const title = 'Verification Processing';
    const content = `
      <p>Hi ${user.fullName || 'User'},</p>
      <p>We have received your bank account details (ending in **${bankData.accNo ? bankData.accNo.slice(-4) : '****'}**) for verification.</p>
      <p>To ensure secure transactions, our team is verifying the account holder's name and IFSC details via our automated security check.</p>
      
      <div class="highlight-box">
        <p style="margin: 0; color: #166534; font-weight: 600;">Status: Processing. Verified accounts allow for seamless investment and redemption directly from your dashboard.</p>
      </div>
    `;
    const html = this.getStandardLayout(title, content, "Your bank account details are currently being verified.");
    return this.sendEmail(user.email, subject, html, this.SENDERS.BANK);
  }

  async sendDematStatusEmail(
    user: { email: string; fullName: string | null },
    status: 'VERIFIED' | 'REJECTED',
    reason?: string,
    dematData?: any,
  ) {
    const isVerified = status === 'VERIFIED';
    const subject = isVerified ? 'Demat Account Verified - SMC Unlisted Stox' : 'Demat Verification Rejected';
    const title = isVerified ? 'Demat Verified' : 'Demat Update';
    const content = `
      <p>Hi ${user.fullName || 'User'},</p>
      <p>Your Demat account linking request for account **${dematData?.accountNumber?.replace(/.(?=.{4})/g, '*') || '****'}** has been ${isVerified ? 'approved' : 'rejected'}.</p>
      
      ${!isVerified && reason ? `
      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; border-radius: 8px; margin: 24px 0;">
        <p style="margin: 0; color: #b91c1c; font-weight: 500;"><strong>Reason:</strong> ${reason}</p>
      </div>
      ` : ''}

      <div class="highlight-box">
        <p style="margin: 0; color: #166534; font-weight: 600;">${isVerified 
          ? 'Your demat account is now ready to receive share transfers from your successful investments.' 
          : 'Please review the reason above and re-submit your demat details to enable share transfers.'}
        </p>
      </div>
    `;
    const html = this.getStandardLayout(title, content, `Demat verification update: ${status}`);
    return this.sendEmail(user.email, subject, html, this.SENDERS.DEMAT);
  }

  private getTicketDisplayId(ticket: any): string {
    if (ticket?.ticketNumber) return ticket.ticketNumber;
    if (ticket?.id) return `TKT-${ticket.id.slice(-6).toUpperCase()}`;
    return 'TKT-PENDING';
  }

  async sendTicketCreatedEmail(ticket: any, user: { email: string; fullName: string }): Promise<EmailResponse> {
    const ticketRef = this.getTicketDisplayId(ticket);
    const subjectTitle = ticket.title || ticket.subject || 'Support Request';
    const subject = `[${ticketRef}] Ticket Created: ${subjectTitle}`;
    const title = 'Support Ticket Created';
    
    const content = `
      <p>Hi ${user.fullName},</p>
      <p>Your support ticket has been successfully created. Our dedicated support team is currently reviewing your request and will get back to you shortly.</p>
      
      <div style="background-color: #f9f9f9; padding: 24px; border-radius: 12px; margin: 32px 0; border: 1px solid ${this.COLORS.BORDER};">
        <p style="margin: 8px 0; font-size: 14px;"><strong>Ticket ID:</strong> ${ticketRef}</p>
        <p style="margin: 8px 0; font-size: 14px;"><strong>Subject:</strong> ${subjectTitle}</p>
        <p style="margin: 8px 0; font-size: 14px;"><strong>Status:</strong> <span style="color: ${this.COLORS.PRIMARY}; font-weight: 700;">${(ticket.status || 'OPEN').toUpperCase()}</span></p>
      </div>

      <div class="highlight-box">
        <p style="margin: 0; color: #166534; font-weight: 600;">Tracking: You can track the progress of your ticket and add further comments by logging into our secure support portal.</p>
      </div>
    `;

    const html = this.getStandardLayout(title, content, `We have received your support request (${ticketRef}).`);
    const res = await this.sendEmail(user.email, subject, html, this.SENDERS.DEFAULT);
    return res.success 
      ? { success: true, message: 'Ticket creation email sent' }
      : { success: false, message: 'Failed to send ticket creation email' };
  }

  async sendTicketAssignmentEmail(ticket: any, agent: { email: string; fullName: string }): Promise<EmailResponse> {
    const ticketRef = this.getTicketDisplayId(ticket);
    const subjectTitle = ticket.title || ticket.subject || 'Support Request';
    const subject = `New Ticket Assigned: ${ticketRef}`;
    const title = 'Ticket Assigned to You';
    
    const content = `
      <p>Hi ${agent.fullName},</p>
      <p>A new support ticket has been assigned to you for resolution. Please review the details below and assist the user promptly.</p>
      
      <div style="background-color: #f9f9f9; padding: 24px; border-radius: 12px; margin: 32px 0; border: 1px solid ${this.COLORS.BORDER};">
        <p style="margin: 8px 0; font-size: 14px;"><strong>Ticket ID:</strong> ${ticketRef}</p>
        <p style="margin: 8px 0; font-size: 14px;"><strong>Subject:</strong> ${subjectTitle}</p>
        <p style="margin: 8px 0; font-size: 14px;"><strong>Priority:</strong> <span style="text-transform: uppercase; font-weight: 700;">${ticket.priority || 'NORMAL'}</span></p>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="https://admin.unlistedstox.com/support" class="button">Open Support Console</a>
      </div>
    `;

    const html = this.getStandardLayout(title, content, `A new support ticket requires your attention (${ticketRef}).`);
    const res = await this.sendEmail(agent.email, subject, html, this.SENDERS.DEFAULT);
    return res.success 
      ? { success: true, message: 'Ticket assignment email sent' }
      : { success: false, message: 'Failed to send ticket assignment email' };
  }

  async sendTicketResolutionEmail(ticket: any, user: { email: string; fullName: string }): Promise<EmailResponse> {
    const ticketRef = this.getTicketDisplayId(ticket);
    const subjectTitle = ticket.title || ticket.subject || 'Support Request';
    const subject = `Ticket Resolved: ${ticketRef}`;
    const title = 'Ticket Resolved';
    
    const content = `
      <p>Hi ${user.fullName},</p>
      <p>Great news! Your support ticket has been marked as <strong>Resolved</strong> by our team.</p>
      
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 24px; border-radius: 12px; margin: 32px 0;">
        <p style="margin: 0; color: #166534;"><strong>Ticket Summary:</strong> ${ticketRef} - ${subjectTitle}</p>
      </div>

      <div class="highlight-box">
        <p style="margin: 0; color: #166534; font-weight: 600;">Feedback: If you feel the issue has not been fully addressed, you can effortlessly reopen the ticket from the support portal for further assistance.</p>
      </div>
    `;

    const html = this.getStandardLayout(title, content, `Your support request (${ticketRef}) has been successfully resolved.`);
    const res = await this.sendEmail(user.email, subject, html, this.SENDERS.DEFAULT);
    return res.success 
      ? { success: true, message: 'Ticket resolution email sent' }
      : { success: false, message: 'Failed to send ticket resolution email' };
  }

  async sendTicketEscalationEmail(ticket: any, admin: { email: string; fullName: string }): Promise<EmailResponse> {
    const ticketRef = this.getTicketDisplayId(ticket);
    const subjectTitle = ticket.title || ticket.subject || 'Support Request';
    const subject = `URGENT: Ticket Escalated - ${ticketRef}`;
    const title = 'Ticket Escalated';
    
    const content = `
      <p>Hi ${admin.fullName},</p>
      <p>Attention required: A support ticket has been escalated due to an SLA breach or high priority status.</p>
      
      <div style="background-color: #fff5f5; padding: 24px; border-radius: 12px; border-left: 4px solid #ef4444; margin: 32px 0;">
        <p style="margin: 8px 0; font-size: 14px; color: #991b1b;"><strong>Ticket ID:</strong> ${ticketRef}</p>
        <p style="margin: 8px 0; font-size: 14px; color: #991b1b;"><strong>Subject:</strong> ${subjectTitle}</p>
        <p style="margin: 8px 0; font-size: 14px; color: #991b1b;"><strong>Status:</strong> <span style="font-weight: 800;">ESCALATED</span></p>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="https://admin.unlistedstox.com/support" class="button" style="background-color: #ef4444;">Review Escalation Now</a>
      </div>
    `;

    const html = this.getStandardLayout(title, content, `Critical: An urgent support ticket has been escalated (${ticketRef}).`);
    const res = await this.sendEmail(admin.email, subject, html, this.SENDERS.DEFAULT);
    return res.success 
      ? { success: true, message: 'Escalation email sent' }
      : { success: false, message: 'Failed to send escalation email' };
  }

  async sendTicketCommentEmail(ticket: any, comment: any, commenter: any, recipient: { email: string; fullName: string }): Promise<EmailResponse> {
    const ticketRef = this.getTicketDisplayId(ticket);
    const subject = `New Comment on Ticket ${ticketRef}`;
    const title = 'New Ticket Activity';
    
    const content = `
      <p>Hi ${recipient.fullName},</p>
      <p><strong>${commenter.fullName}</strong> added a new comment to your ticket (${ticketRef}):</p>
      
      <div style="background-color: #f9f9f9; padding: 24px; border-radius: 12px; border-left: 4px solid ${this.COLORS.PRIMARY}; margin: 32px 0;">
        <p style="font-style: italic; color: ${this.COLORS.TEXT_DARK}; margin: 0;">"${comment.content}"</p>
      </div>

      <p>You can view the full thread and reply directly through the portal.</p>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="https://unlistedstox.com/support" class="button">Reply to Ticket</a>
      </div>
    `;

    const html = this.getStandardLayout(title, content, `There is a new update on your support ticket (${ticketRef}).`);
    const res = await this.sendEmail(recipient.email, subject, html, this.SENDERS.DEFAULT);
    return res.success 
      ? { success: true, message: 'Comment notification sent' }
      : { success: false, message: 'Failed to send comment notification' };
  }

  async sendTicketReopenNotification(ticket: any, agent: { email: string; fullName: string }): Promise<EmailResponse> {
    const ticketRef = this.getTicketDisplayId(ticket);
    const subjectTitle = ticket.title || ticket.subject || 'Support Request';
    const subject = `Ticket Reopened: ${ticketRef}`;
    const title = 'Ticket Reopened';
    
    const content = `
      <p>Hi ${agent.fullName},</p>
      <p>Notice: A ticket previously assigned to you has been reopened by the user for further clarification or continued support.</p>
      
      <div style="background-color: #fffbeb; border: 1px solid #fef3c7; padding: 24px; border-radius: 12px; margin: 32px 0;">
        <p style="margin: 8px 0; font-size: 14px;"><strong>Ticket ID:</strong> ${ticketRef}</p>
        <p style="margin: 8px 0; font-size: 14px;"><strong>Subject:</strong> ${subjectTitle}</p>
      </div>

      <div class="highlight-box">
        <p style="margin: 0; color: #166534; font-weight: 600;">Action Required: Please review the latest update from the user and resume assistance.</p>
      </div>
    `;

    const html = this.getStandardLayout(title, content, `A support ticket (${ticketRef}) has been reopened by the user.`);
    const res = await this.sendEmail(agent.email, subject, html, this.SENDERS.DEFAULT);
    return res.success 
      ? { success: true, message: 'Reopen notification sent' }
      : { success: false, message: 'Failed to send reopen notification' };
  }

  async sendTicketAssignedToUserNotification(ticket: any, agent: { fullName: string }, user: { email: string; fullName: string }): Promise<EmailResponse> {
    const ticketRef = this.getTicketDisplayId(ticket);
    const subject = `[${ticketRef}] Agent Assigned to Your Ticket`;
    const title = 'Support Agent Assigned';
    
    const content = `
      <p>Hi ${user.fullName},</p>
      <p>Good news! A support specialist has been assigned to your request and is currently reviewing the details to provide you with the best assistance.</p>
      
      <div style="background-color: #f9f9f9; padding: 24px; border-radius: 12px; margin: 32px 0; border: 1px solid ${this.COLORS.BORDER};">
        <p style="margin: 8px 0; font-size: 14px;"><strong>Ticket ID:</strong> ${ticketRef}</p>
        <p style="margin: 8px 0; font-size: 14px;"><strong>Assigned Specialist:</strong> ${agent.fullName}</p>
      </div>

      <div class="highlight-box">
        <p style="margin: 0; color: #166534; font-weight: 600;">Status: Active Review. You will receive further notifications as we progress toward resolving your query.</p>
      </div>
    `;

    const html = this.getStandardLayout(title, content, `A support specialist is now working on your request (${ticketRef}).`);
    const res = await this.sendEmail(user.email, subject, html, this.SENDERS.DEFAULT);
    return res.success 
      ? { success: true, message: 'User assignment notification sent' }
      : { success: false, message: 'Failed to send user assignment notification' };
  }

  async sendTicketStatusUpdateEmail(ticket: any, user: { email: string; fullName: string }): Promise<EmailResponse> {
    const ticketRef = this.getTicketDisplayId(ticket);
    const subjectTitle = ticket.title || ticket.subject || 'Support Request';
    const subject = `[${ticketRef}] Status Update: ${(ticket.status || '').toUpperCase()}`;
    const title = 'Ticket Status Update';
    
    const content = `
      <p>Hi ${user.fullName},</p>
      <p>The status of your support ticket has been updated. Details are as follows:</p>
      
      <div style="background-color: #f9f9f9; padding: 24px; border-radius: 12px; margin: 32px 0; border: 1px solid ${this.COLORS.BORDER};">
        <p style="margin: 8px 0; font-size: 14px;"><strong>Ticket ID:</strong> ${ticketRef}</p>
        <p style="margin: 8px 0; font-size: 14px;"><strong>Subject:</strong> ${subjectTitle}</p>
        <p style="margin: 8px 0; font-size: 14px;"><strong>New Status:</strong> <span style="text-transform: uppercase; font-weight: 800; color: ${this.COLORS.PRIMARY};">${ticket.status}</span></p>
      </div>

      <p>You can log in to the support portal at any time to view more details or add fresh comments.</p>
    `;

    const html = this.getStandardLayout(title, content, `Your ticket ${ticketRef} has a new status.`);
    const res = await this.sendEmail(user.email, subject, html, this.SENDERS.DEFAULT);
    return res.success 
      ? { success: true, message: 'Status update email sent' }
      : { success: false, message: 'Failed to send status update email' };
  }

  async sendOtpEmail(to: string, otp: string): Promise<EmailResponse> {
    const subject = `${otp} is your SMC Unlisted Stox OTP`;
    const title = 'Verification Code';
    
    const content = `
      <p>Hello,</p>
      <p>Verify your identity to proceed with your request. Please use the following One-Time Password (OTP):</p>
      
      <div style="text-align: center; margin: 40px 0;">
        <div style="background-color: #f8fafc; border: 2px dashed ${this.COLORS.BORDER}; border-radius: 16px; padding: 32px; display: inline-block;">
          <span style="font-size: 48px; font-weight: 800; color: ${this.COLORS.PRIMARY}; letter-spacing: 8px; font-family: 'Inter', monospace;">${otp}</span>
        </div>
      </div>

      <div class="highlight-box">
        <p style="margin: 0; color: #166534; font-weight: 600;">Security Notice: This code is valid for 5 minutes. Never share your OTP with anyone, including SMC staff.</p>
      </div>
      
      <p>If you did not request this code, please ignore this email or contact support if you suspect unauthorized activity.</p>
    `;

    const html = this.getStandardLayout(title, content, `Use code ${otp} to verify your identity.`);
    const res = await this.sendEmail(to, subject, html, this.SENDERS.DEFAULT);
    return res.success 
      ? { success: true, message: 'OTP email sent' }
      : { success: false, message: 'Failed to send OTP email' };
  }

  /**
   * Send security alert email when a new device or browser logs into an account.
   */
  async sendNewDeviceLoginAlert(details: {
    email: string;
    fullName: string;
    portal: string;
    device: string;
    ip: string;
    loginTime: Date;
  }): Promise<EmailResponse> {
    const portalNameMap: Record<string, string> = {
      USER: 'SMC Web App',
      ADMIN: 'SMC Admin Panel',
      CMS: 'SMC CMS Panel',
      SUPPORT: 'SMC Support Desk',
      MARKETING: 'SMC Marketing Panel',
      ACCOUNTING: 'SMC Accounting Panel',
      OPERATION: 'SMC Operations Panel',
      BRANCH: 'SMC Branch Portal',
      INTERNAL_RM: 'SMC RM Portal',
      DISTRIBUTOR: 'SMC Distributor Portal',
      DISTRIBUTOR_RM: 'SMC Partner RM Portal',
    };

    const portalName = portalNameMap[details.portal] || details.portal;
    const timeFormatted = details.loginTime.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const subject = `Security Alert: New device login on ${portalName}`;
    const title = 'New Device Login Detected';

    const content = `
      <p>Hello ${details.fullName},</p>
      <p>We detected a new login to your account on <strong>${portalName}</strong>.</p>
      
      <div style="background-color: #f8fafc; border: 1px solid ${this.COLORS.BORDER}; border-radius: 12px; padding: 20px 24px; margin: 24px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: ${this.COLORS.TEXT_MUTED}; width: 130px;"><strong>Portal:</strong></td>
            <td style="padding: 6px 0; color: ${this.COLORS.TEXT_DARK}; font-weight: 600;">${portalName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: ${this.COLORS.TEXT_MUTED};"><strong>Device / Browser:</strong></td>
            <td style="padding: 6px 0; color: ${this.COLORS.TEXT_DARK};">${details.device}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: ${this.COLORS.TEXT_MUTED};"><strong>IP Address:</strong></td>
            <td style="padding: 6px 0; color: ${this.COLORS.TEXT_DARK}; font-family: monospace;">${details.ip}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: ${this.COLORS.TEXT_MUTED};"><strong>Date & Time:</strong></td>
            <td style="padding: 6px 0; color: ${this.COLORS.TEXT_DARK};">${timeFormatted} IST</td>
          </tr>
        </table>
      </div>

      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px 20px; border-radius: 8px; margin: 24px 0;">
        <p style="margin: 0; color: #991b1b; font-weight: 600; font-size: 14px;">
          Don't recognize this activity?
        </p>
        <p style="margin: 6px 0 0 0; color: #b91c1c; font-size: 13px; line-height: 1.5;">
          If this wasn't you, your account credentials might be compromised. Please log in immediately, open <strong>Active Sessions</strong> from your account menu, and click <strong>Log out all other devices</strong> to terminate all unrecognized sessions.
        </p>
      </div>

      <p style="font-size: 13px; color: ${this.COLORS.TEXT_MUTED}; margin-top: 24px;">
        If this was you, you can safely ignore this security notification.
      </p>
    `;

    const html = this.getStandardLayout(title, content, `New device login on ${portalName} detected.`);
    const res = await this.sendEmail(details.email, subject, html, this.SENDERS.DEFAULT);
    return res.success 
      ? { success: true, message: 'New device alert email sent' }
      : { success: false, message: 'Failed to send new device alert email' };
  }
}
