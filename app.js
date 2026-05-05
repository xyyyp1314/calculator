const AUTH_STORAGE_KEY = "branch_toolbox_auth_v1";
const TAB_PAGES = [
  "/pages/home/index",
  "/pages/calculator/index",
  "/pages/scanner/index",
  "/pages/arbitrage/index",
  "/pages/critical/index"
];

const VERIFY_CODE = "GYGJ2026";

App({
  globalData: {
    brandName: "支行日用工具箱",
    makerName: "巩义支行个金部",
    authHint: "仅限内部使用，首次通过后当前设备可直接进入。",
    verifyHint: "请输入巩义支行个金部下发的验证口令。",
    verified: false,
    user: null
  },

  onLaunch() {
    const saved = wx.getStorageSync(AUTH_STORAGE_KEY);
    if (saved && saved.verified && saved.user) {
      this.globalData.verified = true;
      this.globalData.user = saved.user;
    }
  },

  isVerified() {
    return !!this.globalData.verified;
  },

  getUser() {
    return this.globalData.user;
  },

  isTabPage(path) {
    return TAB_PAGES.includes(path);
  },

  ensureAuthed(targetPath = "/pages/home/index") {
    if (this.isVerified()) return true;
    const redirect = encodeURIComponent(targetPath);
    wx.redirectTo({
      url: `/pages/auth/index?redirect=${redirect}`
    });
    return false;
  },

  verifyAccess(payload = {}) {
    const name = String(payload.name || "").trim();
    const employeeId = String(payload.employeeId || "").trim();
    const verifyCode = String(payload.verifyCode || "").trim();

    if (!name) {
      return { ok: false, message: "先填一下使用人姓名。" };
    }

    if (!employeeId) {
      return { ok: false, message: "先填一下工号或账号。" };
    }

    if (!verifyCode) {
      return { ok: false, message: "还没输入验证口令。" };
    }

    if (verifyCode !== VERIFY_CODE) {
      return { ok: false, message: "验证口令不正确，请联系管理员确认。" };
    }

    const user = {
      name,
      employeeId,
      makerName: this.globalData.makerName,
      approvedAt: new Date().toISOString()
    };

    wx.setStorageSync(AUTH_STORAGE_KEY, {
      verified: true,
      user
    });

    this.globalData.verified = true;
    this.globalData.user = user;

    return { ok: true, user };
  },

  logout() {
    wx.removeStorageSync(AUTH_STORAGE_KEY);
    this.globalData.verified = false;
    this.globalData.user = null;
  },

  switchAfterAuth(targetPath = "/pages/home/index") {
    if (this.isTabPage(targetPath)) {
      wx.switchTab({ url: targetPath });
      return;
    }

    wx.redirectTo({ url: targetPath });
  }
});
