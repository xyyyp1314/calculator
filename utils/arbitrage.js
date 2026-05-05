const {
  TERM_META,
  TERM_OPTIONS,
  RATE_PRESETS,
  createDefaultProduct,
  normalizeRateTable,
  syncMaturityDate,
  getTermIndex,
  formatDate,
  toNumber,
  formatMoney,
  formatSignedMoney,
  formatPercent,
  formatBp
} = require("./calculator");

function parseDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date, days) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + days * 86400000);
}

function daysBetween(startDate, endDate) {
  if (!startDate || !endDate) return NaN;
  return Math.round((endDate - startDate) / 86400000);
}

function buildRateItems(rates, benchmarkTerm) {
  return TERM_OPTIONS.map((item) => ({
    value: item.value,
    label: item.label,
    rate: rates[item.value],
    activeClass: item.value === benchmarkTerm ? "active" : ""
  }));
}

function createDefaultQuote() {
  return {
    name: "盯盘挂单",
    visiblePrice: "100870.42",
    visibleBuyerYield: "1.86",
    relistBuyerYield: "1.95"
  };
}

function computeArbitrage(input) {
  const product = syncMaturityDate(input);
  const term = TERM_META[product.termCode];
  const startDate = parseDate(product.startDate);
  const maturityDate = parseDate(product.maturityDate);
  const todayDate = parseDate(product.todayDate);

  const principal = toNumber(product.principal);
  const couponRatePct = toNumber(product.couponRate);
  const couponRate = couponRatePct / 100;
  const pagePrice = toNumber(input.visiblePrice);
  const visibleBuyerYield = toNumber(input.visibleBuyerYield);
  const relistBuyerYield = toNumber(input.relistBuyerYield);
  const benchmarkRatePct = toNumber(input.benchmarkRate);

  const maturityAmount = Number.isFinite(principal) && Number.isFinite(couponRate) && term
    ? principal * (1 + couponRate * term.years)
    : NaN;

  const remainingDaysToday = daysBetween(todayDate, maturityDate);
  const rawListingRemainingDays = Number.isFinite(pagePrice) && pagePrice > 0 &&
    Number.isFinite(visibleBuyerYield) && visibleBuyerYield > 0 &&
    Number.isFinite(maturityAmount)
    ? ((maturityAmount - pagePrice) / pagePrice) * 365 / (visibleBuyerYield / 100)
    : NaN;

  const inferredRemainingDays = Number.isFinite(rawListingRemainingDays)
    ? Math.round(rawListingRemainingDays)
    : NaN;

  const inferredListingDate = Number.isFinite(inferredRemainingDays) && maturityDate
    ? addDays(maturityDate, -inferredRemainingDays)
    : null;

  const hiddenDays = inferredListingDate && todayDate
    ? daysBetween(inferredListingDate, todayDate)
    : NaN;

  const heldListingDays = startDate && inferredListingDate
    ? daysBetween(startDate, inferredListingDate)
    : NaN;

  const heldTodayDays = startDate && todayDate
    ? daysBetween(startDate, todayDate)
    : NaN;

  const actualTodayYield = Number.isFinite(pagePrice) && pagePrice > 0 &&
    Number.isFinite(maturityAmount) && remainingDaysToday > 0
    ? ((maturityAmount - pagePrice) / pagePrice) * 365 / remainingDaysToday * 100
    : NaN;

  const inferredRetainedRate = Number.isFinite(pagePrice) && Number.isFinite(principal) &&
    principal > 0 && heldListingDays > 0
    ? ((pagePrice - principal) / principal) * 365 / heldListingDays * 100
    : NaN;

  const sameRetainedRelistPrice = Number.isFinite(principal) && Number.isFinite(inferredRetainedRate) && heldTodayDays > 0
    ? principal * (1 + inferredRetainedRate / 100 * heldTodayDays / 365)
    : NaN;

  const sameRetainedSpace = Number.isFinite(sameRetainedRelistPrice) && Number.isFinite(pagePrice)
    ? sameRetainedRelistPrice - pagePrice
    : NaN;

  const relistPrice = Number.isFinite(maturityAmount) && Number.isFinite(relistBuyerYield) && relistBuyerYield > 0 && remainingDaysToday > 0
    ? maturityAmount / (1 + relistBuyerYield / 100 * remainingDaysToday / 365)
    : NaN;

  const relistSpace = Number.isFinite(relistPrice) && Number.isFinite(pagePrice)
    ? relistPrice - pagePrice
    : NaN;

  const marketFairPrice = Number.isFinite(maturityAmount) && Number.isFinite(benchmarkRatePct) && benchmarkRatePct >= 0 && remainingDaysToday > 0
    ? maturityAmount / (1 + benchmarkRatePct / 100 * remainingDaysToday / 365)
    : NaN;

  const marketSpace = Number.isFinite(marketFairPrice) && Number.isFinite(pagePrice)
    ? marketFairPrice - pagePrice
    : NaN;

  const marketSpreadBp = Number.isFinite(actualTodayYield) && Number.isFinite(benchmarkRatePct)
    ? (actualTodayYield - benchmarkRatePct) * 100
    : NaN;

  const frozenGapBp = Number.isFinite(actualTodayYield) && Number.isFinite(visibleBuyerYield)
    ? (actualTodayYield - visibleBuyerYield) * 100
    : NaN;

  const hiddenOneDayAmount = Number.isFinite(principal) && Number.isFinite(inferredRetainedRate)
    ? principal * inferredRetainedRate / 100 / 365
    : NaN;

  const warnings = [];
  if (!Number.isFinite(pagePrice)) warnings.push("补一下页面看到的转让价格。");
  if (!Number.isFinite(visibleBuyerYield)) warnings.push("补一下页面看到的后手利率。");
  if (!startDate || !maturityDate || !todayDate) warnings.push("产品日期还没填完整。");
  if (inferredListingDate && startDate && inferredListingDate < startDate) {
    warnings.push("推算挂出日期早于起息日，页面价格和后手利率大概率有一项不对。");
  }
  if (inferredListingDate && todayDate && inferredListingDate > todayDate) {
    warnings.push("推算挂出日期晚于今天，建议核一下输入值。");
  }
  if (remainingDaysToday <= 0) {
    warnings.push("这单已经接近到期或已到期，套利口径会失真。");
  }

  return {
    ...input,
    ...product,
    termLabel: term ? term.label : "--",
    maturityAmount,
    pagePrice,
    visibleBuyerYield,
    relistBuyerYield,
    benchmarkRatePct,
    remainingDaysToday,
    inferredRemainingDays,
    inferredListingDate,
    hiddenDays,
    heldListingDays,
    heldTodayDays,
    actualTodayYield,
    inferredRetainedRate,
    sameRetainedRelistPrice,
    sameRetainedSpace,
    relistPrice,
    relistSpace,
    marketFairPrice,
    marketSpace,
    marketSpreadBp,
    frozenGapBp,
    hiddenOneDayAmount,
    warnings
  };
}

