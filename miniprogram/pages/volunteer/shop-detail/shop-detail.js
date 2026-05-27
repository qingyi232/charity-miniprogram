const app = getApp()
const db = wx.cloud.database()
const _ = db.command

Page({
  data: {
    goods: null,
    myPoints: 0,
    canExchange: false,
    exchanging: false,
    loading: true
  },

  onLoad(options) {
    if (options.id) {
      this.goodsId = options.id
      this.loadDetail()
      this.loadMyPoints()
    }
  },

  async loadDetail() {
    try {
      const res = await db.collection('shop_goods').doc(this.goodsId).get()
      this.setData({ goods: res.data })
      this.checkCanExchange()
    } catch (e) {
      console.error('加载商品详情失败', e)
    } finally {
      this.setData({ loading: false })
    }
  },

  async loadMyPoints() {
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

      const user = userRes?.data || userInfo
      const orderHours = orderRes.data.reduce((sum, r) => sum + (r.serviceHours || 1), 0)
      const suppCount = suppRes.total || 0
      const totalPoints = user.totalPoints || ((orderRes.data.length + suppCount) * 10 + (orderHours + suppCount))
      const usedPoints = user.usedPoints || 0

      this.setData({ myPoints: totalPoints - usedPoints })
      this.checkCanExchange()
    } catch (e) {
      console.error('加载积分失败', e)
    }
  },

  checkCanExchange() {
    const { goods, myPoints } = this.data
    if (!goods) return
    const can = goods.stock > 0 && myPoints >= goods.pointsPrice
    this.setData({ canExchange: can })
  },

  async handleExchange() {
    const { goods } = this.data
    if (!goods || this.data.exchanging) return

    const confirmRes = await new Promise(resolve => {
      wx.showModal({
        title: '确认兑换',
        content: `确定使用 ${goods.pointsPrice} 积分兑换「${goods.name}」？`,
        confirmText: '确认兑换',
        confirmColor: '#FF6B35',
        success: resolve
      })
    })

    if (!confirmRes.confirm) return

    this.setData({ exchanging: true })
    wx.showLoading({ title: '兑换中...' })

    try {
      const userId = app.globalData.userInfo._id
      const cost = goods.pointsPrice

      await db.collection('users').doc(userId).update({
        data: {
          availablePoints: _.inc(-cost),
          usedPoints: _.inc(cost),
          updateTime: db.serverDate()
        }
      })
      await db.collection('shop_goods').doc(this.goodsId).update({
        data: { stock: _.inc(-1) }
      })
      await db.collection('exchange_records').add({
        data: {
          userId,
          goodsId: this.goodsId,
          goodsName: goods.name,
          pointsCost: cost,
          quantity: 1,
          status: 'success',
          createTime: db.serverDate()
        }
      })
      await db.collection('points_log').add({
        data: {
          userId,
          type: 'spend',
          amount: -cost,
          reason: `兑换：${goods.name}`,
          createTime: db.serverDate()
        }
      })

      wx.hideLoading()
      wx.showToast({ title: '兑换成功', icon: 'success' })
      this.loadDetail()
      this.loadMyPoints()
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '兑换失败', icon: 'none' })
    } finally {
      this.setData({ exchanging: false })
    }
  }
})
