const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    userInfo: null,
    starLevelText: '',
    totalPoints: 0,
    stats: {
      totalOrders: 0,
      totalHours: 0,
      avgRating: '--'
    },
    recordList: [],
    statsPeriod: 'month',
    periodStats: { orders: 0, hours: 0, pairCount: 0, points: 0 },
    showArchive: false,
    showInputModal: false,
    inputModalTitle: '',
    inputModalDesc: '',
    inputModalPlaceholder: '',
    inputModalValue: ''
  },

  onLoad() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 })
    }
  },

  async onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 })
    }
    const userInfo = await app.refreshUserInfo() || app.globalData.userInfo
    if (!userInfo || !userInfo._id) {
      this.setData({ userInfo: null, recordList: [], totalPoints: 0 })
      return
    }
    this.setData({
      userInfo,
      starLevelText: this.getStarLevel(userInfo?.totalServiceHours || 0)
    })
    this.loadStats()
    this.loadRecords()
    this.loadPeriodStats('month')
  },

  getStarLevel(hours) {
    if (hours >= 500) return '五星志愿者'
    if (hours >= 200) return '四星志愿者'
    if (hours >= 100) return '三星志愿者'
    if (hours >= 50) return '二星志愿者'
    return '初级志愿者'
  },

  async loadStats() {
    try {
      if (!app.globalData.userInfo || !app.globalData.userInfo._id) return
      const userId = app.globalData.userInfo._id

      const [orderRes, pairRes] = await Promise.all([
        db.collection('orders')
          .where({ volunteerId: userId, status: 'completed' })
          .get(),
        db.collection('pairs')
          .where({ volunteerId: userId, status: 'active' })
          .count()
      ])

      const records = orderRes.data
      const totalHours = records.reduce((sum, r) => sum + (r.serviceHours || 1), 0)
      const ratings = records.filter(r => r.rating).map(r => r.rating)
      const avgRating = ratings.length > 0
        ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
        : '--'

      let supplementCount = 0
      try {
        const suppRes = await db.collection('supplement_records')
          .where({ status: 'approved' })
          .count()
        supplementCount = suppRes.total || 0
      } catch (e) { /* skip */ }

      const totalOrders = records.length + supplementCount
      const totalHoursAll = totalHours + supplementCount

      const freshUser = await db.collection('users').doc(userId).get().catch(() => null)
      let totalPoints = freshUser?.data?.totalPoints || app.globalData.userInfo?.totalPoints || (totalOrders * 10 + totalHoursAll)

      this.setData({
        'stats.totalOrders': totalOrders,
        'stats.totalHours': totalHoursAll,
        'stats.avgRating': avgRating,
        totalPoints
      })
    } catch (e) {
      console.error('加载统计失败', e)
    }
  },

  async loadRecords() {
    try {
      if (!app.globalData.userInfo || !app.globalData.userInfo._id) return
      const userId = app.globalData.userInfo._id

      const orderRes = await db.collection('orders')
        .where({ volunteerId: userId, status: 'completed' })
        .orderBy('completeTime', 'desc')
        .limit(30)
        .get()

      const orderList = orderRes.data.map(item => {
        let completeDateStr = ''
        if (item.completeTime) {
          const d = new Date(item.completeTime)
          completeDateStr = `${d.getMonth() + 1}/${d.getDate()}`
        }
        return { ...item, completeDateStr, recordType: 'order' }
      })

      let supplementList = []
      try {
        const suppRes = await db.collection('supplement_records')
          .orderBy('createTime', 'desc')
          .limit(50)
          .get()
        if (suppRes.data && suppRes.data.length > 0) {
          supplementList = suppRes.data.map(item => {
            let completeDateStr = ''
            if (item.createTime) {
              const d = new Date(item.createTime)
              completeDateStr = `${d.getMonth() + 1}/${d.getDate()}`
            }
            const statusText = { pending: '待审核', approved: '已通过', rejected: '已拒绝' }
            return {
              ...item,
              recordType: 'supplement',
              title: '补充服务记录',
              completeDateStr,
              statusText: statusText[item.status] || item.status,
              elderName: '',
              category: '补充记录',
              serviceHours: 1
            }
          })
        }
      } catch (e) {
        console.error('加载补充记录失败', e)
      }

      let checkinList = []
      try {
        const checkinRes = await db.collection('service_checkins')
          .orderBy('createTime', 'desc')
          .limit(50)
          .get()
        if (checkinRes.data && checkinRes.data.length > 0) {
          checkinList = checkinRes.data.map(item => {
            let completeDateStr = ''
            if (item.createTime) {
              const d = new Date(item.createTime)
              completeDateStr = `${d.getMonth() + 1}/${d.getDate()}`
            }
            return {
              ...item,
              recordType: 'checkin',
              title: item.serviceContent || (item.type === 'arrive' ? '到达签到' : '结束签退'),
              completeDateStr,
              elderName: '结对服务',
              category: item.type === 'arrive' ? '签到' : '签退',
              serviceHours: 0
            }
          })
        }
      } catch (e) {
        console.error('加载签到记录失败', e)
      }

      const allRecords = [...orderList, ...supplementList, ...checkinList]
      allRecords.sort((a, b) => {
        const timeA = new Date(a.completeTime || a.createTime || 0)
        const timeB = new Date(b.completeTime || b.createTime || 0)
        return timeB - timeA
      })

      this.setData({ recordList: allRecords.slice(0, 50) })
    } catch (e) {
      console.error('加载服务记录失败', e)
    }
  },

  switchPeriod(e) {
    const period = e.currentTarget.dataset.period
    this.setData({ statsPeriod: period })
    this.loadPeriodStats(period)
  },

  async loadPeriodStats(period) {
    try {
      if (!app.globalData.userInfo || !app.globalData.userInfo._id) return
      const userId = app.globalData.userInfo._id
      const now = new Date()
      let startDate
      if (period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      } else {
        startDate = new Date(now.getFullYear(), 0, 1)
      }

      const res = await db.collection('orders')
        .where({
          volunteerId: userId,
          status: 'completed',
          completeTime: db.command.gte(startDate)
        })
        .get()

      const records = res.data
      const hours = records.reduce((sum, r) => sum + (r.serviceHours || 1), 0)
      const elderIds = [...new Set(records.map(r => r.elderId))]

      let supplementCount = 0
      try {
        const suppRes = await db.collection('supplement_records')
          .where({ status: 'approved' })
          .get()
        const suppList = suppRes.data || []
        supplementCount = suppList.filter(s => {
          if (!s.createTime) return false
          return new Date(s.createTime) >= startDate
        }).length
      } catch (e) { /* skip */ }

      const totalOrders = records.length + supplementCount
      const totalHours = hours + supplementCount
      const points = totalOrders * 10 + totalHours

      this.setData({
        periodStats: {
          orders: totalOrders,
          hours: Math.round(totalHours * 10) / 10,
          pairCount: elderIds.length,
          points
        }
      })
    } catch (e) {
      console.error('加载时段统计失败', e)
    }
  },

  addSupplementRecord() {
    this.setData({
      showInputModal: true,
      inputModalTitle: '补充服务记录',
      inputModalDesc: '请填写服务日期和内容，提交后由管理员审核',
      inputModalPlaceholder: '格式：日期 + 服务内容 + 时长\n例：5月20日 陪伴王奶奶 2小时',
      inputModalValue: ''
    })
  },

  onModalInput(e) {
    this.setData({ inputModalValue: e.detail.value })
  },

  cancelInputModal() {
    this.setData({ showInputModal: false, inputModalValue: '' })
  },

  async confirmInputModal() {
    const content = this.data.inputModalValue.trim()
    if (!content) {
      wx.showToast({ title: '请填写内容', icon: 'none' })
      return
    }
    this.setData({ showInputModal: false })
    wx.showLoading({ title: '提交中...' })
    try {
      const userId = app.globalData.userInfo._id
      const userName = app.globalData.userInfo.nickname || '志愿者'
      await db.collection('supplement_records').add({
        data: { userId, userName, content, status: 'pending', createTime: db.serverDate() }
      })
      wx.hideLoading()
      wx.showToast({ title: '已提交，待审核', icon: 'success' })
      this.setData({ inputModalValue: '' })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '提交失败', icon: 'none' })
    }
  },

  generateArchive() {
    this.setData({ showArchive: true })
    setTimeout(() => this.drawArchive(), 200)
  },

  closeArchive() {
    this.setData({ showArchive: false })
  },

  drawArchive() {
    const query = wx.createSelectorQuery()
    query.select('#archiveCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0]) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getWindowInfo().pixelRatio
        const w = res[0].width
        const h = res[0].height
        canvas.width = w * dpr
        canvas.height = h * dpr
        ctx.scale(dpr, dpr)
        this._archiveCanvas = canvas

        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)

        const headerH = 85
        const grad = ctx.createLinearGradient(0, 0, w, headerH)
        grad.addColorStop(0, '#43B89C')
        grad.addColorStop(1, '#2DB5A0')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, w, headerH)

        ctx.fillStyle = '#fff'
        const titleSize = Math.min(16, w * 0.052)
        ctx.font = `bold ${titleSize}px sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText('青老代际智能融合平台', w / 2, 30)
        ctx.font = `${titleSize * 0.75}px sans-serif`
        ctx.fillText('志愿者服务档案', w / 2, 52)

        const now = new Date()
        const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
        ctx.font = '10px sans-serif'
        ctx.fillText(`生成日期：${dateStr}`, w / 2, 70)

        ctx.textAlign = 'left'
        let y = headerH + 20

        ctx.fillStyle = '#333'
        ctx.font = 'bold 15px sans-serif'
        ctx.fillText('志愿者信息', 20, y)
        y += 28

        ctx.fillStyle = '#666'
        ctx.font = '13px sans-serif'
        const info = this.data.userInfo || {}
        ctx.fillText(`姓名：${info.nickname || '志愿者'}`, 20, y); y += 22
        ctx.fillText(`等级：${this.data.starLevelText}`, 20, y); y += 22
        ctx.fillText(`心火积分：${this.data.totalPoints} 分`, 20, y); y += 32

        ctx.fillStyle = '#eee'
        ctx.fillRect(20, y, w - 40, 1); y += 16

        ctx.fillStyle = '#333'
        ctx.font = 'bold 15px sans-serif'
        ctx.fillText('服务统计', 20, y); y += 28

        ctx.fillStyle = '#666'
        ctx.font = '13px sans-serif'
        ctx.fillText(`完成任务：${this.data.stats.totalOrders} 次`, 20, y); y += 22
        ctx.fillText(`服务时长：${this.data.stats.totalHours} 小时`, 20, y); y += 22
        ctx.fillText(`平均评分：${this.data.stats.avgRating}`, 20, y); y += 32

        ctx.fillStyle = '#eee'
        ctx.fillRect(20, y, w - 40, 1); y += 16

        ctx.fillStyle = '#333'
        ctx.font = 'bold 15px sans-serif'
        ctx.fillText('近期服务记录', 20, y); y += 26

        ctx.font = '12px sans-serif'
        const records = this.data.recordList.slice(0, 8)
        if (records.length === 0) {
          ctx.fillStyle = '#999'
          ctx.fillText('暂无服务记录', 20, y)
        } else {
          records.forEach(r => {
            ctx.fillStyle = '#333'
            ctx.fillText(`${r.completeDateStr || '-'}  ${r.title || '帮扶任务'}`, 20, y)
            ctx.fillStyle = '#2DB5A0'
            ctx.fillText(`${r.serviceHours || 1}h`, w - 60, y)
            y += 20
          })
        }

        y += 20
        ctx.fillStyle = '#ccc'
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('本档案由「青老代际智能融合平台」小程序自动生成', w / 2, y)
      })
  },

  async saveArchive() {
    if (!this._archiveCanvas) {
      wx.showToast({ title: '请先生成档案', icon: 'none' })
      return
    }

    try {
      const res = await wx.canvasToTempFilePath({
        canvas: this._archiveCanvas,
        fileType: 'png'
      })
      await wx.saveImageToPhotosAlbum({ filePath: res.tempFilePath })
      wx.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (e) {
      if (e.errMsg && e.errMsg.includes('auth deny')) {
        wx.showToast({ title: '请授权保存图片权限', icon: 'none' })
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' })
      }
    }
  }
})
