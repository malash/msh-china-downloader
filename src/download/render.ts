import type { BankAccount, ClaimDetail } from '../api/claim.js';
import type { DownloadedImage } from './images.js';
import { eta } from './template.js';
import { toRelativeUrl } from '../util.js';

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
  return accounts.filter(a => {
    const key = `${a.accNo}|${a.bankName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const present = (rows: Field[]): Field[] => rows.filter(r => r.value);

const isImageFile = (file: string): boolean => /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(file);

export interface Eob {
  image: string | null;
  pdf: string | null;
}

export const renderMarkdown = (
  claim: ClaimDetail,
  images: DownloadedImage[],
  eob: Eob | null,
): string => {
  const table = (rows: Field[]) =>
    [
      '| 项目 | 内容 |',
      '| --- | --- |',
      ...present(rows).map(r => `| ${r.label} | ${r.value} |`),
    ].join('\n');

  const section = (title: string, body: string) => `## ${title}\n\n${body}`;
  const embed = (caption: string, file: string) =>
    `${isImageFile(file) ? '!' : ''}[${caption}](${toRelativeUrl(['images', file])})`;

  const eobBody = eob
    ? [eob.image && embed('理赔说明书', eob.image), eob.pdf && embed('PDF', eob.pdf)]
        .filter(Boolean)
        .join('\n\n')
    : '';

  const banks = uniqueAccounts(claim.claimAccInfoReturns ?? [])
    .map((acc, i) => `### 账户 ${i + 1}\n\n${table(bankFields(acc))}`)
    .join('\n\n');

  const pics = images
    .map(({ rider, file }) => `### ${rider.riderTypeName}\n\n${embed(rider.riderTypeName, file)}`)
    .join('\n\n');

  const sections = [
    section('基本信息', table(basicInfo(claim))),
    section('就诊信息', table(visitInfo(claim))),
    section('金额信息', table(amountInfo(claim))),
    section('被保险人信息', table(insuredInfo(claim))),
    section('银行账户', banks),
    ...(eobBody ? [section('理赔说明书', eobBody)] : []),
    section(`已上传理赔资料（${images.length} 张）`, pics),
  ];

  return `# 理赔 ${claim.claimNo} · ${claim.statusName}

${sections.join('\n\n')}
`;
};

export const renderHtml = (
  claim: ClaimDetail,
  images: DownloadedImage[],
  eob: Eob | null,
): string => {
  const eobImages = [];
  if (eob?.image) {
    eobImages.push({
      caption: '理赔说明书',
      file: eob.image,
      url: toRelativeUrl(['images', eob.image]),
      href: toRelativeUrl(['images', eob.pdf ?? eob.image]),
      isImage: true,
    });
  } else if (eob?.pdf) {
    eobImages.push({
      caption: '理赔说明书',
      file: eob.pdf,
      url: toRelativeUrl(['images', eob.pdf]),
      href: toRelativeUrl(['images', eob.pdf]),
      isImage: false,
    });
  }

  const sections = [
    { title: '基本信息', status: claim.statusName, open: true, fields: present(basicInfo(claim)) },
    { title: '就诊信息', open: true, fields: present(visitInfo(claim)) },
    { title: '金额信息', open: true, fields: present(amountInfo(claim)) },
    { title: '被保险人信息', open: false, fields: present(insuredInfo(claim)) },
    {
      title: '银行账户',
      open: false,
      accounts: uniqueAccounts(claim.claimAccInfoReturns ?? []).map(acc =>
        present(bankFields(acc)),
      ),
    },
    ...(eobImages.length ? [{ title: '理赔说明书', open: true, images: eobImages }] : []),
    {
      title: `已上传理赔资料（${images.length} 张）`,
      open: true,
      images: images.map(({ rider, file }) => ({
        caption: rider.riderTypeName,
        file,
        url: toRelativeUrl(['images', file]),
        href: toRelativeUrl(['images', file]),
        isImage: isImageFile(file),
      })),
    },
  ];

  return eta.render('claim', { claimNo: claim.claimNo, sections });
};
