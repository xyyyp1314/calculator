/**
 * 存款日平线计算工具
 * 考核规则：当月每个周五(×1) + 月末(×3)，加权平均 − 年末余额 = 日平线
 * 周五恰好是月末 → 按月末算(×3)
 */

const DEPOSIT_TYPES = [
  { value: "interbank", label: "同业" },
  { value: "institutional", label: "机构" }
];

const MONTH_OPTIONS = [
  { value: 1, label: "1月" },
  { value: 2, label: "2月" },
  { value: 3, label: "3月" },
  { value: 4, label: "4月" },
  { value: 5, label: "5月" },
  { value: 6, label: "6月" },
  { value: 7, label: "7月" },
  { value: 8, label: "8月" },
  { value: 9, label: "9月" },
  { value: 10, label: "10月" },
  { value: 11, label: "11月" },
  { value: 12, label: "12月" }
];

const YEAR = 2026;

function pad2(v) {
  return String(v).padStart(2, "0");
}

function fmtDate(year, month, day) {
  return year + "-" + pad2(month) + "-" + pad2(day);
}

function toNumber(v) {
  if (v === "" || v === null || v === undefined) return NaN;
  var n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : NaN;
}

function trimNum(v, digits) {
  if (digits === undefined) digits = 4;
  if (!Number.isFinite(v)) return "--";
  return v.toFixed(digits);
}

/**
 * 获取指定月份的所有考核节点
 * @returns [{date, label, weight, isMonthEnd}]
 */
function getMonthCheckpoints(year, month) {
  var checkpoints = [];
  var lastDay = new Date(year, month, 0).getDate();
  var lastDayOfWeek = new Date(year, month - 1, lastDay).getDay();
  var isLastDayFriday = lastDayOfWeek === 5;

  for (var d = 1; d <= lastDay; d++) {
    var dow = new Date(year, month - 1, d).getDay();
    if (dow === 5) {
      if (d === lastDay) {
        // 周五恰好是月末 → 按月末处理 ×3
        checkpoints.push({
          date: fmtDate(year, month, d),
          label: month + "/" + d + " 月末",
          shortLabel: month + "/" + d,
          weight: 3,
          isMonthEnd: true,
          weightLabel: "×3"
        });
      } else {
        checkpoints.push({
          date: fmtDate(year, month, d),
          label: month + "/" + d + " 周五",
          shortLabel: month + "/" + d,
          weight: 1,
          isMonthEnd: false,
          weightLabel: "×1"
        });
      }
    }
  }

  // 如果月末不是周五，单独加月末节点
  if (!isLastDayFriday) {
    checkpoints.push({
      date: fmtDate(year, month, lastDay),
      label: month + "/" + lastDay + " 月末",
      shortLabel: month + "/" + lastDay,
      weight: 3,
      isMonthEnd: true,
      weightLabel: "×3"
    });
  }

  return checkpoints;
}

function getTotalWeight(checkpoints) {
  var total = 0;
  for (var i = 0; i < checkpoints.length; i++) {
    total += checkpoints[i].weight;
  }
  return total;
}

/**
 * 正向计算：各节点余额 → 日平线
 */
function computeForward(checkpoints, values, yearEndBalance) {
  var yeb = toNumber(yearEndBalance);
  var weightedSum = 0;
  var totalWeight = 0;
  var filledCount = 0;

  for (var i = 0; i < checkpoints.length; i++) {
    var cp = checkpoints[i];
    var val = toNumber(values[cp.date]);
    if (Number.isFinite(val)) {
      weightedSum += val * cp.weight;
      totalWeight += cp.weight;
      filledCount++;
    }
  }

  var allFilled = filledCount === checkpoints.length;
  if (!allFilled || totalWeight === 0) {
    return { weightedAverage: NaN, dailyLine: NaN, allFilled: false, filledCount: filledCount };
  }

  var weightedAverage = weightedSum / totalWeight;
  var dailyLine = Number.isFinite(yeb) ? weightedAverage - yeb : NaN;

  return { weightedAverage: weightedAverage, dailyLine: dailyLine, allFilled: true, filledCount: filledCount };
}

/**
 * 倒推：已知目标日平线 → 各节点平均余额
 * dailyLine = weightedAvg - yearEndBalance
 * avgBalance = dailyLine + yearEndBalance
 */
function computeReverse(targetLine, yearEndBalance) {
  var tl = toNumber(targetLine);
  var yeb = toNumber(yearEndBalance);
  if (!Number.isFinite(tl) || !Number.isFinite(yeb)) return NaN;
  return tl + yeb;
}

/**
 * 过程推算：部分节点已填，计算剩余节点需要的余额
 */
function computeProgress(checkpoints, values, yearEndBalance, targetLine) {
  var tl = toNumber(targetLine);
  var yeb = toNumber(yearEndBalance);
  if (!Number.isFinite(tl) || !Number.isFinite(yeb)) return null;

  var targetAvg = tl + yeb;
  var totalWeight = getTotalWeight(checkpoints);
  var targetWeightedSum = targetAvg * totalWeight;

  var filledWeightedSum = 0;
  var filledWeight = 0;
  var filledCount = 0;

  for (var i = 0; i < checkpoints.length; i++) {
    var val = toNumber(values[checkpoints[i].date]);
    if (Number.isFinite(val)) {
      filledWeightedSum += val * checkpoints[i].weight;
      filledWeight += checkpoints[i].weight;
      filledCount++;
    }
  }

  var remainingWeight = totalWeight - filledWeight;
  if (remainingWeight <= 0) return null;

  var neededWeightedSum = targetWeightedSum - filledWeightedSum;
  var neededAvg = neededWeightedSum / remainingWeight;

  return {
    targetAvg: targetAvg,
    neededAvg: neededAvg,
    filledCount: filledCount,
    totalCount: checkpoints.length,
    remainingCount: checkpoints.length - filledCount,
    filledWeight: filledWeight,
    remainingWeight: remainingWeight,
    totalWeight: totalWeight
  };
}

function getDepositTypeIndex(type) {
  for (var i = 0; i < DEPOSIT_TYPES.length; i++) {
    if (DEPOSIT_TYPES[i].value === type) return i;
  }
  return 0;
}

function getMonthIndex(month) {
  return Math.max(0, Math.min(11, month - 1));
}

module.exports = {
  DEPOSIT_TYPES: DEPOSIT_TYPES,
  MONTH_OPTIONS: MONTH_OPTIONS,
  YEAR: YEAR,
  getMonthCheckpoints: getMonthCheckpoints,
  toNumber: toNumber,
  trimNum: trimNum,
  getTotalWeight: getTotalWeight,
  computeForward: computeForward,
  computeReverse: computeReverse,
  computeProgress: computeProgress,
  getDepositTypeIndex: getDepositTypeIndex,
  getMonthIndex: getMonthIndex
};
