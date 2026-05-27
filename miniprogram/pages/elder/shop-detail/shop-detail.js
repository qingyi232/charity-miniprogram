const CATEGORY_MAP = {
  grain_oil: '粮油米面',
  daily: '日用百货',
  food: '食品饮料',
  health_care: '保健用品',
  other: '其他'
}

Page({
  data: {
    goods: null,
    categoryText: '',
    loading: false,
    showPanel: false,
    quantity: 1,
    totalPrice: '0.00',
    showPay: false,
    payStep: '',
    payError: ''
  },

  onLoad(options) {
    if (options.id) this.loadDetail(options.id)
  },

  async loadDetail(id) {
    this.setData({ loading: true })
    try {
      const db = wx.cloud.database()
      const res = await db.collection('elder_shop_goods').doc(id).get()
      const goods = res.data
      this.setData({
        goods,
        categoryText: CATEGORY_MAP[goods.category] || goods.category || '其他',
        totalPrice: (goods.price || 0).toFixed(2)
      })
    } catch (e) {
      console.error('loadDetail error', e)
      this.setData({ goods: null })
    }
    this.setData({ loading: false })
  },

  contactService() {
    wx.showModal({
      title: '联系社区',
      content: '如需帮助，请联系您的结对志愿者或社区服务中心。',
      showCancel: false
    })
  },

  showOrderPanel() {
    if (!this.data.goods || this.data.goods.stock <= 0) return
    this.setData({
      showPanel: true,
      quantity: 1,
      totalPrice: (this.data.goods.price || 0).toFixed(2)
    })
  },

  hideOrderPanel() {
    this.setData({ showPanel: false })
  },

  updateTotal() {
    const price = this.data.goods ? this.data.goods.price : 0
    this.setData({
      totalPrice: (price * this.data.quantity).toFixed(2)
    })
  },

  increaseQty() {
    const max = this.data.goods ? this.data.goods.stock : 1
    if (this.data.quantity >= max) {
      wx.showToast({ title: '超出库存', icon: 'none' })
      return
    }
    this.setData({ quantity: this.data.quantity + 1 })
    this.updateTotal()
  },

  decreaseQty() {
    if (this.data.quantity <= 1) return
    this.setData({ quantity: this.data.quantity - 1 })
    this.updateTotal()
  },

  async confirmOrder() {
    const { goods, quantity, totalPrice } = this.data
    if (!goods) return

    const app = getApp()
    const userInfo = app.globalData.userInfo || {}

    this.setData({ showPanel: false, showPay: true, payStep: 'paying' })

    try {
      const db = wx.cloud.database()

      const freshRes = await db.collection('elder_shop_goods').doc(goods._id).get()
      const freshGoods = freshRes.data
      if (!freshGoods || freshGoods.status !== 'active') {
        this.setData({ payStep: 'fail', payError: '商品已下架' })
        return
      }
      if (freshGoods.stock < quantity) {
        this.setData({ payStep: 'fail', payError: `库存不足，当前库存${freshGoods.stock}件` })
        return
      }

      const orderNo = 'ES' + Date.now() + Math.random().toString(36).substr(2, 4).toUpperCase()

      await new Promise(resolve => setTimeout(resolve, 1500))

      await db.collection('elder_shop_orders').add({
        data: {
          orderNo,
          goodsId: goods._id,
          goodsName: goods.name,
          goodsImage: goods.image || '',
          price: goods.price,
          spec: goods.spec || '',
          quantity,
          totalAmount: parseFloat(totalPrice),
          payMethod: 'cash_on_delivery',
          payStatus: 'unpaid',
          orderStatus: 'pending_accept',
          elderId: userInfo._id || '',
          elderName: userInfo.nickname || userInfo.name || '老人',
          elderPhone: userInfo.phone || '',
          elderAddress: userInfo.address || '',
          elderAvatar: userInfo.avatar || '',
          volunteerId: '',
          volunteerName: '',
          createTime: db.serverDate()
        }
      })

      const _ = db.command
      await db.collection('elder_shop_goods').doc(goods._id).update({
        data: {
          stock: _.inc(-quantity),
          salesCount: _.inc(quantity)
        }
      })

      this.setData({
        payStep: 'success',
        'goods.stock': freshGoods.stock - quantity
      })

    } catch (e) {
      console.error('order error', e)
      this.setData({ payStep: 'fail', payError: '下单失败，请重试' })
    }
  },

  retryPay() {
    this.setData({ showPay: false })
    this.showOrderPanel()
  },

  closePay() {
    this.setData({ showPay: false, payStep: '' })
  },

  continueShopping() {
    this.setData({ showPay: false, payStep: '' })
    wx.navigateBack()
  },

  viewOrders() {
    this.setData({ showPay: false, payStep: '' })
    wx.navigateTo({ url: '/pages/elder/order/order' })
  }
})
