const app = getApp()

Page({
  data: {
    userInfo: null
  },

  onLoad() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 })
    }
  },

  async onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 })
    }
    const userInfo = await app.refreshUserInfo() || app.globalData.userInfo
    this.setData({ userInfo })
  },

  goMyOrders() {
    wx.switchTab({ url: '/pages/elder/order/order' })
  },

  goMyPair() {
    wx.navigateTo({ url: '/pages/elder/pair/pair' })
  },

  goHealth() {
    wx.navigateTo({ url: '/pages/elder/health/health' })
  },

  goEditProfile() {
    wx.navigateTo({ url: '/pages/elder/edit-profile/edit-profile' })
  },

  goEmergency() {
    wx.navigateTo({ url: '/pages/elder/sos/sos' })
  },

  goAbout() {
    wx.showToast({ title: '青老代际智能融合平台 v1.0', icon: 'none' })
  },

  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      confirmColor: '#E8573A',
      success: (res) => {
        if (res.confirm) {
          app.logout()
          wx.redirectTo({ url: '/pages/common/login/login' })
        }
      }
    })
  }
})
