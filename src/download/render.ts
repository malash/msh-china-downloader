import type { BankAccount, ClaimDetail } from '../api/claim.js';
import type { DownloadedImage } from './images.js';

interface Field {
  label: string;
  value: string;
}

const SEX: Record<string, string> = { '01': '男', '02': '女' };

const money = (currency: string, amount: string): string => (amount ? `${currency} ${amount}` : '');

const basicInfo = (claim: ClaimDetail): Field[] => [
  { label: '理赔号', value: claim.claimNo },
  { label: '线上理赔号', value: claim.olClaimNo },
  { label: '批次号', value: claim.batchNo },
  { label: '保单年度', value: claim.policyYear },
  { label: '申请日期', value: claim.applyDate },
  { label: '收单日期', value: claim.receiveDate },
  { label: '结案日期', value: claim.checkDate },
  { label: '赔付日期', value: claim.payDate },
];

const visitInfo = (claim: ClaimDetail): Field[] => [
  { label: '就诊人', value: claim.insuredName },
  { label: '就诊日期', value: `${claim.startDate} ~ ${claim.endDate}` },
  { label: '就诊类型', value: claim.claimTypeName },
  { label: '医院名称', value: claim.hChineseName },
  { label: '医院（英文）', value: claim.hEnglishName },
  { label: '医院所在国家及地区', value: claim.countryOfHospitail },
  { label: '疾病', value: String(claim.sickness ?? '') },
];

const amountInfo = (claim: ClaimDetail): Field[] => [
  { label: '就诊金额', value: money(claim.invoiceCurrency, claim.invoiceAmount) },
  { label: '发票张数', value: claim.invoiceNumber },
  { label: '免赔额', value: money(claim.invoiceCurrency, claim.deductible) },
  { label: '折后金额', value: money(claim.invoiceCurrency, claim.discountamount) },
  { label: '自付金额', value: money(claim.invoiceCurrency, claim.selfPay) },
  { label: '赔付金额', value: money(claim.currency, claim.payAmount) },
];

const insuredInfo = (claim: ClaimDetail): Field[] => {
  const i = claim.insuredInfoReturn ?? ({} as ClaimDetail['insuredInfoReturn']);
  return [
    { label: '姓名', value: i.insuredFullCName || claim.insuredName },
    { label: '性别', value: SEX[i.sex] ?? '' },
    { label: '出生日期', value: i.birthday },
    { label: '证件类型', value: i.idTypeName },
    { label: '证件号码', value: i.idNumber },
    { label: '证件有效期', value: i.validityOfCertificate },
    { label: '国籍', value: i.nationality },
    { label: '职业', value: i.occupation },
    { label: '手机', value: i.mph },
    { label: '邮箱', value: i.email },
    { label: '地址', value: i.address },
    { label: '保单号', value: i.grpContNo },
    { label: '计划代码', value: i.grpPlanCode },
  ];
};

const bankFields = (acc: BankAccount): Field[] => [
  { label: '收款人', value: acc.payee },
  { label: '开户行', value: acc.bankName },
  { label: '账号', value: acc.accNo },
  { label: 'SWIFT', value: acc.swiftCode },
  { label: '银行地址', value: acc.bankAddress },
  { label: '币种', value: acc.isCNYStr },
];

