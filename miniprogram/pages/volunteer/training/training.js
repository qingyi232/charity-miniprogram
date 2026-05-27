Page({
  data: {
    currentTab: 'course',
    caseKeyword: '',
    requiredCourses: [],
    optionalCourses: [],
    templateGroups: [],
    expertList: [],
    caseList: []
  },

  onLoad() {
    this.loadTrainingContent()
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 })
    }
  },

  async loadTrainingContent() {
    let all = []
    try {
      const db = wx.cloud.database()
      const res = await db.collection('training_content')
        .where({ status: 'active' })
        .orderBy('sortOrder', 'asc')
        .limit(100)
        .get()
      all = res.data || []
    } catch (e) { /* skip */ }

    const templates = all.filter(d => d.type === 'template')
    const groupMap = {}
    templates.forEach(t => {
      const group = t.groupTitle || '其他模板'
      if (!groupMap[group]) groupMap[group] = []
      groupMap[group].push({ id: t._id || ('tpl_' + groupMap[group].length), name: t.name, desc: t.desc })
    })
    const templateGroups = Object.entries(groupMap).map(([title, items]) => ({ title, items }))

    this.setData({
      requiredCourses: all.filter(d => d.type === 'required_course').map((c, i) => ({ id: c._id || ('r' + (i + 1)), ...c, progress: 0 })),
      optionalCourses: all.filter(d => d.type === 'optional_course').map((c, i) => ({ id: c._id || ('o' + (i + 1)), ...c })),
      expertList: all.filter(d => d.type === 'expert').map((e, i) => ({ id: e._id || ('e' + (i + 1)), ...e, avatar: e.avatar || '' })),
      caseList: all.filter(d => d.type === 'case').map((c, i) => ({ id: c._id || ('c' + (i + 1)), ...c })),
      templateGroups
    })
  },

  switchTab(e) {
    this.setData({ currentTab: e.currentTarget.dataset.tab })
  },

  viewCourse(e) {
    const id = e.currentTarget.dataset.id
    const allCourses = [...this.data.requiredCourses, ...this.data.optionalCourses]
    const course = allCourses.find(c => c.id === id)
    if (course) {
      wx.showModal({
        title: course.name,
        content: `${course.desc}\n\n时长：${course.duration || '待定'}`,
        showCancel: false
      })
    }
  },

  viewTemplate(e) {
    const id = e.currentTarget.dataset.id
    const allTemplates = this.data.templateGroups.reduce((acc, g) => [...acc, ...g.items], [])
    const tpl = allTemplates.find(t => t.id === id)
    if (tpl) {
      wx.showModal({
        title: tpl.name,
        content: `操作流程：${tpl.desc}`,
        showCancel: false
      })
    }
  },

  viewCase(e) {
    const id = e.currentTarget.dataset.id
    const c = this.data.caseList.find(x => x.id === id)
    if (c) {
      wx.showModal({
        title: c.title,
        content: `${c.summary}\n\n社区：${c.community || ''}`,
        showCancel: false
      })
    }
  },

  onCaseSearch(e) {
    this.setData({ caseKeyword: e.detail.value })
  },

  async collectCase(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.caseList[index]
    if (!item) return

    const db = wx.cloud.database()
    const caseId = item._id || item.id

    if (item.collected) {
      try {
        await db.collection('favorites').where({ targetId: caseId, type: 'case' }).remove()
      } catch (err) { /* skip */ }
      this.setData({ [`caseList[${index}].collected`]: false })
      wx.showToast({ title: '已取消收藏', icon: 'success' })
    } else {
      try {
        await db.collection('favorites').add({
          data: { targetId: caseId, type: 'case', title: item.title, createTime: db.serverDate() }
        })
      } catch (err) { /* skip */ }
      this.setData({ [`caseList[${index}].collected`]: true })
      wx.showToast({ title: '已收藏', icon: 'success' })
    }
  },

  consultExpert(e) {
    const id = e.currentTarget.dataset.id
    const expert = this.data.expertList.find(x => x.id === id)
    if (expert) {
      wx.showModal({
        title: `${expert.name} · ${expert.field}`,
        content: expert.desc,
        showCancel: false
      })
    }
  }
})
