const {
  MODE_OPTIONS,
  MONTH_OPTIONS,
  buildDefaultForm,
  syncCriticalForm,
  getModeIndex,
  getMonthIndex,
  computeCritical,
  toResultView
} = require("../../utils/critical-customer");

const STORAGE_KEY = "critical_customer_boost_v1";

function buildDefaultState() {
  const form = buildDefaultForm();
  return {
    toolName: getApp().globalData.brandName,
    makerName: getApp().globalData.makerName,
    modeOptions: MODE_OPTIONS,
    monthOptions: MONTH_OPTIONS,
    modeIndex: getModeIndex(form.mode),
    monthIndex: getMonthIndex(form.monthValue),
    form,
    result: toResultView(computeCritical(form))
  };
}

function hydrateState(saved) {
  const defaults = buildDefaultState();
  const form = syncCriticalForm({
    ...defaults.form,
    ...(saved.form || {})
  });

  return {
    ...defaults,
    form,
    modeIndex: getModeIndex(form.mode),
    monthIndex: getMonthIndex(form.monthValue),
    result: toResultView(computeCritical(form))
  };
}

Page({
  data: buildDefaultState(),

  onLoad() {
    const saved = wx.getStorageSync(STORAGE_KEY);
    const nextData = saved ? hydrateState(saved) : buildDefaultState();
    this.setData(nextData);
  },

  onShow() {
    getApp().ensureAuthed("/pages/critical/index");
  },

  persist() {
    wx.setStorageSync(STORAGE_KEY, {
      form: this.data.form
    });
  },

  resetDefaults() {
    this.setData(buildDefaultState(), () => this.persist());
  },

  setMode(event) {
    const mode = event.currentTarget.dataset.mode;
    const nextForm = syncCriticalForm({
      ...this.data.form,
      mode
    });

    this.setData({
      form: nextForm,
      modeIndex: getModeIndex(mode),
      monthIndex: getMonthIndex(nextForm.monthValue),
      result: toResultView(computeCritical(nextForm))
    }, () => this.persist());
  },

  onMonthChange(event) {
    const monthValue = MONTH_OPTIONS[event.detail.value].value;
    const nextForm = syncCriticalForm({
      ...this.data.form,
      monthValue
    });

    this.setData({
      form: nextForm,
      monthIndex: Number(event.detail.value),
      result: toResultView(computeCritical(nextForm))
    }, () => this.persist());
  },

  onDateChange(event) {
    const key = event.currentTarget.dataset.key;
    const nextForm = syncCriticalForm({
      ...this.data.form,
      [key]: event.detail.value
    });

    this.setData({
      form: nextForm,
      result: toResultView(computeCritical(nextForm))
    }, () => this.persist());
  },

  onInput(event) {
    const key = event.currentTarget.dataset.key;
    const nextForm = {
      ...this.data.form,
      [key]: event.detail.value
    };

    this.setData({
      form: nextForm,
      result: toResultView(computeCritical(nextForm))
    }, () => this.persist());
  }
});
