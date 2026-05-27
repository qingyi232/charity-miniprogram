const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    records: [],
    statusMap: { pending: '待发放', shipped: '已发出', completed: '已完成', success: '兑换成功' }
  },
  onLoad() { this.loadRecords() },
  async loadRecords() {
    try {
      const userId = app.globalData.userInfo?._id
      if (!userId) return
      const res = await db.collection('exchange_records')
        .where({ userId })
        .orderBy('createTime', 'desc')
        .limit(50)
        .get()
      const records = (res.data || []).map(r => {
        if (r.createTime) {
          const d = new Date(r.createTime)
          r.createTimeStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
        } else {
          r.createTimeStr = '--'
        }
        return r
      })
      this.setData({ records })
    } catch (e) {
      console.error('加载兑换记录失败', e)
    }
  }
})
