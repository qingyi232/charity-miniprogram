const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    userInfo: null,
    starLevelText: '初级志愿者',
    stats: {
      totalOrders: 0,
      pairCount: 0,
      rating: '--'
    }
  },

  onLoad() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 5 })
    }
  },

  async onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 5 })
    }
    const userInfo = await app.refreshUserInfo() || app.globalData.userInfo
    this.setData({
      userInfo,
      starLevelText: this.getStarLevel(userInfo?.totalServiceHours || 0)
    })
    this.loadStats()
  },

  getStarLevel(hours) {
    if (hours >= 500) return '五星志愿者'
    if (hours >= 200) return '四星志愿者'
    if (hours >= 100) return '三星志愿者'
    if (hours >= 50) return '二星志愿者'
    return '初级志愿者'
  },

  async loadStats() {
    try {
      const userId = app.globalData.userInfo._id

      const [orderRes, pairRes, suppRes] = await Promise.all([
        db.collection('orders')
          .where({ volunteerId: userId, status: 'completed' })
          .get(),
        db.collection('pairs')
          .where({ volunteerId: userId, status: 'active' })
          .count(),
        db.collection('supplement_records')
          .where({ status: 'approved' })
          .count().catch(() => ({ total: 0 }))
      ])

      const orderCount = orderRes.data.length
      const orderHours = orderRes.data.reduce((sum, r) => sum + (r.serviceHours || 1), 0)
      const suppCount = suppRes.total || 0
      const totalOrders = orderCount + suppCount
      const totalHours = orderHours + suppCount

      this.setData({
        'stats.totalOrders': totalOrders,
        'stats.pairCount': pairRes.total,
        'userInfo.totalServiceHours': totalHours
      })
    } catch (e) {
      console.error('加载统计失败', e)
    }
  },

  goMyOrders() {
    wx.switchTab({ url: '/pages/volunteer/index/index' })
  },

  goMyPair() {
    wx.switchTab({ url: '/pages/volunteer/pair/pair' })
  },

  goServiceRecord() {
    wx.switchTab({ url: '/pages/volunteer/service/service' })
  },

  goVerify() {
    wx.navigateTo({ url: '/pages/volunteer/verify/verify' })
  },

  async goCertificate() {
    const hours = this.data.userInfo?.totalServiceHours || 0
    if (hours < 10) {
      wx.showToast({ title: `累计服务${hours}小时，满10小时可申请证书`, icon: 'none' })
      return
    }

    wx.showLoading({ title: '查询中...' })
    try {
      const userId = app.globalData.userInfo._id
      const certRes = await db.collection('certificates')
        .where({ userId })
        .orderBy('createTime', 'desc')
        .limit(1)
        .get()
      wx.hideLoading()

      if (certRes.data && certRes.data.length > 0) {
        const cert = certRes.data[0]
        const statusMap = { pending: '审核中', approved: '已通过', rejected: '已拒绝' }
        wx.showModal({
          title: '证书申请状态',
          content: `申请状态：${statusMap[cert.status] || cert.status}\n服务时长：${cert.serviceHours}小时\n申请时间：${cert.applyTime || ''}`,
          showCancel: false
        })
        return
      }
    } catch (e) {
      wx.hideLoading()
    }

    wx.showModal({
      title: '公益服务证书',
      content: `您已累计服务 ${hours} 小时，完成 ${this.data.stats.totalOrders} 次帮扶任务。确认申请公益服务证书？`,
      confirmText: '申请证书',
      confirmColor: '#2DB5A0',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '提交中...' })
          try {
            const userId = app.globalData.userInfo._id
            const userName = app.globalData.userInfo.nickname || '志愿者'
            const existRes = await db.collection('certificates')
              .where({ userId, status: db.command.in(['pending', 'approved']) })
              .get()
            if (existRes.data.length > 0) {
              wx.hideLoading()
              wx.showToast({ title: '已有申请记录', icon: 'none' })
              return
            }
            const now = new Date()
            const applyTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
            await db.collection('certificates').add({
              data: {
                userId, userName, serviceHours: hours,
                totalOrders: this.data.stats.totalOrders,
                pairCount: this.data.stats.pairCount,
                starLevel: app.globalData.userInfo.starLevel || 1,
                status: 'pending', applyTime,
                createTime: db.serverDate()
              }
            })
            wx.hideLoading()
            wx.showToast({ title: '证书申请已提交', icon: 'success' })
          } catch (e) {
            wx.hideLoading()
            wx.showToast({ title: '网络错误', icon: 'none' })
          }
        }
      }
    })
  },

  goTraining() {
    wx.switchTab({ url: '/pages/volunteer/training/training' })
  },

  goShop() {
    wx.navigateTo({ url: '/pages/volunteer/shop/shop' })
  },

  goEditProfile() {
    wx.navigateTo({ url: '/pages/volunteer/edit-profile/edit-profile' })
  },

  goActivity() {
    wx.navigateTo({ url: '/pages/common/activity/activity' })
  },

  goMyCollection() {
    wx.showToast({ title: '暂无收藏内容', icon: 'none' })
  },

  goPrivacy() {
    wx.showModal({
      title: '隐私设置',
      content: '1. 手机号仅结对志愿者可见\n2. 住址信息模糊处理\n3. 健康数据仅授权查看\n4. 聊天记录端到端保护',
      showCancel: false,
      confirmText: '我知道了'
    })
  },

  goAbout() {
    wx.showToast({ title: '青老代际智能融合平台 v1.0', icon: 'none' })
  },

  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      confirmColor: '#4A90D9',
      success: (res) => {
        if (res.confirm) {
          app.logout()
          wx.redirectTo({ url: '/pages/common/login/login' })
        }
      }
    })
  }
})
