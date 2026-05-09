var dl = require("../../utils/deposit-line");

var STORAGE_KEY = "deposit_line_v1";

function getCurrentMonth() {
  var now = new Date();
  if (now.getFullYear() === dl.YEAR) return now.getMonth() + 1;
  return 1;
}

function buildDefaultTypeData() {
  return {
    yearEndBalance: "",
    yearEndLocked: false,
    targetLine: "",
    values: {}
  };
}

function buildResult(checkpoints, typeData) {
  var values = typeData.values || {};
  var yeb = typeData.yearEndBalance;
  var targetLine = typeData.targetLine;

  // 正向计算
  var fwd = dl.computeForward(checkpoints, values, yeb);
  var yebNum = dl.toNumber(yeb);

  // 计算加权总和（用于展示）
  var weightedSum = 0;
  var filledAll = true;
  for (var i = 0; i < checkpoints.length; i++) {
    var v = dl.toNumber(values[checkpoints[i].date]);
    if (Number.isFinite(v)) {
      weightedSum += v * checkpoints[i].weight;
    } else {
      filledAll = false;
    }
  }

  // 倒推
  var reverseAvg = dl.computeReverse(targetLine, yeb);
  var hasReverse = Number.isFinite(reverseAvg);

  // 过程推算
  var progress = dl.computeProgress(checkpoints, values, yeb, targetLine);
  var hasProgress = progress !== null && progress.filledCount > 0 && progress.remainingCount > 0;

  // 生成各节点建议值
  var suggestions = {};
  if (hasReverse) {
    if (hasProgress) {
      // 有已填数据 → 过程推算
      for (var j = 0; j < checkpoints.length; j++) {
        var cpVal = dl.toNumber(values[checkpoints[j].date]);
        if (!Number.isFinite(cpVal)) {
          suggestions[checkpoints[j].date] = dl.trimNum(progress.neededAvg, 2) + " 万元";
        }
      }
    } else if (progress === null || progress.filledCount === 0) {
      // 无已填数据 → 纯倒推
      for (var k = 0; k < checkpoints.length; k++) {
        suggestions[checkpoints[k].date] = dl.trimNum(reverseAvg, 2) + " 万元";
      }
    }
  }

  var dailyLineText = "--";
  var weightedAvgText = "--";
  var showDetail = false;
  var statusText = "未完成";
  var formulaText = "填满所有节点后显示完整计算过程。";
  var weightedSumText = "--";
  var yearEndText = Number.isFinite(yebNum) ? dl.trimNum(yebNum, 2) : "--";

  if (fwd.allFilled && Number.isFinite(fwd.dailyLine)) {
    dailyLineText = dl.trimNum(fwd.dailyLine, 4);
    weightedAvgText = dl.trimNum(fwd.weightedAverage, 4);
    showDetail = true;
    statusText = "已完成";
    weightedSumText = dl.trimNum(weightedSum, 2);

    var totalWeight = dl.getTotalWeight(checkpoints);
    formulaText = "加权总和 " + dl.trimNum(weightedSum, 2) +
      " ÷ 总系数 " + totalWeight +
      " = 加权平均 " + dl.trimNum(fwd.weightedAverage, 4) +
      "，减去年末余额 " + yearEndText +
      " = 日平线 " + dl.trimNum(fwd.dailyLine, 4);
  }

  // 倒推文案
  var reverseText = "";
  if (hasReverse) {
    reverseText = "目标日平线 " + dl.trimNum(dl.toNumber(targetLine), 4) + " 万元";
    if (hasProgress) {
      reverseText += "，已填 " + progress.filledCount + " 个节点，剩余 " + progress.remainingCount + " 个节点每个需要保持 " + dl.trimNum(progress.neededAvg, 2) + " 万元。";
    } else {
      reverseText += "，当月各节点平均需要 " + dl.trimNum(reverseAvg, 2) + " 万元。";
    }
  }

  return {
    dailyLineText: dailyLineText,
    weightedAvgText: weightedAvgText,
    showDetail: showDetail,
    statusText: statusText,
    formulaText: formulaText,
    weightedSumText: weightedSumText,
    yearEndText: yearEndText,
    hasReverse: hasReverse,
    reverseText: reverseText,
    hasProgress: hasProgress,
    filledCountText: hasProgress ? progress.filledCount + " / " + progress.totalCount : "--",
    neededAvgText: hasProgress ? dl.trimNum(progress.neededAvg, 2) : "--",
    suggestions: suggestions
  };
}

