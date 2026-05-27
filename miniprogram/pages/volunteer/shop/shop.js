const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    pointsInfo: {},
    goodsList: [],
    currentCategory: '',
    loading: false
  },

  onLoad() {
    this.loadPoints()
    this.loadGoods()
  },

  onShow() {
    this.loadPoints()
  },

  onPullDownRefresh() {
    Promise.all([this.loadPoints(), this.loadGoods()]).finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  async loadPoints() {
    try {
      const userInfo = app.globalData.userInfo
      if (!userInfo || !userInfo._id) return

      const [orderRes, suppRes, userRes] = await Promise.all([
        db.collection('orders')
          .where({ volunteerId: userInfo._id, status: 'completed' })
          .get().catch(() => ({ data: [] })),
        db.collection('supplement_records')
          .where({ status: 'approved' })
          .count().catch(() => ({ total: 0 })),
        db.collection('users').doc(userInfo._id).get().catch(() => null)
      ])

      const orderHours = orderRes.data.reduce((sum, r) => sum + (r.serviceHours || 1), 0)
      const suppCount = suppRes.total || 0
      const totalHours = orderHours + suppCount
      const user = userRes?.data || userInfo
      const totalPoints = user.totalPoints || ((orderRes.data.length + suppCount) * 10 + totalHours)
      const usedPoints = user.usedPoints || 0

      this.setData({
        pointsInfo: {
          totalPoints,
          availablePoints: totalPoints - usedPoints,
          usedPoints,
          totalServiceHours: totalHours
        }
      })
    } catch (e) {
      console.error('加载积分失败', e)
    }
  },

  async loadGoods() {
    this.setData({ loading: true })
    try {
      const query = { status: 'active' }
      if (this.data.currentCategory) {
        query.category = this.data.currentCategory
      }
      const res = await db.collection('shop_goods')
        .where(query)
        .orderBy('sortOrder', 'asc')
        .limit(50)
        .get()
      this.setData({ goodsList: res.data || [] })
    } catch (e) {
      console.error('加载商品失败', e)
    } finally {
      this.setData({ loading: false })
    }
  },

  switchCategory(e) {
    const cat = e.currentTarget.dataset.cat
    this.setData({ currentCategory: cat })
    this.loadGoods()
  },

  goGoodsDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/volunteer/shop-detail/shop-detail?id=${id}` })
  },

  goPointsHistory() {
    wx.navigateTo({ url: '/pages/volunteer/points-history/points-history' })
  },

  goRanking() {
    wx.navigateTo({ url: '/pages/volunteer/points-ranking/points-ranking' })
  },

  goExchangeRecords() {
    wx.navigateTo({ url: '/pages/volunteer/exchange-records/exchange-records' })
  },

  goPointsRules() {
    wx.showModal({
      title: '心火积分规则',
      content: '1. 服务1小时获得10积分\n2. 紧急服务额外奖励5积分\n3. 获得五星评价奖励3积分\n4. 积分可兑换公益证书、纪念品等\n5. 积分不可转让',
      showCancel: false,
      confirmText: '我知道了'
    })
  }
})
