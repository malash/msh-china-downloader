import type { ClaimSummary } from '../api/claim-list.js';
import { eta } from './template.js';
import { hasAmount } from '../util.js';

export interface ClaimRow {
  summary: ClaimSummary;
  folder: string;
  claimTypeName: string;
  payToName: string;
}

export interface PersonGroup {
  name: string;
  relationship: string;
  claims: ClaimRow[];
}

// Display order: 待补件(2) → 处理中(3) → 已完成(1,4,5); newer dates first within each.
const STATUS_ORDER: Record<string, number> = { '2': 0, '3': 1 };
const statusRank = (status: string): number => STATUS_ORDER[status] ?? 2;

export const sortClaims = (claims: ClaimRow[]): ClaimRow[] =>
  [...claims].sort(
    (a, b) =>
      statusRank(a.summary.status) - statusRank(b.summary.status) ||
      b.summary.startDate.localeCompare(a.summary.startDate),
  );

const money = (currency: string, amount: string): string =>
  hasAmount(amount) ? `${currency} ${amount}` : '--';

export const renderIndex = (groups: PersonGroup[]): string => {
  const view = groups.map(g => ({
    name: g.name,
    relationship: g.relationship,
    claims: sortClaims(g.claims).map(({ summary, folder, claimTypeName, payToName }) => ({
      href: `claims/${folder}/index.html`,
      // 就诊日期: always show as start~end (both ends, even when identical).
      dateRange: summary.endDate
        ? `${summary.startDate}~${summary.endDate}`
        : summary.startDate,
      claimType: claimTypeName,
      payTo: payToName,
      status: summary.status,
      statusName: summary.statusName,
      hospital: summary.hChineseName,
      // English hospital name for a native title tooltip; omit if same/empty.
      hospitalEn:
        summary.hEnglishName && summary.hEnglishName !== summary.hChineseName
          ? summary.hEnglishName
          : '',
      invoiceAmount: money(summary.invoiceCurrency, summary.invoiceAmount),
      payAmount: money(summary.currency, summary.payAmount),
      // settled (1/4/5) but paid nothing → flag the status tag red
      noPay: !hasAmount(summary.payAmount) && ['1', '4', '5'].includes(summary.status),
      claimNo: summary.claimNo,
    })),
  }));
  const total = groups.reduce((n, g) => n + g.claims.length, 0);
  return eta.render('index', { total, groups: view });
};
