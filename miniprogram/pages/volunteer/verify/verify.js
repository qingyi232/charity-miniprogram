const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    verified: false,
    verifyApplied: false,
    verifyApplyTime: '',
    submitting: false,
    form: {
      realName: '',
      phone: '',
      idCard: '',
      serviceArea: '',
      serviceTypes: [],
      bio: ''
    }
  },

  async onLoad() {
    const userInfo = await app.refreshUserInfo() || app.globalData.userInfo
    if (!userInfo) return

    if (userInfo.verified) {
      this.setData({ verified: true })
      return
    }
    if (userInfo.verifyApplied) {
      let applyTime = ''
      if (userInfo.verifyApplyTime) {
        const d = new Date(userInfo.verifyApplyTime)
        applyTime = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      }
      this.setData({ verifyApplied: true, verifyApplyTime: applyTime })
      return
    }

    this.setData({
      'form.realName': userInfo.nickname || '',
      'form.phone': userInfo.phone || '',
      'form.serviceArea': userInfo.serviceArea || '',
      'form.serviceTypes': userInfo.serviceTypes || []
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

  async handleSubmit() {
    const { form } = this.data

    if (!form.realName.trim()) {
      wx.showToast({ title: '请输入真实姓名', icon: 'none' }); return
    }
    if (!/^1[3-9]\d{9}$/.test(form.phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' }); return
    }
    if (!/^\d{17}[\dXx]$/.test(form.idCard)) {
      wx.showToast({ title: '请输入正确的身份证号', icon: 'none' }); return
    }
    if (!form.serviceArea.trim()) {
      wx.showToast({ title: '请输入服务区域', icon: 'none' }); return
    }
    if (form.serviceTypes.length === 0) {
      wx.showToast({ title: '请至少选择一种服务类型', icon: 'none' }); return
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中...' })

    try {
      const userId = app.globalData.userInfo._id
      const updateData = {
        nickname: form.realName,
        phone: form.phone,
        idCard: form.idCard,
        serviceArea: form.serviceArea,
        serviceTypes: form.serviceTypes,
        bio: form.bio,
        verifyApplied: true,
        verifyApplyTime: new Date().toISOString(),
        updateTime: db.serverDate()
      }
      await db.collection('users').doc(userId).update({ data: updateData })
      const updated = await db.collection('users').doc(userId).get()
      wx.hideLoading()
      app.setUserInfo(updated.data)
      wx.showToast({ title: '认证申请已提交', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1500)
    } catch (e) {
      wx.hideLoading()
      console.error('认证提交失败', e)
      wx.showToast({ title: '网络错误，请重试', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
