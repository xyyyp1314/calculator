const TERM_META = {
  "1M": { label: "1个月", months: 1, years: 1 / 12 },
  "3M": { label: "3个月", months: 3, years: 3 / 12 },
  "6M": { label: "6个月", months: 6, years: 6 / 12 },
  "1Y": { label: "1年", months: 12, years: 1 },
  "2Y": { label: "2年", months: 24, years: 2 },
  "3Y": { label: "3年", months: 36, years: 3 },
  "5Y": { label: "5年", months: 60, years: 5 }
};

const TERM_CODES = Object.keys(TERM_META);
const TERM_OPTIONS = TERM_CODES.map((value) => ({
  value,
  label: TERM_META[value].label
}));

const MODE_OPTIONS = [
  { value: "price", label: "按转让价格" },
  { value: "buyer", label: "按后手显示利率" },
  { value: "listing", label: "按保留利率" }
];

const RATE_PRESETS = {
  "1M": "0.90",
  "3M": "0.90",
  "6M": "1.10",
  "1Y": "1.20",
  "2Y": "1.20",
  "3Y": "1.55",
  "5Y": ""
};

function parseDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayString() {
  return formatDate(new Date());
}

function daysInMonthUTC(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function addMonths(date, months) {
  if (!date) return null;
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const totalMonths = year * 12 + month + months;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = totalMonths % 12;
  const nextDay = Math.min(day, daysInMonthUTC(nextYear, nextMonth));
  return new Date(Date.UTC(nextYear, nextMonth, nextDay));
}

function daysBetween(a, b) {
  if (!a || !b) return NaN;
  return Math.round((b - a) / 86400000);
}

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return NaN;
  const next = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(next) ? next : NaN;
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return "--";
  return Number(value).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatSignedMoney(value) {
  if (!Number.isFinite(value)) return "--";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatMoney(value)}`;
}

function formatPercent(value, digits = 3) {
  const next = Number(value);
  if (!Number.isFinite(next)) return "--";
  return `${next.toFixed(digits)}%`;
}

function formatBp(value) {
  const next = Number(value);
  if (!Number.isFinite(next)) return "--";
  const prefix = next > 0 ? "+" : "";
  return `${prefix}${next.toFixed(1)}bp`;
}

function getTermIndex(termCode) {
  const index = TERM_CODES.findIndex((item) => item === termCode);
  return index >= 0 ? index : 0;
}

function getModeIndex(mode) {
  const index = MODE_OPTIONS.findIndex((item) => item.value === mode);
  return index >= 0 ? index : 0;
}

function getModeLabel(mode) {
  return MODE_OPTIONS[getModeIndex(mode)].label;
}

function getDriverFieldLabel(mode) {
  if (mode === "buyer") return "后手显示利率";
  if (mode === "listing") return "保留利率";
  return "转让价格";
}

function getReverseTitle(mode) {
  if (mode === "buyer") return "后手显示利率驱动";
  if (mode === "listing") return "保留利率驱动";
  return "转让价格驱动";
}

function getReverseText(mode) {
  if (mode === "buyer") {
    return "给定后手显示利率，自动反推出转让价格、保留利率与今日年化。";
  }
  if (mode === "listing") {
    return "给定保留利率，自动反推出转让价格、后手显示利率与今日年化。";
  }
  return "给定转让价格，自动反推出后手显示利率、保留利率与今日年化。";
}

function createDefaultProduct(today = todayString()) {
  const startDate = "2025-03-20";
  return {
    startDate,
    termCode: "3Y",
    maturityDate: formatDate(addMonths(parseDate(startDate), TERM_META["3Y"].months)),
    couponRate: "1.55",
    principal: "100000",
    todayDate: today
  };
}

function createDefaultListing(today = todayString(), name = "示例挂单") {
  return {
    id: `listing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    listingDate: today,
    mode: "price",
    driverValue: "100870.42"
  };
}

function normalizeRateTable(rates = {}) {
  const next = {};
  TERM_CODES.forEach((termCode) => {
    next[termCode] = rates[termCode] !== undefined ? String(rates[termCode]) : RATE_PRESETS[termCode];
  });
  return next;
}

function syncMaturityDate(product) {
  const startDate = parseDate(product.startDate);
  const term = TERM_META[product.termCode];
  return {
    ...product,
    maturityDate: startDate && term ? formatDate(addMonths(startDate, term.months)) : ""
  };
}

