const app = getApp()
const db = wx.cloud.database()
const _ = db.command

Page({
  data: { historyList: [] },
  onLoad() { this.loadHistory() },
  async loadHistory() {
    try {
      const userId = app.globalData.userInfo?._id
      const openid = app.globalData.userInfo?.openid
      if (!userId) return
      const queryConditions = [{ userId }]
      if (openid) queryConditions.push({ openid })
      const res = await db.collection('points_log')
        .where(_.or(queryConditions))
        .orderBy('createTime', 'desc')
        .limit(100)
        .get()
      const list = (res.data || []).map(r => {
        if (r.createTime) {
          const d = new Date(r.createTime)
          r.createTimeStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
        } else {
          r.createTimeStr = '--'
        }
        return r
      })
      this.setData({ historyList: list })
    } catch (e) {
      console.error('加载积分明细失败', e)
    }
  }
})
