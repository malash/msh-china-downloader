import type { ClaimSummary } from '../api/claim-list.js';

export interface ClaimRow {
  summary: ClaimSummary;
  folder: string;
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

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const money = (currency: string, amount: string): string =>
  amount && amount !== '--' ? `${currency} ${amount}` : '--';

const row = ({ summary, folder }: ClaimRow): string => {
  const href = `claims/${folder.split('/').map(encodeURIComponent).join('/')}/index.html`;
  return `
        <tr onclick="window.open('${href}', '_blank')">
          <td>${escapeHtml(summary.startDate)}</td>
          <td><span class="status s${escapeHtml(summary.status)}">${escapeHtml(summary.statusName)}</span></td>
          <td>${escapeHtml(summary.hChineseName)}</td>
          <td>${escapeHtml(money(summary.invoiceCurrency, summary.invoiceAmount))}</td>
          <td>${escapeHtml(money(summary.currency, summary.payAmount))}</td>
          <td>${escapeHtml(summary.claimNo)}</td>
        </tr>`;
};

const personSection = (group: PersonGroup): string => {
  const rows = sortClaims(group.claims).map(row).join('');
  return `  <details>
    <summary>${escapeHtml(group.name)}（${escapeHtml(group.relationship)}） · ${group.claims.length} 条</summary>
    <table>
      <thead>
        <tr><th>就诊日期</th><th>状态</th><th>医院</th><th>就诊金额</th><th>赔付金额</th><th>理赔号</th></tr>
      </thead>
      <tbody>${rows}
      </tbody>
    </table>
  </details>`;
};

export const renderIndex = (groups: PersonGroup[]): string => `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>理赔下载</title>
  <style>
    body { font-family: -apple-system, "PingFang SC", sans-serif; max-width: 1000px; margin: 0 auto; padding: 1.5rem 1rem; color: #333; background: #f5f5f5; }
    h1 { font-size: 1.4rem; }
    details { background: #fff; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1rem; }
    summary { font-size: 1.1rem; font-weight: 700; border-left: 4px solid #f60; padding-left: .6rem; cursor: pointer; list-style-position: inside; }
    details[open] summary { margin-bottom: 1rem; }
    table { border-collapse: collapse; width: 100%; }
    th, td { padding: .55rem .5rem; text-align: left; border-bottom: 1px solid #f0f0f0; }
    th { color: #888; font-weight: 400; font-size: .85rem; }
    tbody tr { cursor: pointer; }
    tbody tr:hover { background: #fff8f2; }
    tbody tr td:last-child { color: #f60; }
    .status { padding: .1rem .5rem; border-radius: 4px; font-size: .85rem; white-space: nowrap; }
    .status.s2 { background: #fde8e8; color: #d33; }
    .status.s3 { background: #fff3e0; color: #f60; }
    .status.s1, .status.s4, .status.s5 { background: #e8f5e9; color: #2a2; }
  </style>
</head>
<body>
  <h1>理赔下载（${groups.reduce((n, g) => n + g.claims.length, 0)} 条）</h1>
${groups.map(personSection).join('\n')}
</body>
</html>
`;