function resolveTransferPrice({ mode, driverValue, maturityAmount, principal, remainingDays, heldListing }) {
  if (!Number.isFinite(driverValue)) return NaN;

  if (mode === "price") {
    return driverValue;
  }

  if (mode === "buyer") {
    if (!Number.isFinite(maturityAmount) || remainingDays <= 0) return NaN;
    return maturityAmount / (1 + driverValue / 100 * remainingDays / 365);
  }

  if (mode === "listing") {
    if (!Number.isFinite(principal) || heldListing <= 0) return NaN;
    return principal * (1 + driverValue / 100 * heldListing / 365);
  }

  return NaN;
}

function computeListing(input) {
  const term = TERM_META[input.termCode];
  const startDate = parseDate(input.startDate);
  const maturityDate = startDate && term ? addMonths(startDate, term.months) : null;
  const listingDate = parseDate(input.listingDate);
  const todayDate = parseDate(input.todayDate);

  const couponRate = toNumber(input.couponRate) / 100;
  const couponRatePct = toNumber(input.couponRate);
  const principal = toNumber(input.principal);
  const benchmarkRatePct = toNumber(input.benchmarkRate);

  const totalDays = daysBetween(startDate, maturityDate);
  const remainingDays = daysBetween(todayDate, maturityDate);
  const heldListing = daysBetween(startDate, listingDate);
  const heldToday = daysBetween(startDate, todayDate);

  const maturityAmount = Number.isFinite(principal) && Number.isFinite(couponRate) && term
    ? principal * (1 + couponRate * term.years)
    : NaN;

  const transferPrice = resolveTransferPrice({
    mode: input.mode,
    driverValue: toNumber(input.driverValue),
    maturityAmount,
    principal,
    remainingDays,
    heldListing
  });

  const buyerActualYield = Number.isFinite(transferPrice) && transferPrice > 0 && Number.isFinite(maturityAmount) && remainingDays > 0
    ? ((maturityAmount - transferPrice) / transferPrice) * 365 / remainingDays * 100
    : NaN;

  const buyerDisplayYield = Number.isFinite(buyerActualYield) ? Math.min(buyerActualYield, 12) : NaN;

  const sellerListingYield = Number.isFinite(transferPrice) && Number.isFinite(principal) && principal > 0 && heldListing > 0
    ? ((transferPrice - principal) / principal) * 365 / heldListing * 100
    : NaN;

  const sellerTodayYield = Number.isFinite(transferPrice) && Number.isFinite(principal) && principal > 0 && heldToday > 0
    ? ((transferPrice - principal) / principal) * 365 / heldToday * 100
    : NaN;

  const benchmarkRate = benchmarkRatePct / 100;
  const fairPrice = Number.isFinite(maturityAmount) && Number.isFinite(benchmarkRate) && benchmarkRate >= 0 && remainingDays > 0
    ? maturityAmount / (1 + benchmarkRate * remainingDays / 365)
    : NaN;

  const spreadBp = Number.isFinite(buyerActualYield) && Number.isFinite(benchmarkRatePct)
    ? (buyerActualYield - benchmarkRatePct) * 100
    : NaN;

  const priceSpace = Number.isFinite(fairPrice) && Number.isFinite(transferPrice)
    ? fairPrice - transferPrice
    : NaN;

  const excessProfit = Number.isFinite(maturityAmount) && Number.isFinite(transferPrice) && Number.isFinite(benchmarkRate) && remainingDays > 0
    ? maturityAmount - transferPrice * (1 + benchmarkRate * remainingDays / 365)
    : NaN;

  const status = !Number.isFinite(transferPrice) || !Number.isFinite(maturityAmount)
    ? "待补输入"
    : remainingDays <= 0
      ? "已到期"
      : Number.isFinite(priceSpace) && Number.isFinite(spreadBp) && priceSpace >= 0 && spreadBp >= 0
        ? "有空间"
        : Number.isFinite(spreadBp) && spreadBp >= 0
          ? "可关注"
          : "偏贵";

  return {
    ...input,
    termLabel: term ? term.label : "--",
    maturityDateText: formatDate(maturityDate),
    totalDays,
    remainingDays,
    heldListing,
    heldToday,
    couponRatePct,
    maturityAmount,
    transferPrice,
    buyerActualYield,
    buyerDisplayYield,
    sellerListingYield,
    sellerTodayYield,
    benchmarkRatePct,
    fairPrice,
    spreadBp,
    priceSpace,
    excessProfit,
    status
  };
}

