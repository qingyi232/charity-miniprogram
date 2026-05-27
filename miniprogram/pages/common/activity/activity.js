const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    activityList: [],
    activeFilter: 'all',
    page: 1,
    pageSize: 10,
    loading: false,
    noMore: false
  },

  onLoad() {
    this.loadActivities(true)
  },

  onShow() {
    if (app.globalData.isLogin) {
      this.loadActivities(true)
    }
  },

  onPullDownRefresh() {
    this.loadActivities(true)
    wx.stopPullDownRefresh()
  },

  switchFilter(e) {
    this.setData({ activeFilter: e.currentTarget.dataset.filter })
    this.loadActivities(true)
  },

  async loadActivities(reset = false) {
    if (this.data.loading) return
    if (!reset && this.data.noMore) return

    const page = reset ? 1 : this.data.page + 1
    this.setData({ loading: true })

    try {
      const query = { status: 'active' }
      if (this.data.activeFilter !== 'all') {
        query.type = this.data.activeFilter
      }

      const skip = (page - 1) * this.data.pageSize
      const res = await db.collection('announcements')
        .where(query)
        .orderBy('isTop', 'desc')
        .orderBy('createTime', 'desc')
        .skip(skip)
        .limit(this.data.pageSize)
        .get()

      const rawList = res.data || []

      let userId = app.globalData.userInfo?._id
      if (!userId) {
        const freshInfo = await app.refreshUserInfo()
        userId = freshInfo?._id || app.globalData.userInfo?._id
      }

      const activityIds = rawList.filter(i => i.type === 'activity').map(i => i._id)

      let mySignupSet = new Set()
      if (userId && activityIds.length > 0) {
        try {
          const signupRes = await db.collection('activity_signups')
            .where({ userId, activityId: db.command.in(activityIds) })
            .field({ activityId: true })
            .get()
          signupRes.data.forEach(s => mySignupSet.add(s.activityId))
        } catch (e) { /* ignore */ }
      }

      let list = rawList.map(item => {
        let createTimeStr = ''
        if (item.createTime) {
          const d = new Date(item.createTime)
          createTimeStr = `${d.getMonth() + 1}月${d.getDate()}日`
        }
        const hasSignup = userId && (
          mySignupSet.has(item._id) ||
          (Array.isArray(item.signups) && item.signups.includes(userId))
        )
        return { ...item, createTimeStr, hasSignup }
      })

      if (reset) {
        this.setData({ activityList: list, page: 1, noMore: list.length < this.data.pageSize })
      } else {
        this.setData({
          activityList: [...this.data.activityList, ...list],
          page,
          noMore: list.length < this.data.pageSize
        })
      }
    } catch (e) {
      console.error('加载活动失败', e)
    }

    this.setData({ loading: false })
  },

  loadMore() {
    this.loadActivities()
  },

  async handleSignup(e) {
    const activityId = e.currentTarget.dataset.id
    if (!app.globalData.isLogin) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    wx.showModal({
      title: '确认报名',
      content: '确定要报名参加这个公益活动吗？',
      confirmColor: '#2DB5A0',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '报名中...' })
          try {
            const userId = app.globalData.userInfo?._id
            const userName = app.globalData.userInfo?.nickname || '用户'
            const userRole = app.globalData.userInfo?.role || 'volunteer'

            const existRes = await db.collection('activity_signups')
              .where({ activityId, userId })
              .count()

            if (existRes.total > 0) {
              wx.hideLoading()
              const idx = this.data.activityList.findIndex(a => a._id === activityId)
              if (idx >= 0) this.setData({ [`activityList[${idx}].hasSignup`]: true })
              wx.showToast({ title: '您已报名', icon: 'success' })
              return
            }

            await db.collection('activity_signups').add({
              data: { activityId, userId, userName, userRole, createTime: db.serverDate() }
            })
            await db.collection('announcements').doc(activityId).update({
              data: { signupCount: db.command.inc(1), signups: db.command.push([userId]) }
            })

            wx.hideLoading()
            const idx = this.data.activityList.findIndex(a => a._id === activityId)
            if (idx >= 0) {
              this.setData({
                [`activityList[${idx}].hasSignup`]: true,
                [`activityList[${idx}].signupCount`]: (this.data.activityList[idx].signupCount || 0) + 1
              })
            }
            wx.showToast({ title: '报名成功', icon: 'success' })
          } catch (e) {
            wx.hideLoading()
            wx.showToast({ title: '报名失败', icon: 'none' })
          }
        }
      }
    })
  },

  goDetail(e) {
    const item = e.currentTarget.dataset.item
    wx.showModal({
      title: item.title,
      content: `${item.content || '暂无详情'}\n\n${item.type === 'activity' ? '活动时间：' + (item.activityDate || '待定') + '\n活动地点：' + (item.activityLocation || '待定') : ''}`,
      showCancel: false,
      confirmText: '知道了'
    })
  }
})
