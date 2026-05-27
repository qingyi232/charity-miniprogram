const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    categories: [
      { name: '生活代购', value: 'shopping', icon: '/static/icons/shopping.svg' },
      { name: '上门陪伴', value: 'companion', icon: '/static/icons/handshake.svg' },
      { name: '家务帮忙', value: 'housework', icon: '/static/icons/home.svg' },
      { name: '就医陪同', value: 'medical', icon: '/static/icons/hospital.svg' },
      { name: '日常聊天', value: 'chat', icon: '/static/icons/chat.svg' },
      { name: '其他需求', value: 'other', icon: '/static/icons/clipboard.svg' }
    ],
    selectedCategory: '',
    title: '',
    description: '',
    serviceDate: '',
    address: '',
    location: null,
    urgency: 3,
    urgencyText: '一般',
    today: ''
  },

  onLoad() {
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    this.setData({ today })
  },

  selectCategory(e) {
    this.setData({ selectedCategory: e.currentTarget.dataset.value })
  },

  onInputTitle(e) {
    this.setData({ title: e.detail.value })
  },

  onInputDesc(e) {
    this.setData({ description: e.detail.value })
  },

  onDateChange(e) {
    this.setData({ serviceDate: e.detail.value })
  },

  chooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          address: res.address || res.name,
          location: { lat: res.latitude, lng: res.longitude }
        })
      }
    })
  },

  setUrgency(e) {
    const level = e.currentTarget.dataset.level
    const texts = ['', '不急', '稍急', '一般', '较急', '非常紧急']
    this.setData({ urgency: level, urgencyText: texts[level] })
  },

  async handleSubmit() {
    if (!this.data.selectedCategory) {
      wx.showToast({ title: '请选择需求类型', icon: 'none' })
      return
    }
    if (!this.data.title.trim()) {
      wx.showToast({ title: '请输入需求标题', icon: 'none' })
      return
    }
    if (!this.data.description.trim()) {
      wx.showToast({ title: '请描述您的需求', icon: 'none' })
      return
    }

    wx.showLoading({ title: '发布中...' })
    try {
      const user = app.globalData.userInfo
      const now = db.serverDate()
      await db.collection('orders').add({
        data: {
          elderId: user._id,
          elderName: user.nickname || '老人',
          elderAvatar: user.avatar || '',
          elderPhone: user.phone || '',
          elderAddress: user.address || '',
          title: this.data.title,
          description: this.data.description,
          category: this.data.selectedCategory,
          serviceTime: this.data.serviceDate,
          address: this.data.address || user.address,
          location: this.data.location || {},
          urgency: this.data.urgency || 3,
          volunteerId: '',
          volunteerName: '',
          status: 'pending',
          rating: 0,
          comment: '',
          createTime: now,
          updateTime: now,
          acceptTime: null,
          completeTime: null
        }
      })

      wx.hideLoading()
      if (true) {
        wx.showToast({ title: '发布成功', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 1500)
      } else {
        wx.showToast({ title: res.result.message || '发布失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '网络错误', icon: 'none' })
    }
  }
})
