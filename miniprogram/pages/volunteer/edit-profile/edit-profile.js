const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    saving: false,
    form: {
      nickname: '',
      phone: '',
      age: '',
      avatar: '',
      serviceArea: '',
      serviceTypes: [],
      bio: ''
    }
  },

  onLoad() {
    const u = app.globalData.userInfo
    if (!u) return
    this.setData({
      'form.nickname': u.nickname || '',
      'form.phone': u.phone || '',
      'form.age': u.age ? String(u.age) : '',
      'form.avatar': u.avatar || '',
      'form.serviceArea': u.serviceArea || '',
      'form.serviceTypes': u.serviceTypes || [],
      'form.bio': u.bio || ''
    })
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  toggleType(e) {
    const type = e.currentTarget.dataset.type
    const types = [...this.data.form.serviceTypes]
    const idx = types.indexOf(type)
    if (idx >= 0) {
      types.splice(idx, 1)
    } else {
      types.push(type)
    }
    this.setData({ 'form.serviceTypes': types })
  },

  chooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempPath = res.tempFiles[0].tempFilePath
        this.uploadAvatar(tempPath)
      }
    })
  },

  async uploadAvatar(filePath) {
    wx.showLoading({ title: '上传中...' })
    try {
      const ext = filePath.split('.').pop()
      const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath
      })
      this.setData({ 'form.avatar': uploadRes.fileID })
      wx.hideLoading()
      wx.showToast({ title: '头像已更新', icon: 'success' })
    } catch (e) {
      wx.hideLoading()
      console.error('上传头像失败', e)
      wx.showToast({ title: '上传失败', icon: 'none' })
    }
  },

  async handleSave() {
    const { form } = this.data
    if (!form.nickname.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' }); return
    }

    this.setData({ saving: true })
    wx.showLoading({ title: '保存中...' })

    try {
      const updateData = {
        nickname: form.nickname.trim(),
        phone: form.phone,
        serviceArea: form.serviceArea,
        serviceTypes: form.serviceTypes,
        bio: form.bio
      }
      if (form.avatar) updateData.avatar = form.avatar
      if (form.age) updateData.age = parseInt(form.age) || 0

      const userId = app.globalData.userInfo._id
      updateData.updateTime = db.serverDate()
      await db.collection('users').doc(userId).update({ data: updateData })
      const updated = await db.collection('users').doc(userId).get()

      wx.hideLoading()

      app.setUserInfo(updated.data)
      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1200)
    } catch (e) {
      wx.hideLoading()
      console.error('保存资料失败', e)
      wx.showToast({ title: '网络错误', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  }
})
