const app = getApp()
const db = wx.cloud.database()
const _ = db.command

const STATUS_MAP = {
  pending: '待接单',
  accepted: '已接单',
  in_progress: '服务中',
  completed: '已完成',
  cancelled: '已取消'
}

const SHOP_STATUS_MAP = {
  pending_accept: '待接单',
  accepted: '待配送',
  delivering: '配送中',
  delivered: '已送达·待收款',
  completed: '已完成',
  cancelled: '已取消'
}

Page({
  data: {
    order: {},
    statusText: '',
    orderType: 'help',
    shopStatusMap: SHOP_STATUS_MAP
  },

  onLoad(options) {
    const orderType = options.type === 'shop' ? 'shop' : 'help'
    this.setData({ orderType })
    if (options.id) {
      if (orderType === 'shop') {
        this.loadShopOrder(options.id)
      } else {
        this.loadOrder(options.id)
      }
    }
  },

  async loadOrder(id) {
    try {
      const res = await db.collection('orders').doc(id).get()
      const order = res.data
      this.setData({
        order,
        statusText: STATUS_MAP[order.status] || order.status
      })
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  async loadShopOrder(id) {
    try {
      const res = await db.collection('elder_shop_orders').doc(id).get()
      const order = res.data
      this.setData({
        order,
        statusText: SHOP_STATUS_MAP[order.orderStatus] || order.orderStatus
      })
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  async handleAccept() {
    wx.showModal({
      title: '确认接单',
      content: '确定要接受这个帮扶任务吗？',
      confirmColor: '#2DB5A0',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '处理中...' })
        try {
          const orderId = this.data.order._id
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
          this.loadOrder(orderId)
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    })
  },

  async handleShopAccept() {
    wx.showModal({
      title: '确认接单',
      content: '接单后需要您购买商品并送上门，送达后向老人收取货款。',
      confirmColor: '#2DB5A0',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '处理中...' })
        try {
          const orderId = this.data.order._id
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
          this.loadShopOrder(orderId)
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '接单失败', icon: 'none' })
        }
      }
    })
  },

  async handleStartDelivery() {
    wx.showModal({
      title: '开始配送',
      content: '确认已购买商品，现在出发配送？',
      confirmColor: '#2DB5A0',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '处理中...' })
        try {
          const orderId = this.data.order._id
          await db.collection('elder_shop_orders').doc(orderId).update({
            data: {
              orderStatus: 'delivering',
              deliveryStartTime: db.serverDate(),
              updateTime: db.serverDate()
            }
          })
          wx.hideLoading()
          wx.showToast({ title: '已开始配送', icon: 'success' })
          this.loadShopOrder(orderId)
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    })
  },

  async handleDelivered() {
    wx.showModal({
      title: '确认送达',
      content: '商品已送到老人手中？接下来请当面收取货款。',
      confirmColor: '#2DB5A0',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '处理中...' })
        try {
          const orderId = this.data.order._id
          await db.collection('elder_shop_orders').doc(orderId).update({
            data: {
              orderStatus: 'delivered',
              deliveredTime: db.serverDate(),
              updateTime: db.serverDate()
            }
          })
          wx.hideLoading()
          wx.showToast({ title: '已确认送达', icon: 'success' })
          this.loadShopOrder(orderId)
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    })
  },

  async handleCollectPayment() {
    const totalAmount = this.data.order.totalAmount || 0
    wx.showModal({
      title: '确认收款',
      content: `已当面收取老人货款 ¥${totalAmount.toFixed(2)}？确认后订单完成。`,
      confirmColor: '#2DB5A0',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '处理中...' })
        try {
          const orderId = this.data.order._id
          await db.collection('elder_shop_orders').doc(orderId).update({
            data: {
              orderStatus: 'completed',
              payStatus: 'paid',
              payMethod: 'cash_on_delivery',
              payTime: db.serverDate(),
              completeTime: db.serverDate(),
              updateTime: db.serverDate()
            }
          })

          const userId = app.globalData.userInfo._id
          try {
            await db.collection('users').doc(userId).update({
              data: {
                totalServiceHours: _.inc(0.5),
                totalPoints: _.inc(5),
                availablePoints: _.inc(5),
                updateTime: db.serverDate()
              }
            })
          } catch (ue) { /* skip */ }

          wx.hideLoading()
          wx.showToast({ title: '收款完成', icon: 'success' })
          this.loadShopOrder(orderId)
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    })
  },

  async handleComplete() {
    wx.showModal({
      title: '完成服务',
      content: '确认已完成本次帮扶服务？',
      confirmColor: '#2DB5A0',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '处理中...' })
        try {
          const orderId = this.data.order._id
          const serviceHours = this.data.order.serviceHours || 1
          await db.collection('orders').doc(orderId).update({
            data: {
              status: 'completed',
              serviceHours,
              completeTime: db.serverDate(),
              updateTime: db.serverDate()
            }
          })
          const earnedPoints = Math.round(serviceHours * 10)
          const userId = app.globalData.userInfo._id
          try {
            await db.collection('users').doc(userId).update({
              data: {
                totalServiceHours: _.inc(serviceHours),
                totalPoints: _.inc(earnedPoints),
                availablePoints: _.inc(earnedPoints),
                updateTime: db.serverDate()
              }
            })
          } catch (ue) { /* skip */ }
          wx.hideLoading()
          wx.showToast({ title: '已完成', icon: 'success' })
          this.loadOrder(orderId)
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    })
  },

  async handleCheckIn() {
    wx.showLoading({ title: '签到中...' })
    try {
      const location = await this.getLocation()
      const orderId = this.data.order._id
      await db.collection('orders').doc(orderId).update({
        data: {
          status: 'in_progress',
          checkInTime: db.serverDate(),
          checkInLocation: location || null,
          updateTime: db.serverDate()
        }
      })
      await db.collection('service_records').add({
        data: {
          orderId,
          volunteerId: app.globalData.userInfo._id,
          elderId: this.data.order.elderId,
          type: 'check_in',
          location: location || null,
          createTime: db.serverDate()
        }
      })
      wx.hideLoading()
      wx.showToast({ title: '签到成功', icon: 'success' })
      this.loadOrder(orderId)
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '签到失败', icon: 'none' })
    }
  },

  async handleCheckOut() {
    wx.showModal({
      title: '签退确认',
      content: '确认完成本次服务并签退？',
      confirmColor: '#2DB5A0',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '签退中...' })
        try {
          const location = await this.getLocation()
          const orderId = this.data.order._id
          const order = this.data.order

          let serviceHours = 1
          if (order.checkInTime) {
            const diffMs = Date.now() - new Date(order.checkInTime).getTime()
            serviceHours = Math.max(0.5, Math.round(diffMs / 3600000 * 10) / 10)
          }

          await db.collection('orders').doc(orderId).update({
            data: {
              status: 'completed',
              checkOutTime: db.serverDate(),
              checkOutLocation: location || null,
              serviceHours,
              completeTime: db.serverDate(),
              updateTime: db.serverDate()
            }
          })
          await db.collection('service_records').add({
            data: {
              orderId,
              volunteerId: app.globalData.userInfo._id,
              elderId: order.elderId,
              type: 'check_out',
              serviceHours,
              location: location || null,
              createTime: db.serverDate()
            }
          })
          const earnedPoints = Math.round(serviceHours * 10)
          try {
            await db.collection('users').doc(app.globalData.userInfo._id).update({
              data: {
                totalServiceHours: _.inc(serviceHours),
                totalPoints: _.inc(earnedPoints),
                availablePoints: _.inc(earnedPoints),
                updateTime: db.serverDate()
              }
            })
          } catch (ue) { /* skip */ }

          wx.hideLoading()
          wx.showToast({ title: `签退成功，服务${serviceHours}小时`, icon: 'success' })
          this.loadOrder(orderId)
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '签退失败', icon: 'none' })
        }
      }
    })
  },

  handleReject() {
    wx.showModal({
      title: '放弃订单',
      content: '确定要放弃这个帮扶任务吗？订单将重新变为待接单状态。',
      confirmText: '确认放弃',
      confirmColor: '#E8573A',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '处理中...' })
        try {
          const orderId = this.data.order._id
          await db.collection('orders').doc(orderId).update({
            data: {
              volunteerId: '',
              volunteerName: '',
              status: 'pending',
              acceptTime: null,
              updateTime: db.serverDate()
            }
          })
          wx.hideLoading()
          wx.showToast({ title: '已放弃', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    })
  },

  handleShopReject() {
    wx.showModal({
      title: '放弃配送',
      content: '确定放弃此配送任务？订单将重新进入待接单状态。',
      confirmText: '确认放弃',
      confirmColor: '#E8573A',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '处理中...' })
        try {
          const orderId = this.data.order._id
          await db.collection('elder_shop_orders').doc(orderId).update({
            data: {
              volunteerId: '',
              volunteerName: '',
              volunteerPhone: '',
              orderStatus: 'pending_accept',
              acceptTime: null,
              updateTime: db.serverDate()
            }
          })
          wx.hideLoading()
          wx.showToast({ title: '已放弃', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    })
  },

  getLocation() {
    return new Promise((resolve) => {
      wx.getLocation({
        type: 'gcj02',
        success: (res) => resolve({ lat: res.latitude, lng: res.longitude }),
        fail: () => resolve(null)
      })
    })
  },

  goChat() {
    const order = this.data.order
    const targetId = order.elderId
    const targetName = order.elderName || '老人'
    wx.navigateTo({
      url: `/pages/common/chat/chat?targetId=${targetId}&targetName=${targetName}`
    })
  },

  callElder() {
    const phone = this.data.order.elderPhone
    if (phone) {
      wx.makePhoneCall({ phoneNumber: phone })
    } else {
      wx.showToast({ title: '暂无联系电话', icon: 'none' })
    }
  }
})