function getStatusClass(computed) {
  if (Number.isFinite(computed.relistSpace) && computed.relistSpace > 0) return "good";
  if (Number.isFinite(computed.marketSpace) && computed.marketSpace > 0) return "warm";
  return "bad";
}

function toResultView(computed, benchmarkTerm) {
  const statusClass = getStatusClass(computed);
  const statusText = statusClass === "good" ? "可盯" : statusClass === "warm" ? "可看" : "一般";
  const noteText = Number.isFinite(computed.hiddenDays) && computed.hiddenDays > 0
    ? `这单大概率已经挂了 ${computed.hiddenDays} 天，页面后手利率还是老数。`
    : "这单看起来像刚挂出来，隐藏收益还不算明显。";

  const sameRetainedExplainText = Number.isFinite(computed.sameRetainedSpace)
    ? `如果卖方今天按同一保留利率重挂，价格大概会比页面多 ${formatSignedMoney(computed.sameRetainedSpace)}。`
    : "同保留利率重挂价要先把页面价格和后手利率补齐。";

  const relistExplainText = Number.isFinite(computed.relistSpace)
    ? `按你填的“今天重挂后手利率”，这单大概能挂到 ${formatMoney(computed.relistPrice)}。`
    : "填一个“今天重挂后手利率”，就能测自定义套利空间。";

  const marketExplainText = Number.isFinite(computed.marketSpace)
    ? `按当前市场利率看，这单相对市场的价差是 ${formatSignedMoney(computed.marketSpace)}。`
    : "补完市场利率后，这里会给你一个市场参考价差。";

  return {
    ...computed,
    statusClass,
    statusText,
    benchmarkText: `${TERM_META[benchmarkTerm].label} ${formatPercent(computed.benchmarkRatePct)}`,
    warningText: computed.warnings.join(" "),
    noteText,
    visiblePriceText: formatMoney(computed.pagePrice),
    visibleBuyerYieldText: formatPercent(computed.visibleBuyerYield),
    relistBuyerYieldText: formatPercent(computed.relistBuyerYield),
    inferredListingDateText: computed.inferredListingDate ? formatDate(computed.inferredListingDate) : "--",
    hiddenDaysText: Number.isFinite(computed.hiddenDays) ? `${computed.hiddenDays} 天` : "--",
    actualTodayYieldText: formatPercent(computed.actualTodayYield),
    frozenGapText: formatBp(computed.frozenGapBp),
    inferredRetainedRateText: formatPercent(computed.inferredRetainedRate),
    hiddenOneDayText: formatSignedMoney(computed.hiddenOneDayAmount),
    marketFairPriceText: formatMoney(computed.marketFairPrice),
    marketSpaceText: formatSignedMoney(computed.marketSpace),
    marketSpreadText: formatBp(computed.marketSpreadBp),
    sameRetainedRelistPriceText: formatMoney(computed.sameRetainedRelistPrice),
    sameRetainedSpaceText: formatSignedMoney(computed.sameRetainedSpace),
    relistPriceText: formatMoney(computed.relistPrice),
    relistSpaceText: formatSignedMoney(computed.relistSpace),
    sameRetainedExplainText,
    relistExplainText,
    marketExplainText
  };
}

module.exports = {
  TERM_OPTIONS,
  RATE_PRESETS,
  createDefaultProduct,
  createDefaultQuote,
  normalizeRateTable,
  syncMaturityDate,
  getTermIndex,
  buildRateItems,
  computeArbitrage,
  toResultView
};
