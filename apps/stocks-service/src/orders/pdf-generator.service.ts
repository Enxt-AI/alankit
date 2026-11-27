import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PinoNestLogger } from '@repo/logger';
import type { Browser } from 'puppeteer';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';

/**
 * Data needed to fill in the Deal Sheet / Declaration PDF.
 * All fields are optional — any missing field will fall back to a safe default.
 */
export interface DealSheetData {
  // Header
  date_top: string;              // e.g. "12-05-2026"
  client_name: string;           // buyer full name / company name
  client_address: string;        // buyer full address (will auto-wrap)

  // Securities table
  share_name: string;            // e.g. "TATA CONSULTANCY SERVICES"
  isin: string;                  // e.g. "INE467B01029"
  quantity: string;              // e.g. "100"
  price: string;                 // price per share, e.g. "4150"
  total_consideration: string;   // e.g. "INR 415000"
  mode_of_delivery: string;      // "DEMAT"
  expected_transfer_date: string; // e.g. "T+3"
  base_price?: string;
  discounted_price?: string;
  discounted_price_per_share?: string;
  discount_amount?: string;

  // Buyer column
  buyer_name: string;
  buyer_client_id: string;
  buyer_dp_name: string;
  buyer_dp_id: string;
  buyer_pan: string;
  buyer_bank_name: string;
  buyer_account_no: string;
  buyer_ifsc: string;

  // Seller column ( fixed values)
  seller_name: string;
  seller_client_id: string;
  seller_dp_name: string;
  seller_dp_id: string;
  seller_pan: string;
  seller_bank_name: string;
  seller_account_no: string;
  seller_ifsc: string;
}

/**
 * A single line item in the invoice items table.
 */
export interface InvoiceLineItem {
  sr_no: number;
  isin: string;
  share_name: string;
  no_of_shares: number;
  rate: number;
  amount: number;
}

/**
 * Data needed to fill the invoice (Bill of Supply) PDF.
 * Field names match the {placeholder} tags in invoice-template.html.
 */
export interface InvoiceData {
  customer_name:    string;  // Customer Name
  invoice_no:       string;  // Invoice No (order ID)
  invoice_date:     string;  // Date (approval date)
  customer_pan:     string;  // Customer PAN
  customer_gst:     string;  // Customer GST No (blank if not available)
  place_of_supply:  string;  // Place of Supply (state)
  billing_address:  string;  // Full billing address
  line_items:       InvoiceLineItem[];  // Dynamic table rows
  total_amount:     string;  // e.g. "INR 6,160"
  amount_in_words:  string;  // e.g. "Six Thousand One Hundred Sixty Rupees Only"
}

/**
 * Data needed to fill the Payment Receipt Advice PDF.
 * Field names match the {placeholder} tags in receipt-template.html.
 */
export interface ReceiptData {
  receipt_no:          string;  // Order ID (short)
  receipt_date:        string;  // Date order was placed (createdAt)
  order_id:            string;  // Full order ID
  customer_name:       string;
  customer_pan:        string;
  demat_account_no:    string;  // From kycData or blank
  customer_address:    string;
  amount_received:     string;  // e.g. "₹6,160/-"
  amount_in_words:     string;  // e.g. "Six Thousand One Hundred Sixty Rupees Only"
  // Payment mode fields — filled if known, blank otherwise
  cash_checked:        string;  // "checked" or ""
  cheque_checked:      string;
  neft_checked:        string;
  fund_checked:        string;
  upi_checked:         string;
  other_checked:       string;
  cheque_no:           string;
  cheque_date:         string;
  neft_utr_no:         string;
  fund_transfer_ref:   string;
  upi_transaction_id:  string;
  other_payment_mode:  string;
  signatory_date:      string;  // Same as receipt_date
}


/** Fixed  seller details — never changes */
const _SELLER: Pick<
  DealSheetData,
  | 'seller_name'
  | 'seller_client_id'
  | 'seller_dp_name'
  | 'seller_dp_id'
  | 'seller_pan'
  | 'seller_bank_name'
  | 'seller_account_no'
  | 'seller_ifsc'
> = {
  seller_name: ' INVESTECH PRIVATE LIMITED',
  seller_client_id: '10336294',
  seller_dp_name: ' GLOBAL SECURITIES LTD',
  seller_dp_id: 'IN303655',
  seller_pan: 'AASCS6448K',
  seller_bank_name: 'HDFC BANK',
  seller_account_no: '57500001892772',
  seller_ifsc: 'HDFC0000003',
};

