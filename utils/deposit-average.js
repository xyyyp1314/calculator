const UNIT_OPTIONS = [
  { value: "1", label: "元" },
  { value: "10000", label: "万元" },
  { value: "100000000", label: "亿元" }
];

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function todayString(offsetDays = 0) {
  const next = new Date();
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + offsetDays);
  return formatDate(next);
}

function parseDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return null;
  const next = new Date(year, month - 1, day);
  next.setHours(0, 0, 0, 0);
  return next;
}

function daysBetween(startDate, endDate) {
  if (!startDate || !endDate) return NaN;
  return Math.round((endDate - startDate) / 86400000);
}

function dayOfYearInclusive(date) {
  if (!date) return NaN;
  const yearStart = new Date(date.getFullYear(), 0, 1);
  yearStart.setHours(0, 0, 0, 0);
  return daysBetween(yearStart, date) + 1;
}

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return NaN;
  const next = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(next) ? next : NaN;
}

function getUnitValue(unit) {
  const next = Number(unit);
  return Number.isFinite(next) && next > 0 ? next : 10000;
}

function getUnitLabel(unit) {
  const target = String(getUnitValue(unit));
  const found = UNIT_OPTIONS.find((item) => item.value === target);
  return found ? found.label : "万元";
}

function scaleToBase(value, unit) {
  const next = toNumber(value);
  if (!Number.isFinite(next)) return NaN;
  return next * getUnitValue(unit);
}

function scaleFromBase(value, unit) {
  if (!Number.isFinite(value)) return NaN;
  return value / getUnitValue(unit);
}

function trimNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return "--";
  return value.toFixed(digits);
}

function formatAmount(value, unit, options = {}) {
  if (!Number.isFinite(value)) return "--";
  const scaled = scaleFromBase(value, unit);
  if (!Number.isFinite(scaled)) return "--";
  const { signed = false, suffix = true } = options;
  const prefix = signed && scaled > 0 ? "+" : "";
  const unitLabel = suffix ? ` ${getUnitLabel(unit)}` : "";
  return `${prefix}${trimNumber(scaled)}${unitLabel}`;
}

function formatRatio(value) {
  if (!Number.isFinite(value)) return "--";
  return `${trimNumber(value * 100, 2)}%`;
}

function classifyRatio(value) {
  if (!Number.isFinite(value)) return "";
  if (value >= 1) return "good";
  if (value >= 0.8) return "warm";
  return "bad";
}

function buildDefaultForm() {
  return {
    unit: "10000",
    curDate: todayString(),
    targetDate: todayString(7),
    targetDailyInc: "13.5",
    curPointTotal: "764329",
    curDailyTotal: "732870",
    basePoint: "764329",
    baseDaily: "732870",
    lineIncInput: ""
  };
}

