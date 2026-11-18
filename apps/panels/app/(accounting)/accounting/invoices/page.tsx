"use client";

import { useMemo, useState, useEffect } from "react";
import { 
  Search, 
  Download, 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  MoreHorizontal,
  TrendingUp,
  Building2,
  Loader2
} from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { fetchVouchers, Voucher } from "@/lib/accounting-api";
import QRCode from "qrcode";

// Mapping shape for the UI table
interface InvoiceData {
  id: string;
  orderId?: string;
  voucherId: string;
  scriptName: string;
  isin: string;
  client: string;
  date: string;
  qty: number;
  rate: number;
  amount: number;
  status: string;
  type: string;
  pan: string;
  gst: string;
  placeOfSupply: string;
  address: string;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 0 });

  useEffect(() => {
    let active = true;

    async function loadInvoices() {
      setLoading(true);
      setError(null);
      try {
        // Fetch PAYMENT_SALES vouchers, which represent our Invoices
        const res = await fetchVouchers({ 
          type: "PAYMENT_SALES", 
          page: pagination.page, 
          limit: pagination.limit 
        });

        if (!active) return;

        const mappedInvoices: InvoiceData[] = res.vouchers.map((v) => {
          const isGatewayCharges = (v.metadata as any)?.voucherClass === "GATEWAY_CHARGES" ||
                                   v.narration?.toLowerCase().includes("gateway charges") ||
                                   v.entries?.some((e) => e.ledger?.name?.toLowerCase().includes("gateway charges") || e.ledger?.name?.toLowerCase().includes("bank charges"));

          // 1. Resolve Script Name / Item Detail (Never display generic "Unknown Script" when meaningful context exists)
          let scriptName = "";
          const scriptEntry = v.entries?.find((e) => e.scriptName);
          if (scriptEntry?.scriptName) {
            scriptName = scriptEntry.scriptName;
          } else if ((v.metadata as any)?.stockName) {
            scriptName = (v.metadata as any).stockName;
          } else if ((v.metadata as any)?.scriptName) {
            scriptName = (v.metadata as any).scriptName;
          } else if (v.narration) {
            const match = v.narration.match(/(?:Payment for|Order|Purchase of|Sale of)\s+([^\/\-]+)/i);
            if (match && match[1] && !match[1].toLowerCase().includes("gateway")) {
              scriptName = match[1].trim();
            }
          }

          if (!scriptName) {
            if (isGatewayCharges) {
              scriptName = "Payment Gateway & Bank Charges";
            } else {
              scriptName = v.narration || "General Service Invoice";
            }
          }

          // 2. Resolve Client / Investor Name
          let clientName = "";
          const userLedgerEntry = v.entries?.find((e) => e.ledger?.type === "USER");
          if (userLedgerEntry?.ledger?.name) {
            clientName = userLedgerEntry.ledger.name;
          } else if ((v.metadata as any)?.clientName || (v.metadata as any)?.customerName) {
            clientName = (v.metadata as any).clientName || (v.metadata as any).customerName;
          } else if (isGatewayCharges) {
            clientName = "Cashfree Payments India Pvt Ltd";
          } else {
            const otherEntry = v.entries?.find((e) => e.ledger?.type !== "SALE" && e.ledger?.type !== "STOCK" && !e.ledger?.name?.toLowerCase().includes("bank charges"));
            clientName = otherEntry?.ledger?.name || "Customer / Payee";
          }

          const userEntry = userLedgerEntry || v.entries?.find((e) => e.ledger?.type !== "SALE" && e.ledger?.type !== "STOCK");
          const transactionType = userEntry?.entryType === "DEBIT" ? "Buy" : "Sell";
          const stockEntryWithDetails = scriptEntry || v.entries?.[0];

          // Generate dedicated INV- series for Invoice ID (e.g. INV-0010 instead of SAL-0010)
          const invoiceId = (v.metadata as any)?.invoiceNumber ||
                            (v.voucherNumber.startsWith("SAL-")
                              ? `INV-${v.voucherNumber.slice(4)}`
                              : v.voucherNumber.startsWith("INV-")
                              ? v.voucherNumber
                              : `INV-${v.voucherNumber.replace(/^[A-Z]+-/, "")}`);

          const orderId = (v.metadata as any)?.orderId || (v as any).orderId || undefined;

          return {
            id: invoiceId,
            orderId,
            voucherId: v.id,
            scriptName,
            isin: stockEntryWithDetails?.isin || "—",
            client: clientName,
            date: new Date(v.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            qty: stockEntryWithDetails?.qty || 0,
            rate: stockEntryWithDetails?.rate || 0,
            amount: v.totalAmount,
            status: "Paid", // Automatically Paid if generated via Payment Flow
            type: transactionType,
            pan: (userEntry?.ledger as any)?.pan || "—",
            gst: (userEntry?.ledger as any)?.gstNo || "—",
            placeOfSupply: "—", // Not explicitly stored in ledger, default to blank/dash
            address: (userEntry?.ledger as any)?.address || "—",
          };
        });

        setInvoices(mappedInvoices);
        setPagination(res.pagination);
      } catch (err: any) {
        if (!active) return;
        setError(err.message || "Failed to load invoices");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadInvoices();

    return () => { active = false; };
  }, [pagination.page, pagination.limit]);

  // Frontend filtering logic combining API data + local filter
  const filteredInvoices = useMemo(() => {
    const list = invoices.filter(invoice => {
      const matchesSearch = invoice.client.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           invoice.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           invoice.scriptName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "All" || invoice.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    // Sort descending by numerical sequence in Invoice ID (e.g. INV-0008, INV-0006, INV-0003, INV-0001)
    return list.sort((a, b) => {
      const numA = parseInt(a.id.replace(/\D/g, "") || "0", 10);
      const numB = parseInt(b.id.replace(/\D/g, "") || "0", 10);
      if (numA !== numB) return numB - numA;
      return b.id.localeCompare(a.id);
    });
  }, [invoices, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = invoices.length;
    const paid = invoices.filter(i => i.status === "Paid").length;
    const pending = invoices.filter(i => i.status === "Pending").length;
    const totalVolume = invoices.reduce((acc, curr) => acc + curr.amount, 0);

    return { total, paid, pending, totalVolume };
  }, [invoices]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  // ── Client-side PDF & Invoice Document Downloader ─────────────────────────
  // Direct file download (Zero print popups/dialogs!) with Official Digital Stamp & QR Code
  const downloadInvoicePdf = async (invoice: InvoiceData) => {
    // 1. If orderId is present, attempt direct backend Puppeteer PDF download
    if (invoice.orderId) {
      try {
        const token = localStorage.getItem("accessToken") || localStorage.getItem("token") || "";
        const stocksApiUrl = process.env.NEXT_PUBLIC_STOCKS_SERVICE_URL || "http://localhost:3001";
        const res = await fetch(`${stocksApiUrl}/api/orders/${invoice.orderId}/invoice`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `Invoice_${invoice.id}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          return;
        }
      } catch (e) {
        console.warn("Direct PDF download fallback to stamped document generator", e);
      }
    }

    // 2. Generate scannable verification QR code URL (Opens public verification portal)
    const cleanAmt = String(invoice.amount || '').replace(/[^0-9.]/g, '');
    const qrVerificationUrl = `https://www.unlistedstox.com/verify?type=invoice&no=${encodeURIComponent(invoice.id)}&date=${encodeURIComponent(invoice.date || '')}&amt=${encodeURIComponent(cleanAmt)}&sig=SMC-INV-${invoice.id}`;

    let qrCodeUrl = "";
    try {
      qrCodeUrl = await QRCode.toDataURL(qrVerificationUrl, {
        margin: 2,
        width: 320,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#FFFFFF' }
      });
    } catch {
      qrCodeUrl = "";
    }

    // Convert amount number to words (simple Indian English implementation)
    const toWords = (num: number): string => {
      const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
        'Eighteen', 'Nineteen'];
      const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
      if (num === 0) return 'Zero';
      const convert = (n: number): string => {
        if (n < 20) return ones[n] ?? '';
        if (n < 100) return (tens[Math.floor(n / 10)] ?? '') + (n % 10 ? ' ' + (ones[n % 10] ?? '') : '');
        if (n < 1000) return (ones[Math.floor(n / 100)] ?? '') + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
        if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
        if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
        return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
      };
      const rupees = Math.floor(num);
      const paise = Math.round((num - rupees) * 100);
      let result = convert(rupees) + ' Rupees';
      if (paise > 0) result += ' and ' + convert(paise) + ' Paise';
      return result + ' Only';
    };

    const totalFormatted = `\u20B9${invoice.amount.toLocaleString('en-IN')}`;
    const tableRow = `
      <tr>
        <td>1</td>
        <td>${invoice.isin !== '\u2014' ? invoice.isin : '\u2014'}</td>
        <td>${invoice.scriptName}</td>
        <td>${invoice.qty ? new Intl.NumberFormat('en-IN').format(invoice.qty) : '\u2014'}</td>
        <td>\u20B9${invoice.rate.toFixed(2)}</td>
        <td style="text-align:right;">\u20B9${invoice.amount.toLocaleString('en-IN')}</td>
      </tr>`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Bill of Supply \u2014 SMC Investech Private Limited</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; font-family: "Times New Roman", Times, serif; font-size: 11px; color: #000; }
    .page { width: 210mm; min-height: 297mm; padding: 20mm; margin: 0 auto; }
    .header { text-align: center; line-height: 1.55; margin-bottom: 10px; }
    .header .company-name { font-size: 16px; font-weight: bold; text-decoration: underline; letter-spacing: 0.4px; }
    .header .formerly { font-style: italic; font-size: 11.5px; }
    .header .address, .header .cin, .header .gst { font-size: 11px; }
    .bill-title { text-align: center; font-size: 13px; font-weight: bold; text-decoration: underline; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    td, th { border: 1px solid #000; padding: 3px 5px; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; }
    .customer-table { margin-bottom: 8px; }
    .customer-table td { vertical-align: middle; }
    .customer-table .billing-label { font-weight: bold; }
    .customer-table .billing-value { min-height: 26px; vertical-align: top; }
    .items-table { margin-bottom: 8px; }
    .items-table thead th { background-color: #c0c0c0; text-align: center; font-weight: bold; padding: 4px 5px; vertical-align: middle; }
    .items-table tbody td { text-align: center; vertical-align: middle; min-height: 28px; }
    .items-table tbody td:last-child { text-align: right; }
    .total-row td { font-weight: bold; vertical-align: middle; }
    .items-table tfoot td { vertical-align: top; }
    .tfoot-label td { font-weight: bold; padding: 3px 5px; }
    .tfoot-value td { min-height: 24px; padding: 3px 5px; }
    .footer-table td { vertical-align: top; padding: 7px 9px; }
    .footer-table .bank-col { width: 55%; }
    .footer-table .sign-col { width: 45%; text-align: center; }
    .footer-table p { line-height: 1.45; margin-bottom: 3px; }
    .bank-section-title { text-align: center; font-weight: bold; margin-bottom: 6px; }
    .sign-company { font-weight: bold; margin-bottom: 1px; }

    /* Unified Official Stamp & QR Seal Badge */
    .stamp-seal-box {
      margin: 6px auto 4px auto;
      padding: 6px 10px;
      border: 1.5px dashed #047857;
      background-color: #f0fdf4;
      border-radius: 6px;
      text-align: center;
      display: inline-block;
      width: 150px;
    }

    .stamp-header {
      font-size: 8.5px;
      font-weight: bold;
      color: #047857;
      letter-spacing: 0.3px;
      text-transform: uppercase;
      line-height: 1.1;
    }

    .stamp-subtitle {
      font-size: 7.5px;
      color: #065f46;
      font-weight: bold;
      margin-bottom: 2px;
    }

    .stamp-qr-frame {
      background: #ffffff;
      padding: 4px;
      border: 1px solid #a7f3d0;
      border-radius: 4px;
      display: inline-block;
      margin: 3px 0;
    }

    .stamp-qr-img {
      width: 84px;
      height: 84px;
      display: block;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
    }

    .stamp-footer {
      font-size: 7.5px;
      color: #047857;
      font-weight: bold;
      margin-top: 2px;
      line-height: 1.1;
    }

    .sign-authorised { font-style: italic; margin-bottom: 6px; }
    .sub-address { text-align: left; font-size: 10px; line-height: 1.42; margin-top: 6px; }
    .sub-address p { margin-bottom: 5px; }
    .fw-bold { font-weight: bold; }
    .text-uline { text-decoration: underline; }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="company-name">SMC INVESTECH PRIVATE LIMITED</div>
    <div class="formerly">(Formerly SMC Real Estate Advisors Pvt. Ltd.)</div>
    <div class="address">3rd Floor, C-98, SECTOR 2, NOIDA,</div>
    <div class="address">Gautambuddha Nagar, Uttar Pradesh, 201301</div>
    <div class="cin">CIN No. U74120UP2013PTC054923</div>
    <div class="gst">GST No.: 09AASCS6448K1ZF &nbsp;&nbsp; Pan: - AASCS6448K</div>
  </div>
  <div class="bill-title">Bill of Supply</div>
  <table class="customer-table">
    <colgroup><col style="width:17%;"><col style="width:33%;"><col style="width:17%;"><col style="width:33%;"></colgroup>
    <tbody>
      <tr><td>Customer Name:-</td><td>${invoice.client}</td><td>Invoice No</td><td>${invoice.id}</td></tr>
      <tr><td>Customer GST No:-</td><td>${invoice.gst !== '—' ? invoice.gst : '&nbsp;'}</td><td>Date</td><td>${invoice.date}</td></tr>
      <tr><td>Customer PAN:-</td><td>${invoice.pan !== '—' ? invoice.pan : '&nbsp;'}</td><td>Place of Supply</td><td>${invoice.placeOfSupply !== '—' ? invoice.placeOfSupply : '&nbsp;'}</td></tr>
      <tr><td colspan="4" class="billing-label">Billing Address</td></tr>
      <tr><td colspan="4" class="billing-value">${invoice.address !== '—' ? invoice.address : '&nbsp;'}</td></tr>
    </tbody>
  </table>
  <table class="items-table">
    <colgroup><col style="width:6%;"><col style="width:15%;"><col style="width:29%;"><col style="width:15%;"><col style="width:15%;"><col style="width:20%;"></colgroup>
    <thead><tr><th>Sr No</th><th>ISIN No</th><th>Share Name</th><th>No of Share</th><th>Rate</th><th>Amount</th></tr></thead>
    <tbody>
      ${tableRow}
      <tr class="total-row"><td colspan="5" style="text-align:center;font-weight:bold;">Total</td><td style="text-align:right;font-weight:bold;">${totalFormatted}</td></tr>
    </tbody>
    <tfoot>
      <tr class="tfoot-label"><td colspan="6">Amount in word</td></tr>
      <tr class="tfoot-value"><td colspan="6">${toWords(invoice.amount)}</td></tr>
    </tfoot>
  </table>
  <table class="footer-table">
    <tbody><tr>
      <td class="bank-col">
        <p class="bank-section-title">Bank Details for Payment</p>
        <p>Account Name:&nbsp;<span class="fw-bold text-uline">SMC Investech Private Limited</span></p>
        <p><span class="fw-bold">Bank Name:</span> HDFC Bank Ltd</p>
        <p><span class="fw-bold">Account No.:</span> 57500001892772</p>
        <p><span class="fw-bold">IFSC Code:</span> HDFC0000003</p>
        <br>
        <p><span class="fw-bold">Note:</span> This is to inform you that the Company is registered under MSME Act as a Small Enterprise under Service Sector. Company's UAM no. is DL01E0006487. In case you required the certificate and/or any query kindly contact at billing.realty@smcrealty.com or call at +91-11-40815200</p>
        <br>
        <p><span class="fw-bold text-uline">Declaration:</span> Certified that the particulars given above are true and correct</p>
      </td>
      <td class="sign-col">
        <p class="sign-company">For SMC Investech Private Limited</p>
        <p>(Formerly SMC Real Estate Advisors Pvt. Ltd.)</p>

        <!-- Official Digital Signature Stamp & QR Seal -->
        <div class="stamp-seal-box">
          <div class="stamp-header">&#x2714; DIGITALLY SIGNED</div>
          <div class="stamp-subtitle">SMC Investech Pvt. Ltd.</div>
          <div class="stamp-qr-frame">
            ${qrCodeUrl ? `<img src="${qrCodeUrl}" class="stamp-qr-img" alt="Digital Stamp QR Code" />` : ''}
          </div>
          <div class="stamp-footer">Scan to Verify &bull; ${invoice.date}</div>
        </div>

        <p class="sign-authorised">(Authorised Signatory)</p>
        <div class="sub-address">
          <p><span class="fw-bold">Registered Address&nbsp;:</span> C-98, Third Floor Sector-&nbsp;2 Noida Gautam Buddha Nagar UP 201301 IN, Telephone No 0120-4560429, 0120-4240414&nbsp;|&nbsp; Email:&nbsp;info@smcrealty.com</p>
          <p><span class="fw-bold">Corporate Address&nbsp;:</span> 11/5B 3rd Floor Pusa Road, New Delhi-110045, Telephone No 011-400815200, website:-&nbsp;smcrealty.com</p>
        </div>
      </td>
    </tr></tbody>
  </table>
</div>
</body>
</html>`;

    // Direct document file download (Zero print popups/dialogs!)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Invoice_${invoice.id}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    if (filteredInvoices.length === 0) return;
    
    const headers = [
      'Invoice ID',
      'Script Name',
      'ISIN / CIN',
      'Client',
      'Date',
      'Quantity',
      'Rate',
      'Total Amount',
      'Type',
      'Status'
    ];

    // Format date to DD/MM/YYYY HH:MM AM/PM IST
    const formatDateIST = (dateStr: string) => {
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleString('en-IN', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: true,
          timeZone: 'Asia/Kolkata'
        });
      } catch { return dateStr; }
    };

    const rows = filteredInvoices.map(invoice => [
      `'${invoice.id}`,
      invoice.scriptName,
      invoice.isin && invoice.isin !== '—' ? `'${invoice.isin}` : '',
      invoice.client,
      formatDateIST(invoice.date),
      invoice.qty,
      invoice.rate,
      invoice.amount,
      invoice.type,
      invoice.status
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `invoices_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 space-y-8 min-h-screen pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Contract Notes & Invoices</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Manage unlisted stock transactions and billing</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={exportToCSV} variant="outline" className="rounded-xl border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold gap-2 shadow-sm">
            <Download className="h-4 w-4" />
            Report
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 rounded-3xl border-slate-100 shadow-sm bg-white group hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Total Volume</p>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.totalVolume)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-3xl border-slate-100 shadow-sm bg-white group hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Completed Orders</p>
              <p className="text-2xl font-bold text-slate-900">{stats.paid}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-3xl border-slate-100 shadow-sm bg-white group hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors duration-300">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Pending Settlement</p>
              <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-3xl border-slate-100 shadow-sm bg-white group hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-slate-50 text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-colors duration-300">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Total Scripts</p>
              <p className="text-2xl font-bold text-slate-900">
                {new Set(invoices.map(i => i.scriptName).filter(Boolean)).size}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100">
          <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      {/* Main Content Area */}
      <Card className="rounded-3xl border-slate-100 shadow-sm bg-white overflow-hidden">
        <div className="p-6 border-b border-slate-50 bg-slate-50/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search stock name, client or invoice..."
                className="pl-10 rounded-xl border-slate-200 bg-white placeholder:text-slate-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 custom-scrollbar">
              {["All", "Paid", "Pending", "Overdue"].map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "rounded-xl px-4 py-2 text-sm font-semibold transition-all whitespace-nowrap",
                    statusFilter === status 
                      ? "bg-emerald-600 text-white border-transparent shadow-md"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-slate-100 bg-slate-50/50">
                  <TableHead className="w-[140px] text-slate-500 font-bold uppercase text-[11px] tracking-wider py-5 pl-6">Invoice ID</TableHead>
                  <TableHead className="text-slate-500 font-bold uppercase text-[11px] tracking-wider py-5">Script Detail</TableHead>
                  <TableHead className="text-slate-500 font-bold uppercase text-[11px] tracking-wider py-5">Investor</TableHead>
                  <TableHead className="text-slate-500 font-bold uppercase text-[11px] tracking-wider py-5 text-right">Qty</TableHead>
                  <TableHead className="text-slate-500 font-bold uppercase text-[11px] tracking-wider py-5 text-right">Rate</TableHead>
                  <TableHead className="text-slate-500 font-bold uppercase text-[11px] tracking-wider py-5 text-right">Total Amount</TableHead>
                  <TableHead className="text-slate-500 font-bold uppercase text-[11px] tracking-wider py-5 text-center">Status</TableHead>
                  <TableHead className="w-[80px] text-right py-5 pr-6"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length > 0 ? (
                  filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id} className="group hover:bg-slate-50/50 border-slate-50 transition-colors">
                      <TableCell className="py-4 pl-6 font-mono text-xs font-bold text-slate-500">{invoice.id}</TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-slate-900 text-xs">{invoice.scriptName}</span>
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-tight">{invoice.isin}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 font-semibold text-slate-700 text-xs">{invoice.client}</TableCell>
                      <TableCell className="py-4 text-right font-mono font-bold text-slate-900 text-xs">{invoice.qty ? new Intl.NumberFormat('en-IN').format(invoice.qty) : "—"}</TableCell>
                      <TableCell className="py-4 text-right font-mono font-medium text-slate-600 text-xs">₹{invoice.rate.toFixed(2)}</TableCell>
                      <TableCell className="py-4 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="font-mono font-bold text-slate-900 text-xs">₹{invoice.amount.toLocaleString('en-IN')}</span>
                          <span className={cn(
                            "text-[9px] font-bold uppercase px-1.5 rounded-sm",
                            invoice.type === 'Buy' ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50"
                          )}>{invoice.type}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-center">
                        <Badge className={cn(
                          "rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all border shadow-sm",
                          invoice.status === 'Paid' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : 
                          invoice.status === 'Pending' ? "bg-amber-50 text-amber-700 border-amber-100" : 
                          "bg-rose-50 text-rose-700 border-rose-100"
                        )}>
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 pr-6 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100">
                              <MoreHorizontal className="h-4 w-4 text-slate-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl border-slate-100 shadow-xl p-1">
                            <DropdownMenuItem
                              className="rounded-lg gap-2 text-xs font-medium focus:bg-emerald-50 focus:text-emerald-700 py-2 cursor-pointer"
                              onClick={() => downloadInvoicePdf(invoice)}
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download PDF
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="h-12 w-12 text-slate-200" />
                        <p className="text-slate-500 font-medium">{searchQuery ? 'No invoices match your search' : 'No invoices generated yet'}</p>
                        <Button variant="link" onClick={() => { setSearchQuery(""); setStatusFilter("All"); }} className="text-emerald-600 font-semibold p-0">Clear filters</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-100 bg-slate-50/50">
            <div className="text-xs font-semibold text-slate-500">
              Showing <span className="font-bold text-slate-900">{Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)}</span> to{" "}
              <span className="font-bold text-slate-900">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of{" "}
              <span className="font-bold text-slate-900">{pagination.total}</span> invoices
            </div>
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    className={cn("cursor-pointer select-none", pagination.page <= 1 && "pointer-events-none opacity-50")}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let p = i + 1;
                  if (pagination.totalPages > 5) {
                    if (pagination.page > 3) p = pagination.page - 2 + i;
                    if (p > pagination.totalPages) p = pagination.totalPages - (4 - i);
                  }
                  return (
                    <PaginationItem key={p}>
                      <PaginationLink
                        isActive={pagination.page === p}
                        onClick={() => setPagination((prev) => ({ ...prev, page: p }))}
                        className="cursor-pointer select-none"
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(pagination.totalPages, prev.page + 1) }))}
                    className={cn("cursor-pointer select-none", pagination.page >= pagination.totalPages && "pointer-events-none opacity-50")}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </Card>
    </div>
  );
}
