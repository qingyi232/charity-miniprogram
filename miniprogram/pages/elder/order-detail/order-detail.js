const app = getApp()
const db = wx.cloud.database()

const SHOP_STATUS_MAP = {
  pending_accept: '等待志愿者接单',
  accepted: '志愿者已接单，准备配送',
  delivering: '志愿者正在配送中',
  delivered: '商品已送达，请当面付款',
  completed: '订单已完成',
  cancelled: '订单已取消'
}

Page({
  data: {
    order: {},
    volunteerInfo: {},
    orderType: 'help',
    statusText: '',
    statusDesc: '',
    statusIcon: 'clock.svg',
    acceptTimeStr: '',
    checkInTimeStr: '',
    checkOutTimeStr: '',
    rateValue: 0,
    rateComment: '',
    rateTexts: ['很差', '较差', '一般', '满意', '非常满意'],
    shopStatusMap: SHOP_STATUS_MAP
  },

  onLoad(options) {
    const orderType = options.type === 'shop' ? 'shop' : 'help'
    this.setData({ orderType })
    if (options.id) {
      this.orderId = options.id
      if (orderType === 'shop') {
        this.loadShopOrder()
      } else {
        this.loadOrder()
      }
    }
  },

  onShow() {
    if (this.orderId) {
      if (this.data.orderType === 'shop') {
        this.loadShopOrder()
      } else {
        this.loadOrder()
      }
    }
  },

  async loadOrder() {
    wx.showLoading({ title: '加载中...' })
    try {
      const res = await db.collection('orders').doc(this.orderId).get()
      wx.hideLoading()
      const order = res.data
      this.setData({
        order,
        ...this.getStatusInfo(order.status),
        acceptTimeStr: this.formatTime(order.acceptTime),
        checkInTimeStr: this.formatTime(order.checkInTime),
        checkOutTimeStr: this.formatTime(order.checkOutTime)
      })
      if (order.volunteerId) this.loadVolunteerInfo(order.volunteerId)
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  async loadShopOrder() {
    wx.showLoading({ title: '加载中...' })
    try {
      const res = await db.collection('elder_shop_orders').doc(this.orderId).get()
      wx.hideLoading()
      const order = res.data
      this.setData({
        order,
        statusText: SHOP_STATUS_MAP[order.orderStatus] || order.orderStatus,
        statusDesc: SHOP_STATUS_MAP[order.orderStatus] || ''
      })
      if (order.volunteerId) this.loadVolunteerInfo(order.volunteerId)
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  async loadVolunteerInfo(volunteerId) {
    try {
      const res = await db.collection('users').doc(volunteerId).get()
      if (res.data) {
        this.setData({ volunteerInfo: res.data })
      }
    } catch (e) {
      console.error('加载志愿者信息失败', e)
    }
  },

  getStatusInfo(status) {
    const map = {
      pending: { statusText: '等待接单', statusDesc: '您的需求已发布，等待志愿者接单', statusIcon: 'clock.svg' },
      accepted: { statusText: '志愿者已接单', statusDesc: '志愿者已接受您的需求，即将为您服务', statusIcon: 'check.svg' },
      in_progress: { statusText: '服务进行中', statusDesc: '志愿者正在为您提供服务', statusIcon: 'heartbeat.svg' },
      completed: { statusText: '服务已完成', statusDesc: '本次服务已完成', statusIcon: 'check.svg' },
      cancelled: { statusText: '订单已取消', statusDesc: '该订单已被取消', statusIcon: 'info.svg' }
    }
    return map[status] || map.pending
  },

  callVolunteer() {
    const phone = this.data.volunteerInfo.phone
    if (phone) {
      wx.makePhoneCall({ phoneNumber: phone })
    } else {
      wx.showToast({ title: '暂无联系电话', icon: 'none' })
    }
  },

  goChat() {
    const v = this.data.order
    wx.navigateTo({
      url: `/pages/common/chat/chat?targetId=${v.volunteerId}&targetName=${v.volunteerName || '志愿者'}`
    })
  },

  setRate(e) {
    this.setData({ rateValue: e.currentTarget.dataset.value })
  },

  onCommentInput(e) {
    this.setData({ rateComment: e.detail.value })
  },

  async submitRate() {
    if (this.data.rateValue === 0) {
      wx.showToast({ title: '请先评分', icon: 'none' })
      return
    }
    wx.showLoading({ title: '提交中...' })
    try {
      await db.collection('orders').doc(this.orderId).update({
        data: {
          rating: this.data.rateValue,
          comment: this.data.rateComment || '',
          updateTime: db.serverDate()
        }
      })
      wx.hideLoading()
      wx.showToast({ title: '评价成功', icon: 'success' })
      this.loadOrder()
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '评价失败', icon: 'none' })
    }
  },

  handleCancel() {
    wx.showModal({
      title: '取消订单',
      content: '确定要取消这个订单吗？',
      confirmText: '确认取消',
      confirmColor: '#E8573A',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' })
          try {
            await db.collection('orders').doc(this.orderId).update({
              data: { status: 'cancelled', updateTime: db.serverDate() }
            })
            wx.hideLoading()
            wx.showToast({ title: '订单已取消', icon: 'success' })
            this.loadOrder()
          } catch (e) {
            wx.hideLoading()
            wx.showToast({ title: '取消失败', icon: 'none' })
          }
        }
      }
    })
  },

  handleShopCancel() {
    wx.showModal({
      title: '取消订单',
      content: '确定要取消这个商城订单吗？',
      confirmText: '确认取消',
      confirmColor: '#E8573A',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' })
          try {
            await db.collection('elder_shop_orders').doc(this.orderId).update({
              data: {
                orderStatus: 'cancelled',
                updateTime: db.serverDate()
              }
            })
            const order = this.data.order
            if (order.goodsId && order.quantity) {
              const _ = db.command
              try {
                await db.collection('elder_shop_goods').doc(order.goodsId).update({
                  data: {
                    stock: _.inc(order.quantity),
                    salesCount: _.inc(-order.quantity)
                  }
                })
              } catch (e) { /* skip */ }
            }
            wx.hideLoading()
            wx.showToast({ title: '订单已取消', icon: 'success' })
            this.loadShopOrder()
          } catch (e) {
            wx.hideLoading()
            wx.showToast({ title: '取消失败', icon: 'none' })
          }
        }
      }
    })
  },

  formatTime(time) {
    if (!time) return '--'
    const d = new Date(time)
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
})