function buildDefaultState() {
  var month = getCurrentMonth();
  var depositType = "interbank";
  var checkpoints = dl.getMonthCheckpoints(dl.YEAR, month);
  var typeData = buildDefaultTypeData();
  var storedData = {
    interbank: buildDefaultTypeData(),
    institutional: buildDefaultTypeData()
  };

  return {
    toolName: getApp().globalData.brandName,
    depositTypes: dl.DEPOSIT_TYPES,
    monthOptions: dl.MONTH_OPTIONS,
    depositType: depositType,
    depositTypeIndex: dl.getDepositTypeIndex(depositType),
    month: month,
    monthIndex: dl.getMonthIndex(month),
    checkpoints: checkpoints,
    totalWeight: dl.getTotalWeight(checkpoints),
    typeData: typeData,
    storedData: storedData,
    result: buildResult(checkpoints, typeData)
  };
}

Page({
  data: buildDefaultState(),

  onLoad: function () {
    var saved = wx.getStorageSync(STORAGE_KEY);
    if (saved) {
      var depositType = saved.depositType || "interbank";
      var month = saved.month || getCurrentMonth();
      var storedData = {
        interbank: Object.assign(buildDefaultTypeData(), saved.storedData && saved.storedData.interbank || {}),
        institutional: Object.assign(buildDefaultTypeData(), saved.storedData && saved.storedData.institutional || {})
      };
      var typeData = storedData[depositType];
      var checkpoints = dl.getMonthCheckpoints(dl.YEAR, month);

      this.setData({
        depositType: depositType,
        depositTypeIndex: dl.getDepositTypeIndex(depositType),
        month: month,
        monthIndex: dl.getMonthIndex(month),
        checkpoints: checkpoints,
        totalWeight: dl.getTotalWeight(checkpoints),
        typeData: typeData,
        storedData: storedData,
        result: buildResult(checkpoints, typeData)
      });
    }
  },

  persist: function () {
    var storedData = JSON.parse(JSON.stringify(this.data.storedData));
    storedData[this.data.depositType] = JSON.parse(JSON.stringify(this.data.typeData));
    this.setData({ storedData: storedData });
    wx.setStorageSync(STORAGE_KEY, {
      depositType: this.data.depositType,
      month: this.data.month,
      storedData: storedData
    });
  },

  resetDefaults: function () {
    this.setData(buildDefaultState());
  },

  recalculate: function () {
    var result = buildResult(this.data.checkpoints, this.data.typeData);
    this.setData({ result: result }, this.persist.bind(this));
  },

  onDepositTypeChange: function (e) {
    var depositType = dl.DEPOSIT_TYPES[e.detail.value].value;
    // 先把当前数据存回 storedData
    var storedData = JSON.parse(JSON.stringify(this.data.storedData));
    storedData[this.data.depositType] = JSON.parse(JSON.stringify(this.data.typeData));

    var typeData = storedData[depositType] || buildDefaultTypeData();
    var checkpoints = this.data.checkpoints;

    this.setData({
      depositType: depositType,
      depositTypeIndex: Number(e.detail.value),
      typeData: typeData,
      storedData: storedData,
      result: buildResult(checkpoints, typeData)
    }, this.persist.bind(this));
  },

  onMonthChange: function (e) {
    var month = dl.MONTH_OPTIONS[e.detail.value].value;
    var checkpoints = dl.getMonthCheckpoints(dl.YEAR, month);

    this.setData({
      month: month,
      monthIndex: Number(e.detail.value),
      checkpoints: checkpoints,
      totalWeight: dl.getTotalWeight(checkpoints)
    }, this.recalculate.bind(this));
  },

  onYearEndInput: function (e) {
    if (this.data.typeData.yearEndLocked) return;
    this.setData({ "typeData.yearEndBalance": e.detail.value }, this.recalculate.bind(this));
  },

  toggleYearEndLock: function () {
    this.setData({
      "typeData.yearEndLocked": !this.data.typeData.yearEndLocked
    }, this.persist.bind(this));
  },

  onTargetLineInput: function (e) {
    this.setData({ "typeData.targetLine": e.detail.value }, this.recalculate.bind(this));
  },

  clearTargetLine: function () {
    this.setData({ "typeData.targetLine": "" }, this.recalculate.bind(this));
  },

  onCheckpointInput: function (e) {
    var date = e.currentTarget.dataset.date;
    // 微信小程序 setData 的 key 中不能直接用 date 字符串中的 "-"
    // 用整体赋值的方式更新 values
    var values = JSON.parse(JSON.stringify(this.data.typeData.values || {}));
    values[date] = e.detail.value;
    this.setData({ "typeData.values": values }, this.recalculate.bind(this));
  }
});