function toResultView(computed, benchmarkTerm) {
  const statusClass = Number.isFinite(computed.priceSpace) && Number.isFinite(computed.spreadBp) && computed.priceSpace >= 0 && computed.spreadBp >= 0
    ? "good"
    : Number.isFinite(computed.spreadBp) && computed.spreadBp >= 0
      ? "warm"
      : "bad";

  return {
    ...computed,
    benchmarkText: `${TERM_META[benchmarkTerm].label} ${formatPercent(computed.benchmarkRatePct)}`,
    transferPriceText: formatMoney(computed.transferPrice),
    buyerDisplayText: formatPercent(computed.buyerDisplayYield),
    buyerActualText: formatPercent(computed.buyerActualYield),
    todayYieldText: formatPercent(computed.sellerTodayYield),
    retainedRateText: formatPercent(computed.sellerListingYield),
    spreadText: formatBp(computed.spreadBp),
    priceSpaceText: formatSignedMoney(computed.priceSpace),
    excessProfitText: formatSignedMoney(computed.excessProfit),
    fairPriceText: formatMoney(computed.fairPrice),
    maturityAmountText: formatMoney(computed.maturityAmount),
    retainedRateGuideText: Number.isFinite(computed.couponRatePct)
      ? `${formatPercent(computed.couponRatePct - 3)} 至 ${formatPercent(computed.couponRatePct + 3)}`
      : "--",
    retainedRateExplainText: "工行口径中，保留利率是客户本次转让过程中为该笔存单保留的收益率。",
    retainedRateFormulaText: "转让价格 = 本金 + 本金 × 实际存期 × 保留利率",
    spreadClass: statusClass === "bad" ? "accent" : "",
    statusClass,
    modeLabel: getModeLabel(computed.mode),
    reverseTitle: getReverseTitle(computed.mode),
    reverseText: getReverseText(computed.mode),
    transferPriceRole: computed.mode === "price" ? "输入项" : "反推项",
    buyerDisplayRole: computed.mode === "buyer" ? "输入项" : "反推项",
    retainedRateRole: computed.mode === "listing" ? "输入项" : "反推项",
    todayYieldRole: "反推项"
  };
}

function sortListings(listings) {
  return [...listings].sort((a, b) => {
    const aScore = Number.isFinite(a.priceSpace) ? a.priceSpace : -Infinity;
    const bScore = Number.isFinite(b.priceSpace) ? b.priceSpace : -Infinity;
    if (bScore !== aScore) return bScore - aScore;

    const aSpread = Number.isFinite(a.spreadBp) ? a.spreadBp : -Infinity;
    const bSpread = Number.isFinite(b.spreadBp) ? b.spreadBp : -Infinity;
    return bSpread - aSpread;
  });
}

function parseBatchText(text, fallbackDate = todayString()) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  return lines.map((line, index) => {
    const [name, listingDate, price, buyerYield, retainedRate] = line.split(/[,，\t]/).map((item) => String(item || "").trim());
    let mode = "price";
    let driverValue = price;

    if (!driverValue && buyerYield) {
      mode = "buyer";
      driverValue = buyerYield;
    }

    if (!driverValue && retainedRate) {
      mode = "listing";
      driverValue = retainedRate;
    }

    return {
      id: `batch-${Date.now()}-${index}`,
      name: name || `挂单${index + 1}`,
      listingDate: listingDate || fallbackDate,
      mode,
      driverValue,
      modeLabel: getModeLabel(mode),
      driverFieldLabel: getDriverFieldLabel(mode)
    };
  }).filter((item) => item.driverValue);
}

module.exports = {
  TERM_META,
  TERM_CODES,
  TERM_OPTIONS,
  MODE_OPTIONS,
  RATE_PRESETS,
  formatDate,
  todayString,
  addMonths,
  toNumber,
  formatMoney,
  formatSignedMoney,
  formatPercent,
  formatBp,
  getTermIndex,
  getModeIndex,
  getModeLabel,
  getDriverFieldLabel,
  getReverseTitle,
  getReverseText,
  createDefaultProduct,
  createDefaultListing,
  normalizeRateTable,
  syncMaturityDate,
  computeListing,
  toResultView,
  sortListings,
  parseBatchText
};
