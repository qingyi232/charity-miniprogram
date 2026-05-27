const app = getApp()
const db = wx.cloud.database()
const _ = db.command

Page({
  data: {
    messageList: [],
    sosMessages: [],
    systemMessages: []
  },

  onLoad() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    this.loadChatList()
    this.loadSOSMessages()
    this.loadSystemMessages()
  },

  async loadChatList() {
    try {
      const userId = app.globalData.userInfo._id
      const res = await db.collection('messages')
        .where(_.or([
          { fromUserId: userId, type: 'chat' },
          { toUserId: userId, type: 'chat' }
        ]))
        .orderBy('createTime', 'desc')
        .limit(100)
        .get()

      const chatMap = {}
      for (const msg of res.data) {
        const otherId = msg.fromUserId === userId ? msg.toUserId : msg.fromUserId
        const otherName = msg.fromUserId === userId ? (msg.toUserName || '用户') : (msg.fromUserName || '用户')
        const otherAvatar = msg.fromUserId === userId ? '' : (msg.fromUserAvatar || '')

        if (!chatMap[otherId]) {
          chatMap[otherId] = {
            targetId: otherId,
            name: otherName,
            avatar: otherAvatar,
            lastMessage: msg.content,
            lastTime: msg.createTime,
            timeStr: this.formatTime(msg.createTime),
            unread: 0
          }
        }
        if (msg.toUserId === userId && !msg.read) {
          chatMap[otherId].unread++
        }
      }

      const messageList = Object.values(chatMap).sort((a, b) => {
        const ta = new Date(a.lastTime || 0).getTime()
        const tb = new Date(b.lastTime || 0).getTime()
        return tb - ta
      })

      this.setData({ messageList })
    } catch (e) {
      console.error('加载消息列表失败', e)
    }
  },

  async loadSOSMessages() {
    try {
      const userId = app.globalData.userInfo._id
      const res = await db.collection('messages')
        .where({ toUserId: userId, type: 'sos', read: false })
        .orderBy('createTime', 'desc')
        .limit(5)
        .get()

      const sosMessages = res.data.map(item => ({
        ...item,
        timeStr: this.formatTime(item.createTime)
      }))
      this.setData({ sosMessages })
    } catch (e) {
      console.error('加载SOS消息失败', e)
    }
  },

  async loadSystemMessages() {
    try {
      const userId = app.globalData.userInfo._id
      const res = await db.collection('messages')
        .where({
          toUserId: userId,
          type: _.in(['system', 'health_alert'])
        })
        .orderBy('createTime', 'desc')
        .limit(10)
        .get()

      const systemMessages = res.data.map(item => ({
        ...item,
        timeStr: this.formatTime(item.createTime)
      }))
      this.setData({ systemMessages })
    } catch (e) {
      console.error('加载系统消息失败', e)
    }
  },

  goChat(e) {
    const item = e.currentTarget.dataset.item
    wx.navigateTo({
      url: `/pages/common/chat/chat?targetId=${item.targetId}&targetName=${item.name}`
    })
  },

  formatTime(time) {
    if (!time) return ''
    const d = new Date(time)
    const now = new Date()
    const diff = now - d
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    return `${d.getMonth() + 1}/${d.getDate()}`
  }
})