/**
 * PdfGeneratorService
 *
 * Uses Puppeteer to generate the filled PDF from an HTML template.
 */
@Injectable()
export class PdfGeneratorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new PinoNestLogger('stocks-service', 'PdfGeneratorService');
  private browser: Browser | null = null;

  async onModuleInit() {
    this.logger.log(`Initializing Puppeteer Browser singleton...`);
    try {
      const puppeteer = (await eval('import("puppeteer")')).default;
      this.browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.NODE_ENV === 'production' ? '/usr/bin/chromium-browser' : undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      });
      this.logger.log(`Puppeteer Browser launched successfully.`);
    } catch (error) {
      this.logger.error(`Failed to launch Puppeteer Browser`, error);
    }
  }

  async onModuleDestroy() {
    if (this.browser) {
      this.logger.log(`Closing Puppeteer Browser singleton...`);
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Generates the HTML string by replacing {{placeholder}} tags with real DB data.
   * The HTML template in MinIO must contain {{key}} placeholders (see scripts/templatify-html.js).
   */
  private generateHtmlTemplate(rawHtml: string, data: DealSheetData): string {
    let html = rawHtml;

    // Log the deal data being injected so we can verify DB values
    this.logger.log(`[DealSheet] Injecting → client: ${data.client_name}, share: ${data.share_name}, qty: ${data.quantity}, price: ${data.price}, PAN: ${data.buyer_pan}, IFSC: ${data.buyer_ifsc}, bank: ${data.buyer_bank_name}, dpName: ${data.buyer_dp_name}`);

    // Split the address across two lines (~85 chars each)
    const addrWords = (data.client_address || '').split(' ');
    let line1 = '', line2 = '';
    for (const w of addrWords) {
      const test = line1 ? line1 + ' ' + w : w;
      if (test.length < 85) line1 = test;
      else line2 += (line2 ? ' ' : '') + w;
    }

    // All {{placeholder}} → value mappings
    const templateData: Record<string, string> = {
      date_top: data.date_top,
      client_name: data.client_name,
      client_address_line1: line1,
      client_address_line2: line2,
      share_name: data.share_name,
      isin: data.isin,
      quantity: data.quantity,
      price: data.price,
      total_consideration: data.total_consideration,
      base_price: data.base_price || data.price,
      discounted_price: data.discounted_price || data.total_consideration,
      discounted_price_per_share: data.discounted_price_per_share || data.price,
      discount_amount: data.discount_amount || 'INR 0',
      mode_of_delivery: data.mode_of_delivery,
      expected_transfer_date: data.expected_transfer_date,
      buyer_name: data.buyer_name,
      buyer_client_id: data.buyer_client_id,
      buyer_dp_name: data.buyer_dp_name,
      buyer_dp_id: data.buyer_dp_id,
      buyer_pan: data.buyer_pan,
      buyer_bank_name: data.buyer_bank_name,
      buyer_account_no: data.buyer_account_no,
      buyer_ifsc: data.buyer_ifsc,
      seller_name: data.seller_name,
      seller_client_id: data.seller_client_id,
      seller_dp_name: data.seller_dp_name,
      seller_dp_id: data.seller_dp_id,
      seller_pan: data.seller_pan,
      seller_bank_name: data.seller_bank_name,
      seller_account_no: data.seller_account_no,
      seller_ifsc: data.seller_ifsc,
    };

    // Replace all {{key}} tags globally
    let hits = 0;
    for (const [key, value] of Object.entries(templateData)) {
      const before = html;
      html = html.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value);
      html = html.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      if (html !== before) hits++;
    }

    this.logger.log(`[DealSheet] {{placeholder}} replacements: ${hits}/${Object.keys(templateData).length}`);
    if (hits === 0) {
      this.logger.warn('[DealSheet] ⚠️  ZERO placeholders matched! Is the correct template loaded from MinIO?');
    }

    return html;
  }

  /**
   * Fill the blank eSign template PDF with real deal data.
   *
   * @param rawHtml         Raw HTML template string fetched from MinIO
   * @param data            Deal-sheet data to overlay
   * @returns               Filled PDF as a Buffer
   */
  async fillDealSheet(
    rawHtml: string,
    data: DealSheetData,
  ): Promise<Buffer> {
    if (!this.browser) {
      throw new Error('Puppeteer Browser is not initialized.');
    }

    let page: any = null;

    try {
      this.logger.log(`Generating HTML template...`);
      const htmlContent = this.generateHtmlTemplate(rawHtml, data);

      page = await this.browser.newPage();

      // Emulate print media type for print CSS application
      await page.emulateMediaType('print');
      
      // Disable JS for raw performance (our HTML template is purely static)
      await page.setJavaScriptEnabled(false);

      // Set the HTML content (domcontentloaded is much faster than networkidle0)
      await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });

      this.logger.log(`Rendering PDF...`);

      // Override pdf2htmlEX's default page-break-after: always which causes trailing blank pages
      await page.addStyleTag({
        content: `
          @media print {
            .pf { 
              page-break-after: always !important;
              page-break-inside: avoid !important;
              margin: 0 !important;
              box-shadow: none !important;
            }
            .pf:last-of-type {
              page-break-after: avoid !important;
            }
          }
        `,
      });

      // Use the exact pixel dimensions specified in pdf2htmlEX (w0/h0 classes) 
      // to prevent 1px overflow spilling into a new blank page.
      const pdfBytes = await page.pdf({
        width: '892.98px',
        height: '1262.88px',
        printBackground: true,
        displayHeaderFooter: false,
        margin: {
          top: '0px',
          right: '0px',
          bottom: '0px',
          left: '0px',
        },
      });

      this.logger.log(`✅ Success! Enterprise PDF generated (${pdfBytes.length} bytes)`);
      return Buffer.from(pdfBytes);
    } catch (error: any) {
      this.logger.error(`❌ Error generating PDF: `, error);
      throw error;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  // ─── Invoice PDF ────────────────────────────────────────────────────────────

  /**
   * Convert a numeric amount to Indian-English words (e.g. 6160 → "Six Thousand One Hundred Sixty Rupees Only").
   * Handles crore / lakh / thousand correctly.
   */
  private amountToWords(amount: number): string {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
                  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
                  'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const convert = (n: number): string => {
      if (n === 0) return '';
      if (n < 20) return ones[n] + ' ';
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '') + ' ';
      return ones[Math.floor(n / 100)] + ' Hundred ' + convert(n % 100);
    };

    if (amount === 0) return 'Zero Rupees Only';
    const int = Math.floor(amount);
    const fraction = Math.round((amount - int) * 100);

    let result = '';
    const crore = Math.floor(int / 10000000);
    const lakh  = Math.floor((int % 10000000) / 100000);
    const thousand = Math.floor((int % 100000) / 1000);
    const remainder = int % 1000;

    if (crore)   result += convert(crore)   + 'Crore ';
    if (lakh)    result += convert(lakh)    + 'Lakh ';
    if (thousand) result += convert(thousand) + 'Thousand ';
    if (remainder) result += convert(remainder);

    let finalWords = result.trim() ? result.trim() + ' Rupees' : '';
    
    if (fraction > 0) {
      const paiseWords = convert(fraction).trim() + ' Paise';
      finalWords = finalWords ? finalWords + ' and ' + paiseWords : paiseWords;
    }

    return (finalWords.trim() + ' Only').replace(/\s+/g, ' ');
  }

  /**
   * Fill the invoice HTML template with real order data.
   *
   * 1. Builds dynamic `<tr>` rows from `data.line_items`
   * 2. Replaces `{table_rows}` with the generated HTML
   * 3. Replaces remaining `{key}` scalar placeholders
   * 4. Renders to PDF via Puppeteer
   *
   * @param rawHtml   Clean invoice HTML template
   * @param data      Invoice field values (including line_items array)
   * @returns         Filled PDF as a Buffer
   */
  async fillInvoice(rawHtml: string, data: InvoiceData): Promise<Buffer> {
    if (!this.browser) {
      throw new Error('Puppeteer Browser is not initialized.');
    }

    let page: any = null;

    try {
      this.logger.log(`[Invoice] Injecting data for order ${data.invoice_no} — customer: ${data.customer_name}`);

      // ── 1. Build dynamic table rows HTML ──────────────────────────────────
      const rowsHtml = data.line_items.map((item) => `
      <tr>
        <td>${item.sr_no}</td>
        <td class="left">${item.isin}</td>
        <td class="left">${item.share_name}</td>
        <td>${item.no_of_shares.toLocaleString('en-IN')}</td>
        <td>${item.rate.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
        <td class="right">INR ${item.amount.toLocaleString('en-IN')}</td>
      </tr>`).join('\n');

      // ── 2. Replace {table_rows} ───────────────────────────────────────────
      let html = rawHtml.split('{table_rows}').join(rowsHtml);

      // ── 3. Generate HMAC SHA256 signature & AES-256 Encrypted Payload ──────────
      const secretKey = process.env.INVOICE_SECRET || '_INVOICE_AUTH_SECRET_KEY_2026';
      const rawPayload = `INV:${data.invoice_no}|DATE:${data.invoice_date}|PAN:${data.customer_pan}|AMT:${data.total_amount}`;
      const hmacHash = crypto.createHmac('sha256', secretKey).update(rawPayload).digest('hex').toUpperCase();
      const authCode = `-SIG-${hmacHash.slice(0, 12)}`;

      const signedDate = data.invoice_date || new Date().toLocaleDateString('en-IN');

      // Generate clean verification URL that mobile phone cameras can scan and open
      const baseUrl = process.env.PUBLIC_APP_URL || 'https://www.unlistedstocks.com';
      const cleanAmt = String(data.total_amount || '').replace(/[^0-9.]/g, '');
      const qrVerificationUrl = `${baseUrl}/verify?type=invoice&no=${encodeURIComponent(data.invoice_no)}&date=${encodeURIComponent(data.invoice_date || '')}&amt=${encodeURIComponent(cleanAmt)}&sig=${encodeURIComponent(authCode)}`;

      // Generate Data URL for QR Code with high resolution and high contrast for instant scanning
      let qrCodeUrl = "";
      try {
        qrCodeUrl = await QRCode.toDataURL(qrVerificationUrl, {
          margin: 2,
          width: 320,
          errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#FFFFFF' }
        });
      } catch (qrErr: any) {
        this.logger.warn(`[Invoice] Failed to generate QR code: ${qrErr.message}`);
        qrCodeUrl = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2YwZmRmNCIvPjwvc3ZnPg==";
      }

      // ── 4. Replace scalar {key} placeholders ─────────────────────────────
      const scalars: Record<string, string> = {
        customer_name:   data.customer_name,
        invoice_no:      data.invoice_no,
        invoice_date:    data.invoice_date,
        customer_pan:    data.customer_pan,
        customer_gst:    data.customer_gst,
        place_of_supply: data.place_of_supply,
        billing_address: data.billing_address,
        total_amount:    data.total_amount,
        amount_in_words: data.amount_in_words,
        signed_date:     signedDate,
        auth_code:       authCode,
        qr_code_url:     qrCodeUrl,
      };

      for (const [key, value] of Object.entries(scalars)) {
        html = html.split(`{${key}}`).join(value);
      }

      // ── 4. Render PDF with Puppeteer ──────────────────────────────────────
      page = await this.browser.newPage();
      await page.emulateMediaType('print');
      await page.setJavaScriptEnabled(false);
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      // Puppeteer's font readiness wait can stall for a background page.
      await page.bringToFront();
      const pdfBytes = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: false,
        margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
      });

      this.logger.log(`[Invoice] ✅ PDF generated (${pdfBytes.length} bytes)`);
      return Buffer.from(pdfBytes);
    } catch (error: any) {
      this.logger.error(`[Invoice] ❌ PDF generation error:`, error);
      throw error;
    } finally {
      if (page) await page.close();
    }
  }

  /**
   * Build InvoiceData from an order + user records fetched from the DB.
   */
  buildInvoiceData(
    user: any,
    stock: { name: string; isin?: string | null } | null,
    order: {
      id: string;
      quantity: number;
      pricePerShare: number;
      totalAmount: number;
      date: Date | string;
      invoiceNumber?: string | null;
    },
  ): InvoiceData {
    const kycData: any = (user.kycData as any) || {};

    const customerName  = (user.fullName || kycData?.panDetails?.name || 'CLIENT').toUpperCase();
    const pan           = (kycData?.panDetails?.pan || '').toUpperCase();
    const rawAddr: any  = kycData?.aadhaarDetails?.address || kycData?.address || '';
    const state         = (typeof rawAddr === 'object' ? rawAddr?.state : '') || 'N/A';

    let addressStr: string;
    if (typeof rawAddr === 'string' && rawAddr.trim()) {
      addressStr = rawAddr.toUpperCase();
    } else if (typeof rawAddr === 'object' && rawAddr !== null) {
      addressStr = [
        rawAddr.house, rawAddr.street, rawAddr.landmark,
        rawAddr.locality, rawAddr.vtc || rawAddr.subDistrict,
        rawAddr.district, rawAddr.state, rawAddr.pincode, rawAddr.country,
      ].filter(Boolean).join(', ').toUpperCase();
    } else {
      addressStr = 'ADDRESS NOT AVAILABLE';
    }

    const orderDate = new Date(order.date);
    const dateStr   = orderDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const qty         = order.quantity;
    const price       = order.pricePerShare;
    const total       = order.totalAmount;
    const amountWords = this.amountToWords(total);

    // Build single line item (for stock orders; basket orders can expand this)
    const lineItems: InvoiceLineItem[] = [{
      sr_no: 1,
      isin: (stock?.isin || 'PENDING').toUpperCase(),
      share_name: (stock?.name || 'UNLISTED SHARE').toUpperCase(),
      no_of_shares: qty,
      rate: price,
      amount: total,
    }];

    const gst = (kycData?.gstNumber || kycData?.gst || '').toUpperCase();

    return {
      customer_name:   customerName,
      invoice_no:      order.invoiceNumber || order.id.slice(0, 16).toUpperCase(),
      invoice_date:    dateStr,
      customer_pan:    pan || 'PAN NOT AVAILABLE',
      customer_gst:    gst,  // blank string if no GST on file
      place_of_supply: (state as string).toUpperCase(),
      billing_address: addressStr,
      line_items:      lineItems,
      total_amount:    `INR ${total.toLocaleString('en-IN')}`,
      amount_in_words: amountWords,
    };
  }

  /**
   * Build DealSheetData from User + Stock + Order records pulled from the DB.
   */
  buildDealSheetData(
    user: any,
    stock: { name: string; isin?: string | null; price?: number | null } | null,
    order: {
      quantity: number;
      totalAmount: number;
      pricePerShare: number;
      basePrice?: number | null;
      discountAmount?: number | null;
    } | null,
  ): DealSheetData {
    const now = new Date();
    const today = now.toLocaleDateString('en-GB').replace(/\//g, '-');

    // ── Read from user JSON columns ──────────────────────────────────────────
    const kycData: any  = (user.kycData  as any) || {};
    const dematData: any = (user.dematData as any) || {};
    const bankData: any  = (user.bankData  as any) || {};

    // PAN
    const pan = (
      kycData?.panDetails?.pan || 'PAN-PENDING'
    ).toUpperCase();

    // Client name
    const clientName = (user.fullName || kycData?.panDetails?.name || 'CLIENT').toUpperCase();

    // Address
    const rawAddr: any = kycData?.aadhaarDetails?.address || kycData?.address || '';
    let clientAddress: string;
    if (typeof rawAddr === 'string' && rawAddr.trim()) {
      clientAddress = rawAddr.toUpperCase();
    } else if (typeof rawAddr === 'object' && rawAddr !== null) {
      clientAddress = [
        rawAddr.house,
        rawAddr.street,
        rawAddr.landmark,
        rawAddr.locality,
        rawAddr.vtc || rawAddr.subDistrict,
        rawAddr.district,
        rawAddr.state,
        rawAddr.pincode,
        rawAddr.country,
      ]
        .filter(Boolean)
        .join(', ')
        .toUpperCase();
    } else {
      clientAddress = 'ADDRESS NOT AVAILABLE';
    }

    // Demat — standard format: 8-character DP ID and 8-digit Client ID (BO ID is 16 characters)
    let fullBoId = (dematData?.accountNumber || '').toString().trim().toUpperCase();
    let rawDpId = (dematData?.dpId || '').toString().trim().toUpperCase();
    let rawClientId = (dematData?.clientId || '').toString().trim().toUpperCase();

    if (!fullBoId && rawDpId && rawClientId) {
      fullBoId = `${rawDpId}${rawClientId}`;
    }

    let dpId = rawDpId || 'PENDING';
    let clientId = rawClientId;

    if (fullBoId && fullBoId.length === 16) {
      dpId = fullBoId.slice(0, 8);
      clientId = fullBoId.slice(8);
    } else if (rawDpId.startsWith('IN') && (rawDpId.length + rawClientId.length === 16)) {
      const combined = `${rawDpId}${rawClientId}`;
      dpId = combined.slice(0, 8);
      clientId = combined.slice(8);
      fullBoId = combined;
    }

    const boId      = (fullBoId || (dpId !== 'PENDING' && clientId ? dpId + clientId : '') || clientId || dpId).toUpperCase();
    const dpName    = (dematData?.dpName    || dematData?.depository || 'PENDING').toUpperCase();

    // Bank — read actual bank name from the database
    const bankName      = (bankData?.bankName || bankData?.benificiaryName || bankData?.bank || 'PENDING').toUpperCase();
    const bankAccountNo = (bankData?.accNo || bankData?.accountNumber || 'PENDING');
    const bankIfsc      = (bankData?.ifsc  || 'PENDING').toUpperCase();

    this.logger.log(`[DealSheet] DB → user: ${user.fullName}, PAN: ${pan}, dpId: ${dpId}, dpName: ${dpName}, bank: ${bankName}, accNo: ${bankAccountNo}, ifsc: ${bankIfsc}`);
    this.logger.log(`[DealSheet] DB → kycData keys: ${Object.keys(kycData).join(',') || 'EMPTY'}, dematData keys: ${Object.keys(dematData).join(',') || 'EMPTY'}, bankData keys: ${Object.keys(bankData).join(',') || 'EMPTY'}`);

    // ── Securities ───────────────────────────────────────────────────────────
    const qty   = order?.quantity    ?? 0;
    const discountedPricePerShare = order?.pricePerShare ?? stock?.price ?? 0;
    const discountedPrice = order?.totalAmount ?? qty * discountedPricePerShare;
    const basePrice = order?.basePrice ?? stock?.price ?? discountedPricePerShare;
    const discountAmount = order?.discountAmount !== undefined && order?.discountAmount !== null
      ? order.discountAmount
      : Math.max(0, Number(((basePrice * qty) - discountedPrice).toFixed(2)));

    const formattedDiscountedPricePerShare = Number.isInteger(discountedPricePerShare)
      ? String(discountedPricePerShare)
      : discountedPricePerShare.toFixed(2);
    const formattedBasePrice = Number.isInteger(basePrice)
      ? String(basePrice)
      : basePrice.toFixed(2);
    const formattedTotalConsideration = `INR ${discountedPrice.toLocaleString('en-IN')}`;
    const formattedDiscountAmount = `INR ${discountAmount.toLocaleString('en-IN')}`;

    return {
      date_top: today,
      client_name: clientName,
      client_address: clientAddress,

      share_name: `<span style="position: relative; left: -40px; display: inline-block; white-space: nowrap;">${(stock?.name || 'UNLISTED SHARE').toUpperCase()}</span>`,
      isin: (stock?.isin || 'PENDING').toUpperCase(),
      quantity: String(qty),
      price: formattedDiscountedPricePerShare,
      total_consideration: formattedTotalConsideration,
      base_price: formattedBasePrice,
      discounted_price: formattedTotalConsideration,
      discounted_price_per_share: formattedDiscountedPricePerShare,
      discount_amount: formattedDiscountAmount,
      mode_of_delivery: 'DEMAT',
      expected_transfer_date: 'T+7',

      buyer_name:       clientName,
      buyer_client_id:  boId,         // Full 16-digit BO ID (accountNumber or dpId+clientId)
      buyer_dp_name:    clientName,   // The client's registered name in the Demat account (KYC name)
      buyer_dp_id:      dpId,
      buyer_pan:        pan,
      buyer_bank_name:  bankName,
      buyer_account_no: bankAccountNo,
      buyer_ifsc:       bankIfsc,

      ..._SELLER,
    };
  }

  // ─── Payment Receipt PDF ─────────────────────────────────────────────────────

  /**
   * Fill the payment receipt HTML template with real order data and render to PDF.
   */
  async fillReceipt(rawHtml: string, data: ReceiptData): Promise<Buffer> {
    if (!this.browser) {
      throw new Error('Puppeteer Browser is not initialized.');
    }

    let page: any = null;

    try {
      this.logger.log(`[Receipt] Generating for order ${data.order_id} — customer: ${data.customer_name}`);

      // Replace all {key} scalar placeholders
      let html = rawHtml;
      // Generate HMAC SHA256 signature & AES-256 Encrypted Payload
      const secretKey = process.env.INVOICE_SECRET || '_INVOICE_AUTH_SECRET_KEY_2026';
      const rawPayload = `RCP:${data.receipt_no}|ORD:${data.order_id}|AMT:${data.amount_received}|PAN:${data.customer_pan}|DATE:${data.receipt_date}`;
      const hmacHash = crypto.createHmac('sha256', secretKey).update(rawPayload).digest('hex').toUpperCase();
      const authCode = `-RCP-${hmacHash.slice(0, 12)}`;

      const signedDate = data.receipt_date || new Date().toLocaleDateString('en-IN');

      // Generate clean verification URL that mobile phone cameras can scan and open
      const baseUrl = process.env.PUBLIC_APP_URL || 'https://www.unlistedstocks.com';
      const cleanAmt = String(data.amount_received || '').replace(/[^0-9.]/g, '');
      const qrVerificationUrl = `${baseUrl}/verify?type=receipt&no=${encodeURIComponent(data.receipt_no)}&orderId=${encodeURIComponent(data.order_id || '')}&date=${encodeURIComponent(data.receipt_date || '')}&amt=${encodeURIComponent(cleanAmt)}&sig=${encodeURIComponent(authCode)}`;

      // Generate Data URL for QR Code with high resolution and high contrast for instant scanning
      let qrCodeUrl = "";
      try {
        qrCodeUrl = await QRCode.toDataURL(qrVerificationUrl, {
          margin: 2,
          width: 320,
          errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#FFFFFF' }
        });
      } catch (qrErr: any) {
        this.logger.warn(`[Receipt] Failed to generate QR code: ${qrErr.message}`);
        qrCodeUrl = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2YwZmRmNCIvPjwvc3ZnPg==";
      }

      const fields: Record<string, string> = {
        receipt_no:         data.receipt_no,
        receipt_date:       data.receipt_date,
        order_id:           data.order_id,
        customer_name:      data.customer_name,
        customer_pan:       data.customer_pan,
        demat_account_no:   data.demat_account_no,
        customer_address:   data.customer_address,
        amount_received:    data.amount_received,
        amount_in_words:    data.amount_in_words,
        cash_checked:       data.cash_checked,
        cheque_checked:     data.cheque_checked,
        neft_checked:       data.neft_checked,
        fund_checked:       data.fund_checked,
        upi_checked:        data.upi_checked,
        other_checked:      data.other_checked,
        cheque_no:          data.cheque_no,
        cheque_date:        data.cheque_date,
        neft_utr_no:        data.neft_utr_no,
        fund_transfer_ref:  data.fund_transfer_ref,
        upi_transaction_id: data.upi_transaction_id,
        other_payment_mode: data.other_payment_mode,
        signatory_date:     data.signatory_date,
        signed_date:        signedDate,
        auth_code:          authCode,
        qr_code_url:        qrCodeUrl,
      };

      for (const [key, value] of Object.entries(fields)) {
        html = html.split(`{${key}}`).join(value);
      }

      page = await this.browser.newPage();
      await page.emulateMediaType('print');
      await page.setJavaScriptEnabled(false);
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      const pdfBytes = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: false,
        margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
      });

      this.logger.log(`[Receipt] ✅ PDF generated (${pdfBytes.length} bytes)`);
      return Buffer.from(pdfBytes);
    } catch (error: any) {
      this.logger.error(`[Receipt] ❌ PDF generation error:`, error);
      throw error;
    } finally {
      if (page) await page.close();
    }
  }

  /**
   * Build ReceiptData from an order + user records.
   * Uses order.createdAt as the receipt date (the date payment was placed).
   */
  buildReceiptData(
    user: any,
    stock: { name: string } | null,
    order: {
      id: string;
      totalAmount: number;
      createdAt: Date | string;
      cashfreePaymentId?: string | null;
      receiptNumber?: string | null;
      orderNumber?: string | null;
    },
  ): ReceiptData {
    const kycData: any = (user.kycData as any) || {};
    const bankData: any = (user.bankData as any) || {};
    const dematData: any = (user.dematData as any) || {};

    const customerName = (user.fullName || kycData?.panDetails?.name || 'CLIENT').toUpperCase();
    const pan          = (kycData?.panDetails?.pan || '').toUpperCase();
    
    // BO ID = 16-character accountNumber, or dpId (8) + clientId (8) concatenated
    let rawDpId = (dematData?.dpId || '').toString().trim().toUpperCase();
    let rawClientId = (dematData?.clientId || '').toString().trim().toUpperCase();
    let dematAcc = (dematData?.accountNumber || kycData?.dematDetails?.clientId || kycData?.dematAccountNo || '').toString().trim().toUpperCase();
    if (!dematAcc && rawDpId && rawClientId) {
      dematAcc = rawDpId + rawClientId;
    }

    let dpId = rawDpId;
    let clientId = rawClientId;
    if (dematAcc && dematAcc.length === 16) {
      dpId = dematAcc.slice(0, 8);
      clientId = dematAcc.slice(8);
    } else if (rawDpId.startsWith('IN') && (rawDpId.length + rawClientId.length === 16)) {
      const combined = `${rawDpId}${rawClientId}`;
      dpId = combined.slice(0, 8);
      clientId = combined.slice(8);
      dematAcc = combined;
    }

    const rawAddr: any = kycData?.aadhaarDetails?.address || kycData?.address || '';
    let addressStr: string;
    if (typeof rawAddr === 'string' && rawAddr.trim()) {
      addressStr = rawAddr;
    } else if (typeof rawAddr === 'object' && rawAddr !== null) {
      addressStr = [
        rawAddr.house, rawAddr.street, rawAddr.landmark,
        rawAddr.locality, rawAddr.vtc || rawAddr.subDistrict,
        rawAddr.district, rawAddr.state, rawAddr.pincode,
      ].filter(Boolean).join(', ');
    } else {
      addressStr = 'Address not available';
    }

    const receiptDate  = new Date(order.createdAt);
    const dateStr      = receiptDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const total        = order.totalAmount;
    const amountWords  = this.amountToWords(total);
    const paymentRef   = order.cashfreePaymentId || '';

    return {
      receipt_no:         order.receiptNumber || order.id.slice(0, 10).toUpperCase(),
      receipt_date:       dateStr,
      order_id:           (order.orderNumber || order.id).toUpperCase(),
      customer_name:      customerName,
      customer_pan:       pan || 'PAN NOT AVAILABLE',
      demat_account_no:   dematAcc,
      customer_address:   addressStr,
      amount_received:    `₹${total.toLocaleString('en-IN')}/-`,
      amount_in_words:    amountWords,
      // Payment mode — if we have a cashfree ref treat as UPI/online, rest blank
      cash_checked:       '',
      cheque_checked:     '',
      neft_checked:       '',
      fund_checked:       '',
      upi_checked:        paymentRef ? 'checked' : '',
      other_checked:      '',
      cheque_no:          '',
      cheque_date:        '',
      neft_utr_no:        '',
      fund_transfer_ref:  '',
      upi_transaction_id: paymentRef,
      other_payment_mode: '',
      signatory_date:     dateStr,
    };
  }

  /**
   * Encrypts the verification payload using AES-256-CBC with the system secret key.
   * Scanned payload output format: "-VERIFY:<iv_hex>:<encrypted_hex>"
   * Decodable ONLY at  end!
   */
  public encryptVerificationPayload(dataObj: Record<string, any>): string {
    const secret = process.env.INVOICE_SECRET || '_INVOICE_AUTH_SECRET_KEY_2026';
    const key = crypto.createHash('sha256').update(secret).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(JSON.stringify(dataObj), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `-VERIFY:${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypts an  verification QR token back to original document JSON data.
   */
  public decryptVerificationPayload(token: string): Record<string, any> | null {
    try {
      if (!token.startsWith('-VERIFY:')) return null;
      const parts = token.split(':');
      if (parts.length !== 3) return null;
      const iv = Buffer.from(parts[1], 'hex');
      const encryptedText = parts[2];
      const secret = process.env.INVOICE_SECRET || '_INVOICE_AUTH_SECRET_KEY_2026';
      const key = crypto.createHash('sha256').update(secret).digest();
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch {
      return null;
    }
  }
}
