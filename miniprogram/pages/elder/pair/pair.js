const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    pairedVolunteer: null,
    serviceRecords: []
  },

  onShow() {
    this.loadPairedVolunteer()
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
        this.setData({
          pairedVolunteer: {
            name: pair.volunteerName || '志愿者',
            avatar: pair.volunteerAvatar,
            phone: pair.volunteerPhone || '未公开',
            level: pair.volunteerLevel || '初级志愿者',
            serviceHours: pair.volunteerServiceHours || 0,
            serviceCount: pair.serviceCount || 0,
            pairDate: pair.pairDate || '--',
            id: pair.volunteerId
          }
        })
        this.loadServiceRecords(pair.volunteerId)
      }
    } catch (e) {
      console.error('加载结对信息失败', e)
    }
  },

  callVolunteer() {
    const phone = this.data.pairedVolunteer?.phone
    if (phone && phone !== '未公开') {
      wx.makePhoneCall({ phoneNumber: phone })
    } else {
      wx.showToast({ title: '暂无联系电话', icon: 'none' })
    }
  },

  goChat() {
    const vol = this.data.pairedVolunteer
    if (vol) {
      wx.navigateTo({
        url: `/pages/common/chat/chat?targetId=${vol.id}&targetName=${vol.name}`
      })
    }
  },

  async loadServiceRecords(volunteerId) {
    try {
      const userId = app.globalData.userInfo._id
      const res = await db.collection('orders')
        .where({
          elderId: userId,
          volunteerId,
          status: 'completed'
        })
        .orderBy('completeTime', 'desc')
        .limit(10)
        .get()

      const serviceRecords = res.data.map(item => {
        let dateStr = ''
        if (item.completeTime) {
          const d = new Date(item.completeTime)
          dateStr = `${d.getMonth() + 1}月${d.getDate()}日`
        }
        return { ...item, dateStr }
      })
      this.setData({ serviceRecords })
    } catch (e) {
      console.error('加载服务记录失败', e)
    }
  }
})
