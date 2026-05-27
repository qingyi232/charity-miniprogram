const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    pairList: [],
    expandedIndex: -1,
    showInputModal: false,
    inputModalTitle: '',
    inputModalPlaceholder: '',
    inputModalValue: '',
    _checkoutPairId: ''
  },

  onLoad() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    this.loadPairList().then(() => {
      const pendingId = app.globalData.pendingPairId
      if (pendingId) {
        app.globalData.pendingPairId = null
        const idx = this.data.pairList.findIndex(p => p._id === pendingId)
        if (idx >= 0) this.setData({ expandedIndex: idx })
      }
    })
  },

  async loadPairList() {
    try {
      const userId = app.globalData.userInfo._id
      const res = await db.collection('pairs')
        .where({ volunteerId: userId, status: 'active' })
        .orderBy('createTime', 'desc')
        .get()

      const pairList = res.data.map(item => {
        let pairDate = '--'
        if (item.createTime) {
          const d = new Date(item.createTime)
          pairDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        }
        return { ...item, pairDate }
      })

      this.setData({ pairList })
    } catch (e) {
      console.error('加载结对列表失败', e)
    }
  },

  async toggleDetail(e) {
    const index = e.currentTarget.dataset.index
    if (this.data.expandedIndex === index) {
      this.setData({ expandedIndex: -1 })
      return
    }

    this.setData({ expandedIndex: index })

    const item = this.data.pairList[index]
    if (!item.healthData) {
      await this.loadElderHealth(index, item.elderId)
    }
  },

  async loadElderHealth(index, elderId) {
    try {
      const res = await db.collection('health_data')
        .where({ userId: elderId })
        .orderBy('createTime', 'desc')
        .limit(1)
        .get()
      if (res.data.length > 0) {
        const d = res.data[0]
        const healthData = {
          bp: d.systolic && d.diastolic ? `${d.systolic}/${d.diastolic}` : '--/--',
          heartRate: d.heartRate || '--',
          bloodOxygen: d.bloodOxygen || '--',
          temperature: d.temperature || '--',
          bpAlert: d.systolic && (d.systolic > 140 || d.diastolic > 90),
          boAlert: d.bloodOxygen && d.bloodOxygen < 94,
          timeStr: this.formatTime(d.createTime)
        }
        this.setData({ [`pairList[${index}].healthData`]: healthData })
      }
    } catch (e) {
      console.error('加载老人健康数据失败', e)
    }
  },

  viewElderHealth(e) {
    const elderId = e.currentTarget.dataset.elderId
    const elderName = e.currentTarget.dataset.elderName
    wx.navigateTo({
      url: `/pages/elder/health/health?userId=${elderId}&title=${elderName}的健康数据`
    })
  },

  callElder(e) {
    const phone = e.currentTarget.dataset.phone
    if (phone) {
      wx.makePhoneCall({ phoneNumber: phone })
    } else {
      wx.showToast({ title: '暂无联系电话', icon: 'none' })
    }
  },

  goChat(e) {
    const item = e.currentTarget.dataset.item
    wx.navigateTo({
      url: `/pages/common/chat/chat?targetId=${item.elderId}&targetName=${item.elderName}`
    })
  },

  handleCheckin(e) {
    const { pairId, type, serviceContent } = e.currentTarget.dataset
    const typeText = type === 'arrive' ? '到达签到' : '结束签退'
    wx.getLocation({
      type: 'gcj02',
      success: (loc) => {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['camera'],
          success: async (media) => {
            wx.showLoading({ title: `${typeText}中...` })
            try {
              const filePath = media.tempFiles[0].tempFilePath
              const cloudPath = `checkin/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
              const uploadRes = await wx.cloud.uploadFile({ cloudPath, filePath })
              const checkinData = {
                  pairId,
                  type,
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                  photo: uploadRes.fileID,
                  createTime: db.serverDate()
                }
              if (serviceContent) checkinData.serviceContent = serviceContent
              await db.collection('service_checkins').add({ data: checkinData })
              wx.hideLoading()
              wx.showToast({ title: `${typeText}成功`, icon: 'success' })
            } catch (err) {
              wx.hideLoading()
              wx.showToast({ title: `${typeText}失败`, icon: 'none' })
            }
          }
        })
      },
      fail: () => {
        wx.showToast({ title: '需要位置权限', icon: 'none' })
      }
    })
  },

  handleCheckout(e) {
    const { pairId } = e.currentTarget.dataset
    this.setData({
      showInputModal: true,
      inputModalTitle: '结束签退 - 服务内容确认',
      inputModalPlaceholder: '请简要描述本次服务内容，如：陪伴聊天2小时、代购日用品等',
      inputModalValue: '',
      _checkoutPairId: pairId
    })
  },

  onModalInput(e) {
    this.setData({ inputModalValue: e.detail.value })
  },

  cancelInputModal() {
    this.setData({ showInputModal: false, inputModalValue: '' })
  },

  confirmInputModal() {
    const serviceContent = this.data.inputModalValue.trim() || '未填写'
    this.setData({ showInputModal: false, inputModalValue: '' })
    this.handleCheckin({
      currentTarget: {
        dataset: { pairId: this.data._checkoutPairId, type: 'leave', serviceContent }
      }
    })
  },

  volunteerSOS(e) {
    const pairId = e.currentTarget.dataset.pairId
    wx.showModal({
      title: '一键求助',
      content: '确认向管理员发送紧急求助？将附带您当前位置信息。',
      confirmColor: '#E53935',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '发送中...' })
          try {
            const userId = app.globalData.userInfo._id
            const userName = app.globalData.userInfo.nickname || '志愿者'
            wx.getLocation({
              type: 'gcj02',
              success: async (loc) => {
                await db.collection('messages').add({
                  data: {
                    type: 'sos',
                    msgType: 'volunteer_sos',
                    fromUserId: userId,
                    fromUserName: userName,
                    toUserId: 'admin',
                    content: `[志愿者紧急求助] ${userName}\n结对ID: ${pairId}\n定位: ${loc.latitude}, ${loc.longitude}`,
                    read: false,
                    location: { lat: loc.latitude, lng: loc.longitude },
                    createTime: db.serverDate()
                  }
                })
                wx.hideLoading()
                wx.showToast({ title: '求助已发送', icon: 'success' })
              },
              fail: async () => {
                await db.collection('messages').add({
                  data: {
                    type: 'sos',
                    msgType: 'volunteer_sos',
                    fromUserId: userId,
                    fromUserName: userName,
                    toUserId: 'admin',
                    content: `[志愿者紧急求助] ${userName}\n结对ID: ${pairId}`,
                    read: false,
                    createTime: db.serverDate()
                  }
                })
                wx.hideLoading()
                wx.showToast({ title: '求助已发送', icon: 'success' })
              }
            })
          } catch (err) {
            wx.hideLoading()
            wx.showToast({ title: '发送失败', icon: 'none' })
          }
        }
      }
    })
  },

  formatTime(time) {
    if (!time) return '--'
    const d = new Date(time)
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
})
