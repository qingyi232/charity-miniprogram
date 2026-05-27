const app = getApp()
const db = wx.cloud.database()

const SHOP_STATUS_MAP = {
  pending_accept: '待接单',
  accepted: '待配送',
  delivering: '配送中',
  delivered: '已送达',
  completed: '已完成',
  cancelled: '已取消'
}

Page({
  data: {
    currentTab: 'pending',
    sortBy: 'time',
    orderList: [],
    myLocation: null,
    shopStatusMap: SHOP_STATUS_MAP
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    this.getMyLocation()
    this.loadOrders()
  },

  getMyLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          myLocation: { lat: res.latitude, lng: res.longitude }
        })
        if (this.data.sortBy === 'distance' && this.data.orderList.length > 0) {
          this.sortByDistance()
        }
      },
      fail: () => {
        console.log('未获取位置，距离排序不可用')
      }
    })
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ currentTab: tab })
    this.loadOrders()
  },

  switchSort(e) {
    const sort = e.currentTarget.dataset.sort
    this.setData({ sortBy: sort })
    if (sort === 'distance') {
      if (!this.data.myLocation) {
        wx.showToast({ title: '请授权位置信息', icon: 'none' })
        this.getMyLocation()
        return
      }
      this.sortByDistance()
    } else {
      this.loadOrders()
    }
  },

  calcDistance(lat1, lng1, lat2, lng2) {
    if (!lat1 || !lng1 || !lat2 || !lng2) return 99999
    const rad = Math.PI / 180
    const a = Math.sin((lat2 - lat1) * rad / 2)
    const b = Math.sin((lng2 - lng1) * rad / 2)
    const s = 2 * Math.asin(Math.sqrt(a * a + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * b * b))
    return Math.round(s * 6371 * 10) / 10
  },

  sortByDistance() {
    const { myLocation, orderList } = this.data
    if (!myLocation) return

    const sorted = orderList.map(item => {
      let dist = 99999
      if (item.location && item.location.lat && item.location.lng) {
        dist = this.calcDistance(myLocation.lat, myLocation.lng, item.location.lat, item.location.lng)
      }
      return { ...item, distance: dist }
    }).sort((a, b) => a.distance - b.distance)

    this.setData({ orderList: sorted })
  },

  formatDistance(km) {
    if (km >= 99999) return ''
    if (km < 1) return Math.round(km * 1000) + 'm'
    return km.toFixed(1) + 'km'
  },

  async loadOrders() {
    const isShopTab = this.data.currentTab.startsWith('shop')
    if (isShopTab) {
      return this.loadShopOrders()
    }

    try {
      const userId = app.globalData.userInfo._id
      let query = {}
      if (this.data.currentTab === 'pending') {
        query = { status: 'pending' }
      } else if (this.data.currentTab === 'mine') {
        query = { volunteerId: userId, status: db.command.in(['accepted', 'in_progress']) }
      } else {
        query = { volunteerId: userId, status: 'completed' }
      }
      const res = await db.collection('orders')
        .where(query)
        .orderBy('createTime', 'desc')
        .limit(20)
        .get()

      const list = res.data.map(item => {
        let dist = 99999
        if (this.data.myLocation && item.location && item.location.lat) {
          dist = this.calcDistance(
            this.data.myLocation.lat, this.data.myLocation.lng,
            item.location.lat, item.location.lng
          )
        }
        return { ...item, distance: dist, distanceText: this.formatDistance(dist) }
      })

      if (this.data.sortBy === 'distance') {
        list.sort((a, b) => a.distance - b.distance)
      }

      this.setData({ orderList: list })
    } catch (e) {
      console.error('加载订单失败', e)
    }
  },

  async loadShopOrders() {
    try {
      const userId = app.globalData.userInfo._id
      let query = {}
      if (this.data.currentTab === 'shop_pending') {
        query = { orderStatus: 'pending_accept' }
      } else if (this.data.currentTab === 'shop_mine') {
        query = { volunteerId: userId, orderStatus: db.command.in(['accepted', 'delivering']) }
      } else {
        query = { volunteerId: userId, orderStatus: db.command.in(['delivered', 'completed']) }
      }
      const res = await db.collection('elder_shop_orders')
        .where(query)
        .orderBy('createTime', 'desc')
        .limit(20)
        .get()

      this.setData({ orderList: res.data || [] })
    } catch (e) {
      console.error('加载代购订单失败', e)
    }
  },

  async handleAccept(e) {
    const orderId = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认接单',
      content: '确定要接受这个帮扶任务吗？',
      confirmColor: '#4A90D9',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' })
          try {
            const orderRes = await db.collection('orders').doc(orderId).get()
            if (orderRes.data.status !== 'pending') {
              wx.hideLoading()
              wx.showToast({ title: '订单已被接单', icon: 'none' })
              return
            }
            const volunteer = app.globalData.userInfo
            await db.collection('orders').doc(orderId).update({
              data: {
                volunteerId: volunteer._id,
                volunteerName: volunteer.nickname || '志愿者',
                volunteerAvatar: volunteer.avatar || '',
                volunteerPhone: volunteer.phone || '',
                status: 'accepted',
                acceptTime: db.serverDate(),
                updateTime: db.serverDate()
              }
            })
            wx.hideLoading()
            wx.showToast({ title: '接单成功', icon: 'success' })
            this.loadOrders()
          } catch (e) {
            wx.hideLoading()
            wx.showToast({ title: '接单失败', icon: 'none' })
          }
        }
      }
    })
  },

  async handleShopAccept(e) {
    const orderId = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认接单',
      content: '接单后需要您购买商品并送上门，送达后向老人收取货款。',
      confirmColor: '#4A90D9',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' })
          try {
            const orderRes = await db.collection('elder_shop_orders').doc(orderId).get()
            if (orderRes.data.orderStatus !== 'pending_accept') {
              wx.hideLoading()
              wx.showToast({ title: '订单已被接单', icon: 'none' })
              return
            }
            const volunteer = app.globalData.userInfo
            await db.collection('elder_shop_orders').doc(orderId).update({
              data: {
                volunteerId: volunteer._id,
                volunteerName: volunteer.nickname || '志愿者',
                volunteerPhone: volunteer.phone || '',
                orderStatus: 'accepted',
                acceptTime: db.serverDate(),
                updateTime: db.serverDate()
              }
            })
            wx.hideLoading()
            wx.showToast({ title: '接单成功', icon: 'success' })
            this.loadShopOrders()
          } catch (e) {
            wx.hideLoading()
            wx.showToast({ title: '接单失败', icon: 'none' })
          }
        }
      }
    })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/volunteer/order-detail/order-detail?id=${id}` })
  },

  goShopDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/volunteer/order-detail/order-detail?id=${id}&type=shop` })
  }
})
