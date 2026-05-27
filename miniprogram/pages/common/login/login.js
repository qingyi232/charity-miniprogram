const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    selectedRole: '',
    logging: false
  },

  selectRole(e) {
    this.setData({ selectedRole: e.currentTarget.dataset.role })
  },

  async handleWxLogin() {
    if (!this.data.selectedRole) {
      wx.showToast({ title: '请先选择身份', icon: 'none' })
      return
    }

    this.setData({ logging: true })

    try {
      const role = this.data.selectedRole
      const userRes = await db.collection('users').where({ _openid: '{openid}' }).get()

      let userData
      if (userRes.data.length > 0) {
        userData = userRes.data[0]
        if (userData.role !== role) {
          await db.collection('users').doc(userData._id).update({ data: { role } })
          userData.role = role
        }
      } else {
        const now = db.serverDate()
        const newUser = {
          role,
          nickname: '',
          avatar: '',
          phone: '',
          age: 0,
          address: '',
          emergencyContact: '',
          emergencyPhone: '',
          healthInfo: '',
          serviceTypes: [],
          serviceArea: '',
          totalServiceHours: 0,
          totalPoints: 0,
          availablePoints: 0,
          usedPoints: 0,
          starLevel: 1,
          verified: false,
          status: 'active',
          createTime: now,
          updateTime: now
        }
        const addRes = await db.collection('users').add({ data: newUser })
        newUser._id = addRes._id
        userData = newUser
      }

      app.setUserInfo(userData)
      app.setUserRole(role)

      const homePage = role === 'elder'
        ? '/pages/elder/index/index'
        : '/pages/volunteer/index/index'

      wx.reLaunch({ url: homePage })
    } catch (e) {
      console.error('登录失败', e)
      wx.showToast({ title: '网络错误，请重试', icon: 'none' })
    } finally {
      this.setData({ logging: false })
    }
  }
})
