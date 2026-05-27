const db = wx.cloud.database()

Page({
  data: { rankList: [] },
  onLoad() { this.loadRanking() },
  async loadRanking() {
    try {
      const res = await db.collection('users')
        .where({ role: 'volunteer' })
        .orderBy('totalPoints', 'desc')
        .limit(50)
        .get()
      const list = (res.data || []).map(user => ({
        ...user,
        totalPoints: user.totalPoints || 0,
        totalServiceHours: user.totalServiceHours || 0
      }))
      this.setData({ rankList: list })
    } catch (e) {
      console.error('加载排行榜失败', e)
    }
  }
})
