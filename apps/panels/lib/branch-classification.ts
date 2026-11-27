import {
  TrendingUp,
  Network,
  Gem,
  Rocket,
  PlusCircle,
  type LucideIcon,
} from "lucide-react";
import type { BranchClassification } from "@/hooks/use-network-management";

export type ClassificationFieldKey =
  | "classificationLabel"
  | "zone"
  | "zonalHead"
  | "areaManager"
  | "branchManager"
  | "territory"
  | "territoryHead"
  | "reportingManager";

export interface ClassificationOption {
  value: BranchClassification;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  fields: { key: ClassificationFieldKey; label: string; placeholder: string }[];
}

export const CLASSIFICATION_OPTIONS: ClassificationOption[] = [
  {
    value: "EQUITY",
    label: "Equity",
    description: "Zone → Zonal Head → Area → Branch",
    icon: TrendingUp,
    accent: "#16A34A",
    fields: [
      { key: "zone", label: "Zone", placeholder: "e.g. North Zone" },
      { key: "zonalHead", label: "Zonal Head", placeholder: "Zonal head name" },
      {
        key: "areaManager",
        label: "Area Manager",
        placeholder: "Area manager name",
      },
      {
        key: "branchManager",
        label: "Branch Manager",
        placeholder: "Branch manager name",
      },
    ],
  },
  {
    value: "DISTRIBUTION",
    label: "Distribution",
    description: "Territory → Territory Head",
    icon: Network,
    accent: "#3B82F6",
    fields: [
      { key: "territory", label: "Territory", placeholder: "e.g. Delhi NCR" },
      {
        key: "territoryHead",
        label: "Territory Head",
        placeholder: "Territory head name",
      },
    ],
  },
  {
    value: "WEALTH",
    label: "Wealth",
    description: "Reporting Manager",
    icon: Gem,
    accent: "#8B5CF6",
    fields: [
      {
        key: "reportingManager",
        label: "Reporting Manager",
        placeholder: "Reporting manager name",
      },
    ],
  },
  {
    value: "stocksKART",
    label: "stockskart",
    description: "Reporting Manager",
    icon: Rocket,
    accent: "#F59E0B",
    fields: [
      {
        key: "reportingManager",
        label: "Reporting Manager",
        placeholder: "Reporting manager name",
      },
    ],
  },
  {
    value: "OTHER",
    label: "Add New",
    description: "Custom classification",
    icon: PlusCircle,
    accent: "#EC4899",
    fields: [
      {
        key: "classificationLabel",
        label: "Classification Name",
        placeholder: "e.g. Insurance",
      },
      {
        key: "reportingManager",
        label: "Reporting Manager",
        placeholder: "Reporting manager name",
      },
    ],
  },
];

export const EMPTY_CLASSIFICATION_FIELDS: Record<
  ClassificationFieldKey,
  string
> = {
  classificationLabel: "",
  zone: "",
  zonalHead: "",
  areaManager: "",
  branchManager: "",
  territory: "",
  territoryHead: "",
  reportingManager: "",
};

export const CLASSIFICATION_FIELD_PATTERN = /^[a-zA-Z0-9\s\-'.&(),/]+$/;

export const getClassificationOption = (value?: string | null) =>
  CLASSIFICATION_OPTIONS.find((o) => o.value === value) || null;
