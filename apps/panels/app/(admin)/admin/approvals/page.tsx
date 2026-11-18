"use client";

import { useEffect, useState, useMemo } from "react";
import {
  getPendingApprovals,
  getApprovalHistory,
  getApprovalStats,
  approveRequest,
  rejectRequest,
  clearAllPendingRequests,
  ChangeRequest,
  ApprovalStats,
  ChangeDiffItem,
} from "@/lib/approvals-api";
import {
  formatCurrencyINR,
  formatDateTime,
  formatDate,
  getStorageUrl,
  cn,
} from "@/lib/utils";
import DOMPurify from "isomorphic-dompurify";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  Clock,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Search,
  RefreshCw,
  Building2,
  Sliders,
  Copy,
  Check,
  Filter,
  Layers,
  User,
  MessageSquare,
  Sparkles,
  FileText,
  HelpCircle,
  Newspaper,
  BookOpen,
  FolderTree,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { getStockById } from "@/lib/stocks-api";

// ---------------------------------------------------------------------------
// Stock reference resolver (shows stock name instead of raw ID)
// ---------------------------------------------------------------------------
const stockNameCache = new Map<string, Promise<{ name: string; cin?: string | null } | null>>();

function resolveStock(id: string) {
  if (!stockNameCache.has(id)) {
    stockNameCache.set(
      id,
      getStockById(id)
        .then((s: any) => (s ? { name: s.name, cin: s.cin } : null))
        .catch(() => null)
    );
  }
  return stockNameCache.get(id)!;
}

