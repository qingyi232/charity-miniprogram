const app = getApp()
const db = wx.cloud.database()
const { DEFAULT_AVATAR, isValidImageUrl, validateCloudAvatars, validateSingleAvatar } = require('../../../utils/api')

Page({
  data: {
    userInfo: null,
    orderList: [],
    pairList: [],
    unreadCount: 0,
    starLevelText: '初级志愿者',
    announcements: [],
    orderFilter: '',
    serviceStats: {
      totalOrders: 0,
      totalHours: 0,
      pairCount: 0,
      rating: '--'
    },
    communityStats: {
      pendingOrders: 0,
      todayCompleted: 0,
      activeVolunteers: 0,
      totalHours: 0
    },
    topCategories: [],
    myTodayOrders: [],
    casePreviews: [],
    showInputModal: false,
    inputModalTitle: '',
    inputModalPlaceholder: '',
    inputModalValue: '',
    inputModalConfirmText: '确认',
    _rejectOrderId: ''
  },

  onLoad() {
    this.checkLogin()
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
  },

  async onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    if (app.globalData.isLogin) {
      const freshInfo = await app.refreshUserInfo()
      const userInfo = { ...(freshInfo || app.globalData.userInfo) }
      if (!isValidImageUrl(userInfo.avatar)) {
        userInfo.avatar = DEFAULT_AVATAR
      }
      this.setData({
        userInfo,
        starLevelText: this.getStarLevel(userInfo.totalServiceHours || 0)
      })
      this.validateUserAvatar(userInfo)
      this.loadAnnouncements()
      this.loadOrders()
      this.loadPairList()
      this.loadUnreadCount()
      this.loadServiceStats()
      this.loadCommunityStats()
      this.loadMyTodayOrders()
      this.loadCasePreviews()
    }
  },

  checkLogin() {
    if (!app.globalData.isLogin) {
      wx.redirectTo({ url: '/pages/common/login/login' })
      return
    }
    const userInfo = { ...app.globalData.userInfo }
    if (!isValidImageUrl(userInfo.avatar)) {
      userInfo.avatar = DEFAULT_AVATAR
    }
    this.setData({
      userInfo,
      starLevelText: this.getStarLevel(userInfo.totalServiceHours || 0)
    })
  },

  getStarLevel(hours) {
    if (hours >= 500) return '五星志愿者'
    if (hours >= 200) return '四星志愿者'
    if (hours >= 100) return '三星志愿者'
    if (hours >= 50) return '二星志愿者'
    return '初级志愿者'
  },

  async loadAnnouncements() {
    try {
      const res = await db.collection('announcements')
        .where({ type: 'activity', status: 'active' })
        .orderBy('activityDate', 'asc')
        .limit(3)
        .get()
      this.setData({ announcements: res.data || [] })
    } catch (e) {
      console.error('加载公告失败', e)
    }
  },

  async loadOrders() {
    try {
      const query = { status: 'pending' }
      if (this.data.orderFilter) {
        query.category = this.data.orderFilter
      }
      const res = await db.collection('orders')
        .where(query)
        .orderBy('createTime', 'desc')
        .limit(10)
        .get()
      let list = (res.data || []).sort((a, b) => (b.urgency || 0) - (a.urgency || 0))
      list = await validateCloudAvatars(list, 'elderAvatar')
      this.setData({ orderList: list })
    } catch (e) {
      console.error('加载订单失败', e)
    }
  },

  handleReject(e) {
    const orderId = e.currentTarget.dataset.id
    this._rejectOrderId = orderId
    this.setData({
      showInputModal: true,
      inputModalTitle: '拒绝订单',
      inputModalPlaceholder: '例：时间冲突/距离太远/无法提供此类服务',
      inputModalValue: '',
      inputModalConfirmText: '确认拒绝'
    })
  },

  onModalInput(e) {
    this.setData({ inputModalValue: e.detail.value })
  },

  cancelInputModal() {
    this.setData({ showInputModal: false, inputModalValue: '' })
  },

  async confirmInputModal() {
    const reason = this.data.inputModalValue.trim()
    if (!reason) {
      wx.showToast({ title: '请填写拒绝理由', icon: 'none' })
      return
    }
    this.setData({ showInputModal: false })
    wx.showLoading({ title: '处理中...' })
    try {
      const userId = app.globalData.userInfo._id
      await db.collection('reject_logs').add({
        data: { orderId: this._rejectOrderId, volunteerId: userId, reason, createTime: db.serverDate() }
      })
      wx.hideLoading()
      wx.showToast({ title: '已拒绝', icon: 'success' })
      this.setData({ inputModalValue: '' })
      this.loadOrders()
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  setOrderFilter(e) {
    const filter = e.currentTarget.dataset.filter
    this.setData({ orderFilter: filter })
    this.loadOrders()
  },

  async loadPairList() {
    try {
      const userId = app.globalData.userInfo._id
      const res = await db.collection('pairs')
        .where({ volunteerId: userId, status: 'active' })
        .limit(8)
        .get()
      const list = await validateCloudAvatars(res.data || [], 'elderAvatar')
      this.setData({ pairList: list })
    } catch (e) {
      console.error('加载结对列表失败', e)
    }
  },

  async loadUnreadCount() {
    try {
      const userId = app.globalData.userInfo._id
      const res = await db.collection('messages')
        .where({ toUserId: userId, read: false })
        .count()
      this.setData({ unreadCount: res.total })
    } catch (e) {
      console.error('加载未读消息失败', e)
    }
  },

  async loadServiceStats() {
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
      const totalHours = orderHours + suppCount

      this.setData({
        'serviceStats.totalOrders': orderCount + suppCount,
        'serviceStats.totalHours': totalHours,
        'serviceStats.pairCount': pairRes.total,
        'userInfo.totalServiceHours': totalHours
      })
    } catch (e) {
      console.error('加载服务统计失败', e)
    }
  },

  async loadMyTodayOrders() {
    try {
      const userId = app.globalData.userInfo._id
      const res = await db.collection('orders')
        .where({ volunteerId: userId, status: db.RegExp({ regexp: '^(accepted|in_progress)$', options: 'i' }) })
        .orderBy('createTime', 'desc')
        .limit(5)
        .get()
      this.setData({ myTodayOrders: res.data || [] })
    } catch (e) {
      console.error('加载今日订单失败', e)
    }
  },

  async loadCommunityStats() {
    try {
      const [pendingRes, completedRes, volunteerRes, categoryRes] = await Promise.all([
        db.collection('orders').where({ status: 'pending' }).count(),
        db.collection('orders').where({ status: 'completed' }).count(),
        db.collection('users').where({ role: 'volunteer', verified: true }).count(),
        db.collection('orders').where({ status: 'completed' }).orderBy('createTime', 'desc').limit(100).field({ category: true, serviceHours: true }).get()
      ])

      const catCount = {}
      ;(categoryRes.data || []).forEach(o => {
        const cat = o.category || '帮扶'
        catCount[cat] = (catCount[cat] || 0) + 1
      })
      const sorted = Object.entries(catCount).sort((a, b) => b[1] - a[1]).slice(0, 3)
      const maxCount = sorted.length > 0 ? sorted[0][1] : 1
      const topCategories = sorted.map(([name, count]) => ({
        name,
        count,
        percent: Math.round((count / maxCount) * 100)
      }))

      const totalHours = (categoryRes.data || []).reduce((sum, o) => sum + (o.serviceHours || 1), 0)

      this.setData({
        communityStats: {
          pendingOrders: pendingRes.total,
          todayCompleted: completedRes.total,
          activeVolunteers: volunteerRes.total,
          totalHours
        },
        topCategories
      })
    } catch (e) {
      console.error('加载社区数据失败', e)
    }
  },

  async handleAccept(e) {
    const orderId = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认接单',
      content: '确定要接受这个帮扶任务吗？',
      confirmColor: '#4A90D9',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' })
          try {
            const orderRes = await db.collection('orders').doc(orderId).get()
            if (orderRes.data.status !== 'pending') {
              wx.hideLoading()
              wx.showToast({ title: '订单已被接单', icon: 'none' })
              return
            }
            const volunteer = app.globalData.userInfo
            await db.collection('orders').doc(orderId).update({
              data: {
                volunteerId: volunteer._id,
                volunteerName: volunteer.nickname || '志愿者',
                volunteerAvatar: volunteer.avatar || '',
                volunteerPhone: volunteer.phone || '',
                status: 'accepted',
                acceptTime: db.serverDate(),
                updateTime: db.serverDate()
              }
            })
            try {
              await db.collection('messages').add({
                data: {
                  fromUserId: volunteer._id,
                  fromUserName: volunteer.nickname || '志愿者',
                  toUserId: orderRes.data.elderId,
                  content: `志愿者 ${volunteer.nickname || ''} 已接单您的帮扶需求「${orderRes.data.title || ''}」`,
                  type: 'order_notice',
                  orderId,
                  read: false,
                  createTime: db.serverDate()
                }
              })
            } catch (msgErr) { /* skip */ }
            wx.hideLoading()
            wx.showToast({ title: '接单成功', icon: 'success' })
            this.loadOrders()
          } catch (e) {
            wx.hideLoading()
            wx.showToast({ title: '接单失败', icon: 'none' })
          }
        }
      }
    })
  },

  goAllOrders() {
    wx.switchTab({ url: '/pages/volunteer/order/order' })
  },

  goPairList() {
    wx.switchTab({ url: '/pages/volunteer/pair/pair' })
  },

  goPairDetail(e) {
    const id = e.currentTarget.dataset.id
    const app = getApp()
    app.globalData.pendingPairId = id
    wx.switchTab({ url: '/pages/volunteer/pair/pair' })
  },

  goMessage() {
    wx.navigateTo({ url: '/pages/volunteer/message/message' })
  },

  goMine() {
    wx.switchTab({ url: '/pages/volunteer/mine/mine' })
  },

  goActivity() {
    wx.navigateTo({ url: '/pages/common/activity/activity' })
  },

  goTraining() {
    wx.switchTab({ url: '/pages/volunteer/training/training' })
  },

  async validateUserAvatar(userInfo) {
    if (!userInfo.avatar || !userInfo.avatar.startsWith('cloud://')) return
    const validUrl = await validateSingleAvatar(userInfo.avatar)
    if (validUrl !== userInfo.avatar) {
      this.setData({ 'userInfo.avatar': DEFAULT_AVATAR })
    }
  },

  onAvatarError() {
    this.setData({ 'userInfo.avatar': DEFAULT_AVATAR })
  },

  onOrderImgError(e) {
    const idx = e.currentTarget.dataset.idx
    this.setData({ [`orderList[${idx}].elderAvatar`]: DEFAULT_AVATAR })
  },

  onPairImgError(e) {
    const idx = e.currentTarget.dataset.idx
    this.setData({ [`pairList[${idx}].elderAvatar`]: DEFAULT_AVATAR })
  },

  async loadCasePreviews() {
    try {
      const res = await db.collection('training_content')
        .where({ type: 'case', status: 'active' })
        .orderBy('sortOrder', 'asc')
        .limit(3)
        .get()
      this.setData({ casePreviews: res.data || [] })
    } catch (e) {
      console.error('加载案例失败', e)
      this.setData({ casePreviews: [] })
    }
  }
})
