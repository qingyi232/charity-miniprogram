const tcb = require('@cloudbase/node-sdk')
const app = tcb.init()
const db = app.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action } = event

  switch (action) {
    case 'login': return adminLogin(event)
    case 'dashboard': return getDashboard()
    case 'listUsers': return listUsers(event)
    case 'verifyVolunteer': return verifyVolunteer(event)
    case 'listPendingVerify': return listPendingVerify(event)
    case 'listOrders': return listOrders(event)
    case 'listHealthData': return listHealthData(event)
    case 'listAnnouncements': return listAnnouncements(event)
    case 'createAnnouncement': return createAnnouncement(event)
    case 'updateAnnouncement': return updateAnnouncement(event)
    case 'deleteAnnouncement': return deleteAnnouncement(event)
    case 'listSOS': return listSOS(event)
    case 'getHealthAlerts': return getHealthAlerts(event)
    case 'listCheckins': return listCheckins(event)
    case 'listSupplements': return listSupplements(event)
    case 'approveSupplementRecord': return approveSupplementRecord(event)
    case 'listCertificates': return listCertificates(event)
    case 'approveCertificate': return approveCertificate(event)
    case 'listPairs': return listPairs(event)
    case 'listActivitySignups': return listActivitySignups(event)
    default: return { code: 400, message: '未知操作' }
  }
}

async function adminLogin({ username, password }) {
  try {
    const res = await db.collection('admins')
      .where({ username, password, status: 'active' })
      .get()
    if (res.data.length === 0) return { code: 401, message: '用户名或密码错误' }
    const admin = res.data[0]
    delete admin.password
    return { code: 200, data: admin }
  } catch (e) {
    return { code: 500, message: '登录失败: ' + e.message }
  }
}

