const TOOLS = [
  {
    title: "日均计算器",
    tag: "日常跟进",
    text: "看完成度、缺口、平线和倒推 A*。",
    url: "/pages/scanner/index",
    isTab: true
  },
  {
    title: "大额订单",
    tag: "收益测算",
    text: "单笔测转让价格、后手利率、保留利率和参考价。",
    url: "/pages/calculator/index",
    isTab: true
  },
  {
    title: "大额订单套利",
    tag: "盯盘版",
    text: "拆页面老利率，反推挂出日期、隐藏收益和重挂空间。",
    url: "/pages/arbitrage/index",
    isTab: true
  },
  {
    title: "临界客户提升",
    tag: "冲刺版",
    text: "月日均、年日均两套口径，直接看后几天要补多少。",
    url: "/pages/critical/index",
    isTab: true
  },
  {
    title: "存款日平线",
    tag: "月度考核",
    text: "机构/同业日平线，周五×1 月末×3 加权平均，支持倒推和过程推算。",
    url: "/pages/depositline/index",
    isTab: false
  }
];

Page({
  data: {
    brandName: getApp().globalData.brandName,
    makerName: getApp().globalData.makerName,
    user: null,
    tools: TOOLS
  },

  onShow() {
    if (!getApp().ensureAuthed("/pages/home/index")) return;
    this.setData({
      user: getApp().getUser()
    });
  },

  goTool(e) {
    const url = e.currentTarget.dataset.url;
    const isTab = e.currentTarget.dataset.istab === 'true';
    if (isTab) {
      wx.switchTab({ url });
    } else {
      wx.navigateTo({ url });
    }
  },

  logout() {
    wx.showModal({
      title: "退出当前设备",
      content: "退出后需要重新做一次验证，确定现在退出吗？",
      success: ({ confirm }) => {
        if (!confirm) return;
        getApp().logout();
        wx.redirectTo({
          url: "/pages/auth/index"
        });
      }
    });
  }
});
