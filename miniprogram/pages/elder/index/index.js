const app = getApp()
const db = wx.cloud.database()
const { DEFAULT_AVATAR, isValidImageUrl, validateCloudAvatars, validateSingleAvatar } = require('../../../utils/api')

Page({
  data: {
    userInfo: null,
    wishList: [],
    healthData: {},
    unreadCount: 0,
    pairedVolunteer: null,
    announcements: [],
    currentSwiperIndex: 0
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
      if (!isValidImageUrl(userInfo.avatar)) userInfo.avatar = DEFAULT_AVATAR
      this.setData({ userInfo })
      this.validateUserAvatar(userInfo)
      this.loadAnnouncements()
      this.loadWishList()
      this.loadHealthData()
      this.loadUnreadCount()
      this.loadPairedVolunteer()
    }
  },

  checkLogin() {
    if (!app.globalData.isLogin) {
      wx.redirectTo({ url: '/pages/common/login/login' })
      return
    }
    const userInfo = { ...app.globalData.userInfo }
    if (!isValidImageUrl(userInfo.avatar)) userInfo.avatar = DEFAULT_AVATAR
    this.setData({ userInfo })
  },

  async loadAnnouncements() {
    try {
      const res = await db.collection('announcements')
        .where({ status: 'active' })
        .orderBy('isTop', 'desc')
        .orderBy('createTime', 'desc')
        .limit(5)
        .get()
      this.setData({ announcements: res.data || [] })
    } catch (e) {
      console.error('加载公告失败', e)
    }
  },

  onSwiperChange(e) {
    this.setData({ currentSwiperIndex: e.detail.current })
  },

  async loadWishList() {
    try {
      const res = await db.collection('orders')
        .where({ status: 'pending' })
        .orderBy('createTime', 'desc')
        .limit(5)
        .get()
      let wishList = res.data.map(item => {
        let createTimeStr = ''
        if (item.createTime) {
          const d = new Date(item.createTime)
          createTimeStr = `${d.getMonth() + 1}/${d.getDate()}`
        }
        return { ...item, createTimeStr }
      })
      wishList = await validateCloudAvatars(wishList, 'elderAvatar')
      this.setData({ wishList })
    } catch (e) {
      console.error('加载心愿墙失败', e)
    }
  },

  async loadHealthData() {
    try {
      const userId = app.globalData.userInfo._id
      const res = await db.collection('health_data')
        .where({ userId })
        .orderBy('createTime', 'desc')
        .limit(1)
        .get()
      if (res.data.length > 0) {
        const d = res.data[0]
        this.setData({
          healthData: {
            bloodPressure: d.systolic && d.diastolic ? `${d.systolic}/${d.diastolic}` : '--/--',
            heartRate: d.heartRate || '--',
            bloodOxygen: d.bloodOxygen || '--'
          }
        })
      }
    } catch (e) {
      console.error('加载健康数据失败', e)
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

  async loadPairedVolunteer() {
    try {
      const userId = app.globalData.userInfo._id
      const res = await db.collection('pairs')
        .where({ elderId: userId, status: 'active' })
        .limit(1)
        .get()
      if (res.data.length > 0) {
        const pair = res.data[0]
        const avatarUrl = await validateSingleAvatar(pair.volunteerAvatar)
        this.setData({
          pairedVolunteer: {
            name: pair.volunteerName || '志愿者',
            avatar: avatarUrl,
            phone: pair.volunteerPhone || '暂无',
            id: pair.volunteerId
          }
        })
      }
    } catch (e) {
      console.error('加载结对志愿者失败', e)
    }
  },

  goVoiceChat() {
    if (!this.data.pairedVolunteer) {
      wx.showToast({ title: '暂无结对志愿者', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: `/pages/common/chat/chat?targetId=${this.data.pairedVolunteer.id}&targetName=${this.data.pairedVolunteer.name}`
    })
  },

  goCourseList() {
    wx.navigateTo({ url: '/pages/elder/course/course' })
  },

  goStudy() {
    wx.navigateTo({ url: '/pages/elder/course/course' })
  },

  goCreateOrder() {
    wx.navigateTo({ url: '/pages/elder/order-create/order-create' })
  },

  goHealth() {
    wx.navigateTo({ url: '/pages/elder/health/health' })
  },

  goPairDetail() {
    wx.navigateTo({ url: '/pages/elder/pair/pair' })
  },

  goShop() {
    wx.navigateTo({ url: '/pages/elder/shop/shop' })
  },

  goMine() {
    wx.switchTab({ url: '/pages/elder/mine/mine' })
  },

  goOrderDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/elder/order-detail/order-detail?id=${id}` })
  },

  goMessage() {
    wx.switchTab({ url: '/pages/elder/message/message' })
  },

  callVolunteer() {
    const phone = this.data.pairedVolunteer?.phone
    if (phone && phone !== '暂无') {
      wx.makePhoneCall({ phoneNumber: phone })
    } else {
      wx.showToast({ title: '暂无联系电话', icon: 'none' })
    }
  },

  handleSOS() {
    wx.showModal({
      title: '紧急求助',
      content: '确定要发送紧急求助信号吗？系统将通知您的结对志愿者和后台管理员。',
      confirmText: '确定求助',
      confirmColor: '#E8573A',
      success: (res) => {
        if (res.confirm) {
          this.sendSOS()
        }
      }
    })
  },

  async sendSOS() {
    wx.showLoading({ title: '发送中...' })
    try {
      const userId = app.globalData.userInfo._id
      const elder = app.globalData.userInfo
      const location = await this.getLocation()
      const sosContent = `[紧急求助] 老人：${elder.nickname || '未知'}\n地址：${elder.address || '未知'}\n${location ? `定位：${location.lat}, ${location.lng}` : '未获取定位'}`

      const pairRes = await db.collection('pairs')
        .where({ elderId: userId, status: 'active' })
        .get()
      for (const pair of pairRes.data) {
        await db.collection('messages').add({
          data: {
            type: 'sos', msgType: 'sos',
            fromUserId: userId, fromUserName: elder.nickname || '老人',
            toUserId: pair.volunteerId,
            content: sosContent, read: false, location,
            createTime: db.serverDate()
          }
        })
      }
      await db.collection('messages').add({
        data: {
          type: 'sos', msgType: 'sos',
          fromUserId: userId, fromUserName: elder.nickname || '老人',
          toUserId: 'admin',
          content: sosContent, read: false, location,
          createTime: db.serverDate()
        }
      })
      wx.hideLoading()
      wx.showToast({ title: '求助信号已发送', icon: 'success' })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '发送失败，请重试', icon: 'none' })
    }
  },

  async validateUserAvatar(userInfo) {
    if (!userInfo.avatar || !userInfo.avatar.startsWith('cloud://')) return
    const validUrl = await validateSingleAvatar(userInfo.avatar)
    if (validUrl !== userInfo.avatar) {
      this.setData({ 'userInfo.avatar': DEFAULT_AVATAR })
    }
  },

  getLocation() {
    return new Promise((resolve) => {
      wx.getLocation({
        type: 'gcj02',
        success: (res) => resolve({ lat: res.latitude, lng: res.longitude }),
        fail: () => resolve(null)
      })
    })
  }
})
