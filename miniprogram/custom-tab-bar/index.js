const app = getApp()

Component({
  data: {
    selected: 0,
    role: 'elder',
    elderTabs: [
      { pagePath: '/pages/elder/index/index', text: '首页', icon: '/static/icons/home.svg' },
      { pagePath: '/pages/elder/order/order', text: '我的订单', icon: '/static/icons/clipboard.svg' },
      { pagePath: '/pages/elder/message/message', text: '消息', icon: '/static/icons/chat.svg' },
      { pagePath: '/pages/elder/mine/mine', text: '我的', icon: '/static/icons/user.svg' }
    ],
    volunteerTabs: [
      { pagePath: '/pages/volunteer/index/index', text: '首页', icon: '/static/icons/home.svg' },
      { pagePath: '/pages/volunteer/order/order', text: '任务广场', icon: '/static/icons/clipboard.svg' },
      { pagePath: '/pages/volunteer/pair/pair', text: '我的结对', icon: '/static/icons/handshake.svg' },
      { pagePath: '/pages/volunteer/service/service', text: '服务记录', icon: '/static/icons/chart.svg' },
      { pagePath: '/pages/volunteer/training/training', text: '培训支持', icon: '/static/icons/book.svg' },
      { pagePath: '/pages/volunteer/mine/mine', text: '个人中心', icon: '/static/icons/user.svg' }
    ]
  },

  attached() {
    this.setData({ role: app.globalData.role || 'elder' })
  },

  methods: {
    switchTab(e) {
      const index = e.currentTarget.dataset.index
      const tabs = this.data.role === 'elder' ? this.data.elderTabs : this.data.volunteerTabs
      const tab = tabs[index]
      if (!tab) return
      wx.switchTab({ url: tab.pagePath })
    }
  }
})
