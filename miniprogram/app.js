App({
  globalData: {
    userInfo: null,
    userRole: '',
    role: 'elder',
    openid: '',
    isLogin: false
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }
    wx.cloud.init({
      env: 'cloud1-d7gvq0lhy78aa1507',
      traceUser: true
    })

    this.checkLoginStatus()
  },

  async checkLoginStatus() {
    const userRole = wx.getStorageSync('userRole')
    const cachedInfo = wx.getStorageSync('userInfo')
    if (!cachedInfo) return

    this.globalData.userInfo = cachedInfo
    this.globalData.userRole = userRole
    this.globalData.role = userRole || 'elder'
    this.globalData.isLogin = true

    try {
      const db = wx.cloud.database()
      if (cachedInfo._id) {
        const res = await db.collection('users').doc(cachedInfo._id).get()
        if (res.data) {
          this.globalData.userInfo = res.data
          this.globalData.isLogin = true
          wx.setStorageSync('userInfo', res.data)
        }
      }
    } catch (e) {
      console.error('checkLoginStatus刷新失败，使用缓存', e)
    }
  },

  async refreshUserInfo() {
    try {
      const db = wx.cloud.database()
      const cachedInfo = this.globalData.userInfo
      if (cachedInfo && cachedInfo._id) {
        const res = await db.collection('users').doc(cachedInfo._id).get()
        if (res.data) {
          this.globalData.userInfo = res.data
          this.globalData.isLogin = true
          wx.setStorageSync('userInfo', res.data)
          return res.data
        }
      }
    } catch (e) {
      console.error('刷新用户信息失败', e)
    }
    return this.globalData.userInfo
  },

  setUserInfo(info) {
    this.globalData.userInfo = info
    this.globalData.isLogin = true
    wx.setStorageSync('userInfo', info)
  },

  setUserRole(role) {
    this.globalData.userRole = role
    this.globalData.role = role
    wx.setStorageSync('userRole', role)
  },

  logout() {
    this.globalData.userInfo = null
    this.globalData.userRole = ''
    this.globalData.isLogin = false
    wx.removeStorageSync('userInfo')
    wx.removeStorageSync('userRole')
  }
})
