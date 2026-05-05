function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return null;
  const next = new Date(year, month - 1, day);
  next.setHours(0, 0, 0, 0);
  return next;
}

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return NaN;
  const next = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(next) ? next : NaN;
}

function daysBetween(startDate, endDate) {
  if (!startDate || !endDate) return NaN;
  return Math.round((endDate - startDate) / 86400000);
}

function dayOfYear(date) {
  if (!date) return NaN;
  const yearStart = new Date(date.getFullYear(), 0, 1);
  yearStart.setHours(0, 0, 0, 0);
  return daysBetween(yearStart, date) + 1;
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function daysInYear(year) {
  return new Date(year, 11, 31).getDate() === 31 && dayOfYear(new Date(year, 11, 31)) === 366 ? 366 : 365;
}

function formatAmount(value, signed = false) {
  if (!Number.isFinite(value)) return "--";
  const prefix = signed && value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}`;
}

function todayDate() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function buildMonthOptions() {
  return Array.from({ length: 12 }, (_, index) => ({
    value: String(index + 1),
    label: `${index + 1}月`
  }));
}

const MODE_OPTIONS = [
  { value: "month", label: "月日均" },
  { value: "year", label: "年日均" }
];

const MONTH_OPTIONS = buildMonthOptions();

function clampDay(day, maxDay) {
  return Math.max(1, Math.min(day, maxDay));
}

function syncMonthDates(form) {
  const today = todayDate();
  const year = today.getFullYear();
  const month = Math.max(1, Math.min(12, Number(form.monthValue) || (today.getMonth() + 1)));
  const maxDay = daysInMonth(year, month - 1);

  const currentSource = parseDate(form.currentDate);
  const targetSource = parseDate(form.targetDate);
  const currentDay = clampDay(currentSource ? currentSource.getDate() : (month === today.getMonth() + 1 ? today.getDate() : 1), maxDay);
  const suggestedTargetDay = clampDay(targetSource ? targetSource.getDate() : Math.min(currentDay + 5, maxDay), maxDay);
  const targetDay = Math.max(currentDay, suggestedTargetDay);

  return {
    ...form,
    monthValue: String(month),
    currentDate: formatDate(new Date(year, month - 1, currentDay)),
    targetDate: formatDate(new Date(year, month - 1, targetDay))
  };
}

function syncYearDates(form) {
  const current = parseDate(form.currentDate) || todayDate();
  const year = current.getFullYear();
  const target = parseDate(form.targetDate) || new Date(year, 11, 31);
  const fixedTarget = target.getFullYear() === year ? target : new Date(year, 11, 31);
  const nextTarget = fixedTarget < current ? current : fixedTarget;

  return {
    ...form,
    currentDate: formatDate(current),
    targetDate: formatDate(nextTarget)
  };
}

function syncCriticalForm(form) {
  return form.mode === "year" ? syncYearDates(form) : syncMonthDates(form);
}

function buildDefaultForm() {
  const today = todayDate();
  const currentMonth = String(today.getMonth() + 1);
  return syncCriticalForm({
    mode: "month",
    monthValue: currentMonth,
    currentDate: formatDate(today),
    targetDate: formatDate(new Date(today.getFullYear(), today.getMonth(), Math.min(today.getDate() + 5, daysInMonth(today.getFullYear(), today.getMonth())))),
    currentPointAsset: "200.00",
    currentAverage: "180.00",
    targetAverage: "220.00"
  });
}

function getModeIndex(mode) {
  const index = MODE_OPTIONS.findIndex((item) => item.value === mode);
  return index >= 0 ? index : 0;
}

function getMonthIndex(monthValue) {
  const index = MONTH_OPTIONS.findIndex((item) => item.value === String(monthValue));
  return index >= 0 ? index : 0;
}

function computeCritical(form) {
  const nextForm = syncCriticalForm(form);
  const currentDate = parseDate(nextForm.currentDate);
  const targetDate = parseDate(nextForm.targetDate);
  const currentPointAsset = toNumber(nextForm.currentPointAsset);
  const currentAverage = toNumber(nextForm.currentAverage);
  const targetAverage = toNumber(nextForm.targetAverage);
  const warnings = [];

  if (!Number.isFinite(currentPointAsset)) warnings.push("先填当前时点资产。");
  if (!Number.isFinite(currentAverage)) warnings.push("先填当前日均。");
  if (!Number.isFinite(targetAverage)) warnings.push("先填目标日均。");
  if (!currentDate || !targetDate) warnings.push("日期还没填完整。");

  let totalDays = NaN;
  let elapsedDays = NaN;
  let targetDayIndex = NaN;

  if (nextForm.mode === "month") {
    const year = currentDate ? currentDate.getFullYear() : todayDate().getFullYear();
    const month = Number(nextForm.monthValue) || 1;
    totalDays = daysInMonth(year, month - 1);
    elapsedDays = currentDate ? currentDate.getDate() : NaN;
    targetDayIndex = targetDate ? targetDate.getDate() : NaN;

    if (currentDate && currentDate.getMonth() + 1 !== month) {
      warnings.push("当前日期已自动按所选月份校准。");
    }
  } else {
    const year = currentDate ? currentDate.getFullYear() : todayDate().getFullYear();
    totalDays = daysInYear(year);
    elapsedDays = dayOfYear(currentDate);
    targetDayIndex = dayOfYear(targetDate);
  }

  const remainingDays = Number.isFinite(targetDayIndex) && Number.isFinite(elapsedDays)
    ? targetDayIndex - elapsedDays
    : NaN;

  if (Number.isFinite(remainingDays) && remainingDays <= 0) {
    warnings.push("目标统计日要晚于当前统计日。");
  }

  const requiredFutureLevel = Number.isFinite(targetAverage) &&
    Number.isFinite(currentAverage) &&
    Number.isFinite(targetDayIndex) &&
    Number.isFinite(elapsedDays) &&
    Number.isFinite(remainingDays) &&
    remainingDays > 0
    ? (targetAverage * targetDayIndex - currentAverage * elapsedDays) / remainingDays
    : NaN;

  const requiredLift = Number.isFinite(requiredFutureLevel) && Number.isFinite(currentPointAsset)
    ? requiredFutureLevel - currentPointAsset
    : NaN;

  const summaryText = Number.isFinite(requiredFutureLevel) && Number.isFinite(requiredLift)
    ? requiredLift > 0
      ? `想到目标日均，后 ${remainingDays} 天平均要做到 ${formatAmount(requiredFutureLevel)}，比当前时点还差 ${formatAmount(requiredLift, true)}。`
      : `已经够线了，后 ${remainingDays} 天平均稳在 ${formatAmount(requiredFutureLevel)} 左右就行。`
    : "补齐参数后，这里会直接告诉你后几天平均要补到多少。";

  return {
    ...nextForm,
    warnings,
    totalDays,
    elapsedDays,
    targetDayIndex,
    remainingDays,
    requiredFutureLevel,
    requiredLift,
    summaryText
  };
}

function toResultView(result) {
  return {
    ...result,
    warningText: result.warnings.join(" "),
    totalDaysText: Number.isFinite(result.totalDays) ? `${result.totalDays} 天` : "--",
    elapsedDaysText: Number.isFinite(result.elapsedDays) ? `${result.elapsedDays} 天` : "--",
    targetDayIndexText: Number.isFinite(result.targetDayIndex) ? `${result.targetDayIndex} 天` : "--",
    remainingDaysText: Number.isFinite(result.remainingDays) ? `${result.remainingDays} 天` : "--",
    currentPointAssetText: formatAmount(toNumber(result.currentPointAsset)),
    currentAverageText: formatAmount(toNumber(result.currentAverage)),
    targetAverageText: formatAmount(toNumber(result.targetAverage)),
    requiredFutureLevelText: formatAmount(result.requiredFutureLevel),
    requiredLiftText: formatAmount(result.requiredLift, true)
  };
}

module.exports = {
  MODE_OPTIONS,
  MONTH_OPTIONS,
  buildDefaultForm,
  syncCriticalForm,
  getModeIndex,
  getMonthIndex,
  computeCritical,
  toResultView
};
