const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    latest: {},
    latestTime: '',
    historyList: [],
    activeTab: 7,
    chartMetric: 'bp',
    bpStatus: '', bpStatusText: '',
    hrStatus: '', hrStatusText: '',
    boStatus: '', boStatusText: '',
    bsStatus: '', bsStatusText: '',
    tempStatus: '', tempStatusText: ''
  },

  _refreshTimer: null,

  onLoad(options) {
    if (options.userId) {
      this.targetUserId = options.userId
    }
    if (options.title) {
      wx.setNavigationBarTitle({ title: options.title })
    }
    this.loadLatest()
    this.loadHistory(7)
  },

  onReady() {
    this.initCanvas()
    this._refreshTimer = setInterval(() => {
      this.loadLatest()
    }, 30000)
  },

  onUnload() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer)
      this._refreshTimer = null
    }
  },

  initCanvas() {
    const query = wx.createSelectorQuery()
    query.select('#healthChart')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (res[0]) {
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          const dpr = wx.getWindowInfo().pixelRatio
          canvas.width = res[0].width * dpr
          canvas.height = res[0].height * dpr
          ctx.scale(dpr, dpr)
          this.canvas = canvas
          this.ctx = ctx
          this.canvasWidth = res[0].width
          this.canvasHeight = res[0].height
          this.drawChart()
        }
      })
  },

  async loadLatest() {
    try {
      const userId = this.targetUserId || app.globalData.userInfo._id
      const res = await db.collection('health_data')
        .where({ userId })
        .orderBy('createTime', 'desc')
        .limit(1)
        .get()
      if (res.data.length > 0) {
        const d = res.data[0]
        this.setData({
          latest: d,
          latestTime: this.formatTime(d.createTime),
          ...this.analyzeStatus(d)
        })
      }
    } catch (e) {
      console.error('加载健康数据失败', e)
    }
  },

  async loadHistory(days) {
    try {
      const userId = this.targetUserId || app.globalData.userInfo._id
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      const res = await db.collection('health_data')
        .where({ userId, createTime: db.command.gte(startDate) })
        .orderBy('createTime', 'desc')
        .limit(50)
        .get()
      if (res.data) {
        const list = res.data.map(item => ({
          ...item,
          dateStr: this.formatTime(item.createTime)
        }))
        this.setData({ historyList: list })
        setTimeout(() => this.drawChart(), 100)
      }
    } catch (e) {
      console.error('加载历史数据失败', e)
    }
  },

  switchTab(e) {
    const days = parseInt(e.currentTarget.dataset.days)
    this.setData({ activeTab: days })
    this.loadHistory(days)
  },

  switchMetric(e) {
    const metric = e.currentTarget.dataset.metric
    this.setData({ chartMetric: metric })
    this.drawChart()
  },

  drawChart() {
    if (!this.ctx || !this.data.historyList.length) return

    const ctx = this.ctx
    const w = this.canvasWidth
    const h = this.canvasHeight
    const padding = { top: 30, right: 20, bottom: 40, left: 50 }
    const chartW = w - padding.left - padding.right
    const chartH = h - padding.top - padding.bottom

    ctx.clearRect(0, 0, w, h)

    const list = [...this.data.historyList].reverse()
    const metric = this.data.chartMetric

    let datasets = []
    let yLabel = ''
    let normalRange = null

    if (metric === 'bp') {
      datasets = [
        { data: list.map(d => d.systolic).filter(Boolean), color: '#E8573A', label: '收缩压' },
        { data: list.map(d => d.diastolic).filter(Boolean), color: '#4A90D9', label: '舒张压' }
      ]
      yLabel = 'mmHg'
      normalRange = { low: 60, high: 140 }
    } else if (metric === 'hr') {
      datasets = [{ data: list.map(d => d.heartRate).filter(Boolean), color: '#E8573A', label: '心率' }]
      yLabel = 'bpm'
      normalRange = { low: 60, high: 100 }
    } else if (metric === 'bo') {
      datasets = [{ data: list.map(d => d.bloodOxygen).filter(Boolean), color: '#2196F3', label: '血氧' }]
      yLabel = '%'
      normalRange = { low: 94, high: 100 }
    } else if (metric === 'temp') {
      datasets = [{ data: list.map(d => d.temperature).filter(Boolean), color: '#FF9800', label: '体温' }]
      yLabel = '°C'
      normalRange = { low: 36, high: 37.3 }
    }

    const allValues = datasets.flatMap(d => d.data)
    if (allValues.length === 0) return

    let minVal = Math.min(...allValues)
    let maxVal = Math.max(...allValues)
    const valuePadding = (maxVal - minVal) * 0.15 || 5
    minVal = Math.floor(minVal - valuePadding)
    maxVal = Math.ceil(maxVal + valuePadding)
    if (minVal < 0) minVal = 0

    // 正常范围底色
    if (normalRange) {
      const normalTop = padding.top + chartH * (1 - (normalRange.high - minVal) / (maxVal - minVal))
      const normalBottom = padding.top + chartH * (1 - (normalRange.low - minVal) / (maxVal - minVal))
      ctx.fillStyle = 'rgba(76, 175, 80, 0.08)'
      ctx.fillRect(padding.left, normalTop, chartW, normalBottom - normalTop)
    }

    // 网格线
    ctx.strokeStyle = '#E8E8E8'
    ctx.lineWidth = 0.5
    const gridCount = 4
    for (let i = 0; i <= gridCount; i++) {
      const y = padding.top + (chartH / gridCount) * i
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(w - padding.right, y)
      ctx.stroke()

      const val = maxVal - ((maxVal - minVal) / gridCount) * i
      ctx.fillStyle = '#999'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(val.toFixed(metric === 'temp' ? 1 : 0), padding.left - 6, y + 4)
    }

    // 日期标签
    const maxPoints = Math.max(...datasets.map(d => d.data.length))
    const dateList = list.filter(d => {
      if (metric === 'bp') return d.systolic
      if (metric === 'hr') return d.heartRate
      if (metric === 'bo') return d.bloodOxygen
      return d.temperature
    })

    const labelStep = Math.max(1, Math.floor(maxPoints / 6))
    ctx.fillStyle = '#999'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'center'
    for (let i = 0; i < maxPoints; i += labelStep) {
      const x = padding.left + (chartW / (maxPoints - 1 || 1)) * i
      const item = dateList[i]
      if (item && item.createTime) {
        const d = new Date(item.createTime)
        ctx.fillText(`${d.getMonth() + 1}/${d.getDate()}`, x, h - padding.bottom + 18)
      }
    }

    // 绘制曲线
    datasets.forEach(ds => {
      if (ds.data.length < 2) return
      const pts = ds.data.map((val, i) => ({
        x: padding.left + (chartW / (ds.data.length - 1)) * i,
        y: padding.top + chartH * (1 - (val - minVal) / (maxVal - minVal))
      }))

      // 渐变填充
      const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH)
      gradient.addColorStop(0, ds.color + '30')
      gradient.addColorStop(1, ds.color + '05')
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) {
        const cx = (pts[i - 1].x + pts[i].x) / 2
        ctx.bezierCurveTo(cx, pts[i - 1].y, cx, pts[i].y, pts[i].x, pts[i].y)
      }
      ctx.lineTo(pts[pts.length - 1].x, padding.top + chartH)
      ctx.lineTo(pts[0].x, padding.top + chartH)
      ctx.closePath()
      ctx.fillStyle = gradient
      ctx.fill()

      // 曲线
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) {
        const cx = (pts[i - 1].x + pts[i].x) / 2
        ctx.bezierCurveTo(cx, pts[i - 1].y, cx, pts[i].y, pts[i].x, pts[i].y)
      }
      ctx.strokeStyle = ds.color
      ctx.lineWidth = 2
      ctx.stroke()

      // 数据点
      pts.forEach(pt => {
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2)
        ctx.fillStyle = '#fff'
        ctx.fill()
        ctx.strokeStyle = ds.color
        ctx.lineWidth = 1.5
        ctx.stroke()
      })
    })

    // Y轴标签
    ctx.fillStyle = '#999'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'center'
    ctx.save()
    ctx.translate(12, padding.top + chartH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText(yLabel, 0, 0)
    ctx.restore()

    // 图例
    let legendX = padding.left
    datasets.forEach(ds => {
      ctx.fillStyle = ds.color
      ctx.fillRect(legendX, 6, 14, 8)
      ctx.fillStyle = '#666'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(ds.label, legendX + 18, 14)
      legendX += ctx.measureText(ds.label).width + 36
    })
  },

  analyzeStatus(d) {
    const result = {}
    if (d.systolic) {
      if (d.systolic > 140 || d.diastolic > 90) {
        Object.assign(result, { bpStatus: 'warning', bpStatusText: '偏高' })
      } else if (d.systolic < 90 || d.diastolic < 60) {
        Object.assign(result, { bpStatus: 'warning', bpStatusText: '偏低' })
      } else {
        Object.assign(result, { bpStatus: 'normal', bpStatusText: '正常' })
      }
    }
    if (d.heartRate) {
      if (d.heartRate > 100) Object.assign(result, { hrStatus: 'warning', hrStatusText: '偏快' })
      else if (d.heartRate < 60) Object.assign(result, { hrStatus: 'warning', hrStatusText: '偏慢' })
      else Object.assign(result, { hrStatus: 'normal', hrStatusText: '正常' })
    }
    if (d.bloodOxygen) {
      if (d.bloodOxygen < 94) Object.assign(result, { boStatus: 'danger', boStatusText: '偏低' })
      else if (d.bloodOxygen < 96) Object.assign(result, { boStatus: 'warning', boStatusText: '注意' })
      else Object.assign(result, { boStatus: 'normal', boStatusText: '正常' })
    }
    if (d.bloodSugar) {
      if (d.bloodSugar > 7) Object.assign(result, { bsStatus: 'warning', bsStatusText: '偏高' })
      else if (d.bloodSugar < 3.9) Object.assign(result, { bsStatus: 'danger', bsStatusText: '偏低' })
      else Object.assign(result, { bsStatus: 'normal', bsStatusText: '正常' })
    }
    if (d.temperature) {
      if (d.temperature > 37.3) Object.assign(result, { tempStatus: 'warning', tempStatusText: '偏高' })
      else if (d.temperature < 36) Object.assign(result, { tempStatus: 'warning', tempStatusText: '偏低' })
      else Object.assign(result, { tempStatus: 'normal', tempStatusText: '正常' })
    }
    return result
  },

  formatTime(time) {
    if (!time) return ''
    const d = new Date(time)
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
})
