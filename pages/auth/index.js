Page({
  data: {
    brandName: getApp().globalData.brandName,
    makerName: getApp().globalData.makerName,
    authHint: getApp().globalData.authHint,
    verifyHint: getApp().globalData.verifyHint,
    form: {
      name: "",
      employeeId: "",
      verifyCode: ""
    },
    redirect: "/pages/home/index",
    statusText: ""
  },

  onLoad(options) {
    const redirect = options && options.redirect ? decodeURIComponent(options.redirect) : "/pages/home/index";
    this.setData({ redirect });

    if (getApp().isVerified()) {
      getApp().switchAfterAuth(redirect);
    }
  },

  onInput(event) {
    const key = event.currentTarget.dataset.key;
    this.setData({
      [`form.${key}`]: event.detail.value,
      statusText: ""
    });
  },

  submitLogin() {
    const result = getApp().verifyAccess(this.data.form);
    if (!result.ok) {
      this.setData({ statusText: result.message });
      return;
    }

    wx.showToast({
      title: "验证通过",
      icon: "success"
    });

    getApp().switchAfterAuth(this.data.redirect);
  }
});
