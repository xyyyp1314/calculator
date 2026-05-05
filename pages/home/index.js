const TOOLS = [
  {
    title: "日均计算器",
    tag: "日常跟进",
    text: "看完成度、缺口、平线和倒推 A*。",
    url: "/pages/scanner/index"
  },
  {
    title: "大额订单",
    tag: "收益测算",
    text: "单笔测转让价格、后手利率、保留利率和参考价。",
    url: "/pages/calculator/index"
  },
  {
    title: "大额订单套利",
    tag: "盯盘版",
    text: "拆页面老利率，反推挂出日期、隐藏收益和重挂空间。",
    url: "/pages/arbitrage/index"
  },
  {
    title: "临界客户提升",
    tag: "冲刺版",
    text: "月日均、年日均两套口径，直接看后几天要补多少。",
    url: "/pages/critical/index"
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
