// Shared TypeScript types for AreaBrief

export interface PackageCounts {
  "Bucket 1": number;
  "Bucket 2": number;
  "Bucket 3": number;
  "Bucket 4": number;
  "Family Bucket 1": number;
  "Family Bucket 2": number;
  "Family Bucket 3": number;
  "Family Bucket 4": number;
  "Value Meal 1": number;
  "Value Meal 2": number;
  "Value Meal 3": number;
  "Value Meal 4": number;
  "Meal Box 1": number;
  "Meal Box 2": number;
  "Meal Box 3": number;
  "Meal Box 4": number;
  "Jumbo Tea": number;
}

export const PACKAGE_KEYS: (keyof PackageCounts)[] = [
  "Bucket 1",
  "Bucket 2",
  "Bucket 3",
  "Bucket 4",
  "Family Bucket 1",
  "Family Bucket 2",
  "Family Bucket 3",
  "Family Bucket 4",
  "Value Meal 1",
  "Value Meal 2",
  "Value Meal 3",
  "Value Meal 4",
  "Meal Box 1",
  "Meal Box 2",
  "Meal Box 3",
  "Meal Box 4",
  "Jumbo Tea",
];

export interface BranchReport {
  id: string;
  branchName: string;
  dailySales: number;
  customers: number;
  mtdSales: number;
  lastMonthMtd: number;
  packages: PackageCounts;
  note: string;
  // filled after on-device pass
  onDeviceSummary?: string;
  onDeviceFlags?: string[];
  engineBadge?: "On-device" | "Cloud fallback" | "Local fallback";
  status: "idle" | "summarizing" | "done" | "error";
  error?: string;
}

export interface AreaReport {
  id: string;
  createdAt: string;
  branches: BranchReport[];
  rankedBranches: { name: string; dailySales: number; mtdSales: number; vsLastMonth: number }[];
  totalDailySales: number;
  totalCustomers: number;
  totalMtdSales: number;
  packageTotals: Partial<Record<keyof PackageCounts, number>>;
  anomalies: string[];
  executiveSummary: string;
  engineBadge: "Cloud" | "Local fallback";
  status: "compiling" | "done" | "error";
  error?: string;
}

export type InferenceEngine = "On-device" | "Cloud fallback" | "Cloud" | "Local fallback";
