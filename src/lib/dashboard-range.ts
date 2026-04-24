export type DashboardRange = "today" | "7d" | "14d" | "21d" | "last-month";

export const dashboardRangeOptions: Array<{ value: DashboardRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 Days" },
  { value: "14d", label: "Last 14 Days" },
  { value: "21d", label: "Last 21 Days" },
  { value: "last-month", label: "Last Month" },
];

export const getDashboardRangeStart = (range: DashboardRange, now = new Date()) => {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  if (range === "today") return startOfToday;

  const daysBack =
    range === "7d" ? 7 :
    range === "14d" ? 14 :
    range === "21d" ? 21 :
    30;

  return new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
};

export const filterByDashboardRange = <T extends { created_at: string }>(
  items: T[],
  range: DashboardRange,
  now = new Date(),
) => {
  const start = getDashboardRangeStart(range, now).getTime();
  return items.filter((item) => new Date(item.created_at).getTime() >= start);
};