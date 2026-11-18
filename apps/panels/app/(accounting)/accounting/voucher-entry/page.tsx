"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShoppingCart,
  FileCheck,
  Receipt,
  BookOpen,
  ShoppingBag,
  Loader2,
  Check,
  AlertCircle,
  AlertTriangle,
  Users,
  Plus,
  X,
  ArrowRight,
  ArrowLeft,
  Scale,
  Trash2,
  Calendar as CalendarIcon,
  ArrowLeftRight,
  FileMinus,
  FilePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchLedgers,
  createVoucher,
  updateVoucher,
  fetchVoucherById,
  fetchCustomVoucherTypes,
  type Ledger,
  type CustomVoucherType,
} from "@/lib/accounting-api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LedgerSelectorModal } from "@/components/ui/ledger-selector-modal";
import { StockSelectorModal } from "@/components/ui/stock-selector-modal";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ── Voucher type config ────────────────────────────────────────────────────────
const VOUCHER_CONFIG: Record<
  string,
  {
    label: string;
    icon: any;
    gradient: string;
    apiType: string;
    description: string;
  }
> = {
  SALE: {
    label: "Sale Voucher",
    icon: ShoppingCart,
    gradient: "from-emerald-500 to-emerald-700",
    apiType: "PAYMENT_SALES",
    description: "Customer invoice & share delivery",
  },
  PURCHASE: {
    label: "Purchase Voucher",
    icon: ShoppingBag,
    gradient: "from-amber-500 to-orange-600",
    apiType: "RECEIPT",
    description: "Vendor invoice & share acquisition",
  },
  PAYMENT: {
    label: "Payment Voucher",
    icon: FileCheck,
    gradient: "from-blue-500 to-blue-700",
    apiType: "PAYMENT_SALES",
    description: "Money paid out from Bank/Cash",
  },
  RECEIPT: {
    label: "Receipt Voucher",
    icon: Receipt,
    gradient: "from-indigo-500 to-indigo-700",
    apiType: "RECEIPT",
    description: "Money received into Bank/Cash",
  },
  CONTRA: {
    label: "Contra Voucher",
    icon: ArrowLeftRight,
    gradient: "from-purple-500 to-purple-700",
    apiType: "JOURNAL",
    description: "Bank to Cash / Bank to Bank transfer",
  },
  JOURNAL: {
    label: "Journal Voucher",
    icon: BookOpen,
    gradient: "from-violet-500 to-violet-700",
    apiType: "JOURNAL",
    description: "Adjustments, provisions, depreciation",
  },
  DEBIT_NOTE: {
    label: "Debit Note",
    icon: FileMinus,
    gradient: "from-orange-500 to-amber-700",
    apiType: "DEBIT_NOTE",
    description: "Purchase return / debit adjustment",
  },
  CREDIT_NOTE: {
    label: "Credit Note",
    icon: FilePlus,
    gradient: "from-cyan-500 to-blue-700",
    apiType: "CREDIT_NOTE",
    description: "Sales return / credit adjustment",
  },
};

const PAYMENT_MODES = [
  "Cash",
  "Cheque",
  "NEFT",
  "RTGS",
  "IMPS",
  "UPI",
  "DD",
  "Online Transfer",
  "Other",
];
const SMART_TYPES: string[] = [];

const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);

const getTodayDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatDateObjToYMD = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (dString: string) => {
  if (!dString) return "Pick a date";
  const parts = dString.split("-");
  const dateObj = new Date(parseInt(parts[0]!), parseInt(parts[1]!) - 1, parseInt(parts[2]!));
  return dateObj.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

interface ManualRow {
  ledgerId: string;
  debit: string;
  credit: string;
  narration: string;
  subLedgerId: string;
  entryType?: "DEBIT" | "CREDIT";

  // Payment/Receipt Specific
  orderId: string;
  orderDate: string;
  modeOfPayment: string;
  instrumentId: string;
  instrumentDate: string;
  bankValueDate: string;

  // Sale/Purchase Specific
  contractNoteNo: string;
  contractNoteDate: string;
  scriptName: string;
  isin: string;
  qty: string;
  rate: string;

  // Journal Specific
  referenceNo: string;
  referenceDate: string;

  // Override flags
  isRateManual?: boolean;
  isAmountManual?: boolean;
}

const EMPTY_ROW: ManualRow = {
  ledgerId: "",
  debit: "",
  credit: "",
  narration: "",
  subLedgerId: "",
  entryType: "DEBIT",
  orderId: "",
  orderDate: "",
  modeOfPayment: "",
  instrumentId: "",
  instrumentDate: "",
  bankValueDate: "",
  contractNoteNo: "",
  contractNoteDate: "",
  scriptName: "",
  isin: "",
  qty: "",
  rate: "",
  referenceNo: "",
  referenceDate: "",
  isRateManual: false,
  isAmountManual: false,
};

export default function VoucherEntryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialType = searchParams.get("type") || "SALE";

  // Custom types loading
  const [customTypes, setCustomTypes] = useState<CustomVoucherType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

  useEffect(() => {
    fetchCustomVoucherTypes(true)
      .then((types) => {
        setCustomTypes(types || []);
        setLoadingTypes(false);
      })
      .catch(() => {
        setLoadingTypes(false);
      });
  }, []);

  const tabsList = useMemo(() => {
    const baseTabs = Object.entries(VOUCHER_CONFIG).map(([key, cfg]) => ({
      id: key,
      label: cfg.label,
      icon: cfg.icon,
      gradient: cfg.gradient,
      apiType: cfg.apiType,
      customTypeId: undefined,
    }));

    if (customTypes.length === 0) {
      return baseTabs;
    }

    const customTabs = customTypes.map((t) => {
      const isPay =
        t.name.toLowerCase().includes("pay") ||
        t.name.toLowerCase().includes("payment");
      const isReceiptVoucher =
        t.name.toLowerCase().includes("receipt");
      const baseConfig: any =
        t.baseType === "PAYMENT_SALES"
          ? isPay
            ? VOUCHER_CONFIG.PAYMENT
            : VOUCHER_CONFIG.SALE
          : t.baseType === "RECEIPT"
            ? isReceiptVoucher
              ? VOUCHER_CONFIG.RECEIPT
              : VOUCHER_CONFIG.PURCHASE
            : VOUCHER_CONFIG.JOURNAL;

      return {
        id: t.id,
        label: t.name,
        icon: baseConfig.icon,
        gradient: baseConfig.gradient,
        apiType: t.baseType,
        customTypeId: t.id,
      };
    });

    return [...baseTabs, ...customTabs];
  }, [customTypes]);

  const [selectedTabId, setSelectedTabId] = useState<string>("");

  useEffect(() => {
    if (tabsList.length > 0 && !selectedTabId) {
      const matched = tabsList.find(
        (t) =>
          t.id === initialType || (t.customTypeId && t.apiType === initialType),
      );
      setSelectedTabId(matched ? matched.id : tabsList[0]?.id || "SALE");
    }
  }, [tabsList, initialType, selectedTabId]);

  const activeTab = useMemo(() => {
    return (
      tabsList.find((t) => t.id === selectedTabId) ||
      tabsList[0] || {
        id: "SALE",
        label: "Sale Voucher",
        apiType: "PAYMENT_SALES",
        customTypeId: undefined,
      }
    );
  }, [tabsList, selectedTabId]);

  const [voucherType, setVoucherType] = useState<string>("SALE");

  useEffect(() => {
    if (activeTab) {
      const isPay =
        activeTab.label.toLowerCase().includes("pay") ||
        activeTab.label.toLowerCase().includes("payment");
      const isReceiptVoucher =
        activeTab.label.toLowerCase().includes("receipt");
      const mappedType =
        activeTab.apiType === "PAYMENT_SALES"
          ? isPay
            ? "PAYMENT"
            : "SALE"
          : activeTab.apiType === "RECEIPT"
            ? isReceiptVoucher
              ? "RECEIPT"
              : "PURCHASE"
            : "JOURNAL";
      setVoucherType(mappedType);
    }
  }, [activeTab]);

  const config = (VOUCHER_CONFIG[voucherType] ?? VOUCHER_CONFIG.SALE)!;
  const isSmart = SMART_TYPES.includes(voucherType);

  // ── State ──────────────────────────────────────────────────────────────────
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [date, setDate] = useState(
    getTodayDateString(),
  );
  const [narration, setNarration] = useState("");
  const [refNo, setRefNo] = useState("");
  const [refDate, setRefDate] = useState(getTodayDateString());

  // Smart-voucher fields
  const [clientLedgerId, setClientLedgerId] = useState("");
  const [amount, setAmount] = useState("");
  const [scriptName, setScriptName] = useState("");
  const [isin, setIsin] = useState("");
  const [qty, setQty] = useState("");
  const [rate, setRate] = useState("");
  const [modeOfPayment, setModeOfPayment] = useState("");
  const [instrumentId, setInstrumentId] = useState("");
  const [instrumentDate, setInstrumentDate] = useState("");
  const [bankValueDate, setBankValueDate] = useState("");
  const [cnNo, setCnNo] = useState("");
  const [cnDate, setCnDate] = useState("");
  const [isSmartAmountManual, setIsSmartAmountManual] = useState(false);



  // Manual-voucher fields
  const [rows, setRows] = useState<ManualRow[]>([
    { ...EMPTY_ROW },
    { ...EMPTY_ROW },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stockErrorMessage, setStockErrorMessage] = useState<string | null>(null);
  const editId = searchParams.get("edit");
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [originalVoucherStatus, setOriginalVoucherStatus] =
    useState<string>("");

  useEffect(() => {
    if (editId && tabsList.length > 0) {
      setLoadingEdit(true);
      setIsEditMode(true);
      fetchVoucherById(editId)
        .then((v) => {
          if (v) {
            setDate((v.date || "").split("T")[0] || "");
            setNarration(v.narration || "");
            setRefNo(v.referenceNumber || "");
            setRefDate((v.referenceDate || "").split("T")[0] || "");
            setOriginalVoucherStatus(v.status);

              // Find any stock details present on any entry or in voucher metadata
              const vMeta = (v.metadata || {}) as any;
              const fallbackScriptName =
                vMeta.scriptName ||
                vMeta.stockName ||
                v.entries?.find((e: any) => e.scriptName)?.scriptName ||
                "";
              const fallbackIsin =
                vMeta.isin ||
                vMeta.isinCode ||
                v.entries?.find((e: any) => e.isin)?.isin ||
                "";
              const fallbackQty =
                vMeta.quantity != null
                  ? String(vMeta.quantity)
                  : vMeta.qty != null
                  ? String(vMeta.qty)
                  : (v.entries?.find((e: any) => e.qty != null) as any)?.qty != null
                  ? String((v.entries.find((e: any) => e.qty != null) as any).qty)
                  : "";
              const fallbackRate =
                vMeta.pricePerShare != null
                  ? String(vMeta.pricePerShare)
                  : vMeta.rate != null
                  ? String(vMeta.rate)
                  : (v.entries?.find((e: any) => e.rate != null) as any)?.rate != null
                  ? String((v.entries.find((e: any) => e.rate != null) as any).rate)
                  : "";

              // Pre-populate rows
              const formattedRows = v.entries.map((entry: any) => {
                const isDebit = entry.entryType === "DEBIT";
                const rowQtyStr = entry.qty != null ? String(entry.qty) : fallbackQty;
                const rowRateStr = entry.rate != null ? String(entry.rate) : fallbackRate;
                const qtyVal = parseFloat(rowQtyStr) || 0;
                const rateVal = parseFloat(rowRateStr) || 0;
                const amtVal = entry.amount != null ? parseFloat(entry.amount) : 0;
                const expectedAmt = parseFloat((qtyVal * rateVal).toFixed(2));
                const isAmtManual = qtyVal > 0 && rateVal > 0 && Math.abs(expectedAmt - amtVal) > 0.01;

                return {
                  ledgerId: entry.ledgerId,
                  debit: isDebit ? String(entry.amount) : "",
                  credit: !isDebit ? String(entry.amount) : "",
                  entryType: entry.entryType,
                  narration: entry.narration || "",
                  scriptName: entry.scriptName || fallbackScriptName,
                  isin: entry.isin || fallbackIsin,
                  qty: rowQtyStr,
                  rate: rowRateStr,
                  subLedgerId: entry.metadata?.subLedgerId || "",
                  orderId: entry.metadata?.orderId || vMeta.orderId || "",
                  orderDate: entry.metadata?.orderDate || vMeta.orderDate || "",
                  modeOfPayment: entry.metadata?.modeOfPayment || vMeta.modeOfPayment || "",
                  instrumentId: entry.metadata?.instrumentId || vMeta.instrumentId || "",
                  instrumentDate: entry.metadata?.instrumentDate || vMeta.instrumentDate || "",
                  bankValueDate: entry.metadata?.bankValueDate || vMeta.bankValueDate || "",
                  contractNoteNo: entry.metadata?.contractNoteNo || vMeta.contractNoteNo || v.referenceNumber || "",
                  contractNoteDate: entry.metadata?.contractNoteDate || vMeta.contractNoteDate || (v.referenceDate || "").split("T")[0] || "",
                  referenceNo: entry.metadata?.referenceNo || vMeta.referenceNo || "",
                  referenceDate: entry.metadata?.referenceDate || vMeta.referenceDate || "",
                  isRateManual: true,
                  isAmountManual: isAmtManual,
                };
              });
              setRows(
                formattedRows.length > 0
                  ? formattedRows
                  : [{ ...EMPTY_ROW }, { ...EMPTY_ROW }],
              );

            // Select matching custom voucher type tab
            if (v.customTypeId) {
              setSelectedTabId(v.customTypeId);
            } else {
              // Map voucherNumber prefix to base tab ID
              let targetTabId = "SALE";
              const prefix = (v.voucherNumber || "").split("-")[0];
              if (prefix === "PAY") {
                targetTabId = "PAYMENT";
              } else if (prefix === "SAL") {
                targetTabId = "SALE";
              } else if (prefix === "PUR") {
                targetTabId = "PURCHASE";
              } else if (prefix === "RCP") {
                targetTabId = "RECEIPT";
              } else if (prefix === "JV") {
                targetTabId = "JOURNAL";
              } else {
                // Fallback to apiType matching
                const mappedTab = tabsList.find(
                  (t) => !t.customTypeId && t.apiType === v.type,
                );
                if (mappedTab) targetTabId = mappedTab.id;
              }
              setSelectedTabId(targetTabId);
            }
          }
          setLoadingEdit(false);
        })
        .catch((err) => {
          setError("Failed to load voucher for editing");
          setLoadingEdit(false);
        });
    } else {
      setIsEditMode(false);
      setDate(getTodayDateString());
      setNarration("");
      setRefNo("");
      setRefDate(getTodayDateString());
      setClientLedgerId("");
      setAmount("");
      setScriptName("");
      setIsin("");
      setQty("");
      setRate("");
      setModeOfPayment("");
      setInstrumentId("");
      setInstrumentDate("");
      setBankValueDate("");
      setCnNo("");
      setCnDate("");
      setIsSmartAmountManual(false);
      setRows([{ ...EMPTY_ROW }, { ...EMPTY_ROW }]);
      setError(null);
      setStockErrorMessage(null);
    }
  }, [editId, tabsList]);

  // ── Load ledgers ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchLedgers("ALL", undefined, true)
      .then((r) => setLedgers(r.ledgers || []))
      .catch(() => {});
  }, []);

  // ── Derived ledger shortcuts ────────────────────────────────────────────────
  const saleLedger = useMemo(
    () => ledgers.find((l) => l.type === "SALE"),
    [ledgers],
  );
  const purchaseLedger = useMemo(
    () => ledgers.find((l) => l.type === "PURCHASE"),
    [ledgers],
  );
  const bankLedger = useMemo(
    () =>
      ledgers.find(
        (l) => l.type === "BANK" && l.name.toUpperCase().includes("CASHFREE"),
      ) ||
      ledgers.find(
        (l) => l.type === "BANK" && !l.name.toUpperCase().includes("HDFC"),
      ) ||
      ledgers.find((l) => l.type === "BANK"),
    [ledgers],
  );
  const userLedgers = useMemo(
    () => ledgers.filter((l) => l.type === "USER" && l.isActive),
    [ledgers],
  );
  const clientLedger = useMemo(
    () => ledgers.find((l) => l.id === clientLedgerId && l.isActive),
    [ledgers, clientLedgerId],
  );

  // Computed amount for SALE/PURCHASE voucher (qty × rate)
  const computedAmount = useMemo(() => {
    if (voucherType !== "SALE" && voucherType !== "PURCHASE") return parseFloat(amount) || 0;
    if (isSmartAmountManual) return parseFloat(amount) || 0;
    const q = parseFloat(qty) || 0;
    const r = parseFloat(rate) || 0;
    if (q > 0 && r > 0) return parseFloat((q * r).toFixed(2));
    return parseFloat(amount) || 0;
  }, [voucherType, qty, rate, amount, isSmartAmountManual]);

  // Manual totals
  const manualDebit = rows.reduce((s, r) => s + (parseFloat(r.debit) || 0), 0);
  const manualCredit = rows.reduce(
    (s, r) => s + (parseFloat(r.credit) || 0),
    0,
  );
  const isManualBalanced =
    Math.abs(manualDebit - manualCredit) < 0.01 && manualDebit > 0;

  // ── Double-entry preview (for smart vouchers) ───────────────────────────────
  const doubleEntry = useMemo(() => {
    if (!isSmart) return [];
    const amt = computedAmount;
    if (voucherType === "SALE") {
      return [
        {
          ledger: clientLedger?.name || "Client Ledger",
          code: clientLedger?.code || "—",
          side: "Dr",
          amount: amt,
          color: "text-rose-600",
        },
        {
          ledger: saleLedger?.name || "Sales A/C",
          code: saleLedger?.code || "—",
          side: "Cr",
          amount: amt,
          color: "text-emerald-600",
        },
      ];
    }
    if (voucherType === "PURCHASE") {
      return [
        {
          ledger: purchaseLedger?.name || "Purchases A/C",
          code: purchaseLedger?.code || "—",
          side: "Dr",
          amount: amt,
          color: "text-rose-600",
        },
        {
          ledger: clientLedger?.name || "Client Ledger",
          code: clientLedger?.code || "—",
          side: "Cr",
          amount: amt,
          color: "text-emerald-600",
        },
      ];
    }
    // RECEIPT / PAYMENT
    return [
      {
        ledger: bankLedger?.name || "Bank A/C",
        code: bankLedger?.code || "—",
        side: "Dr",
        amount: amt,
        color: "text-rose-600",
      },
      {
        ledger: clientLedger?.name || "Client Ledger",
        code: clientLedger?.code || "—",
        side: "Cr",
        amount: amt,
        color: "text-emerald-600",
      },
    ];
  }, [
    isSmart,
    voucherType,
    computedAmount,
    clientLedger,
    saleLedger,
    purchaseLedger,
    bankLedger,
  ]);

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let entries: any[];

    if (isSmart) {
      if (!clientLedgerId) {
        setError("Please select the Client Ledger");
        return;
      }
      const amt = computedAmount;
      if (amt <= 0) {
        setError("Amount must be greater than 0");
        return;
      }

      const counterLedgerId =
        voucherType === "SALE"
          ? saleLedger?.id
          : voucherType === "PURCHASE"
            ? purchaseLedger?.id
            : bankLedger?.id;
      if (!counterLedgerId) {
        setError("System ledger not found. Please refresh.");
        return;
      }

      const sharedPayload = {
        narration: narration || undefined,
        scriptName: scriptName || undefined,
        isin: isin || undefined,
        qty: qty ? parseFloat(qty) : undefined,
        rate: rate ? parseFloat(rate) : undefined,
      };

      if (voucherType === "SALE") {
        // Dr Client, Cr Sale Ledger
        entries = [
          {
            ledgerId: clientLedgerId,
            entryType: "DEBIT",
            amount: amt,
            ...sharedPayload,
            remarks: cnNo ? `CN: ${cnNo}` : undefined,
          },
          {
            ledgerId: counterLedgerId,
            entryType: "CREDIT",
            amount: amt,
            ...sharedPayload,
          },
        ];
      } else if (voucherType === "PURCHASE") {
        // Dr Purchase Ledger (stock in), Cr Client (who sold to us)
        entries = [
          {
            ledgerId: counterLedgerId,
            entryType: "DEBIT",
            amount: amt,
            ...sharedPayload,
            remarks: cnNo ? `CN: ${cnNo}` : undefined,
          },
          {
            ledgerId: clientLedgerId,
            entryType: "CREDIT",
            amount: amt,
            ...sharedPayload,
          },
        ];
      } else {
        // RECEIPT / PAYMENT: Dr Bank, Cr Client
        entries = [
          {
            ledgerId: counterLedgerId,
            entryType: "DEBIT",
            amount: amt,
            narration: narration || undefined,
            remarks:
              [
                modeOfPayment && `Mode:${modeOfPayment}`,
                instrumentId && `Inst:${instrumentId}`,
              ]
                .filter(Boolean)
                .join("; ") || undefined,
          },
          {
            ledgerId: clientLedgerId,
            entryType: "CREDIT",
            amount: amt,
            narration: narration || undefined,
          },
        ];
      }
    } else {
      // Manual mode
      if (!isManualBalanced) {
        setError("Total Debits must equal Total Credits");
        return;
      }
      const valid = rows.filter(
        (r) =>
          r.ledgerId && (parseFloat(r.debit) > 0 || parseFloat(r.credit) > 0),
      );
      if (valid.length < 2) {
        setError("At least 2 valid entries required");
        return;
      }
      const hasStock = voucherType !== "RECEIPT" && voucherType !== "PAYMENT" && voucherType !== "CONTRA";
      const isReceiptOrPayment = voucherType === "RECEIPT" || voucherType === "PAYMENT";
      const isPurchaseOrSale = voucherType === "PURCHASE" || voucherType === "SALE";
      const isJournal = voucherType === "JOURNAL";

      const r0 = valid[0];
      // Find any non-empty stock details across all valid rows
      const anyScriptName = valid.find((r) => r.scriptName)?.scriptName;
      const anyIsin = valid.find((r) => r.isin)?.isin;
      const anyQty = valid.find((r) => r.qty)?.qty;
      const anyRate = valid.find((r) => r.rate)?.rate;
      const anyContractNoteNo = valid.find((r) => r.contractNoteNo)?.contractNoteNo || refNo;
      const anyContractNoteDate = valid.find((r) => r.contractNoteDate)?.contractNoteDate || refDate;

      entries = valid.map((r) => {
        const isDebit = parseFloat(r.debit) > 0;
        
        // Fallback to any row or Row 1 metadata if empty on current row
        const resolvedNarration = r.narration || r0?.narration;
        const resolvedScriptName = r.scriptName || anyScriptName || r0?.scriptName;
        const resolvedIsin = r.isin || anyIsin || r0?.isin;
        const resolvedQty = r.qty || anyQty || r0?.qty;
        const resolvedRate = r.rate || anyRate || r0?.rate;
        
        const resolvedSubLedgerId = r.subLedgerId || r0?.subLedgerId;
        const resolvedOrderId = r.orderId || r0?.orderId;
        const resolvedOrderDate = r.orderDate || r0?.orderDate;
        const resolvedModeOfPayment = r.modeOfPayment || r0?.modeOfPayment;
        const resolvedInstrumentId = r.instrumentId || r0?.instrumentId;
        const resolvedInstrumentDate = r.instrumentDate || r0?.instrumentDate;
        const resolvedBankValueDate = r.bankValueDate || r0?.bankValueDate;
        const resolvedContractNoteNo = r.contractNoteNo || anyContractNoteNo || r0?.contractNoteNo;
        const resolvedContractNoteDate = r.contractNoteDate || anyContractNoteDate || r0?.contractNoteDate;
        const resolvedReferenceNo = r.referenceNo || r0?.referenceNo;
        const resolvedReferenceDate = r.referenceDate || r0?.referenceDate;

        return {
          ledgerId: r.ledgerId,
          entryType: isDebit ? "DEBIT" : "CREDIT",
          amount: isDebit ? parseFloat(r.debit) : parseFloat(r.credit),
          narration: resolvedNarration || undefined,
          scriptName: hasStock ? (resolvedScriptName || undefined) : undefined,
          isin: hasStock ? (resolvedIsin || undefined) : undefined,
          qty: hasStock && resolvedQty ? parseFloat(resolvedQty) : undefined,
          rate: hasStock && resolvedRate ? parseFloat(resolvedRate) : undefined,
          metadata: {
            subLedgerId: resolvedSubLedgerId || undefined,
            orderId: isPurchaseOrSale ? (resolvedOrderId || undefined) : undefined,
            orderDate: isPurchaseOrSale ? (resolvedOrderDate || undefined) : undefined,
            modeOfPayment: (isReceiptOrPayment || isPurchaseOrSale) ? (resolvedModeOfPayment || undefined) : undefined,
            instrumentId: (isReceiptOrPayment || isPurchaseOrSale) ? (resolvedInstrumentId || undefined) : undefined,
            instrumentDate: (isReceiptOrPayment || isPurchaseOrSale) ? (resolvedInstrumentDate || undefined) : undefined,
            bankValueDate: isReceiptOrPayment ? (resolvedBankValueDate || undefined) : undefined,
            contractNoteNo: isPurchaseOrSale ? (resolvedContractNoteNo || undefined) : undefined,
            contractNoteDate: isPurchaseOrSale ? (resolvedContractNoteDate || undefined) : undefined,
            referenceNo: isJournal ? (resolvedReferenceNo || undefined) : undefined,
            referenceDate: isJournal ? (resolvedReferenceDate || undefined) : undefined,
          },
        };
      });
    }

    setSubmitting(true);
    try {
      const isPurchaseOrSale = voucherType === "PURCHASE" || voucherType === "SALE";
      const isJournalVoucher = voucherType === "JOURNAL";
      const smartStockMeta = (isSmart && isPurchaseOrSale) ? {
        scriptName: scriptName || undefined,
        stockName: scriptName || undefined,
        isin: isin || undefined,
        qty: qty ? parseFloat(qty) : undefined,
        quantity: qty ? parseFloat(qty) : undefined,
        rate: rate ? parseFloat(rate) : undefined,
        pricePerShare: rate ? parseFloat(rate) : undefined,
        contractNoteNo: cnNo || undefined,
        contractNoteDate: cnDate || undefined,
      } : {};

      const anyEntryScriptName = entries.find((e: any) => e.scriptName)?.scriptName;
      const anyEntryIsin = entries.find((e: any) => e.isin)?.isin;
      const anyEntryQty = entries.find((e: any) => e.qty != null)?.qty;
      const anyEntryRate = entries.find((e: any) => e.rate != null)?.rate;

      const manualStockMeta = (!isSmart && (isPurchaseOrSale || isJournalVoucher)) ? {
        scriptName: anyEntryScriptName || undefined,
        stockName: anyEntryScriptName || undefined,
        isin: anyEntryIsin || undefined,
        qty: anyEntryQty != null ? anyEntryQty : undefined,
        quantity: anyEntryQty != null ? anyEntryQty : undefined,
        rate: anyEntryRate != null ? anyEntryRate : undefined,
        pricePerShare: anyEntryRate != null ? anyEntryRate : undefined,
        contractNoteNo: refNo || undefined,
        contractNoteDate: refDate || undefined,
      } : {};

      const payload = {
        type: activeTab.apiType,
        customTypeId: activeTab.customTypeId || undefined,
        date,
        narration: narration || "",
        referenceNumber: isSmart ? (cnNo || refNo || undefined) : (refNo || undefined),
        referenceDate: isSmart ? (cnDate || refDate || undefined) : (refDate || undefined),
        entries,
        metadata: {
          refNo: isSmart ? (cnNo || refNo || undefined) : refNo,
          voucherClass: voucherType,
          ...smartStockMeta,
          ...manualStockMeta,
          ...(isSmart && modeOfPayment ? { modeOfPayment } : {}),
          ...(isSmart && instrumentId ? { instrumentId } : {}),
          ...(isSmart && instrumentDate ? { instrumentDate } : {}),
        },
      };

      if (isEditMode && editId) {
        await updateVoucher(editId, payload);
      } else {
        await createVoucher(payload);
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/accounting/vouchers");
      }, 1500);
    } catch (err: any) {
      const apiMessage: string =
        err?.response?.data?.message ||
        err?.message ||
        `Failed to ${isEditMode ? "update" : "create"} voucher`;

      // Detect stock-related errors and show them in a prominent popup modal
      const isStockError =
        typeof apiMessage === "string" &&
        (apiMessage.toLowerCase().includes("insufficient stock") ||
          apiMessage.toLowerCase().includes("stock quantity") ||
          apiMessage.toLowerCase().includes("not enough") ||
          apiMessage.toLowerCase().includes("out of stock") ||
          apiMessage.toLowerCase().includes("available quantity"));

      if (isStockError) {
        setStockErrorMessage(apiMessage);
      } else {
        setError(apiMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Reset fields when voucherType changes
  const handleVoucherTypeChange = (newTabId: string) => {
    if (isEditMode) return;
    setSelectedTabId(newTabId);
    setError(null);
    setClientLedgerId("");
    setAmount("");
    setScriptName("");
    setIsin("");
    setQty("");
    setRate("");
    setModeOfPayment("");
    setInstrumentId("");
    setInstrumentDate("");
    setBankValueDate("");
    setCnNo("");
    setCnDate("");
    setIsSmartAmountManual(false);
    setRows([{ ...EMPTY_ROW }, { ...EMPTY_ROW }]);
  };

  const handleClearAllFields = () => {
    if (window.confirm("Are you sure you want to clear all fields?")) {
      if (editId) {
        router.push("/accounting/voucher-entry");
      } else {
        setDate(getTodayDateString());
        setNarration("");
        setRefNo("");
        setRefDate(getTodayDateString());
        setClientLedgerId("");
        setAmount("");
        setScriptName("");
        setIsin("");
        setQty("");
        setRate("");
        setModeOfPayment("");
        setInstrumentId("");
        setInstrumentDate("");
        setBankValueDate("");
        setCnNo("");
        setCnDate("");
        setIsSmartAmountManual(false);
        setRows([{ ...EMPTY_ROW }, { ...EMPTY_ROW }]);
        setError(null);
        setStockErrorMessage(null);
      }
    }
  };

  const inputCls =
    "w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all";
  const labelCls =
    "block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5";

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-3xl border border-slate-100 shadow-sm min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 animate-in zoom-in-50 duration-300">
            <Check className="h-10 w-10 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900">
            {isEditMode
              ? "Voucher Updated Successfully!"
              : "Voucher Created Successfully!"}
          </p>
          <p className="text-sm text-slate-500">
            {isEditMode
              ? "Voucher changes saved successfully. Redirecting..."
              : "Entries posted to general ledger. Redirecting to Vouchers list..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Stock Insufficient Error Modal */}
      {stockErrorMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white shadow-2xl border border-rose-100 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start gap-4 p-6 pb-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-100">
                <AlertTriangle className="h-6 w-6 text-rose-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-slate-900">Insufficient Stock</h2>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">Voucher creation blocked</p>
              </div>
              <button
                type="button"
                onClick={() => setStockErrorMessage(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Message */}
            <div className="px-6 pb-2">
              <div className="rounded-xl bg-rose-50 border border-rose-100 p-4">
                <p className="text-sm text-rose-800 font-semibold leading-relaxed">
                  {stockErrorMessage}
                </p>
              </div>
            </div>

            {/* Info text */}
            <div className="px-6 pb-4 pt-3">
              <p className="text-xs text-slate-500 font-medium">
                No voucher entry has been created. Please check the available stock quantity and try again with a valid amount.
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 px-6 pb-6 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStockErrorMessage(null)}
                className="px-5 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 transition-colors shadow-sm"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
            Double Entry Accounting
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5">
            <FileCheck className="h-8 w-8 text-emerald-600 shrink-0" />
            {isEditMode ? "Alter Voucher" : "Voucher Entry"}
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            {isEditMode
              ? "Modify and resubmit this transaction for audit approval"
              : "Record financial and stock transaction vouchers"}
          </p>
        </div>
        <div>
          <Button
            onClick={() => router.push("/accounting/vouchers")}
            variant="outline"
            className="rounded-xl border-slate-200 text-slate-600 font-semibold gap-2 shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Vouchers
          </Button>
        </div>
      </div>

      {/* Voucher Type Tabs Selector */}
      <Card className="p-4 rounded-3xl border-slate-100 shadow-sm bg-white">
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-3 px-1">
          Select Voucher Type
        </h2>
        {loadingTypes ? (
          <div className="flex items-center gap-2 py-4 px-2 text-slate-400 text-xs font-semibold">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
            Loading active voucher types...
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            {tabsList.map((tab) => {
              const isSelected = selectedTabId === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleVoucherTypeChange(tab.id)}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all duration-200 gap-2 shadow-sm focus:outline-none",
                    isSelected
                      ? "border-emerald-500 bg-emerald-50/40 text-emerald-950 font-bold scale-[1.02] ring-2 ring-emerald-500/20"
                      : "border-slate-100 bg-white hover:border-slate-200 text-slate-500 hover:text-slate-700",
                  )}
                >
                  <div
                    className={cn(
                      "p-2 rounded-xl text-white",
                      isSelected ? tab.gradient : "bg-slate-100 text-slate-400",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p
                      className={cn(
                        "text-xs leading-tight truncate max-w-[130px]",
                        isSelected
                          ? "text-emerald-950 font-bold"
                          : "text-slate-700 font-semibold",
                      )}
                    >
                      {tab.label}
                    </p>
                    <p className="text-[8px] text-slate-400 mt-1 uppercase font-mono tracking-wider">
                      {tab.customTypeId ? (
                        tab.apiType === "PAYMENT_SALES"
                          ? tab.label.toLowerCase().includes("pay") || tab.label.toLowerCase().includes("payment") ? "PAYMENT" : "SALE"
                          : tab.apiType === "RECEIPT"
                            ? tab.label.toLowerCase().includes("receipt") ? "RECEIPT" : "PURCHASE"
                            : "JOURNAL"
                      ) : (
                        tab.id
                      )}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* Voucher Entry Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-rose-50 border border-rose-200">
            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
            <p className="text-sm text-rose-700 font-semibold">{error}</p>
          </div>
        )}

        {/* Common Header Fields */}
        <div className="bg-white rounded-none border border-slate-100 shadow-sm p-6">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-4">
            Voucher Header Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Voucher Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full h-[38px] px-3 justify-start text-left font-normal border-slate-200 shadow-sm hover:bg-slate-50 bg-white",
                      !date && "text-slate-500"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
                    {date ? formatDisplayDate(date) : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[100]" align="start">
                  <Calendar
                    mode="single"
                    selected={date ? new Date(date + "T12:00:00") : undefined}
                    onSelect={(d) => {
                      if (d) setDate(formatDateObjToYMD(d));
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className={labelCls}>Reference No</label>
              <input
                type="text"
                placeholder="Reference Number"
                value={refNo}
                onChange={(e) => setRefNo(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Reference Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full h-[38px] px-3 justify-start text-left font-normal border-slate-200 shadow-sm hover:bg-slate-50 bg-white",
                      !refDate && "text-slate-500"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
                    {refDate ? formatDisplayDate(refDate) : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[100]" align="start">
                  <Calendar
                    mode="single"
                    selected={refDate ? new Date(refDate + "T12:00:00") : undefined}
                    onSelect={(d) => {
                      if (d) setRefDate(formatDateObjToYMD(d));
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="md:col-span-3">
              <label className={labelCls}>Narration</label>
              <input
                type="text"
                placeholder="General narration describing this voucher transaction…"
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* Smart Fields (SALE / RECEIPT) */}
        {isSmart && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-none border border-slate-100 shadow-sm p-6 space-y-6">
              <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
                {voucherType === "SALE"
                  ? "Sales / Order Details"
                  : "Receipt / Bank Details"}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Client selection */}
                <div>
                  <label className={labelCls}>
                    <Users className="inline h-3.5 w-3.5 mr-1 text-slate-400" />
                    Client Ledger Account{" "}
                    <span className="text-rose-500">*</span>
                  </label>
                  <LedgerSelectorModal
                    ledgers={userLedgers}
                    value={clientLedgerId}
                    onChange={(val) => setClientLedgerId(val)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Client Code</label>
                  <input
                    type="text"
                    readOnly
                    placeholder="-"
                    value={
                      userLedgers.find((l) => l.id === clientLedgerId)?.code ||
                      ""
                    }
                    className={cn(
                      inputCls,
                      "bg-slate-50 font-mono font-bold text-slate-500 cursor-not-allowed select-none",
                    )}
                  />
                </div>

                {voucherType === "SALE" || voucherType === "PURCHASE" ? (
                  <>
                    <div>
                      <label className={labelCls}>
                        Unlisted Script / Company Name
                      </label>
                      <StockSelectorModal
                        value={isin}
                        disableZeroQty={voucherType === "SALE"}
                        onChange={(selectedIsin, name, price) => {
                          setIsin(selectedIsin);
                          setScriptName(name);
                          if (price != null && !rate) {
                            setRate(String(price));
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>ISIN Code</label>
                      <input
                        type="text"
                        placeholder="e.g. INE040A01034"
                        value={isin}
                        onChange={(e) => setIsin(e.target.value)}
                        className={cn(inputCls, "font-mono uppercase")}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>
                        Contract Note / Serial No
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. CN-4592"
                        value={cnNo}
                        onChange={(e) => setCnNo(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>CN Date</label>
                      <input
                        type="date"
                        value={cnDate}
                        onChange={(e) => setCnDate(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Quantity (Shares)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        className={cn(inputCls, "text-right font-mono")}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Rate per Share (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={rate}
                        onChange={(e) => setRate(e.target.value)}
                        className={cn(inputCls, "text-right font-mono")}
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <label className={labelCls}>
                        Amount (₹){" "}
                        {qty && rate && (
                          <button
                            type="button"
                            onClick={() => {
                              const nextManual = !isSmartAmountManual;
                              setIsSmartAmountManual(nextManual);
                              if (!nextManual) {
                                const q = parseFloat(qty) || 0;
                                const r = parseFloat(rate) || 0;
                                setAmount(String((q * r).toFixed(2)));
                              }
                            }}
                            className={cn(
                              "text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider transition-all duration-150 inline-flex items-center gap-0.5 ml-1.5 cursor-pointer",
                              isSmartAmountManual
                                ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                            )}
                            title={isSmartAmountManual ? "Click to lock to Auto Amount" : "Click to unlock and edit Amount"}
                          >
                            {isSmartAmountManual ? "Manual 🔓" : "Auto 🔒"}
                          </button>
                        )}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={qty && rate && !isSmartAmountManual ? computedAmount.toFixed(2) : amount}
                        onChange={(e) => {
                          setAmount(e.target.value);
                          setIsSmartAmountManual(true);
                        }}
                        className={cn(
                          inputCls,
                          "text-right font-bold font-mono text-emerald-700 outline-none",
                          qty && rate && !isSmartAmountManual
                            ? "bg-emerald-50/50 cursor-not-allowed select-none border-emerald-200 text-emerald-700"
                            : "bg-white border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        )}
                        disabled={qty && rate && !isSmartAmountManual ? true : false}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className={labelCls}>
                        Receipt Amount (₹){" "}
                        <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                        className={cn(
                          inputCls,
                          "text-right font-bold font-mono text-emerald-700 bg-emerald-50/50",
                        )}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Mode of Payment</label>
                      <select
                        value={modeOfPayment}
                        onChange={(e) => setModeOfPayment(e.target.value)}
                        className={inputCls}
                      >
                        <option value="">— Select Mode —</option>
                        {PAYMENT_MODES.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>
                        Transaction / Instrument No
                      </label>
                      <input
                        type="text"
                        placeholder="Cheque / UTR / Reference"
                        value={instrumentId}
                        onChange={(e) => setInstrumentId(e.target.value)}
                        className={cn(inputCls, "font-mono")}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Instrument Date</label>
                      <input
                        type="date"
                        value={instrumentDate}
                        onChange={(e) => setInstrumentDate(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <label className={labelCls}>Bank Clearance Date</label>
                      <input
                        type="date"
                        value={bankValueDate}
                        onChange={(e) => setBankValueDate(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Smart Double-entry preview */}
            <div className="bg-slate-900 rounded-none p-6 shadow-md text-white flex flex-col justify-between">
              <div>
                <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                  <Scale className="h-4 w-4 text-emerald-500" />
                  Double-Entry Ledger Impact
                </h2>
                <p className="text-xs text-slate-400 mb-6 font-medium">
                  Automatic system reconciliation logic preview:
                </p>
                <div className="space-y-4">
                  {doubleEntry.map((row, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 bg-white/5 rounded-2xl px-4 py-3 border border-white/5"
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold",
                          row.side === "Dr"
                            ? "bg-rose-500/20 text-rose-300"
                            : "bg-emerald-500/20 text-emerald-300",
                        )}
                      >
                        {row.side}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">
                          {row.ledger}
                        </p>
                        <p className="text-[10px] font-mono text-slate-500">
                          {row.code}
                        </p>
                      </div>
                      <p
                        className={cn(
                          "text-sm font-extrabold font-mono",
                          row.color,
                        )}
                      >
                        ₹{fmt(row.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {computedAmount > 0 && (
                <div className="mt-8 pt-6 border-t border-white/5">
                  <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white/5">
                    <span className="text-xs text-slate-400 font-semibold">
                      Total Debit / Credit
                    </span>
                    <span className="text-lg font-extrabold text-white font-mono">
                      ₹{fmt(computedAmount)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Manual Entries (PAYMENT / PURCHASE / JOURNAL / RECEIPT) */}
        {!isSmart && (
          <div className="bg-white rounded-none border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
                Ledger Entry Items
              </h2>
              <button
                type="button"
                onClick={() =>
                  setRows((p) => {
                    const totalDebit = p.reduce((sum, r) => sum + (parseFloat(r.debit) || 0), 0);
                    const totalCredit = p.reduce((sum, r) => sum + (parseFloat(r.credit) || 0), 0);
                    const diff = totalDebit - totalCredit;
                    
                    let entryType: "DEBIT" | "CREDIT" = "DEBIT";
                    let debit = "";
                    let credit = "";
                    
                    if (Math.abs(diff) > 0.01) {
                      const needsCredit = diff > 0;
                      entryType = needsCredit ? "CREDIT" : "DEBIT";
                      const balAmt = Math.abs(diff).toFixed(2);
                      if (needsCredit) {
                        credit = balAmt;
                      } else {
                        debit = balAmt;
                      }
                    }
                    
                    return [
                      ...p,
                      {
                        ...EMPTY_ROW,
                        entryType,
                        debit,
                        credit,
                      },
                    ];
                  })
                }
                className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                <Plus className="h-4 w-4" /> Add Ledger Row
              </button>
            </div>
            <div className="p-4 sm:p-6 bg-slate-50/50 flex flex-col gap-4">
              {rows.map((row, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-slate-200 shadow-sm p-4 relative group hover:border-slate-300 transition-colors"
                >
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase text-slate-300 mr-2">
                      Entry #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setRows((p) => p.filter((_, i) => i !== idx))
                      }
                      disabled={rows.length <= 2}
                      className="h-7 w-7 rounded-none bg-white border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 hover:border-rose-200 disabled:opacity-30 flex items-center justify-center transition-colors"
                      title="Remove Entry"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* ── Row 1: Ledger + Code + Dr/Cr + Narration ── */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 mt-2">
                    <div className="space-y-1.5 lg:col-span-2">
                      <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                        Ledger Account
                      </label>
                      <LedgerSelectorModal
                        ledgers={ledgers.filter(
                          (l) =>
                            l.isActive &&
                            (voucherType === "CONTRA" ||
                              !(
                                l.type === "BANK" &&
                                l.name.toUpperCase().includes("HDFC")
                              )),
                        )}
                        value={row.ledgerId}
                        onChange={(val) =>
                          setRows((p) => {
                            const updated = p.map((r, i) =>
                              i === idx ? { ...r, ledgerId: val } : r,
                            );
                            
                            const curr = updated[idx];
                            if (curr && val) {
                              const prevRow = updated[idx - 1];
                              if (prevRow) {
                                curr.narration = curr.narration || prevRow.narration;
                                curr.modeOfPayment = curr.modeOfPayment || prevRow.modeOfPayment;
                                curr.instrumentId = curr.instrumentId || prevRow.instrumentId;
                                curr.instrumentDate = curr.instrumentDate || prevRow.instrumentDate;
                                curr.bankValueDate = curr.bankValueDate || prevRow.bankValueDate;
                                curr.orderId = curr.orderId || prevRow.orderId;
                                curr.orderDate = curr.orderDate || prevRow.orderDate;
                                curr.referenceNo = curr.referenceNo || prevRow.referenceNo;
                                curr.referenceDate = curr.referenceDate || prevRow.referenceDate;
                              }
                              
                              if (!curr.debit && !curr.credit) {
                                const totalDebit = updated.reduce((s, r, rIdx) => s + (rIdx === idx ? 0 : (parseFloat(r.debit) || 0)), 0);
                                const totalCredit = updated.reduce((s, r, rIdx) => s + (rIdx === idx ? 0 : (parseFloat(r.credit) || 0)), 0);
                                const diff = totalDebit - totalCredit;
                                
                                if (Math.abs(diff) > 0.01) {
                                  const needsCredit = diff > 0;
                                  const amt = Math.abs(diff).toFixed(2);
                                  curr.entryType = needsCredit ? "CREDIT" : "DEBIT";
                                  if (needsCredit) {
                                    curr.credit = amt;
                                    curr.debit = "";
                                  } else {
                                    curr.debit = amt;
                                    curr.credit = "";
                                  }
                                }
                              }
                            }
                            return updated;
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                        Ledger Code
                      </label>
                      <input
                        type="text"
                        readOnly
                        placeholder="-"
                        value={
                          ledgers.find((l) => l.id === row.ledgerId)?.code || ""
                        }
                        className="w-full px-3 py-1.5 text-xs rounded-none border border-slate-200 bg-slate-50 font-mono font-bold text-slate-500 outline-none cursor-not-allowed select-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                        Dr / Cr
                      </label>
                      <select
                        value={row.entryType === "CREDIT" ? "CR" : "DR"}
                        onChange={(e) => {
                          const isDr = e.target.value === "DR";
                          const currentAmt = row.debit || row.credit || "";
                          setRows((p) =>
                            p.map((r, i) =>
                              i === idx
                                ? {
                                    ...r,
                                    entryType: isDr ? "DEBIT" : "CREDIT",
                                    debit: isDr ? currentAmt : "",
                                    credit: !isDr ? currentAmt : "",
                                  }
                                : r,
                            ),
                          );
                        }}
                        className="w-full px-3 py-1.5 text-xs rounded-none border border-slate-200 bg-white font-semibold text-slate-800 outline-none focus:border-emerald-400"
                      >
                        <option value="DR">Dr (Debit)</option>
                        <option value="CR">Cr (Credit)</option>
                      </select>
                    </div>
                    <div className="space-y-1.5 lg:col-span-3">
                      <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                        Narration
                      </label>
                      <input
                        type="text"
                        placeholder="Narration..."
                        value={row.narration}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRows((p) =>
                            p.map((r, i) =>
                              i === idx
                                ? { ...r, narration: val }
                                : r,
                            ),
                          );
                        }}
                        className="w-full px-3 py-1.5 text-xs rounded-none border border-slate-200 outline-none focus:border-emerald-400 bg-white"
                      />
                    </div>
                  </div>

                  {/* ── Row 2: Amount · Qty · Rate · Script · Stock · ISIN ── */}
                  {voucherType !== "RECEIPT" && voucherType !== "PAYMENT" && voucherType !== "CONTRA" ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-4 pt-4 border-t border-slate-100">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                          Script Name
                        </label>
                        <input
                          type="text"
                          placeholder="Script Name"
                          value={row.scriptName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRows((p) => {
                              const updated = p.map((r, i) =>
                                i === idx ? { ...r, scriptName: val } : r,
                              );
                              const nextRow = updated[idx + 1];
                              if (idx === 0 && nextRow) {
                                nextRow.scriptName = val;
                              }
                              return updated;
                            });
                          }}
                          className="w-full px-3 py-1.5 text-xs rounded-none border border-slate-200 outline-none focus:border-emerald-400 bg-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                          Select Stock
                        </label>
                        <StockSelectorModal
                          value={row.isin}
                          disableZeroQty={voucherType === "SALE"}
                          onChange={(isin, name, price) =>
                            setRows((p) => {
                              const next = p.map((r, i) => {
                                if (i !== idx) return r;
                                const rateVal = price != null ? price : parseFloat(r.rate);
                                const qtyVal = parseFloat(r.qty);
                                const shouldRecalculate = !r.isAmountManual && !isNaN(rateVal) && !isNaN(qtyVal) && qtyVal > 0;
                                const computed = shouldRecalculate ? String((qtyVal * rateVal).toFixed(2)) : (r.debit || r.credit);
                                const isCr = r.entryType === "CREDIT";
                                
                                return {
                                  ...r,
                                  isin,
                                  scriptName: r.scriptName || name,
                                  rate: price != null ? String(price) : r.rate,
                                  isRateManual: false,
                                  entryType: r.entryType,
                                  debit: shouldRecalculate ? (!isCr ? computed : "") : r.debit,
                                  credit: shouldRecalculate ? (isCr ? computed : "") : r.credit,
                                };
                              });
                              
                              const r1 = next[1];
                              if (idx === 0 && r1) {
                                const r0 = next[0];
                                if (r0) {
                                  if (voucherType === "PURCHASE") {
                                    next[1] = {
                                      ...r1,
                                      entryType: "CREDIT",
                                    };
                                  } else if (voucherType === "SALE") {
                                    next[1] = {
                                      ...r1,
                                      entryType: "DEBIT",
                                    };
                                  }
                                  
                                  const updatedR1 = next[1];
                                  if (updatedR1) {
                                    const amtVal = r0.debit || r0.credit;
                                    if (amtVal) {
                                      if (voucherType === "PURCHASE") {
                                        updatedR1.entryType = "CREDIT";
                                        updatedR1.credit = amtVal;
                                        updatedR1.debit = "";
                                      } else if (voucherType === "SALE") {
                                        updatedR1.entryType = "DEBIT";
                                        updatedR1.debit = amtVal;
                                        updatedR1.credit = "";
                                      }
                                    }
                                    updatedR1.isin = isin;
                                    updatedR1.scriptName = name;
                                    updatedR1.rate = price != null ? String(price) : r0.rate;
                                    updatedR1.qty = r0.qty;
                                  }
                                }
                              }
                              return next;
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                          Stock ISIN
                        </label>
                        <input
                          type="text"
                          readOnly
                          placeholder="-"
                          value={row.isin || ""}
                          className="w-full px-3 py-1.5 text-xs rounded-none border border-slate-200 bg-slate-50 font-mono font-bold text-slate-500 outline-none cursor-not-allowed select-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                          Quantity
                        </label>
                        <input
                          type="number"
                          placeholder="Qty"
                          value={row.qty}
                          onChange={(e) => {
                            const newQty = e.target.value;
                            const rateVal = parseFloat(row.rate);
                            const qtyVal = parseFloat(newQty);
                            setRows((p) => {
                              const updated = p.map((r, i) => {
                                if (i !== idx) return r;
                                const isPurchase = voucherType === "PURCHASE";
                                const shouldRecalculate = !isPurchase && !r.isAmountManual && !isNaN(rateVal) && !isNaN(qtyVal) && qtyVal > 0;
                                const computed = shouldRecalculate
                                  ? String((qtyVal * rateVal).toFixed(2))
                                  : (r.debit || r.credit);
                                const isCr = r.entryType === "CREDIT";
                                return {
                                  ...r,
                                  qty: newQty,
                                  debit: shouldRecalculate ? (!isCr ? computed : "") : r.debit,
                                  credit: shouldRecalculate ? (isCr ? computed : "") : r.credit,
                                };
                              });

                              // Auto balance next row
                              const nextRow = updated[idx + 1];
                              if (nextRow && !nextRow.isAmountManual) {
                                const totalDebit = updated.reduce((s, r, rIdx) => s + (rIdx === idx + 1 ? 0 : (parseFloat(r.debit) || 0)), 0);
                                const totalCredit = updated.reduce((s, r, rIdx) => s + (rIdx === idx + 1 ? 0 : (parseFloat(r.credit) || 0)), 0);
                                const diff = totalDebit - totalCredit;
                                if (Math.abs(diff) > 0.01) {
                                  const needsCredit = diff > 0;
                                  const balAmt = Math.abs(diff).toFixed(2);
                                  nextRow.entryType = needsCredit ? "CREDIT" : "DEBIT";
                                  if (needsCredit) {
                                    nextRow.credit = balAmt;
                                    nextRow.debit = "";
                                  } else {
                                    nextRow.debit = balAmt;
                                    nextRow.credit = "";
                                  }
                                } else {
                                  nextRow.debit = "";
                                  nextRow.credit = "";
                                }
                              }
                              return updated;
                            });
                          }}
                          className="w-full px-3 py-1.5 text-xs rounded-none border border-slate-200 outline-none focus:border-emerald-400 bg-white font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                          Rate
                          {row.isin && row.rate && voucherType !== "PURCHASE" && (
                            <button
                              type="button"
                              onClick={() => {
                                setRows((p) =>
                                  p.map((r, i) =>
                                    i === idx
                                      ? { ...r, isRateManual: !r.isRateManual }
                                      : r,
                                  ),
                                );
                              }}
                              className={cn(
                                "text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider transition-all duration-150 flex items-center gap-0.5 cursor-pointer",
                                row.isRateManual
                                  ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                  : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                              )}
                              title={row.isRateManual ? "Click to lock to Auto Rate" : "Click to unlock and edit Rate"}
                            >
                              {row.isRateManual ? "Manual 🔓" : "Auto 🔒"}
                            </button>
                          )}
                        </label>
                        <input
                          type="number"
                          placeholder="Rate"
                          value={row.rate}
                          readOnly={!!row.isin && voucherType !== "PURCHASE" && !row.isRateManual}
                          onChange={(e) => {
                            const newRate = e.target.value;
                            const rateVal = parseFloat(newRate);
                            const qtyVal = parseFloat(row.qty);
                            setRows((p) => {
                              const updated = p.map((r, i) => {
                                if (i !== idx) return r;
                                const shouldRecalculate = !r.isAmountManual && !isNaN(rateVal) && !isNaN(qtyVal) && qtyVal > 0;
                                const computed = shouldRecalculate
                                  ? String((qtyVal * rateVal).toFixed(2))
                                  : (r.debit || r.credit);
                                const isCr = r.entryType === "CREDIT";
                                return {
                                  ...r,
                                  rate: newRate,
                                  debit: shouldRecalculate ? (!isCr ? computed : "") : r.debit,
                                  credit: shouldRecalculate ? (isCr ? computed : "") : r.credit,
                                };
                              });

                              // Auto balance next row
                              const nextRow = updated[idx + 1];
                              if (nextRow && !nextRow.isAmountManual) {
                                const totalDebit = updated.reduce((s, r, rIdx) => s + (rIdx === idx + 1 ? 0 : (parseFloat(r.debit) || 0)), 0);
                                const totalCredit = updated.reduce((s, r, rIdx) => s + (rIdx === idx + 1 ? 0 : (parseFloat(r.credit) || 0)), 0);
                                const diff = totalDebit - totalCredit;
                                if (Math.abs(diff) > 0.01) {
                                  const needsCredit = diff > 0;
                                  const balAmt = Math.abs(diff).toFixed(2);
                                  nextRow.entryType = needsCredit ? "CREDIT" : "DEBIT";
                                  if (needsCredit) {
                                    nextRow.credit = balAmt;
                                    nextRow.debit = "";
                                  } else {
                                    nextRow.debit = balAmt;
                                    nextRow.credit = "";
                                  }
                                } else {
                                  nextRow.debit = "";
                                  nextRow.credit = "";
                                }
                              }
                              return updated;
                            });
                          }}
                          className={cn(
                            "w-full px-3 py-1.5 text-xs rounded-none font-mono outline-none",
                            row.isin && voucherType !== "PURCHASE" && !row.isRateManual
                              ? "border-emerald-200 bg-emerald-50/50 text-emerald-700 font-bold cursor-not-allowed select-none"
                              : "border border-slate-200 focus:border-emerald-400 bg-white"
                          )}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                          Amount (₹)
                          {row.qty && row.rate && (parseFloat(row.qty) * parseFloat(row.rate)) > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setRows((p) =>
                                  p.map((r, i) => {
                                    if (i !== idx) return r;
                                    const nextManual = !r.isAmountManual;
                                    let updated = { ...r, isAmountManual: nextManual };
                                    if (!nextManual) {
                                      const qtyVal = parseFloat(r.qty);
                                      const rateVal = parseFloat(r.rate);
                                      if (!isNaN(qtyVal) && !isNaN(rateVal)) {
                                        const computed = String((qtyVal * rateVal).toFixed(2));
                                        const isCr = r.entryType === "CREDIT";
                                        updated.debit = !isCr ? computed : "";
                                        updated.credit = isCr ? computed : "";
                                      }
                                    }
                                    return updated;
                                  })
                                );
                              }}
                              className={cn(
                                "text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider transition-all duration-150 flex items-center gap-0.5 cursor-pointer",
                                row.isAmountManual
                                  ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                  : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                              )}
                              title={row.isAmountManual ? "Click to lock to Auto Amount" : "Click to unlock and edit Amount"}
                            >
                              {row.isAmountManual ? "Manual 🔓" : "Auto 🔒"}
                            </button>
                          )}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={row.debit || row.credit}
                          onChange={(e) => {
                            const isCr = row.entryType === "CREDIT";
                            const amt = e.target.value;
                            setRows((p) => {
                              const updated = p.map((r, i) =>
                                i === idx
                                  ? {
                                      ...r,
                                      debit: !isCr ? amt : "",
                                      credit: isCr ? amt : "",
                                      isAmountManual: true,
                                    }
                                  : r,
                              );
                              
                              // Tally-like auto-fill/update amount for the next row if not manually overridden
                              const nextRow = updated[idx + 1];
                              if (nextRow && !nextRow.isAmountManual) {
                                const totalDebit = updated.reduce((s, r, rIdx) => s + (rIdx === idx + 1 ? 0 : (parseFloat(r.debit) || 0)), 0);
                                const totalCredit = updated.reduce((s, r, rIdx) => s + (rIdx === idx + 1 ? 0 : (parseFloat(r.credit) || 0)), 0);
                                const diff = totalDebit - totalCredit;
                                if (Math.abs(diff) > 0.01) {
                                  const needsCredit = diff > 0;
                                  const balAmt = Math.abs(diff).toFixed(2);
                                  nextRow.entryType = needsCredit ? "CREDIT" : "DEBIT";
                                  if (needsCredit) {
                                    nextRow.credit = balAmt;
                                    nextRow.debit = "";
                                  } else {
                                    nextRow.debit = balAmt;
                                    nextRow.credit = "";
                                  }
                                } else {
                                  nextRow.debit = "";
                                  nextRow.credit = "";
                                }
                              }
                              return updated;
                            });
                          }}
                          className={cn(
                            "w-full px-3 py-1.5 text-xs rounded-none font-mono outline-none font-bold",
                            row.entryType === "CREDIT"
                              ? "border-emerald-200 bg-emerald-50/50 text-emerald-700 placeholder:text-emerald-300 focus:border-emerald-400"
                              : "border-rose-200 bg-rose-50/50 text-rose-700 placeholder:text-rose-300 focus:border-rose-400",
                          )}
                        />
                      </div>
                    </div>
                  ) : (
                    /* For RECEIPT and PAYMENT vouchers, hide stock details, only render Amount field */
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100">
                      <div className="space-y-1.5 md:col-span-1">
                        <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                          Amount (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={row.debit || row.credit}
                          onChange={(e) => {
                            const isCr = row.entryType === "CREDIT";
                            const amt = e.target.value;
                            setRows((p) => {
                              const updated = p.map((r, i) =>
                                i === idx
                                  ? {
                                      ...r,
                                      debit: !isCr ? amt : "",
                                      credit: isCr ? amt : "",
                                      isAmountManual: true,
                                    }
                                  : r,
                              );
                              
                              // Tally-like auto-fill/update amount for the next row if not manually overridden
                              const nextRow = updated[idx + 1];
                              if (nextRow && !nextRow.isAmountManual) {
                                const totalDebit = updated.reduce((s, r, rIdx) => s + (rIdx === idx + 1 ? 0 : (parseFloat(r.debit) || 0)), 0);
                                const totalCredit = updated.reduce((s, r, rIdx) => s + (rIdx === idx + 1 ? 0 : (parseFloat(r.credit) || 0)), 0);
                                const diff = totalDebit - totalCredit;
                                if (Math.abs(diff) > 0.01) {
                                  const needsCredit = diff > 0;
                                  const balAmt = Math.abs(diff).toFixed(2);
                                  nextRow.entryType = needsCredit ? "CREDIT" : "DEBIT";
                                  if (needsCredit) {
                                    nextRow.credit = balAmt;
                                    nextRow.debit = "";
                                  } else {
                                    nextRow.debit = balAmt;
                                    nextRow.credit = "";
                                  }
                                } else {
                                  nextRow.debit = "";
                                  nextRow.credit = "";
                                }
                              }
                              return updated;
                            });
                          }}
                          className={cn(
                            "w-full px-3 py-1.5 text-xs rounded-none font-mono outline-none font-bold",
                            row.entryType === "CREDIT"
                              ? "border-emerald-200 bg-emerald-50/50 text-emerald-700 placeholder:text-emerald-300 focus:border-emerald-400"
                              : "border-rose-200 bg-rose-50/50 text-rose-700 placeholder:text-rose-300 focus:border-rose-400",
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {/* ── Row 3: Type-specific fields + Sub Ledger + Sun Ledger ── */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 mt-4 pt-4 border-t border-slate-100">
                    {(voucherType === "PAYMENT" ||
                      voucherType === "RECEIPT") && (
                      <>
                        {[
                          { name: "modeOfPayment", label: "Mode of Payment", type: "text" },
                          { name: "instrumentId", label: "Instrument ID", type: "text" },
                          { name: "instrumentDate", label: "Instrument Date", type: "date" },
                          { name: "bankValueDate", label: "Bank Value Date", type: "date" },
                        ].map((f) => (
                          <div key={f.name} className="space-y-1.5">
                            <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                              {f.label}
                            </label>
                            <input
                              type={f.type}
                              placeholder={f.label}
                              value={(row as any)[f.name] || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRows((p) =>
                                  p.map((r, i) =>
                                    i === idx
                                      ? { ...r, [f.name]: val }
                                      : r,
                                  ),
                                );
                              }}
                              className="w-full px-3 py-1.5 text-xs rounded-none border border-slate-200 outline-none focus:border-emerald-400 bg-white"
                            />
                          </div>
                        ))}
                      </>
                    )}
                    {voucherType === "PURCHASE" && (
                      <>
                        {[
                          { name: "modeOfPayment", label: "Mode of Payment", type: "text" },
                          { name: "instrumentId", label: "Instrument ID", type: "text" },
                          { name: "instrumentDate", label: "Instrument Date", type: "date" },
                        ].map((f) => (
                          <div key={f.name} className="space-y-1.5">
                            <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                              {f.label}
                            </label>
                            <input
                              type={f.type}
                              placeholder={f.label}
                              value={(row as any)[f.name] || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRows((p) =>
                                  p.map((r, i) =>
                                    i === idx
                                      ? { ...r, [f.name]: val }
                                      : r,
                                  ),
                                );
                              }}
                              className="w-full px-3 py-1.5 text-xs rounded-none border border-slate-200 outline-none focus:border-emerald-400 bg-white"
                            />
                          </div>
                        ))}
                      </>
                    )}
                    {voucherType === "JOURNAL" && (
                      <>
                        {[
                          { name: "referenceNo", label: "Reference No", type: "text" },
                          { name: "referenceDate", label: "Reference Date", type: "date" },
                        ].map((f) => (
                          <div key={f.name} className="space-y-1.5">
                            <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                              {f.label}
                            </label>
                            <input
                              type={f.type}
                              placeholder={f.label}
                              value={(row as any)[f.name] || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRows((p) =>
                                  p.map((r, i) =>
                                    i === idx
                                      ? { ...r, [f.name]: val }
                                      : r,
                                  ),
                                );
                              }}
                              className="w-full px-3 py-1.5 text-xs rounded-none border border-slate-200 outline-none focus:border-emerald-400 bg-white"
                            />
                          </div>
                        ))}
                      </>
                    )}

                    {/* Sub Ledger */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                        Sub Ledger (Optional)
                      </label>
                      <LedgerSelectorModal
                        ledgers={ledgers.filter((l) => l.isActive)}
                        value={row.subLedgerId}
                        onChange={(val) =>
                          setRows((p) => {
                            const curr = p[idx];
                            if (!curr) return p;
                            const oldSubLedgerId = curr.subLedgerId;
                            const updatedCurr = { ...curr, subLedgerId: val };
                            const next = [...p];
                            next[idx] = updatedCurr;
                            
                             const subLedgerName = ledgers.find((l) => l.id === val)?.name || "";
                            
                            // Tally-like default narration helper (if empty)
                            const defaultNarration = (voucherType === "RECEIPT")
                              ? `Advance received from ${subLedgerName} towards unlisted share purchase.`
                              : (voucherType === "PAYMENT")
                                ? `Payment made to ${subLedgerName} towards unlisted share purchase.`
                                : (voucherType === "CONTRA")
                                  ? `Internal funds transfer between Bank and Cash accounts.`
                                  : "";
                            
                            if (defaultNarration) {
                              next[idx].narration = next[idx].narration || defaultNarration;
                            }

                            // Tally-like auto-fill for the counterpart row
                            let counterpartIdx = -1;
                            if (next.length === 2) {
                              counterpartIdx = 1 - idx;
                            } else {
                              // If more than 2 rows, try to find the counterpart by finding the first row with the opposite entry type
                              const currentEntryType = curr.debit ? "DEBIT" : (curr.credit ? "CREDIT" : "");
                              counterpartIdx = next.findIndex((r, rIdx) => {
                                if (rIdx === idx) return false;
                                if (currentEntryType) {
                                  const rType = r.debit ? "DEBIT" : (r.credit ? "CREDIT" : "");
                                  return rType && rType !== currentEntryType;
                                }
                                return false;
                              });
                              if (counterpartIdx === -1 && idx + 1 < next.length) {
                                counterpartIdx = idx + 1;
                              }
                            }

                            // Only auto entry on row two (index 1) on selection of subledger
                            if (counterpartIdx === 1) {
                              const counterpartRow = next[counterpartIdx];
                              if (counterpartRow) {
                                // If counterpart row ledger is empty or matched the old subledger, update it to the new subledger ID
                                if (!counterpartRow.ledgerId || counterpartRow.ledgerId === oldSubLedgerId) {
                                  counterpartRow.ledgerId = val;
                                }

                                // Calculate difference excluding the counterpart row to find the balancing amount
                                const totalDebit = next.reduce((s, r, rIdx) => s + (rIdx === counterpartIdx ? 0 : (parseFloat(r.debit) || 0)), 0);
                                const totalCredit = next.reduce((s, r, rIdx) => s + (rIdx === counterpartIdx ? 0 : (parseFloat(r.credit) || 0)), 0);
                                const diff = totalDebit - totalCredit;
                                
                                if (Math.abs(diff) > 0.01) {
                                  const needsCredit = diff > 0;
                                  const amt = Math.abs(diff).toFixed(2);
                                  counterpartRow.entryType = needsCredit ? "CREDIT" : "DEBIT";
                                  if (needsCredit) {
                                    counterpartRow.credit = amt;
                                    counterpartRow.debit = "";
                                  } else {
                                    counterpartRow.debit = amt;
                                    counterpartRow.credit = "";
                                  }
                                }

                                // Copy other fields if empty
                                counterpartRow.narration = counterpartRow.narration || next[idx].narration || defaultNarration;
                                counterpartRow.qty = counterpartRow.qty || curr.qty;
                                counterpartRow.rate = counterpartRow.rate || curr.rate;
                                counterpartRow.scriptName = counterpartRow.scriptName || curr.scriptName;
                                counterpartRow.isin = counterpartRow.isin || curr.isin;
                                counterpartRow.contractNoteNo = counterpartRow.contractNoteNo || curr.contractNoteNo;
                                counterpartRow.contractNoteDate = counterpartRow.contractNoteDate || curr.contractNoteDate;
                                counterpartRow.referenceNo = counterpartRow.referenceNo || curr.referenceNo;
                                counterpartRow.referenceDate = counterpartRow.referenceDate || curr.referenceDate;
                                counterpartRow.modeOfPayment = counterpartRow.modeOfPayment || curr.modeOfPayment;
                                counterpartRow.instrumentId = counterpartRow.instrumentId || curr.instrumentId;
                                counterpartRow.instrumentDate = counterpartRow.instrumentDate || curr.instrumentDate;
                                counterpartRow.bankValueDate = counterpartRow.bankValueDate || curr.bankValueDate;
                                counterpartRow.orderId = counterpartRow.orderId || curr.orderId;
                                counterpartRow.orderDate = counterpartRow.orderDate || curr.orderDate;
                              }
                            }
                            return next;
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                        Sub Ledger Code
                      </label>
                      <input
                        type="text"
                        readOnly
                        placeholder="-"
                        value={
                          ledgers.find((l) => l.id === row.subLedgerId)?.code ||
                          ""
                        }
                        className="w-full px-3 py-1.5 text-xs rounded-none border border-slate-200 bg-slate-50 font-mono font-bold text-slate-500 outline-none cursor-not-allowed select-none"
                      />
                    </div>

                    {/* Sun Ledger Details */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-widest text-sky-600">
                        Sun Ledger Name
                      </label>
                      <input
                        type="text"
                        readOnly
                        placeholder="-"
                        value={
                          (() => {
                            const l = ledgers.find((l) => l.id === row.ledgerId);
                            if (!l) return "";
                            return l.sunName || l.name || "";
                          })()
                        }
                        className="w-full px-3 py-1.5 text-xs rounded-none border border-sky-200 bg-sky-50 font-semibold text-sky-700 outline-none cursor-not-allowed select-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-widest text-sky-600">
                        Sun Code
                      </label>
                      <input
                        type="text"
                        readOnly
                        placeholder="-"
                        value={
                          (() => {
                            const l = ledgers.find((l) => l.id === row.ledgerId);
                            if (!l) return "";
                            return l.sunCode || l.code || "";
                          })()
                        }
                        className="w-full px-3 py-1.5 text-xs rounded-none border border-sky-200 bg-sky-50 font-mono font-bold text-sky-700 outline-none cursor-not-allowed select-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Balance Reconciliation Bar */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <div className="flex gap-8 text-xs font-bold text-slate-600">
                <span>
                  Total Debit:{" "}
                  <span className="text-rose-600 font-mono text-sm ml-1">
                    ₹{fmt(manualDebit)}
                  </span>
                </span>
                <span>
                  Total Credit:{" "}
                  <span className="text-emerald-600 font-mono text-sm ml-1">
                    ₹{fmt(manualCredit)}
                  </span>
                </span>
              </div>
              <span
                className={cn(
                  "text-xs font-extrabold px-4 py-1.5 rounded-none border shadow-sm",
                  isManualBalanced
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : "bg-rose-50 text-rose-700 border-rose-100",
                )}
              >
                {isManualBalanced
                  ? "✓ Dr/Cr Balanced"
                  : "✗ Debits and Credits must balance"}
              </span>
            </div>
          </div>
        )}

        {/* Submit Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleClearAllFields}
            disabled={submitting}
            className="rounded-none px-6 h-12 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-semibold transition-colors gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/accounting/vouchers")}
            disabled={submitting}
            className="rounded-none px-6 h-12 border border-slate-200 text-slate-500 hover:bg-slate-50 font-semibold"
          >
            Cancel
          </Button>
          <button
            type="submit"
            disabled={submitting || (!isSmart && !isManualBalanced)}
            className={cn(
              "px-8 h-12 text-sm font-extrabold rounded-none text-white shadow-md transition-all flex items-center justify-center gap-2",
              "bg-gradient-to-r",
              config.gradient,
              "hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg",
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />{" "}
                {isEditMode ? "Saving..." : "Posting..."}
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                {isEditMode
                  ? originalVoucherStatus === "REMARKED"
                    ? "Update & Resubmit"
                    : "Save Changes"
                  : `Create ${config.label}`}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
