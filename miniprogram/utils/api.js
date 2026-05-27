const callCloud = (name, data) => {
  return wx.cloud.callFunction({ name, data })
    .then(res => {
      if (res.result.code === 200) return res.result
      const err = new Error(res.result.message || '请求失败')
      err.code = res.result.code
      throw err
    })
    .catch(e => {
      if (e.code) throw e
      console.error(`云函数 ${name} 调用失败`, e)
      throw new Error('网络错误，请重试')
    })
}

const formatTime = (time) => {
  if (!time) return ''
  const d = new Date(time)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const formatDate = (time) => {
  if (!time) return ''
  const d = new Date(time)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const formatDateTime = (time) => {
  if (!time) return ''
  const d = new Date(time)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const categoryMap = {
  shopping: '生活代购',
  companion: '上门陪伴',
  housework: '家务帮忙',
  medical: '就医陪同',
  chat: '日常聊天',
  other: '其他需求'
}

const statusMap = {
  pending: '待接单',
  accepted: '已接单',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消'
}

const DEFAULT_AVATAR = '/static/images/default-avatar.svg'

function isValidImageUrl(url) {
  if (!url) return false
  if (url.startsWith('/static/') || url.startsWith('http://') || url.startsWith('https://')) return true
  if (url.startsWith('cloud://')) return true
  return false
}

async function validateCloudAvatars(items, field) {
  const cloudIds = []
  items.forEach(item => {
    const url = item[field]
    if (url && url.startsWith('cloud://') && !cloudIds.includes(url)) {
      cloudIds.push(url)
    }
  })
  if (cloudIds.length === 0) return items
  try {
    const res = await wx.cloud.getTempFileURL({ fileList: cloudIds })
    const failedIds = new Set()
    ;(res.fileList || []).forEach(f => {
      if (f.status !== 0 || !f.tempFileURL) failedIds.add(f.fileID)
    })
    items.forEach(item => {
      if (item[field] && failedIds.has(item[field])) {
        item[field] = DEFAULT_AVATAR
      }
    })
  } catch (e) {
    items.forEach(item => {
      if (item[field] && item[field].startsWith('cloud://')) {
        item[field] = DEFAULT_AVATAR
      }
    })
  }
  return items
}

async function validateSingleAvatar(url) {
  if (!url || !url.startsWith('cloud://')) return url || DEFAULT_AVATAR
  try {
    const res = await wx.cloud.getTempFileURL({ fileList: [url] })
    const file = (res.fileList || [])[0]
    if (!file || file.status !== 0 || !file.tempFileURL) return DEFAULT_AVATAR
    return url
  } catch (e) {
    return DEFAULT_AVATAR
  }
}

module.exports = {
  callCloud,
  formatTime,
  formatDate,
  formatDateTime,
  categoryMap,
  statusMap,
  DEFAULT_AVATAR,
  isValidImageUrl,
  validateCloudAvatars,
  validateSingleAvatar
}