async function getDashboard() {
  try {
    const safeCount = async (col, query = {}) => {
      try {
        const r = await db.collection(col).where(query).count()
        return r.total || 0
      } catch { return 0 }
    }

    const [totalUsers, volunteerCount, elderCount, totalOrders, pendingOrders, completedOrders, activePairs, unresolvedSOS] = await Promise.all([
      safeCount('users'),
      safeCount('users', { role: 'volunteer' }),
      safeCount('users', { role: 'elder' }),
      safeCount('orders'),
      safeCount('orders', { status: 'pending' }),
      safeCount('orders', { status: 'completed' }),
      safeCount('pairs', { status: 'active' }),
      safeCount('messages', { type: 'sos', read: false })
    ])

    return {
      code: 200,
      data: { totalUsers, volunteerCount, elderCount, totalOrders, pendingOrders, completedOrders, activePairs, unresolvedSOS }
    }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function listUsers({ page = 1, pageSize = 20, role, keyword, verified }) {
  try {
    const query = {}
    if (role) query.role = role
    if (typeof verified === 'boolean') query.verified = verified

    const skip = (page - 1) * pageSize
    const countRes = await db.collection('users').where(query).count()
    const res = await db.collection('users')
      .where(query)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()

    return { code: 200, data: { list: res.data, total: countRes.total, page, pageSize } }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function verifyVolunteer({ userId, verified, rejectReason }) {
  if (!userId) return { code: 400, message: '缺少用户ID' }
  try {
    const updateData = { verified: !!verified, verifyTime: new Date(), updateTime: new Date() }
    if (!verified && rejectReason) updateData.rejectReason = rejectReason
    await db.collection('users').doc(userId).update(updateData)
    return { code: 200, message: verified ? '审核通过' : '审核拒绝' }
  } catch (e) {
    return { code: 500, message: '操作失败' }
  }
}

async function listPendingVerify({ page = 1, pageSize = 20 }) {
  try {
    const skip = (page - 1) * pageSize
    const query = { role: 'volunteer', verified: false, verifyApplied: true }
    const res = await db.collection('users')
      .where(query)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    const countRes = await db.collection('users')
      .where(query)
      .count()
    return { code: 200, data: { list: res.data, total: countRes.total } }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function listOrders({ page = 1, pageSize = 20, status }) {
  try {
    const query = {}
    if (status) query.status = status
    const skip = (page - 1) * pageSize
    const countRes = await db.collection('orders').where(query).count()
    const res = await db.collection('orders')
      .where(query)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    return { code: 200, data: { list: res.data, total: countRes.total, page, pageSize } }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function listHealthData({ page = 1, pageSize = 20, userId }) {
  try {
    const query = {}
    if (userId) query.userId = userId
    const skip = (page - 1) * pageSize
    const res = await db.collection('health_data')
      .where(query)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    return { code: 200, data: res.data }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function listAnnouncements({ page = 1, pageSize = 20 }) {
  try {
    const skip = (page - 1) * pageSize
    const countRes = await db.collection('announcements')
      .where({ status: _.neq('deleted') })
      .count()
    const res = await db.collection('announcements')
      .where({ status: _.neq('deleted') })
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    return { code: 200, data: { list: res.data, total: countRes.total } }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function createAnnouncement({ data }) {
  try {
    const now = new Date()
    const announcement = {
      title: data.title,
      content: data.content || '',
      type: data.type || 'notice',
      isTop: data.isTop || false,
      status: 'active',
      createTime: now,
      updateTime: now
    }
    const res = await db.collection('announcements').add(announcement)
    return { code: 200, data: { _id: res.id } }
  } catch (e) {
    return { code: 500, message: '创建失败' }
  }
}

async function updateAnnouncement({ id, data }) {
  if (!id) return { code: 400, message: '缺少ID' }
  try {
    delete data._id
    data.updateTime = new Date()
    await db.collection('announcements').doc(id).update(data)
    return { code: 200, message: '更新成功' }
  } catch (e) {
    return { code: 500, message: '更新失败' }
  }
}

async function deleteAnnouncement({ id }) {
  if (!id) return { code: 400, message: '缺少ID' }
  try {
    await db.collection('announcements').doc(id).update({ status: 'deleted', updateTime: new Date() })
    return { code: 200, message: '删除成功' }
  } catch (e) {
    return { code: 500, message: '删除失败' }
  }
}

async function listSOS({ page = 1, pageSize = 20 }) {
  try {
    const skip = (page - 1) * pageSize
    const res = await db.collection('messages')
      .where({ type: 'sos' })
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    return { code: 200, data: res.data }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function getHealthAlerts({ page = 1, pageSize = 20 }) {
  try {
    const skip = (page - 1) * pageSize
    const res = await db.collection('messages')
      .where({ type: 'health_alert' })
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    return { code: 200, data: res.data }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function listCheckins({ page = 1, pageSize = 20 }) {
  try {
    const skip = (page - 1) * pageSize
    const res = await db.collection('service_checkins')
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()

    const records = res.data
    const openids = [...new Set(records.map(r => r._openid).filter(Boolean))]
    const userMap = {}
    for (let i = 0; i < openids.length; i += 20) {
      const batch = openids.slice(i, i + 20)
      try {
        const userRes = await db.collection('users')
          .where({ openid: _.in(batch) })
          .field({ openid: true, nickname: true })
          .get()
        userRes.data.forEach(u => { userMap[u.openid] = u.nickname || '未知用户' })
      } catch (e) { /* skip */ }
    }
    const enriched = records.map(r => ({
      ...r,
      userName: userMap[r._openid] || (r._openid ? r._openid.substring(0, 10) + '...' : '--')
    }))

    return { code: 200, data: enriched }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function listSupplements({ page = 1, pageSize = 20, status }) {
  try {
    const query = {}
    if (status) query.status = status
    const skip = (page - 1) * pageSize
    const countRes = await db.collection('supplement_records').where(query).count()
    const res = await db.collection('supplement_records')
      .where(query)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()

    const records = res.data
    const openids = [...new Set(records.map(r => r._openid).filter(Boolean))]
    const userMap = {}
    for (let i = 0; i < openids.length; i += 20) {
      const batch = openids.slice(i, i + 20)
      try {
        const userRes = await db.collection('users')
          .where({ openid: _.in(batch) })
          .field({ openid: true, nickname: true })
          .get()
        userRes.data.forEach(u => { userMap[u.openid] = u.nickname || '未知用户' })
      } catch (e) { /* skip */ }
    }
    const enriched = records.map(r => ({
      ...r,
      userName: r.userName || userMap[r._openid] || (r._openid ? r._openid.substring(0, 10) + '...' : '--')
    }))

    return { code: 200, data: { list: enriched, total: countRes.total } }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function approveSupplementRecord({ recordId, approved }) {
  if (!recordId) return { code: 400, message: '缺少记录ID' }
  try {
    const recordRes = await db.collection('supplement_records').doc(recordId).get()
    const record = recordRes.data

    await db.collection('supplement_records').doc(recordId).update({
      status: approved ? 'approved' : 'rejected',
      reviewTime: new Date()
    })

    if (approved && record._openid) {
      const earnedPoints = 10
      try {
        await db.collection('users').where({ openid: record._openid }).update({
          totalServiceHours: _.inc(1),
          totalPoints: _.inc(earnedPoints),
          availablePoints: _.inc(earnedPoints),
          updateTime: new Date()
        })
      } catch (e) { /* skip */ }

      try {
        await db.collection('points_log').add({
          openid: record._openid,
          type: 'earn',
          amount: earnedPoints,
          reason: '补充服务记录审核通过',
          orderId: recordId,
          createTime: new Date()
        })
      } catch (e) { /* skip */ }
    }

    return { code: 200, message: approved ? '已通过' : '已拒绝' }
  } catch (e) {
    return { code: 500, message: '操作失败' }
  }
}

async function listCertificates({ page = 1, pageSize = 20, status }) {
  try {
    const query = {}
    if (status) query.status = status
    const skip = (page - 1) * pageSize
    const countRes = await db.collection('certificates').where(query).count()
    const res = await db.collection('certificates')
      .where(query)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    return { code: 200, data: { list: res.data, total: countRes.total } }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function approveCertificate({ certId, approved }) {
  if (!certId) return { code: 400, message: '缺少证书ID' }
  try {
    await db.collection('certificates').doc(certId).update({
      status: approved ? 'approved' : 'rejected',
      reviewTime: new Date()
    })
    return { code: 200, message: approved ? '已通过' : '已拒绝' }
  } catch (e) {
    return { code: 500, message: '操作失败' }
  }
}

async function listPairs({ page = 1, pageSize = 20, status }) {
  try {
    const query = {}
    if (status) query.status = status
    const skip = (page - 1) * pageSize
    const countRes = await db.collection('pairs').where(query).count()
    const res = await db.collection('pairs')
      .where(query)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    return { code: 200, data: { list: res.data, total: countRes.total } }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function listActivitySignups({ activityId, page = 1, pageSize = 50 }) {
  try {
    const query = {}
    if (activityId) query.activityId = activityId
    const skip = (page - 1) * pageSize
    const countRes = await db.collection('activity_signups').where(query).count()
    const res = await db.collection('activity_signups')
      .where(query)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    return { code: 200, data: { list: res.data, total: countRes.total } }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}