function computeDepositAverage(form) {
  const unit = getUnitValue(form.unit);
  const curDate = parseDate(form.curDate);
  const targetDate = parseDate(form.targetDate);

  const targetDailyInc = scaleToBase(form.targetDailyInc, unit);
  const curPointTotal = scaleToBase(form.curPointTotal, unit);
  const curDailyTotal = scaleToBase(form.curDailyTotal, unit);
  const basePoint = scaleToBase(form.basePoint, unit);
  const baseDaily = scaleToBase(form.baseDaily, unit);
  const lineIncInput = scaleToBase(form.lineIncInput, unit);

  const missing = [];
  if (!curDate) missing.push("当前日期");
  if (!targetDate) missing.push("目标日期");
  if (!Number.isFinite(targetDailyInc)) missing.push("目标日均新增 A");
  if (!Number.isFinite(curPointTotal)) missing.push("当前时点余额总量");
  if (!Number.isFinite(curDailyTotal)) missing.push("当前日均余额总量");
  if (!Number.isFinite(basePoint)) missing.push("去年年底时点总余额");
  if (!Number.isFinite(baseDaily)) missing.push("去年年底日均总余额");

  const warnings = [];
  if (missing.length) {
    warnings.push(`补全字段后可查看完整结果：${missing.join("、")}`);
  }
  if (curDate && targetDate && targetDate < curDate) {
    warnings.push("目标日期早于当前日期，请检查输入日期。");
  }

  const pointInc = curPointTotal - basePoint;
  const dailyInc = curDailyTotal - baseDaily;
  const completion = Number.isFinite(targetDailyInc) && targetDailyInc !== 0
    ? dailyInc / targetDailyInc
    : NaN;

  const t0 = dayOfYearInclusive(curDate);
  const t1 = dayOfYearInclusive(targetDate);
  const daysLeft = curDate && targetDate ? daysBetween(curDate, targetDate) : NaN;

  let needPerDay = NaN;
  if (Number.isFinite(daysLeft) && Number.isFinite(targetDailyInc) && Number.isFinite(dailyInc)) {
    if (daysLeft > 0) {
      needPerDay = (targetDailyInc - dailyInc) / daysLeft;
    } else if (daysLeft === 0) {
      needPerDay = targetDailyInc - dailyInc;
    }
  }

  const targetDailyTotal = Number.isFinite(baseDaily) && Number.isFinite(targetDailyInc)
    ? baseDaily + targetDailyInc
    : NaN;

  const remainDailyTotalLine = Number.isFinite(targetDailyTotal) &&
    Number.isFinite(curDailyTotal) &&
    Number.isFinite(t0) &&
    Number.isFinite(t1) &&
    t1 > t0
    ? (targetDailyTotal * t1 - curDailyTotal * t0) / (t1 - t0)
    : NaN;

  const remainLineIncByPointBase = Number.isFinite(remainDailyTotalLine) && Number.isFinite(basePoint)
    ? remainDailyTotalLine - basePoint
    : NaN;

  let astar = NaN;
  let astarRatio = NaN;
  if (Number.isFinite(lineIncInput) &&
    Number.isFinite(basePoint) &&
    Number.isFinite(baseDaily) &&
    Number.isFinite(curDailyTotal) &&
    Number.isFinite(t0) &&
    Number.isFinite(t1) &&
    t1 > t0) {
    const reverseTotalLine = basePoint + lineIncInput;
    const cstar = (reverseTotalLine * (t1 - t0) + curDailyTotal * t0) / t1;
    astar = cstar - baseDaily;
    astarRatio = Number.isFinite(targetDailyInc) && targetDailyInc !== 0 ? astar / targetDailyInc : NaN;
  }

  return {
    unit: String(unit),
    unitLabel: getUnitLabel(unit),
    warnings,
    pointInc,
    dailyInc,
    completion,
    daysLeft,
    needPerDay,
    targetDailyTotal,
    remainDailyTotalLine,
    remainLineIncByPointBase,
    astar,
    astarRatio,
    hasReverseInput: Number.isFinite(lineIncInput)
  };
}

function toResultView(result) {
  return {
    ...result,
    warningText: result.warnings.join(" "),
    pointIncText: formatAmount(result.pointInc, result.unit, { signed: true }),
    dailyIncText: formatAmount(result.dailyInc, result.unit, { signed: true }),
    completionText: formatRatio(result.completion),
    completionClass: classifyRatio(result.completion),
    daysLeftText: Number.isFinite(result.daysLeft) ? `${result.daysLeft} 天` : "--",
    needPerDayText: formatAmount(result.needPerDay, result.unit, { signed: true }),
    targetDailyTotalText: formatAmount(result.targetDailyTotal, result.unit),
    remainDailyTotalLineText: formatAmount(result.remainDailyTotalLine, result.unit),
    remainLineIncText: formatAmount(result.remainLineIncByPointBase, result.unit, { signed: true }),
    astarText: formatAmount(result.astar, result.unit, { signed: true }),
    astarRatioText: formatRatio(result.astarRatio),
    astarRatioClass: classifyRatio(result.astarRatio),
    reverseHintText: result.hasReverseInput
      ? "已根据你输入的剩余期间平线增量，反推出最终日均新增 A*。"
      : "输入“剩余期间平线增量底线”后，可反推出最终日均新增 A*。"
  };
}

function getUnitIndex(unit) {
  const target = String(getUnitValue(unit));
  const index = UNIT_OPTIONS.findIndex((item) => item.value === target);
  return index >= 0 ? index : 1;
}

module.exports = {
  UNIT_OPTIONS,
  buildDefaultForm,
  computeDepositAverage,
  getUnitIndex,
  getUnitLabel,
  toResultView
};
