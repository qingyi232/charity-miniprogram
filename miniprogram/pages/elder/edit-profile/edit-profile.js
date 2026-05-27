const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    userInfo: {},
    genderList: ['男', '女'],
    genderIndex: 0,
    emergencyContacts: []
  },

  onLoad() {
    const userInfo = { ...app.globalData.userInfo }
    const genderIndex = userInfo.gender === '女' ? 1 : 0
    this.setData({
      userInfo,
      genderIndex,
      emergencyContacts: userInfo.emergencyContacts || []
    })
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`userInfo.${field}`]: e.detail.value })
  },

  onGenderChange(e) {
    const index = e.detail.value
    this.setData({
      genderIndex: index,
      'userInfo.gender': this.data.genderList[index]
    })
  },

  changeAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: async (res) => {
        const tempPath = res.tempFiles[0].tempFilePath
        wx.showLoading({ title: '上传中...' })
        try {
          const uploadRes = await wx.cloud.uploadFile({
            cloudPath: `avatars/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
            filePath: tempPath
          })
          this.setData({ 'userInfo.avatar': uploadRes.fileID })
          wx.hideLoading()
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '上传失败', icon: 'none' })
        }
      }
    })
  },

  chooseAddress() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          'userInfo.address': res.address || res.name,
          'userInfo.location': { lat: res.latitude, lng: res.longitude }
        })
      }
    })
  },

  addContact() {
    const contacts = [...this.data.emergencyContacts, { name: '', phone: '', relation: '' }]
    this.setData({ emergencyContacts: contacts })
  },

  onContactInput(e) {
    const { index, field } = e.currentTarget.dataset
    this.setData({ [`emergencyContacts[${index}].${field}`]: e.detail.value })
  },

  deleteContact(e) {
    const index = e.currentTarget.dataset.index
    const contacts = [...this.data.emergencyContacts]
    contacts.splice(index, 1)
    this.setData({ emergencyContacts: contacts })
  },

  async handleSave() {
    const info = this.data.userInfo
    if (!info.nickname && !info.name) {
      wx.showToast({ title: '请填写昵称或姓名', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })
    try {
      const updateData = {
        nickname: info.nickname || '',
        name: info.name || '',
        age: info.age ? parseInt(info.age) : null,
        gender: info.gender || '男',
        phone: info.phone || '',
        address: info.address || '',
        addressDetail: info.addressDetail || '',
        location: info.location || null,
        height: info.height ? parseFloat(info.height) : null,
        weight: info.weight ? parseFloat(info.weight) : null,
        medicalHistory: info.medicalHistory || '',
        emergencyContacts: this.data.emergencyContacts.filter(c => c.name && c.phone),
        avatar: info.avatar || '',
        updateTime: db.serverDate()
      }

      const userId = app.globalData.userInfo._id
      await db.collection('users').doc(userId).update({ data: updateData })
      const updated = await db.collection('users').doc(userId).get()

      wx.hideLoading()

      app.setUserInfo(updated.data)
      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1500)
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  }
})
