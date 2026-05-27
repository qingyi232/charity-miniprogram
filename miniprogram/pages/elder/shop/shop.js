Page({
  data: {
    goodsList: [],
    currentCategory: '',
    loading: false
  },

  onLoad() {
    this.loadGoods()
  },

  async loadGoods() {
    this.setData({ loading: true })
    try {
      const db = wx.cloud.database()
      const query = { status: 'active' }
      if (this.data.currentCategory) query.category = this.data.currentCategory
      const res = await db.collection('elder_shop_goods')
        .where(query)
        .orderBy('sortOrder', 'asc')
        .orderBy('createTime', 'desc')
        .limit(100)
        .get()
      this.setData({ goodsList: res.data || [] })
    } catch (e) {
      console.error('loadGoods error', e)
      this.setData({ goodsList: [] })
    }
    this.setData({ loading: false })
  },

  switchCategory(e) {
    const cat = e.currentTarget.dataset.cat
    this.setData({ currentCategory: cat })
    this.loadGoods()
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/elder/shop-detail/shop-detail?id=${id}` })
  }
})
