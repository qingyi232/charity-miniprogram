const db = wx.cloud.database()

const CATEGORY_MAP = {
  phone: '手机使用',
  health: '健康养生',
  safety: '防诈安全',
  life: '生活技能'
}

Page({
  data: {
    activeCategory: 'all',
    allCourses: [],
    courseList: []
  },

  onLoad() {
    this.loadCourses()
  },

  async loadCourses() {
    try {
      const res = await db.collection('training_content')
        .where({ type: 'elder_course', status: 'active' })
        .orderBy('sortOrder', 'asc')
        .orderBy('createTime', 'desc')
        .limit(100)
        .get()
      const courses = (res.data || []).map(c => ({
        ...c,
        id: c._id,
        title: c.name || c.title || '',
        description: c.desc || c.description || '',
        categoryName: CATEGORY_MAP[c.category] || c.category || '其他',
        duration: c.duration || '',
        views: c.views || 0
      }))
      this.setData({ allCourses: courses, courseList: courses })
    } catch (e) {
      console.error('加载课程失败', e)
      this.setData({ allCourses: [], courseList: [] })
    }
  },

  switchCategory(e) {
    const cat = e.currentTarget.dataset.cat
    this.setData({ activeCategory: cat })
    if (cat === 'all') {
      this.setData({ courseList: this.data.allCourses })
    } else {
      this.setData({ courseList: this.data.allCourses.filter(c => c.category === cat) })
    }
  },

  goDetail(e) {
    const item = e.currentTarget.dataset.item
    wx.showModal({
      title: item.title,
      content: `${item.description}\n\n时长: ${item.duration}\n分类: ${item.categoryName}`,
      showCancel: false,
      confirmText: '知道了'
    })
  }
})
