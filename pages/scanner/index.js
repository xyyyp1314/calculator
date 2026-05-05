const {
  UNIT_OPTIONS,
  buildDefaultForm,
  computeDepositAverage,
  getUnitIndex,
  toResultView
} = require("../../utils/deposit-average");

const STORAGE_KEY = "deposit_average_calculator_v1";

function buildDefaultState() {
  const form = buildDefaultForm();
  return {
    toolName: getApp().globalData.brandName,
    unitOptions: UNIT_OPTIONS,
    unitIndex: getUnitIndex("10000"),
    form,
    result: toResultView(computeDepositAverage(form))
  };
}

function hydrateState(saved) {
  const defaults = buildDefaultState();
  const form = {
    ...defaults.form,
    ...(saved.form || {})
  };

  return {
    ...defaults,
    ...saved,
    toolName: defaults.toolName,
    form,
    unitOptions: UNIT_OPTIONS,
    unitIndex: getUnitIndex(form.unit)
  };
}

Page({
  data: buildDefaultState(),

  onLoad() {
    const saved = wx.getStorageSync(STORAGE_KEY);
    const nextData = saved ? hydrateState(saved) : buildDefaultState();
    this.setData(nextData, () => this.recalculate());
  },

  onShow() {
    getApp().ensureAuthed("/pages/scanner/index");
  },

  persist() {
    const { form } = this.data;
    wx.setStorageSync(STORAGE_KEY, { form });
  },

  resetDefaults() {
    this.setData(buildDefaultState(), () => this.recalculate());
  },

  onUnitChange(event) {
    const unit = UNIT_OPTIONS[event.detail.value].value;
    this.setData({
      "form.unit": unit,
      unitIndex: Number(event.detail.value)
    }, () => this.recalculate());
  },

  onDateChange(event) {
    const key = event.currentTarget.dataset.key;
    this.setData({
      [`form.${key}`]: event.detail.value
    }, () => this.recalculate());
  },

  onFieldInput(event) {
    const key = event.currentTarget.dataset.key;
    this.setData({
      [`form.${key}`]: event.detail.value
    }, () => this.recalculate());
  },

  clearReverse() {
    this.setData({
      "form.lineIncInput": ""
    }, () => this.recalculate());
  },

  recalculate() {
    const result = toResultView(computeDepositAverage(this.data.form));
    this.setData({ result }, () => this.persist());
  }
});