// Bank accounts come in pairs that duplicate each other; keep distinct ones only.
const uniqueAccounts = (accounts: BankAccount[]): BankAccount[] => {
  const seen = new Set<string>();
  return accounts.filter((a) => {
    const key = `${a.accNo}|${a.bankName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const present = (rows: Field[]): Field[] => rows.filter((r) => r.value);

export const renderMarkdown = (
  claim: ClaimDetail,
  images: DownloadedImage[],
  eob: string | null,
): string => {
  const table = (rows: Field[]) =>
    ['| 项目 | 内容 |', '| --- | --- |', ...present(rows).map((r) => `| ${r.label} | ${r.value} |`)].join('\n');

  const section = (title: string, body: string, open: boolean) =>
    `<details${open ? ' open' : ''}>\n<summary>${title}</summary>\n\n${body}\n\n</details>`;

  const banks = uniqueAccounts(claim.claimAccInfoReturns ?? [])
    .map((acc, i) => `### 账户 ${i + 1}\n\n${table(bankFields(acc))}`)
    .join('\n\n');

  const pics = images
    .map(({ rider, file }) => `### ${rider.riderTypeName}\n\n![${rider.riderTypeName}](images/${file})`)
    .join('\n\n');

  const sections = [
    section('基本信息', table(basicInfo(claim)), true),
    section('就诊信息', table(visitInfo(claim)), true),
    section('金额信息', table(amountInfo(claim)), true),
    section('被保险人信息', table(insuredInfo(claim)), false),
    section('银行账户', banks, false),
    ...(eob ? [section('理赔说明书', `![理赔说明书](images/${eob})`, false)] : []),
    section(`已上传理赔资料（${images.length} 张）`, pics, true),
  ];

  return `# 理赔 ${claim.claimNo} · ${claim.statusName}

${sections.join('\n\n')}
`;
};

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const htmlTable = (rows: Field[]): string =>
  `<table>\n${present(rows)
    .map((r) => `      <tr><th>${escapeHtml(r.label)}</th><td>${escapeHtml(r.value)}</td></tr>`)
    .join('\n')}\n    </table>`;

export const renderHtml = (
  claim: ClaimDetail,
  images: DownloadedImage[],
  eob: string | null,
): string => {
  const banks = uniqueAccounts(claim.claimAccInfoReturns ?? [])
    .map((acc, i) => `    <h3>账户 ${i + 1}</h3>\n    ${htmlTable(bankFields(acc))}`)
    .join('\n');

  const pics = images
    .map(
      ({ rider, file }) =>
        `    <figure>\n      <figcaption>${escapeHtml(rider.riderTypeName)}</figcaption>\n      <a href="images/${file}" target="_blank">\n        <img src="images/${file}" alt="${escapeHtml(rider.riderTypeName)}">\n      </a>\n    </figure>`,
    )
    .join('\n');

  const section = (summary: string, body: string, open: boolean) =>
    `  <details${open ? ' open' : ''}>\n    <summary>${summary}</summary>\n${body}\n  </details>`;

  const sections = [
    section(`基本信息<span class="status">${escapeHtml(claim.statusName)}</span>`, htmlTable(basicInfo(claim)), true),
    section('就诊信息', htmlTable(visitInfo(claim)), true),
    section('金额信息', htmlTable(amountInfo(claim)), true),
    section('被保险人信息', htmlTable(insuredInfo(claim)), false),
    section('银行账户', banks, false),
    ...(eob
      ? [section('理赔说明书', `    <figure>\n      <a href="images/${eob}" target="_blank">\n        <img src="images/${eob}" alt="理赔说明书">\n      </a>\n    </figure>`, false)]
      : []),
    section(`已上传理赔资料（${images.length} 张）`, pics, true),
  ];

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>理赔 ${escapeHtml(claim.claimNo)}</title>
  <style>
    body { font-family: -apple-system, "PingFang SC", sans-serif; max-width: 800px; margin: 0 auto; padding: 1.5rem 1rem; color: #333; background: #f5f5f5; }
    details { background: #fff; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1rem; }
    summary { font-size: 1.1rem; font-weight: 700; border-left: 4px solid #f60; padding-left: .6rem; cursor: pointer; list-style-position: inside; }
    summary .status { float: right; color: #f60; font-weight: 400; }
    details[open] summary { margin-bottom: 1rem; }
    h3 { font-size: .95rem; color: #666; margin: 1rem 0 .5rem; }
    table { border-collapse: collapse; width: 100%; }
    th, td { padding: .6rem .25rem; text-align: left; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    th { color: #888; font-weight: 400; width: 10rem; }
    td { color: #333; }
    figure { margin: 0 0 1.25rem; }
    figcaption { color: #666; margin-bottom: .5rem; }
    img { max-width: 100%; border: 1px solid #eee; border-radius: 4px; }
  </style>
</head>
<body>
${sections.join('\n')}
</body>
</html>
`;
};
