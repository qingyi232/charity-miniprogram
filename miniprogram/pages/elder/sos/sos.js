const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    pressing: false,
    emergencyContacts: [],
    latestHealth: null,
    showContactModal: false,
    contactForm: { name: '', phone: '', relation: '' }
  },

  onShow() {
    this.loadEmergencyContacts()
    this.loadLatestHealth()
  },

  async loadEmergencyContacts() {
    try {
      if (!app.globalData.userInfo || !app.globalData.userInfo._id) return
      const userId = app.globalData.userInfo._id
      const res = await db.collection('users').doc(userId).get()
      if (res.data && res.data.emergencyContacts && res.data.emergencyContacts.length > 0) {
        this.setData({ emergencyContacts: res.data.emergencyContacts })
      }
    } catch (e) {
      if (e.message && e.message.includes('cannot find document')) {
        this.setData({ emergencyContacts: [] })
      } else {
        console.error('加载紧急联系人失败', e)
      }
    }
  },

  async loadLatestHealth() {
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
          latestHealth: {
            bp: d.systolic && d.diastolic ? `${d.systolic}/${d.diastolic}` : '--',
            heartRate: d.heartRate || '--',
            bloodOxygen: d.bloodOxygen || '--',
            bpAlert: d.systolic > 140 || d.diastolic > 90,
            boAlert: d.bloodOxygen && d.bloodOxygen < 94
          }
        })
      }
    } catch (e) {
      console.error('加载健康数据失败', e)
    }
  },

  addContact() {
    this.setData({
      showContactModal: true,
      contactForm: { name: '', phone: '', relation: '' }
    })
  },

  onContactInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`contactForm.${field}`]: e.detail.value })
  },

  closeContactModal() {
    this.setData({ showContactModal: false })
  },

  confirmAddContact() {
    const { name, phone, relation } = this.data.contactForm
    if (!name.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' })
      return
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' })
      return
    }
    const contacts = [...this.data.emergencyContacts, { name: name.trim(), phone, relation: relation.trim() }]
    this.saveContacts(contacts)
    this.setData({ showContactModal: false })
  },

  deleteContact(e) {
    const index = e.currentTarget.dataset.index
    wx.showModal({
      title: '确认删除',
      content: `确定删除联系人"${this.data.emergencyContacts[index].name}"？`,
      confirmColor: '#E8573A',
      success: (res) => {
        if (!res.confirm) return
        const contacts = [...this.data.emergencyContacts]
        contacts.splice(index, 1)
        this.saveContacts(contacts)
      }
    })
  },

  async saveContacts(contacts) {
    wx.showLoading({ title: '保存中...' })
    try {
      const userId = app.globalData.userInfo._id
      await db.collection('users').doc(userId).update({
        data: { emergencyContacts: contacts, updateTime: db.serverDate() }
      })
      this.setData({ emergencyContacts: contacts })
      wx.hideLoading()
      wx.showToast({ title: '保存成功', icon: 'success' })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  handleSOS() {
    wx.showModal({
      title: '紧急求助',
      content: '确定要发送紧急求助信号吗？将通知您的结对志愿者和管理员。',
      confirmText: '确定求助',
      confirmColor: '#C62828',
      success: async (res) => {
        if (res.confirm) {
          this.setData({ pressing: true })
          wx.showLoading({ title: '发送中...' })
          try {
            const location = await this.getLocation()
            const userId = app.globalData.userInfo._id
            const elder = app.globalData.userInfo
            const sosContent = `[紧急求助] 老人：${elder.nickname || '未知'}\n地址：${elder.address || '未知'}\n${location ? `定位：${location.lat}, ${location.lng}` : '未获取定位'}`
            const pairRes = await db.collection('pairs')
              .where({ elderId: userId, status: 'active' }).get()
            for (const pair of pairRes.data) {
              await db.collection('messages').add({
                data: { type: 'sos', msgType: 'sos', fromUserId: userId, fromUserName: elder.nickname || '老人', toUserId: pair.volunteerId, content: sosContent, read: false, location, createTime: db.serverDate() }
              })
            }
            await db.collection('messages').add({
              data: { type: 'sos', msgType: 'sos', fromUserId: userId, fromUserName: elder.nickname || '老人', toUserId: 'admin', content: sosContent, read: false, location, createTime: db.serverDate() }
            })
            wx.hideLoading()
            wx.showToast({ title: '求助信号已发送', icon: 'success' })
          } catch (e) {
            wx.hideLoading()
            wx.showToast({ title: '发送失败，请重试', icon: 'none' })
          }
          this.setData({ pressing: false })
        }
      }
    })
  },

  callContact(e) {
    wx.makePhoneCall({ phoneNumber: e.currentTarget.dataset.phone })
  },

  call120() {
    wx.makePhoneCall({ phoneNumber: '120' })
  },

  call110() {
    wx.makePhoneCall({ phoneNumber: '110' })
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
