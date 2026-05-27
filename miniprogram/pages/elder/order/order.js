const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    mainTab: 'help',
    currentTab: 'all',
    orderList: [],
    statusMap: {
      pending: '待接单',
      accepted: '已接单',
      in_progress: '进行中',
      completed: '已完成',
      cancelled: '已取消'
    },
    shopStatusMap: {
      pending_accept: '等待志愿者接单',
      accepted: '志愿者已接单',
      delivering: '配送中',
      delivered: '已送达·待付款',
      completed: '已完成',
      cancelled: '已取消'
    },
    categoryMap: {
      shopping: '生活代购',
      companion: '上门陪伴',
      housework: '家务帮忙',
      medical: '就医陪同',
      chat: '日常聊天',
      other: '其他需求'
    }
  },

  onLoad() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    this.loadOrders()
  },

  switchMainTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ mainTab: tab, currentTab: 'all', orderList: [] })
    this.loadOrders()
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ currentTab: tab })
    this.loadOrders()
  },

  async loadOrders() {
    if (this.data.mainTab === 'shop') {
      return this.loadShopOrders()
    }
    try {
      const userId = app.globalData.userInfo._id
      const query = { elderId: userId }
      if (this.data.currentTab !== 'all') {
        query.status = this.data.currentTab
      }
      const res = await db.collection('orders')
        .where(query)
        .orderBy('createTime', 'desc')
        .limit(20)
        .get()
      this.setData({ orderList: res.data })
    } catch (e) {
      console.error('加载订单失败', e)
    }
  },

  async loadShopOrders() {
    try {
      const userId = app.globalData.userInfo._id
      const query = { elderId: userId }
      if (this.data.currentTab !== 'all') {
        query.orderStatus = this.data.currentTab
      }
      const res = await db.collection('elder_shop_orders')
        .where(query)
        .orderBy('createTime', 'desc')
        .limit(20)
        .get()
      this.setData({ orderList: res.data })
    } catch (e) {
      console.error('加载商城订单失败', e)
    }
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/elder/order-detail/order-detail?id=${id}` })
  },

  goShopDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/elder/order-detail/order-detail?id=${id}&type=shop` })
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/elder/order-create/order-create' })
  },

  goShop() {
    wx.navigateTo({ url: '/pages/elder/shop/shop' })
  }
})
