// Demo dataset: fictional "Golden Cluck" fried chicken chain
// 8 branches with daily sales, package counts, and notes (some with anomalies)
// All data is fictional and for demonstration purposes only.

import type { BranchReport, PackageCounts } from "./types";

function packages(partial: Partial<PackageCounts>): PackageCounts {
  return {
    "Bucket 1": 0, "Bucket 2": 0, "Bucket 3": 0, "Bucket 4": 0,
    "Family Bucket 1": 0, "Family Bucket 2": 0, "Family Bucket 3": 0, "Family Bucket 4": 0,
    "Value Meal 1": 0, "Value Meal 2": 0, "Value Meal 3": 0, "Value Meal 4": 0,
    "Meal Box 1": 0, "Meal Box 2": 0, "Meal Box 3": 0, "Meal Box 4": 0,
    "Jumbo Tea": 0,
    ...partial,
  };
}

function branch(
  id: string,
  name: string,
  dailySales: number,
  customers: number,
  mtdSales: number,
  lastMonthMtd: number,
  pkgs: Partial<PackageCounts>,
  note: string
): BranchReport {
  return { id, branchName: name, dailySales, customers, mtdSales, lastMonthMtd, packages: packages(pkgs), note, status: "idle" };
}

export const DEMO_DATA: BranchReport[] = [
  branch("riverside", "Riverside", 12450, 312, 248300, 265100, {
    "Bucket 1": 120, "Bucket 2": 80, "Bucket 3": 45, "Bucket 4": 30,
    "Family Bucket 1": 55, "Family Bucket 2": 40, "Family Bucket 3": 25, "Family Bucket 4": 15,
    "Value Meal 1": 180, "Value Meal 2": 95, "Value Meal 3": 60, "Value Meal 4": 40,
    "Meal Box 1": 75, "Meal Box 2": 50, "Meal Box 3": 30, "Meal Box 4": 20, "Jumbo Tea": 140,
  }, "Strong morning rush, sold out of Bucket 4 by 6 PM. Delivery apps showed 30% surge in orders."),
  branch("hilltop", "Hilltop", 9800, 245, 198200, 210400, {
    "Bucket 1": 95, "Bucket 2": 65, "Bucket 3": 38, "Bucket 4": 20,
    "Family Bucket 1": 42, "Family Bucket 2": 32, "Family Bucket 3": 20, "Family Bucket 4": 12,
    "Value Meal 1": 140, "Value Meal 2": 80, "Value Meal 3": 45, "Value Meal 4": 30,
    "Meal Box 1": 60, "Meal Box 2": 40, "Meal Box 3": 25, "Meal Box 4": 15, "Jumbo Tea": 110,
  }, "Steady traffic all day. Lunch promotion drove 12% more customers vs last week same day."),
  branch("market-st", "Market St", 18200, 455, 365600, 389800, {
    "Bucket 1": 180, "Bucket 2": 130, "Bucket 3": 75, "Bucket 4": 50,
    "Family Bucket 1": 80, "Family Bucket 2": 65, "Family Bucket 3": 40, "Family Bucket 4": 25,
    "Value Meal 1": 250, "Value Meal 2": 140, "Value Meal 3": 90, "Value Meal 4": 60,
    "Meal Box 1": 110, "Meal Box 2": 80, "Meal Box 3": 50, "Meal Box 4": 35, "Jumbo Tea": 210,
  }, "Sales dipped sharply after 2 PM — possibly weather-related foot traffic drop. 4 returns logged for soggy packaging."),
  branch("northgate", "Northgate", 14200, 355, 284400, 295100, {
    "Bucket 1": 150, "Bucket 2": 100, "Bucket 3": 55, "Bucket 4": 35,
    "Family Bucket 1": 65, "Family Bucket 2": 48, "Family Bucket 3": 30, "Family Bucket 4": 18,
    "Value Meal 1": 190, "Value Meal 2": 110, "Value Meal 3": 70, "Value Meal 4": 45,
    "Meal Box 1": 85, "Meal Box 2": 55, "Meal Box 3": 35, "Meal Box 4": 22, "Jumbo Tea": 155,
  }, "Unusually high returns today — 6 orders complained about cold food. Possible oven temp issue. Checked oven calibration, found it 8°F low. Reset and monitored."),
  branch("lakeside", "Lakeside", 7600, 190, 152800, 168500, {
    "Bucket 1": 75, "Bucket 2": 50, "Bucket 3": 28, "Bucket 4": 15,
    "Family Bucket 1": 35, "Family Bucket 2": 22, "Family Bucket 3": 14, "Family Bucket 4": 8,
    "Value Meal 1": 110, "Value Meal 2": 60, "Value Meal 3": 38, "Value Meal 4": 22,
    "Meal Box 1": 45, "Meal Box 2": 28, "Meal Box 3": 18, "Meal Box 4": 12, "Jumbo Tea": 85,
  }, "Very quiet today. Only 8 Jumbo Teas sold — way below normal 20+. Possible competitor opened nearby. Manager investigating."),
  branch("old-town", "Old Town", 11300, 285, 226600, 230000, {
    "Bucket 1": 130, "Bucket 2": 90, "Bucket 3": 50, "Bucket 4": 30,
    "Family Bucket 1": 52, "Family Bucket 2": 40, "Family Bucket 3": 25, "Family Bucket 4": 16,
    "Value Meal 1": 160, "Value Meal 2": 85, "Value Meal 3": 55, "Value Meal 4": 35,
    "Meal Box 1": 70, "Meal Box 2": 45, "Meal Box 3": 28, "Meal Box 4": 18, "Jumbo Tea": 120,
  }, "Steady day, no issues. One staff member called in sick but coverage was sufficient."),
  branch("airport-rd", "Airport Rd", 22300, 580, 446000, 468200, {
    "Bucket 1": 250, "Bucket 2": 160, "Bucket 3": 90, "Bucket 4": 65,
    "Family Bucket 1": 100, "Family Bucket 2": 70, "Family Bucket 3": 45, "Family Bucket 4": 28,
    "Value Meal 1": 320, "Value Meal 2": 200, "Value Meal 3": 120, "Value Meal 4": 80,
    "Meal Box 1": 150, "Meal Box 2": 100, "Meal Box 3": 65, "Meal Box 4": 42, "Jumbo Tea": 280,
  }, "Travel traffic spiked at lunch. Jumbo Teas sold out by 3 PM — need to increase afternoon prep. Handled well otherwise."),
  branch("university", "University", 13800, 340, 276200, 282400, {
    "Bucket 1": 160, "Bucket 2": 105, "Bucket 3": 62, "Bucket 4": 38,
    "Family Bucket 1": 60, "Family Bucket 2": 48, "Family Bucket 3": 28, "Family Bucket 4": 20,
    "Value Meal 1": 200, "Value Meal 2": 120, "Value Meal 3": 75, "Value Meal 4": 50,
    "Meal Box 1": 95, "Meal Box 2": 60, "Meal Box 3": 38, "Meal Box 4": 24, "Jumbo Tea": 165,
  }, "Campus event drove higher than usual dinner traffic. All stock cleared. No issues."),
];