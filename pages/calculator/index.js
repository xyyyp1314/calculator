const {
  TERM_META,
  TERM_OPTIONS,
  MODE_OPTIONS,
  RATE_PRESETS,
  getTermIndex,
  getModeIndex,
  getModeLabel,
  getDriverFieldLabel,
  createDefaultProduct,
  createDefaultListing,
  normalizeRateTable,
  syncMaturityDate,
  computeListing,
  toResultView
} = require("../../utils/calculator");

const STORAGE_KEY = "pricing_desk_single_v2";

function buildRateItems(rates, benchmarkTerm) {
  return TERM_OPTIONS.map((item) => ({
    value: item.value,
    label: item.label,
    rate: rates[item.value],
    activeClass: item.value === benchmarkTerm ? "active" : ""
  }));
}

function buildListingView(listing) {
  return {
    ...listing,
    modeIndex: getModeIndex(listing.mode),
    modeLabel: getModeLabel(listing.mode),
    driverFieldLabel: getDriverFieldLabel(listing.mode)
  };
}

function composeState(state) {
  const product = syncMaturityDate(state.product);
  return {
    ...state,
    product,
    listing: buildListingView(state.listing),
    termIndex: getTermIndex(product.termCode),
    benchmarkIndex: getTermIndex(state.benchmarkTerm),
    benchmarkLabel: TERM_META[state.benchmarkTerm].label,
    currentBenchmarkRate: state.rates[state.benchmarkTerm],
    rateItems: buildRateItems(state.rates, state.benchmarkTerm),
    rateToggleText: state.showRateEditor ? "收起利率表" : "展开利率表"
  };
}

function buildDefaultState() {
  return composeState({
    toolName: getApp().globalData.brandName,
    product: createDefaultProduct(),
    listing: createDefaultListing(undefined, "单笔测算"),
    benchmarkTerm: "3Y",
    rates: normalizeRateTable(RATE_PRESETS),
    termOptions: TERM_OPTIONS,
    modeOptions: MODE_OPTIONS,
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
    listing: {
      ...defaults.listing,
      ...(saved.listing || {})
    },
    rates: normalizeRateTable(saved.rates || defaults.rates),
    termOptions: TERM_OPTIONS,
    modeOptions: MODE_OPTIONS
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
    getApp().ensureAuthed("/pages/calculator/index");
  },

  persist() {
    const { product, listing, benchmarkTerm, rates, showRateEditor } = this.data;
    wx.setStorageSync(STORAGE_KEY, { product, listing, benchmarkTerm, rates, showRateEditor });
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

  onListingDateChange(event) {
    this.setData({ "listing.listingDate": event.detail.value }, () => this.recalculate());
  },

  onListingInput(event) {
    const key = event.currentTarget.dataset.key;
    const nextListing = buildListingView({
      ...this.data.listing,
      [key]: event.detail.value
    });
    this.setData({ listing: nextListing }, () => this.recalculate());
  },

  onModeChange(event) {
    const mode = MODE_OPTIONS[event.detail.value].value;
    const nextListing = buildListingView({
      ...this.data.listing,
      mode
    });
    this.setData({ listing: nextListing }, () => this.recalculate());
  },

  onBenchmarkChange(event) {
    const benchmarkTerm = TERM_OPTIONS[event.detail.value].value;
    this.setData({
      benchmarkTerm,
      benchmarkIndex: event.detail.value,
      benchmarkLabel: TERM_META[benchmarkTerm].label,
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
    const { product, listing, benchmarkTerm, rates } = this.data;
    const computed = computeListing({
      ...product,
      ...listing,
      benchmarkRate: rates[benchmarkTerm]
    });
    const result = toResultView(computed, benchmarkTerm);
    this.setData({
      result,
      currentBenchmarkRate: rates[benchmarkTerm],
      rateItems: buildRateItems(rates, benchmarkTerm)
    }, () => this.persist());
  }
});
