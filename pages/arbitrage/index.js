const {
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
} = require("../../utils/arbitrage");

const STORAGE_KEY = "cd_arbitrage_v1";

function composeState(state) {
  const product = syncMaturityDate(state.product);
  return {
    ...state,
    product,
    termOptions: TERM_OPTIONS,
    termIndex: getTermIndex(product.termCode),
    benchmarkIndex: getTermIndex(state.benchmarkTerm),
    benchmarkLabel: TERM_OPTIONS[getTermIndex(state.benchmarkTerm)].label,
    currentBenchmarkRate: state.rates[state.benchmarkTerm],
    rateItems: buildRateItems(state.rates, state.benchmarkTerm),
    rateToggleText: state.showRateEditor ? "收起利率表" : "展开利率表"
  };
}

function buildDefaultState() {
  return composeState({
    toolName: getApp().globalData.brandName,
    product: createDefaultProduct(),
    quote: createDefaultQuote(),
    benchmarkTerm: "3Y",
    rates: normalizeRateTable(RATE_PRESETS),
    showRateEditor: false,
    result: null
  });
}

function hydrateState(saved) {
  const defaults = buildDefaultState();
  return composeState({
    ...defaults,
    ...saved,
    toolName: defaults.toolName,
    product: {
      ...defaults.product,
      ...(saved.product || {})
    },
    quote: {
      ...defaults.quote,
      ...(saved.quote || {})
    },
    rates: normalizeRateTable(saved.rates || defaults.rates)
  });
}

Page({
  data: buildDefaultState(),

  onLoad() {
    const saved = wx.getStorageSync(STORAGE_KEY);
    const nextData = saved ? hydrateState(saved) : buildDefaultState();
    this.setData(nextData, () => this.recalculate());
  },

  onShow() {
    getApp().ensureAuthed("/pages/arbitrage/index");
  },

  persist() {
    const { product, quote, benchmarkTerm, rates, showRateEditor } = this.data;
    wx.setStorageSync(STORAGE_KEY, { product, quote, benchmarkTerm, rates, showRateEditor });
  },

  resetDefaults() {
    this.setData(buildDefaultState(), () => this.recalculate());
  },

  onProductDateChange(event) {
    const key = event.currentTarget.dataset.key;
    this.setData({ [`product.${key}`]: event.detail.value }, () => {
      this.syncDerived();
      this.recalculate();
    });
  },

  onProductInput(event) {
    const key = event.currentTarget.dataset.key;
    this.setData({ [`product.${key}`]: event.detail.value }, () => this.recalculate());
  },

  onTermChange(event) {
    const termCode = TERM_OPTIONS[event.detail.value].value;
    this.setData({ "product.termCode": termCode }, () => {
      this.syncDerived();
      this.recalculate();
    });
  },

  onQuoteInput(event) {
    const key = event.currentTarget.dataset.key;
    this.setData({ [`quote.${key}`]: event.detail.value }, () => this.recalculate());
  },

  onBenchmarkChange(event) {
    const benchmarkTerm = TERM_OPTIONS[event.detail.value].value;
    this.setData({
      benchmarkTerm,
      benchmarkIndex: event.detail.value,
      benchmarkLabel: TERM_OPTIONS[getTermIndex(benchmarkTerm)].label,
      currentBenchmarkRate: this.data.rates[benchmarkTerm]
    }, () => this.recalculate());
  },

  onCurrentBenchmarkRateInput(event) {
    const value = event.detail.value;
    const { benchmarkTerm } = this.data;
    this.setData({
      [`rates.${benchmarkTerm}`]: value,
      currentBenchmarkRate: value
    }, () => this.recalculate());
  },

  onRateInput(event) {
    const termCode = event.currentTarget.dataset.term;
    const value = event.detail.value;
    this.setData({
      [`rates.${termCode}`]: value,
      currentBenchmarkRate: termCode === this.data.benchmarkTerm ? value : this.data.currentBenchmarkRate
    }, () => this.recalculate());
  },

  toggleRateEditor() {
    const showRateEditor = !this.data.showRateEditor;
    this.setData({
      showRateEditor,
      rateToggleText: showRateEditor ? "收起利率表" : "展开利率表"
    });
  },

  syncDerived() {
    const product = syncMaturityDate(this.data.product);
    this.setData({
      product,
      termIndex: getTermIndex(product.termCode)
    });
  },

  recalculate() {
    const { product, quote, benchmarkTerm, rates } = this.data;
    const result = toResultView(computeArbitrage({
      ...product,
      ...quote,
      benchmarkRate: rates[benchmarkTerm]
    }), benchmarkTerm);

    this.setData({
      result,
      currentBenchmarkRate: rates[benchmarkTerm],
      rateItems: buildRateItems(rates, benchmarkTerm)
    }, () => this.persist());
  }
});