function StockRefValue({ id }: { id: string }) {
  const [stock, setStock] = useState<{ name: string; cin?: string | null } | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    resolveStock(id).then((s) => active && setStock(s));
    return () => {
      active = false;
    };
  }, [id]);

  if (stock === undefined) {
    return <span className="text-slate-400 italic text-xs">Loading stock…</span>;
  }
  if (!stock) {
    return (
      <span className="font-mono text-xs text-slate-600 break-all">
        {id} <span className="text-rose-500 not-italic">(stock not found)</span>
      </span>
    );
  }
  return (
    <div className="flex flex-col">
      <span className="font-semibold text-slate-900">{stock.name}</span>
      {stock.cin && (
        <span className="font-mono text-[11px] text-slate-500">CIN: {stock.cin}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Card Component
// ---------------------------------------------------------------------------
interface StatCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  loading?: boolean;
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBg,
  iconColor,
  loading,
}: StatCardProps) {
  return (
    <div
      className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] transition-all hover:shadow-[0_8px_30px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 flex items-center gap-4"
    >
      <div
        className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
          iconBg,
          iconColor
        )}
      >
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {title}
        </p>
        {loading ? (
          <div className="h-8 w-16 bg-slate-200 animate-pulse rounded mt-1" />
        ) : (
          <p className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            {value.toLocaleString()}
          </p>
        )}
        <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HTML & JSON Detection Helpers
// ---------------------------------------------------------------------------
function isJsonString(str: any): boolean {
  if (typeof str !== "string") return false;
  const trimmed = str.trim();
  return (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  );
}

function tryParseJson(val: any): any {
  if (!val) return null;
  if (typeof val === "object") return val;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function isHtml(str: any): boolean {
  if (typeof str !== "string") return false;
  if (isJsonString(str)) return false;
  return /<[a-z][\s\S]*>/i.test(str);
}

function stripHtml(str: string): string {
  return str
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isValuesEqual(a: any, b: any): boolean {
  if (a === b) return true;

  const isEmpty = (v: any) =>
    v === null ||
    v === undefined ||
    v === "" ||
    v === "—" ||
    v === "Not set" ||
    (typeof v === "string" && v.trim() === "");

  if (isEmpty(a) && isEmpty(b)) return true;
  if (isEmpty(a) || isEmpty(b)) return false;

  // Booleans / Status labels ("Active", "Inactive", true, false, "true", "false")
  const isBoolA =
    typeof a === "boolean" ||
    a === "true" ||
    a === "false" ||
    a === "Active" ||
    a === "Inactive";
  const isBoolB =
    typeof b === "boolean" ||
    b === "true" ||
    b === "false" ||
    b === "Active" ||
    b === "Inactive";
  if (isBoolA && isBoolB) {
    const boolA = a === true || a === "true" || a === "Active";
    const boolB = b === true || b === "true" || b === "Active";
    return boolA === boolB;
  }

  // Numbers & Currency comparison (e.g. 6.7 vs "₹6.70" vs "6.70" vs 6.70)
  const cleanNum = (v: any): number | null => {
    if (typeof v === "number" && !isNaN(v)) return v;
    if (typeof v === "string") {
      const cleaned = v.replace(/[^0-9.-]+/g, "");
      if (cleaned !== "" && !isNaN(Number(cleaned))) return Number(cleaned);
    }
    return null;
  };
  const numA = cleanNum(a);
  const numB = cleanNum(b);
  if (numA !== null && numB !== null) {
    return Math.abs(numA - numB) < 0.00001;
  }

  // Strings (trim and optional HTML strip)
  if (typeof a === "string" && typeof b === "string") {
    if (a.trim() === b.trim()) return true;
    if (isHtml(a) || isHtml(b)) {
      return stripHtml(a) === stripHtml(b);
    }
  }

  // Objects & Arrays
  if (typeof a === "object" && typeof b === "object") {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Entity Avatar Component
// ---------------------------------------------------------------------------
function EntityAvatar({
  logoUrl,
  entityType,
  name,
}: {
  logoUrl?: string | null;
  entityType: string;
  name: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  if (logoUrl && !imgFailed) {
    return (
      <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0 overflow-hidden">
        <img
          src={logoUrl}
          alt={name}
          className="w-full h-full object-contain p-1"
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }

  switch (entityType) {
    case "STATIC_PAGE":
      return (
        <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 shadow-2xs flex items-center justify-center shrink-0 text-teal-600">
          <FileText className="w-6 h-6" />
        </div>
      );
    case "FAQ":
      return (
        <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 shadow-2xs flex items-center justify-center shrink-0 text-indigo-600">
          <HelpCircle className="w-6 h-6" />
        </div>
      );
    case "NEWS":
      return (
        <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 shadow-2xs flex items-center justify-center shrink-0 text-amber-600">
          <Newspaper className="w-6 h-6" />
        </div>
      );
    case "ARTICLE":
      return (
        <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-200 shadow-2xs flex items-center justify-center shrink-0 text-sky-600">
          <BookOpen className="w-6 h-6" />
        </div>
      );
    case "STOCK_CATEGORY":
      return (
        <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 shadow-2xs flex items-center justify-center shrink-0 text-rose-600">
          <FolderTree className="w-6 h-6" />
        </div>
      );
    case "UPCOMING_STOCK":
      return (
        <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 shadow-2xs flex items-center justify-center shrink-0 text-amber-600">
          <TrendingUp className="w-6 h-6" />
        </div>
      );
    case "BASKET":
      return (
        <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200 shadow-2xs flex items-center justify-center shrink-0 text-purple-600">
          <Layers className="w-6 h-6" />
        </div>
      );
    case "TESTIMONIAL":
      return (
        <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 shadow-2xs flex items-center justify-center shrink-0 text-emerald-600">
          <MessageSquare className="w-6 h-6" />
        </div>
      );
    case "REVENUE_SHARING":
      return (
        <div className="w-12 h-12 rounded-xl bg-violet-50 border border-violet-200 shadow-2xs flex items-center justify-center shrink-0 text-violet-600">
          <Sliders className="w-6 h-6" />
        </div>
      );
    default:
      if (name && name.length >= 2 && !name.includes("_")) {
        return (
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-base shrink-0 shadow-2xs">
            {name.slice(0, 2).toUpperCase()}
          </div>
        );
      }
      return (
        <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 shadow-2xs flex items-center justify-center shrink-0 text-slate-500">
          <Building2 className="w-6 h-6" />
        </div>
      );
  }
}

function expandStructuredDiff(items: ChangeDiffItem[]): ChangeDiffItem[] {
  const result: ChangeDiffItem[] = [];

  for (const item of items) {
    if (item.field === "content" || item.field === "performanceMetrics") {
      const curJson = tryParseJson(item.currentValue);
      const propJson = tryParseJson(item.proposedValue);

      if (propJson && typeof propJson === "object" && !Array.isArray(propJson)) {
        const curObj =
          curJson && typeof curJson === "object" && !Array.isArray(curJson)
            ? curJson
            : {};
        const subDiffs: ChangeDiffItem[] = [];

        const allKeys = Array.from(
          new Set([...Object.keys(curObj), ...Object.keys(propJson)])
        );

        for (const key of allKeys) {
          const oldVal = curObj[key];
          const newVal = propJson[key];

          if (JSON.stringify(oldVal) === JSON.stringify(newVal)) continue;

          // If leadership members array:
          if (
            key === "leadership_members" &&
            (Array.isArray(oldVal) || Array.isArray(newVal))
          ) {
            const oldArr = Array.isArray(oldVal) ? oldVal : [];
            const newArr = Array.isArray(newVal) ? newVal : [];
            const maxLen = Math.max(oldArr.length, newArr.length);

            for (let i = 0; i < maxLen; i++) {
              const mOld = oldArr[i] || {};
              const mNew = newArr[i] || {};
              const mName = mNew.name || mOld.name || `Member ${i + 1}`;

              if (mOld.imageUrl !== mNew.imageUrl) {
                subDiffs.push({
                  field: `leadership_${i}_image`,
                  label: `Leadership: ${mName} (Photo)`,
                  currentValue: mOld.imageUrl || "No Image",
                  proposedValue: mNew.imageUrl || "No Image",
                });
              }
              if (mOld.name !== mNew.name) {
                subDiffs.push({
                  field: `leadership_${i}_name`,
                  label: `Leadership: Member ${i + 1} (Name)`,
                  currentValue: mOld.name || "—",
                  proposedValue: mNew.name || "—",
                });
              }
              if (mOld.role !== mNew.role) {
                subDiffs.push({
                  field: `leadership_${i}_role`,
                  label: `Leadership: ${mName} (Role)`,
                  currentValue: mOld.role || "—",
                  proposedValue: mNew.role || "—",
                });
              }
              if (mOld.desc !== mNew.desc) {
                subDiffs.push({
                  field: `leadership_${i}_desc`,
                  label: `Leadership: ${mName} (Bio)`,
                  currentValue: mOld.desc || "—",
                  proposedValue: mNew.desc || "—",
                });
              }
            }
            continue;
          }

          // Human friendly labels for about-us keys
          const KEY_LABELS: Record<string, string> = {
            hero_title: "Hero Banner: Title",
            hero_subtitle: "Hero Banner: Subtitle",
            hero_badge: "Hero Banner: Badge",
            hero_imageUrl: "Hero Banner: Image",
            hero_badge1: "Hero Banner: Highlight 1",
            hero_badge2: "Hero Banner: Highlight 2",
            ourStory_title: "Our Story: Title",
            ourStory_badge: "Our Story: Badge",
            ourStory_html: "Our Story: Content",
            whyChooseUs_title: "Why Choose Us: Title",
            whyChooseUs_features: "Why Choose Us: Features",
            leadership_title: "Leadership: Section Title",
            leadership_desc: "Leadership: Section Description",
          };

          const label =
            KEY_LABELS[key] ||
            `About Us: ${key
              .replace(/_/g, " ")
              .replace(/^./, (s) => s.toUpperCase())}`;

          subDiffs.push({
            field: `content_${key}`,
            label,
            currentValue:
              oldVal != null
                ? typeof oldVal === "object"
                  ? JSON.stringify(oldVal, null, 2)
                  : String(oldVal)
                : "—",
            proposedValue:
              newVal != null
                ? typeof newVal === "object"
                  ? JSON.stringify(newVal, null, 2)
                  : String(newVal)
                : "—",
          });
        }

        if (subDiffs.length > 0) {
          result.push(...subDiffs);
          continue;
        }
      }
    }

    result.push(item);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Diff Item Formatter
// ---------------------------------------------------------------------------
function DiffRow({ diff, isApproved }: { diff: ChangeDiffItem; isApproved?: boolean }) {
  const [viewMode, setViewMode] = useState<"formatted" | "plain">("formatted");

  const isCurrency =
    diff.field === "price" ||
    diff.field === "internalLendingPrice" ||
    diff.field === "externalLendingPrice";

  const isBackupQuantity = diff.field === "backupQuantity";

  const isQuantity =
    diff.field.toLowerCase().includes("quantity") ||
    diff.field.toLowerCase().includes("qty") ||
    diff.field.toLowerCase().includes("lot");

  const isNumeric =
    typeof diff.currentValue === "number" ||
    typeof diff.proposedValue === "number";

  const hasHtml = isHtml(diff.currentValue) || isHtml(diff.proposedValue);
  const isLongText =
    hasHtml ||
    (typeof diff.currentValue === "string" && diff.currentValue.length > 80) ||
    (typeof diff.proposedValue === "string" && diff.proposedValue.length > 80);

  const isStockRef =
    diff.field === "stockId" ||
    diff.field === "upcomingStockId" ||
    /associated stock/i.test(diff.label || "");

  const renderValue = (val: any) => {
    if (val === null || val === undefined) {
      return <span className="text-slate-400 italic">Not set</span>;
    }
    if (isStockRef) {
      if (typeof val === "string" && /^c[a-z0-9]{20,}$/i.test(val.trim())) {
        return <StockRefValue id={val.trim()} />;
      }
      if (val === "" || val === "—") {
        return <span className="text-slate-400 italic">No stock linked</span>;
      }
    }
    if (isBackupQuantity && (typeof val === "number" || (typeof val === "string" && val.trim() !== "" && Number.isFinite(Number(val))))) {
      const quantity = Number(val);
      return <span className="font-semibold text-slate-900">{quantity.toLocaleString("en-IN")} {quantity === 1 ? "share" : "shares"}</span>;
    }
    if (isCurrency && typeof val === "number") {
      return (
        <span className="font-semibold text-slate-900">
          {formatCurrencyINR(val)}
        </span>
      );
    }
    if (diff.field === "isActive" && typeof val === "boolean") {
      return (
        <Badge
          variant="outline"
          className={cn(
            val
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-slate-100 text-slate-600 border-slate-200"
          )}
        >
          {val ? "Active" : "Inactive"}
        </Badge>
      );
    }
    if (diff.field === "discountSlabs" && Array.isArray(val)) {
      if (val.length === 0) {
        return <span className="text-slate-400 italic">No slabs</span>;
      }
      return (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {val.map((slab: any, idx: number) => (
            <span
              key={idx}
              className="inline-flex items-center text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200"
            >
              {slab.minQty || slab.qty || 0}+ units: {slab.discountPercent || slab.discount || 0}% off
            </span>
          ))}
        </div>
      );
    }
    if (typeof val === "object") {
      return (
        <pre className="text-xs font-mono bg-slate-100 p-1.5 rounded overflow-x-auto max-w-full">
          {JSON.stringify(val, null, 2)}
        </pre>
      );
    }

    if (
      typeof val === "string" &&
      (val.startsWith("/storage/") || val.startsWith("http://") || val.startsWith("https://")) &&
      val.match(/\.(png|jpe?g|webp|svg)(\?.*)?$/i) &&
      !val.includes("\n") &&
      !val.includes("{")
    ) {
      return (
        <div className="flex items-center gap-2.5 my-1">
          <img
            src={val}
            alt="Preview"
            className="w-12 h-12 object-cover rounded-lg border border-slate-200 bg-slate-50 shadow-2xs shrink-0"
            onError={(e) => {
              (e.target as HTMLElement).style.display = "none";
            }}
          />
          <span className="font-mono text-xs text-slate-700 break-all select-all">{val}</span>
        </div>
      );
    }

    if (typeof val === "string") {
      if (isHtml(val)) {
        if (viewMode === "plain") {
          return (
            <div className="text-xs text-slate-700 leading-relaxed max-h-72 overflow-y-auto whitespace-pre-wrap font-normal p-2.5 bg-slate-50/70 rounded-lg border border-slate-200/70">
              {stripHtml(val) || <span className="text-slate-400 italic">Empty text</span>}
            </div>
          );
        }
        return (
          <div
            className="prose prose-xs max-w-none text-xs text-slate-800 break-words leading-relaxed max-h-80 overflow-y-auto p-3 bg-slate-50/70 rounded-lg border border-slate-200/70
              [&_table]:w-full [&_table]:border-collapse [&_table]:my-2 [&_table]:text-[11px]
              [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:p-1.5 [&_th]:font-semibold [&_th]:text-left
              [&_td]:border [&_td]:border-slate-200 [&_td]:p-1.5
              [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4
              [&_p]:mb-1.5 [&_strong]:text-slate-900 [&_strong]:font-semibold"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(val) }}
          />
        );
      }
      return <span className="font-medium text-slate-900 break-words">{val}</span>;
    }

    return <span className="font-medium text-slate-900">{String(val)}</span>;
  };

  const delta = diff.delta;
  const percent = diff.percentChange;
  const isPositive = delta != null && delta > 0;
  const isNegative = delta != null && delta < 0;

  return (
    <div
      className={cn(
        "bg-slate-50/70 rounded-xl p-3.5 border border-slate-200/70 hover:bg-slate-50 transition-colors",
        isLongText && "md:col-span-2"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            {isBackupQuantity ? "Stock Backup Quantity" : diff.label}
          </span>
          {hasHtml && (
            <div className="inline-flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-[10px] font-medium shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode("formatted")}
                className={cn(
                  "px-2 py-0.5 rounded transition-all",
                  viewMode === "formatted"
                    ? "bg-blue-600 text-white font-semibold shadow-2xs"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                Formatted View
              </button>
              <button
                type="button"
                onClick={() => setViewMode("plain")}
                className={cn(
                  "px-2 py-0.5 rounded transition-all",
                  viewMode === "plain"
                    ? "bg-blue-600 text-white font-semibold shadow-2xs"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                Plain Text (No Tags)
              </button>
            </div>
          )}
        </div>

        {isNumeric && delta != null && delta !== 0 && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border",
              isPositive
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            )}
          >
            {isPositive ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {isPositive ? "+" : ""}
            {isCurrency
              ? formatCurrencyINR(delta)
              : isQuantity
              ? isBackupQuantity ? `${delta} ${Math.abs(delta) === 1 ? "share" : "shares"}` : `${delta} units`
              : delta}
            {isCurrency && percent != null && ` (${isPositive ? "+" : ""}${percent.toFixed(2)}%)`}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
        {/* Current State */}
        <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            {diff.currentValue === "Applied Live" || diff.currentValue === "Applied to Database"
              ? "Baseline Status"
              : isBackupQuantity
              ? isApproved ? "Previous Backup Quantity" : "Current Backup Quantity"
              : isApproved
              ? "Previous Baseline"
              : "Current Baseline"}
          </div>
          <div className="text-sm">{renderValue(diff.currentValue)}</div>
        </div>

        {/* Proposed State */}
        <div className="bg-blue-50/40 p-2.5 rounded-lg border border-blue-200/80 shadow-2xs overflow-hidden">
          <div className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>
              {isBackupQuantity
                ? isApproved ? "Approved Backup Quantity" : "Proposed Backup Quantity"
                : isApproved ? "Approved Live Value" : "Proposed Value"}
            </span>
          </div>
          <div className="text-sm font-semibold text-blue-950">
            {renderValue(diff.proposedValue)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Copy Button Helper
// ---------------------------------------------------------------------------
function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`${label || "Text"} copied to clipboard!`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      title={`Copy ${label || text}`}
      className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition-colors"
    >
      {text}
      {copied ? (
        <Check className="w-3 h-3 text-emerald-600" />
      ) : (
        <Copy className="w-3 h-3 text-slate-400" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Approvals Page
// ---------------------------------------------------------------------------
export default function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState<"PENDING" | "HISTORY">("PENDING");
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [stats, setStats] = useState<ApprovalStats>({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modal Action States
  const [selectedRequest, setSelectedRequest] = useState<ChangeRequest | null>(
    null
  );
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | null>(
    null
  );
  const [reviewNote, setReviewNote] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  // Clear All Modal
  const [clearAllModalOpen, setClearAllModalOpen] = useState(false);
  const [clearAllNote, setClearAllNote] = useState("Cleared by admin");
  const [clearingAll, setClearingAll] = useState(false);

  // Fetch Stats
  const loadStats = async () => {
    try {
      setStatsLoading(true);
      const data = await getApprovalStats();
      setStats(data);
    } catch {
      // ignore silently, handled gracefully
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch Requests
  const loadRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "PENDING") {
        const data = await getPendingApprovals();
        setRequests(data);
      } else {
        const data = await getApprovalHistory();
        setRequests(data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load requests.");
      toast.error(err.message || "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  };

  const reloadAll = () => {
    loadStats();
    loadRequests();
  };

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    loadRequests();
  }, [activeTab]);

  // Handle Approve Confirm
  const handleApproveConfirm = async () => {
    if (!selectedRequest) return;
    try {
      setSubmittingAction(true);
      await approveRequest(selectedRequest.id, reviewNote || undefined);
      toast.success(
        `Successfully approved changes for ${
          selectedRequest.entityName || selectedRequest.entityType
        }!`
      );
      setSelectedRequest(null);
      setActionType(null);
      setReviewNote("");
      reloadAll();
    } catch (err: any) {
      toast.error(`Approval failed: ${err.message}`);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle Reject Confirm
  const handleRejectConfirm = async () => {
    if (!selectedRequest) return;
    try {
      setSubmittingAction(true);
      await rejectRequest(selectedRequest.id, reviewNote || undefined);
      toast.success(
        `Rejected change request for ${
          selectedRequest.entityName || selectedRequest.entityType
        }.`
      );
      setSelectedRequest(null);
      setActionType(null);
      setReviewNote("");
      reloadAll();
    } catch (err: any) {
      toast.error(`Rejection failed: ${err.message}`);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle Clear All Confirm
  const handleClearAllConfirm = async () => {
    try {
      setClearingAll(true);
      const result = await clearAllPendingRequests("REJECT", clearAllNote);
      toast.success(`Successfully cleared and rejected ${result.count} pending requests!`);
      setClearAllModalOpen(false);
      reloadAll();
    } catch (err: any) {
      toast.error(`Failed to clear requests: ${err.message}`);
    } finally {
      setClearingAll(false);
    }
  };

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      // Entity Filter
      if (entityFilter !== "ALL" && req.entityType !== entityFilter) {
        return false;
      }

      // Status Filter (History tab)
      if (
        activeTab === "HISTORY" &&
        statusFilter !== "ALL" &&
        req.status !== statusFilter
      ) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const proposedPayload = (req.proposedData || {}) as any;
        const targetData = proposedPayload.data && typeof proposedPayload.data === "object" ? proposedPayload.data : proposedPayload;

        const stockName = (req.entityName || req.entityDetails?.name || "").toLowerCase();
        const title = (req.entityDetails?.title || targetData?.title || "").toLowerCase();
        const slug = (req.entityDetails?.slug || targetData?.slug || "").toLowerCase();
        const label = (proposedPayload.label || "").toLowerCase();
        const isin = (req.entityDetails?.isin || targetData?.isin || "").toLowerCase();
        const cin = (req.entityDetails?.cin || targetData?.cin || "").toLowerCase();
        const requestedBy = (req.requestedBy?.fullName || "").toLowerCase();
        const requestedEmail = (req.requestedBy?.email || "").toLowerCase();
        const reviewedBy = (req.reviewedBy?.fullName || "").toLowerCase();

        return (
          stockName.includes(query) ||
          title.includes(query) ||
          slug.includes(query) ||
          label.includes(query) ||
          isin.includes(query) ||
          cin.includes(query) ||
          requestedBy.includes(query) ||
          requestedEmail.includes(query) ||
          reviewedBy.includes(query)
        );
      }

      return true;
    });
  }, [requests, entityFilter, statusFilter, searchQuery, activeTab]);

  return (
    <div className="flex-1 overflow-auto p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* -------------------------------------------------------------------- */}
      {/* Page Header */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Maker-Checker Approvals
            </h1>
            <Badge
              variant="outline"
              className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold px-2.5 py-0.5"
            >
              Dual Control
            </Badge>
          </div>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Review stock pricing and marketplace changes proposed by Operations before they go live.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={reloadAll}
            disabled={loading || statsLoading}
            className="text-slate-600 hover:text-slate-900 border-slate-200"
          >
            <RefreshCw
              className={cn(
                "w-4 h-4 mr-2",
                (loading || statsLoading) && "animate-spin"
              )}
            />
            Refresh
          </Button>

          {activeTab === "PENDING" && stats.pending > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 font-semibold"
              onClick={() => setClearAllModalOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Clear All Pending ({stats.pending})
            </Button>
          )}
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Stats Cards */}
      {/* -------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pending Reviews"
          value={stats.pending}
          subtitle={
            stats.pending > 0
              ? "Requires checker authorization"
              : "All caught up"
          }
          icon={Clock}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          loading={statsLoading}
        />
        <StatCard
          title="Approved Changes"
          value={stats.approved}
          subtitle="Applied live to catalog"
          icon={CheckCircle2}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          loading={statsLoading}
        />
        <StatCard
          title="Rejected / Archived"
          value={stats.rejected}
          subtitle="Declined or cleared requests"
          icon={XCircle}
          iconBg="bg-rose-50"
          iconColor="text-rose-600"
          loading={statsLoading}
        />
        <StatCard
          title="Total Governed"
          value={stats.total}
          subtitle="All recorded change requests"
          icon={ShieldCheck}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
          loading={statsLoading}
        />
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Tabs & Filter Toolbar */}
      {/* -------------------------------------------------------------------- */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab("PENDING")}
              className={cn(
                "pb-3 text-sm font-semibold relative transition-colors flex items-center gap-2",
                activeTab === "PENDING"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <span>Pending Requests</span>
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-bold",
                  activeTab === "PENDING"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-slate-100 text-slate-600"
                )}
              >
                {stats.pending}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("HISTORY")}
              className={cn(
                "pb-3 text-sm font-semibold relative transition-colors flex items-center gap-2",
                activeTab === "HISTORY"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <span>Audit History</span>
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-bold",
                  activeTab === "HISTORY"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-slate-100 text-slate-600"
                )}
              >
                {stats.approved + stats.rejected}
              </span>
            </button>
          </div>

          <div className="text-xs text-slate-400 pb-2">
            Showing {filteredRequests.length} of {requests.length} requests
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by stock name, ISIN, CIN, requester, or reviewer..."
              className="pl-9 h-9 text-sm bg-slate-50/50 border-slate-200 focus-visible:bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 hidden sm:inline" />
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              aria-label="Filter by Entity Type"
              className="h-9 text-xs font-medium bg-slate-50/50 border border-slate-200 rounded-md px-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ALL">All Request Types</option>
              <option value="STOCK">Stock Details</option>
              <option value="STOCK_PRICING">Stock Pricing & Backup Quantity</option>
              <option value="STATIC_PAGE">Static Pages</option>
              <option value="FAQ">FAQs</option>
              <option value="NEWS">News</option>
              <option value="ARTICLE">Articles</option>
              <option value="STOCK_CATEGORY">Stock Categories</option>
              <option value="UPCOMING_STOCK">Upcoming Stocks</option>
              <option value="BASKET">Stock Baskets</option>
              <option value="TESTIMONIAL">Testimonials</option>
              <option value="REVENUE_SHARING">Revenue Sharing</option>
            </select>

            {/* Status Filter for History tab */}
            {activeTab === "HISTORY" && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by Status"
                className="h-9 text-xs font-medium bg-slate-50/50 border border-slate-200 rounded-md px-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="ALL">All Statuses</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Alerts / Error display */}
      {/* -------------------------------------------------------------------- */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-rose-900">
              Error Loading Approvals
            </h4>
            <p className="text-xs font-medium text-rose-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Requests List */}
      {/* -------------------------------------------------------------------- */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200/80">
          <Loader2 className="h-9 w-9 animate-spin text-blue-600 mb-3" />
          <p className="text-sm font-medium text-slate-500">
            Loading approval requests and computing price diffs...
          </p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200/80 text-center px-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
            {activeTab === "PENDING" ? (
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            ) : (
              <Layers className="w-7 h-7 text-slate-400" />
            )}
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {activeTab === "PENDING"
              ? "No Pending Approvals"
              : "No History Found"}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            {activeTab === "PENDING"
              ? "All maker change requests have been authorized or archived. The live marketplace catalog is currently up to date."
              : searchQuery || entityFilter !== "ALL" || statusFilter !== "ALL"
              ? "No change requests matched your search criteria. Try adjusting or clearing your filters."
              : "No completed approval logs found in the archive."}
          </p>
          {(searchQuery || entityFilter !== "ALL" || statusFilter !== "ALL") && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setSearchQuery("");
                setEntityFilter("ALL");
                setStatusFilter("ALL");
              }}
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {filteredRequests.map((req) => {
            const proposedPayload = (req.proposedData || {}) as any;
            const targetData =
              proposedPayload.data && typeof proposedPayload.data === "object"
                ? proposedPayload.data
                : proposedPayload;
            const action = proposedPayload.action || (req.entityId ? "UPDATE" : "CREATE");

            const entityTypeStr = String(req.entityType || "");

            // Detect if entityName is just a raw fallback string like "STATIC_PAGE" or "FAQ"
            const isGenericName =
              !req.entityName ||
              req.entityName === req.entityType ||
              req.entityName === entityTypeStr.replace(/_/g, " ") ||
              req.entityName.toUpperCase() === "STATIC_PAGE" ||
              req.entityName.toUpperCase() === "FAQ";

            // Clean up label e.g. "Edit page: About Us" -> "About Us", "Create FAQ: What is unlisted?" -> "What is unlisted?"
            const cleanedLabel = proposedPayload.label
              ?.replace(
                /^(?:Edit|Create|Delete|Update)\s+(?:stock|page|FAQ|news|article|category|upcoming stock|testimonial|basket):\s*/i,
                ""
              )
              ?.trim();

            const displayName =
              (!isGenericName ? req.entityName : null) ||
              (req.entityDetails as any)?.title ||
              (req.entityDetails as any)?.name ||
              targetData?.title ||
              targetData?.name ||
              targetData?.question ||
              cleanedLabel ||
              targetData?.slug ||
              req.entityName ||
              (entityTypeStr === "STOCK" || entityTypeStr === "STOCK_PRICING"
                ? "Unlisted Stock"
                : entityTypeStr.replace(/_/g, " "));

            const isin = req.entityDetails?.isin || targetData?.isin;
            const cin = req.entityDetails?.cin || targetData?.cin;
            const slug = (req.entityDetails as any)?.slug || targetData?.slug;
            const category = (req.entityDetails as any)?.category || targetData?.category;
            const authorMeta = targetData?.designation
              ? `${targetData.designation}${targetData.company ? ` at ${targetData.company}` : ""}`
              : targetData?.company || null;

            const rawLogo = req.entityDetails?.logoUrl || targetData?.logoUrl || proposedPayload.logoUrl;
            const logoUrl = rawLogo ? getStorageUrl(rawLogo) : null;

            // Effective diff logic with client-side synthesis for legacy records
            let effectiveDiff: ChangeDiffItem[] = req.diff || [];

            if (effectiveDiff.length === 0 && targetData && typeof targetData === "object") {
              const snapshot = proposedPayload._snapshot || req.currentData;
              const IGNORED_KEYS = new Set([
                "action",
                "label",
                "data",
                "_snapshot",
                "id",
                "createdAt",
                "updatedAt",
                "createdById",
                "updatedById",
              ]);

              const FIELD_LABELS: Record<string, string> = {
                title: "Title / Question",
                slug: "URL Slug",
                content: "Page Content",
                answer: "FAQ Answer",
                category: "Category",
                metaTitle: "Meta Title (SEO)",
                metaDescription: "Meta Description (SEO)",
                performanceMetrics: "Performance Metrics",
                isActive: "Status",
                price: "Base Selling Price",
                internalLendingPrice: "Internal Lending Price",
                externalLendingPrice: "External Lending Price",
                discountSlabs: "Volume Discount Slabs",
                backupQuantity: "Stock Backup Quantity",
                name: "Name",
                description: "Description",
                cin: "CIN",
                isin: "ISIN",
                imageUrl: "Image",
                designation: "Designation",
                company: "Company",
                feedback: "Feedback",
                stockId: "Linked Stock",
                tags: "Tags",
                totalShares: "Total Shares",
                isPopular: "Popular Tag",
                isMarketMover: "Market Mover Tag",
              };

              const keysToInspect = Object.keys(targetData).filter((k) => !IGNORED_KEYS.has(k));

              if (keysToInspect.length > 0) {
                effectiveDiff = keysToInspect
                  .map((key) => {
                    const proposedVal = targetData[key];
                    const currentVal = snapshot
                      ? snapshot[key]
                      : req.status === "APPROVED"
                      ? "Applied to Database"
                      : null;

                    let delta: number | null = null;
                    let percentChange: number | null = null;
                    if (
                      typeof currentVal === "number" &&
                      typeof proposedVal === "number" &&
                      currentVal !== 0
                    ) {
                      delta = proposedVal - currentVal;
                      percentChange = (delta / currentVal) * 100;
                    }

                    return {
                      field: key,
                      label:
                        FIELD_LABELS[key] ||
                        key
                          .replace(/([A-Z])/g, " $1")
                          .replace(/^./, (s) => s.toUpperCase()),
                      currentValue: currentVal,
                      proposedValue: proposedVal,
                      delta,
                      percentChange,
                    };
                  })
                  .filter((item) => {
                    if (action === "CREATE") return true;
                    return !isValuesEqual(item.currentValue, item.proposedValue);
                  });
              }
            }

            effectiveDiff = expandStructuredDiff(effectiveDiff);

            // Filter out unchanged fields for UPDATE / EDIT actions so only actual differences are displayed!
            if (action !== "CREATE") {
              effectiveDiff = effectiveDiff.filter(
                (item) => !isValuesEqual(item.currentValue, item.proposedValue)
              );
            }

            return (
              <div
                key={req.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.03)] overflow-hidden transition-all hover:shadow-[0_6px_24px_rgba(15,23,42,0.06)]"
              >
                {/* Card Header */}
                <div className="p-5 sm:p-6 border-b border-slate-100 bg-linear-to-r from-slate-50/50 to-transparent">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    {/* Stock & Entity Information */}
                    <div className="flex items-start gap-4">
                      {/* Logo / Avatar with entity-specific fallback */}
                      <EntityAvatar
                        logoUrl={logoUrl}
                        entityType={entityTypeStr}
                        name={displayName}
                      />

                      {/* Stock Name & Badges */}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                            {displayName}
                          </h2>
                          {(() => {
                            switch (entityTypeStr) {
                              case "STOCK":
                                return (
                                  <Badge
                                    variant="outline"
                                    className="bg-blue-50 text-blue-700 border-blue-200 text-[11px] font-semibold"
                                  >
                                    Stock Details
                                  </Badge>
                                );
                              case "STOCK_PRICING":
                                return (
                                  <Badge
                                    variant="outline"
                                    className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-semibold"
                                  >
                                    {effectiveDiff.some((item) => item.field === "backupQuantity")
                                      ? effectiveDiff.every((item) => item.field === "backupQuantity")
                                        ? "Stock Backup Quantity"
                                        : "Stock Pricing & Backup Quantity"
                                      : "Stock Pricing"}
                                  </Badge>
                                );
                              case "STATIC_PAGE":
                                return (
                                  <Badge
                                    variant="outline"
                                    className="bg-teal-50 text-teal-700 border-teal-200 text-[11px] font-semibold"
                                  >
                                    Static Page
                                  </Badge>
                                );
                              case "FAQ":
                                return (
                                  <Badge
                                    variant="outline"
                                    className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[11px] font-semibold"
                                  >
                                    FAQ
                                  </Badge>
                                );
                              case "NEWS":
                                return (
                                  <Badge
                                    variant="outline"
                                    className="bg-amber-50 text-amber-700 border-amber-200 text-[11px] font-semibold"
                                  >
                                    News
                                  </Badge>
                                );
                              case "ARTICLE":
                                return (
                                  <Badge
                                    variant="outline"
                                    className="bg-sky-50 text-sky-700 border-sky-200 text-[11px] font-semibold"
                                  >
                                    Article
                                  </Badge>
                                );
                              case "STOCK_CATEGORY":
                                return (
                                  <Badge
                                    variant="outline"
                                    className="bg-rose-50 text-rose-700 border-rose-200 text-[11px] font-semibold"
                                  >
                                    Stock Category
                                  </Badge>
                                );
                              case "UPCOMING_STOCK":
                                return (
                                  <Badge
                                    variant="outline"
                                    className="bg-amber-50 text-amber-700 border-amber-200 text-[11px] font-semibold"
                                  >
                                    Upcoming Stock
                                  </Badge>
                                );
                              case "BASKET":
                                return (
                                  <Badge
                                    variant="outline"
                                    className="bg-purple-50 text-purple-700 border-purple-200 text-[11px] font-semibold"
                                  >
                                    Stock Basket
                                  </Badge>
                                );
                              case "TESTIMONIAL":
                                return (
                                  <Badge
                                    variant="outline"
                                    className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-semibold"
                                  >
                                    Testimonial
                                  </Badge>
                                );
                              case "REVENUE_SHARING":
                                return (
                                  <Badge
                                    variant="outline"
                                    className="bg-purple-50 text-purple-700 border-purple-200 text-[11px] font-semibold"
                                  >
                                    Revenue Sharing
                                  </Badge>
                                );
                              default:
                                return (
                                  <Badge
                                    variant="outline"
                                    className="bg-slate-50 text-slate-700 border-slate-200 text-[11px] font-semibold"
                                  >
                                    {entityTypeStr.replace(/_/g, " ")}
                                  </Badge>
                                );
                            }
                          })()}

                          {/* Action Badge (CREATE / UPDATE / DELETE) */}
                          {action && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5",
                                action === "CREATE" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                                action === "UPDATE" && "bg-blue-50 text-blue-700 border-blue-200",
                                action === "DELETE" && "bg-rose-50 text-rose-700 border-rose-200"
                              )}
                            >
                              {action}
                            </Badge>
                          )}
                        </div>

                        {/* Metadata row: ISIN, CIN, Slug, Category, Author */}
                        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500">
                          {isin && (
                            <div className="flex items-center gap-1">
                              <span className="font-semibold text-slate-400">ISIN:</span>
                              <CopyButton text={isin} label="ISIN" />
                            </div>
                          )}
                          {cin && (
                            <div className="flex items-center gap-1">
                              <span className="font-semibold text-slate-400">CIN:</span>
                              <span className="font-mono text-[11px] text-slate-600">{cin}</span>
                            </div>
                          )}
                          {slug && (
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-400">Page Slug:</span>
                              <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[11px]">
                                /{slug.replace(/^\//, "")}
                              </code>
                              <CopyButton text={`/${slug.replace(/^\//, "")}`} label="Page Slug" />
                            </div>
                          )}
                          {category && (
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-400">Category:</span>
                              <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 text-[11px]">
                                {category}
                              </Badge>
                            </div>
                          )}
                          {authorMeta && (
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-400">Author:</span>
                              <span className="text-slate-700 font-medium">{authorMeta}</span>
                            </div>
                          )}
                        </div>

                        {/* Maker / Requester Line */}
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            Proposed by{" "}
                            <span className="font-semibold text-slate-800">
                              {req.requestedBy.fullName}
                            </span>{" "}
                            ({req.requestedBy.email}) •{" "}
                            <span title={formatDateTime(req.createdAt)}>
                              {formatDate(req.createdAt)}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge & Actions */}
                    <div className="flex flex-col sm:items-end gap-2 shrink-0">
                      {req.status === "PENDING" && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          Awaiting Approval
                        </div>
                      )}
                      {req.status === "APPROVED" && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approved
                        </div>
                      )}
                      {req.status === "REJECTED" && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3.5 h-3.5" />
                          Rejected
                        </div>
                      )}
                      <span className="text-[11px] text-slate-400 font-mono">
                        ID: {req.id.slice(0, 10)}...
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Body: Price & Details Diff */}
                <div className="p-5 sm:p-6 space-y-4">
                  {/* If Approved, show the confirmation banner at the top */}
                  {req.status === "APPROVED" && (
                    <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-xs font-bold text-emerald-800">
                          Approved & Applied Live to Database
                        </span>
                        <span className="text-xs text-slate-600 hidden md:inline">
                          — All proposed changes were verified and merged into the live catalog.
                        </span>
                      </div>
                      {req.reviewedBy && (
                        <span className="text-[11px] text-emerald-700 font-medium shrink-0">
                          Reviewed by {req.reviewedBy.fullName}
                        </span>
                      )}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-blue-600" />
                        Proposed Changes & Value Comparison
                      </h3>
                      {effectiveDiff.length > 0 && (
                        <span className="text-xs text-slate-400">
                          {effectiveDiff.length} field{effectiveDiff.length > 1 ? "s" : ""}{" "}
                          {req.status === "APPROVED" ? "applied" : "modified"}
                        </span>
                      )}
                    </div>

                    {/* Diff Grid */}
                    {effectiveDiff.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {effectiveDiff.map((diffItem, idx) => (
                          <DiffRow
                            key={idx}
                            diff={diffItem}
                            isApproved={req.status === "APPROVED"}
                          />
                        ))}
                      </div>
                    ) : (
                      /* Fallback when no field changes were detected */
                      <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-200 text-center py-5">
                        <p className="text-xs font-medium text-slate-600">
                          No modified field values detected between proposed update and current baseline.
                        </p>
                        <details className="mt-2 text-left">
                          <summary className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer text-center">
                            Inspect Raw Payload
                          </summary>
                          <pre className="mt-2 text-xs font-mono text-slate-700 bg-white p-3 rounded-lg border border-slate-200 overflow-x-auto max-h-48">
                            {JSON.stringify(req.proposedData, null, 2)}
                          </pre>
                        </details>
                      </div>
                    )}
                  </div>

                  {/* Audit History / Reviewer Details */}
                  {req.reviewedBy && (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs text-slate-600 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-blue-600" />
                          Review Decision:{" "}
                          <span
                            className={cn(
                              "font-bold",
                              req.status === "APPROVED"
                                ? "text-emerald-700"
                                : "text-rose-700"
                            )}
                          >
                            {req.status}
                          </span>
                        </span>
                        <span className="text-slate-400">
                          {formatDateTime(req.updatedAt)}
                        </span>
                      </div>
                      <p>
                        Authorized by{" "}
                        <span className="font-medium text-slate-800">
                          {req.reviewedBy.fullName}
                        </span>{" "}
                        ({req.reviewedBy.email})
                      </p>
                      {req.reviewNote && (
                        <div className="mt-2 pt-2 border-t border-slate-200/80 flex items-start gap-2">
                          <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <p className="italic text-slate-700">
                            &quot;{req.reviewNote}&quot;
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer Actions (Only for PENDING) */}
                {req.status === "PENDING" && (
                  <div className="p-4 sm:px-6 bg-slate-50/70 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-slate-500 text-center sm:text-left">
                      Approving will instantly apply these proposed values live to the staging/production catalog.
                    </p>
                    <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 font-semibold"
                        onClick={() => {
                          setSelectedRequest(req);
                          setActionType("REJECT");
                          setReviewNote("");
                        }}
                      >
                        <XCircle className="w-4 h-4 mr-1.5" />
                        Reject Request
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                        onClick={() => {
                          setSelectedRequest(req);
                          setActionType("APPROVE");
                          setReviewNote("");
                        }}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                        Approve & Apply Live
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Approve Confirmation Modal */}
      {/* -------------------------------------------------------------------- */}
      <Dialog
        open={actionType === "APPROVE"}
        onOpenChange={(open) => {
          if (!open) {
            setActionType(null);
            setSelectedRequest(null);
            setReviewNote("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900">
              Approve Change Request
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              You are authorizing changes for{" "}
              <span className="font-bold text-slate-800">
                {selectedRequest?.entityName || selectedRequest?.entityType}
              </span>
              . This will immediately update the live database.
            </DialogDescription>
          </DialogHeader>

          {/* Quick Summary of Diff */}
          {selectedRequest?.diff && selectedRequest.diff.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-2.5 max-h-60 overflow-y-auto">
              <p className="font-semibold text-slate-700">Summary of Live Updates:</p>
              {selectedRequest.diff.map((item, i) => {
                const isHtmlVal = isHtml(item.proposedValue);
                const isCurrency =
                  item.field === "price" ||
                  item.field === "internalLendingPrice" ||
                  item.field === "externalLendingPrice";

                if (isHtmlVal) {
                  return (
                    <div
                      key={i}
                      className="space-y-1 pt-1.5 border-t border-slate-200/80 first:border-0 first:pt-0"
                    >
                      <span className="font-semibold text-slate-700 block">
                        {item.label}:
                      </span>
                      <div
                        className="prose prose-xs max-w-none text-xs text-slate-800 p-2.5 bg-white rounded-lg border border-slate-200/80 max-h-40 overflow-y-auto leading-relaxed
                          [&_table]:w-full [&_table]:border-collapse [&_table]:my-1.5 [&_table]:text-[11px]
                          [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-50 [&_th]:p-1 [&_th]:font-semibold [&_th]:text-left
                          [&_td]:border [&_td]:border-slate-200 [&_td]:p-1
                          [&_p]:my-1 [&_strong]:text-slate-900 [&_strong]:font-semibold"
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(item.proposedValue),
                        }}
                      />
                    </div>
                  );
                }

                if (
                  typeof item.proposedValue === "string" &&
                  item.proposedValue.length > 60
                ) {
                  return (
                    <div
                      key={i}
                      className="space-y-1 pt-1.5 border-t border-slate-200/80 first:border-0 first:pt-0"
                    >
                      <span className="font-semibold text-slate-700 block">
                        {item.label}:
                      </span>
                      <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-800 text-xs break-words max-h-32 overflow-y-auto">
                        {item.proposedValue}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={i}
                    className="flex items-center justify-between text-slate-600"
                  >
                    <span className="font-medium text-slate-500">
                      {item.label}:
                    </span>
                    <span className="font-semibold text-slate-900">
                      {item.proposedValue !== undefined &&
                      item.proposedValue !== null
                        ? typeof item.proposedValue === "boolean"
                          ? item.proposedValue
                            ? "Active"
                            : "Inactive"
                          : isCurrency && typeof item.proposedValue === "number"
                          ? formatCurrencyINR(item.proposedValue)
                          : String(item.proposedValue)
                        : "None"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Review Note Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Approval Note (Optional)
            </label>
            <Input
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="e.g. Verified with treasury and pricing committee"
              className="text-sm"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setActionType(null);
                setSelectedRequest(null);
              }}
              disabled={submittingAction}
            >
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              onClick={handleApproveConfirm}
              disabled={submittingAction}
            >
              {submittingAction ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Applying Live...
                </>
              ) : (
                "Confirm & Apply Live"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------------------------------------------------------- */}
      {/* Reject Confirmation Modal */}
      {/* -------------------------------------------------------------------- */}
      <Dialog
        open={actionType === "REJECT"}
        onOpenChange={(open) => {
          if (!open) {
            setActionType(null);
            setSelectedRequest(null);
            setReviewNote("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-2">
              <XCircle className="w-5 h-5" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900">
              Reject Change Request
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              You are declining changes proposed for{" "}
              <span className="font-bold text-slate-800">
                {selectedRequest?.entityName || selectedRequest?.entityType}
              </span>
              . The current live values will remain unchanged.
            </DialogDescription>
          </DialogHeader>

          {/* Rejection Note Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Reason for Rejection (Recommended)
            </label>
            <Input
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="e.g. Price slab incorrect, please revise to ₹28"
              className="text-sm"
              autoFocus
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setActionType(null);
                setSelectedRequest(null);
              }}
              disabled={submittingAction}
            >
              Cancel
            </Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
              onClick={handleRejectConfirm}
              disabled={submittingAction}
            >
              {submittingAction ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                "Confirm Rejection"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------------------------------------------------------- */}
      {/* Clear All Confirmation Modal */}
      {/* -------------------------------------------------------------------- */}
      <Dialog
        open={clearAllModalOpen}
        onOpenChange={(open) => {
          if (!open) setClearAllModalOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-2">
              <Trash2 className="w-5 h-5" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900">
              Clear All Pending Requests
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              This will reject and archive all{" "}
              <span className="font-bold text-rose-600">
                {stats.pending} pending requests
              </span>
              . Operations makers will need to re-submit new requests if any price
              changes are still required.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Audit Note
            </label>
            <Input
              value={clearAllNote}
              onChange={(e) => setClearAllNote(e.target.value)}
              placeholder="Cleared by admin"
              className="text-sm"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => setClearAllModalOpen(false)}
              disabled={clearingAll}
            >
              Cancel
            </Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
              onClick={handleClearAllConfirm}
              disabled={clearingAll}
            >
              {clearingAll ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Clearing All...
                </>
              ) : (
                `Reject All (${stats.pending})`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
