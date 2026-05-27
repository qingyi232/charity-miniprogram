const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action } = event
  const wxContext = cloud.getWXContext()

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
    case 'listTrainingContent': return listTrainingContent(event)
    case 'saveTrainingContent': return saveTrainingContent(event)
    case 'deleteTrainingContent': return deleteTrainingContent(event)
    case 'listElderGoods': return listElderGoods(event)
    case 'saveElderGoods': return saveElderGoods(event)
    case 'deleteElderGoods': return deleteElderGoods(event)
    case 'listElderShopOrders': return listElderShopOrders(event)
    case 'updateElderShopOrder': return updateElderShopOrder(event)
    case 'elderShopStats': return elderShopStats()
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
    return { code: 500, message: '登录失败' }
  }
}

async function getDashboard() {
  try {
    const [userCount, volunteerCount, elderCount, orderCount, pendingOrders, completedOrders, pairCount, sosCount] = await Promise.all([
      db.collection('users').count(),
      db.collection('users').where({ role: 'volunteer' }).count(),
      db.collection('users').where({ role: 'elder' }).count(),
      db.collection('orders').count(),
      db.collection('orders').where({ status: 'pending' }).count(),
      db.collection('orders').where({ status: 'completed' }).count(),
      db.collection('pairs').where({ status: 'active' }).count(),
      db.collection('messages').where({ type: 'sos', read: false }).count()
    ])

    return {
      code: 200,
      data: {
        totalUsers: userCount.total,
        volunteerCount: volunteerCount.total,
        elderCount: elderCount.total,
        totalOrders: orderCount.total,
        pendingOrders: pendingOrders.total,
        completedOrders: completedOrders.total,
        activePairs: pairCount.total,
        unresolvedSOS: sosCount.total
      }
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
    if (keyword) query.nickname = db.RegExp({ regexp: keyword, options: 'i' })

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
    const updateData = {
      verified: !!verified,
      verifyTime: db.serverDate(),
      updateTime: db.serverDate()
    }
    if (!verified && rejectReason) {
      updateData.rejectReason = rejectReason
    }
    await db.collection('users').doc(userId).update({ data: updateData })

    const certStatus = verified ? 'approved' : 'rejected'
    const certUpdate = { status: certStatus, reviewTime: db.serverDate() }
    if (!verified && rejectReason) certUpdate.rejectReason = rejectReason
    try {
      await db.collection('certificates')
        .where({ userId, status: 'pending' })
        .update({ data: certUpdate })
    } catch (certErr) {
      console.log('certificates集合更新跳过（可能无记录）', certErr.message)
    }

    return { code: 200, message: verified ? '审核通过' : '审核拒绝' }
  } catch (e) {
    return { code: 500, message: '操作失败' }
  }
}

async function listPendingVerify({ page = 1, pageSize = 20 }) {
  try {
    const skip = (page - 1) * pageSize
    const query = { role: 'volunteer', verified: false, verifyApplied: true }
    const volunteers = await db.collection('users')
      .where(query)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    const countRes = await db.collection('users')
      .where(query)
      .count()
    return { code: 200, data: { list: volunteers.data, total: countRes.total } }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function listOrders({ page = 1, pageSize = 20, status, category }) {
  try {
    const query = {}
    if (status) query.status = status
    if (category) query.category = category

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
    const now = db.serverDate()
    const announcement = {
      title: data.title,
      content: data.content || '',
      type: data.type || 'notice',
      cover: data.cover || '',
      isTop: data.isTop || false,
      activityDate: data.activityDate || '',
      activityLocation: data.activityLocation || '',
      signupCount: 0,
      maxSignup: data.maxSignup || 0,
      status: 'active',
      createTime: now,
      updateTime: now
    }
    const res = await db.collection('announcements').add({ data: announcement })
    return { code: 200, data: { _id: res._id } }
  } catch (e) {
    return { code: 500, message: '创建失败' }
  }
}

async function updateAnnouncement({ id, data }) {
  if (!id) return { code: 400, message: '缺少ID' }
  try {
    delete data._id
    data.updateTime = db.serverDate()
    await db.collection('announcements').doc(id).update({ data })
    return { code: 200, message: '更新成功' }
  } catch (e) {
    return { code: 500, message: '更新失败' }
  }
}

async function deleteAnnouncement({ id }) {
  if (!id) return { code: 400, message: '缺少ID' }
  try {
    await db.collection('announcements').doc(id).update({
      data: { status: 'deleted', updateTime: db.serverDate() }
    })
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
      data: {
        status: approved ? 'approved' : 'rejected',
        reviewTime: db.serverDate()
      }
    })

    if (approved && record._openid) {
      const earnedPoints = 10
      try {
        await db.collection('users').where({ openid: record._openid }).update({
          data: {
            totalServiceHours: _.inc(1),
            totalPoints: _.inc(earnedPoints),
            availablePoints: _.inc(earnedPoints),
            updateTime: db.serverDate()
          }
        })
      } catch (e) { /* skip */ }

      try {
        await db.collection('points_log').add({
          data: {
            openid: record._openid,
            userId: record.userId || '',
            type: 'earn',
            amount: earnedPoints,
            reason: '补充服务记录审核通过',
            orderId: recordId,
            createTime: db.serverDate()
          }
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
      data: {
        status: approved ? 'approved' : 'rejected',
        reviewTime: db.serverDate()
      }
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

async function listTrainingContent({ page = 1, pageSize = 50, type }) {
  try {
    const query = { status: _.neq('deleted') }
    if (type) query.type = type
    const skip = (page - 1) * pageSize
    const countRes = await db.collection('training_content').where(query).count()
    const res = await db.collection('training_content')
      .where(query)
      .orderBy('sortOrder', 'asc')
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    return { code: 200, data: { list: res.data, total: countRes.total } }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function saveTrainingContent({ contentData, contentId }) {
  try {
    const now = db.serverDate()
    if (contentId) {
      delete contentData._id
      contentData.updateTime = now
      await db.collection('training_content').doc(contentId).update({ data: contentData })
      return { code: 200, message: '更新成功' }
    } else {
      contentData.status = contentData.status || 'active'
      contentData.sortOrder = contentData.sortOrder || 100
      contentData.createTime = now
      contentData.updateTime = now
      const res = await db.collection('training_content').add({ data: contentData })
      return { code: 200, data: { _id: res._id } }
    }
  } catch (e) {
    return { code: 500, message: '保存失败' }
  }
}

async function deleteTrainingContent({ contentId }) {
  if (!contentId) return { code: 400, message: '缺少内容ID' }
  try {
    await db.collection('training_content').doc(contentId).update({
      data: { status: 'deleted', updateTime: db.serverDate() }
    })
    return { code: 200, message: '删除成功' }
  } catch (e) {
    return { code: 500, message: '删除失败' }
  }
}

async function listElderGoods({ page = 1, pageSize = 20, category }) {
  try {
    const query = { status: _.neq('deleted') }
    if (category) query.category = category
    const skip = (page - 1) * pageSize
    const countRes = await db.collection('elder_shop_goods').where(query).count()
    const res = await db.collection('elder_shop_goods')
      .where(query)
      .orderBy('sortOrder', 'asc')
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    return { code: 200, data: { list: res.data, total: countRes.total } }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function saveElderGoods({ goodsData, goodsId }) {
  try {
    const now = db.serverDate()
    if (goodsId) {
      delete goodsData._id
      goodsData.updateTime = now
      await db.collection('elder_shop_goods').doc(goodsId).update({ data: goodsData })
      return { code: 200, message: '更新成功' }
    } else {
      goodsData.status = goodsData.status || 'active'
      goodsData.salesCount = 0
      goodsData.sortOrder = goodsData.sortOrder || 100
      goodsData.createTime = now
      goodsData.updateTime = now
      const res = await db.collection('elder_shop_goods').add({ data: goodsData })
      return { code: 200, data: { _id: res._id } }
    }
  } catch (e) {
    return { code: 500, message: '保存失败' }
  }
}

async function deleteElderGoods({ goodsId }) {
  if (!goodsId) return { code: 400, message: '缺少商品ID' }
  try {
    await db.collection('elder_shop_goods').doc(goodsId).update({
      data: { status: 'deleted', updateTime: db.serverDate() }
    })
    return { code: 200, message: '删除成功' }
  } catch (e) {
    return { code: 500, message: '删除失败' }
  }
}

async function listElderShopOrders({ page = 1, pageSize = 20, orderStatus, payStatus }) {
  try {
    const query = {}
    if (orderStatus) query.orderStatus = orderStatus
    if (payStatus) query.payStatus = payStatus

    const countRes = await db.collection('elder_shop_orders').where(query).count()
    const res = await db.collection('elder_shop_orders')
      .where(query)
      .orderBy('createTime', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    return { code: 200, data: { list: res.data, total: countRes.total, page, pageSize } }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function updateElderShopOrder({ orderId, updateData }) {
  if (!orderId || !updateData) return { code: 400, message: '参数不完整' }
  try {
    updateData.updateTime = db.serverDate()
    await db.collection('elder_shop_orders').doc(orderId).update({ data: updateData })
    return { code: 200, message: '更新成功' }
  } catch (e) {
    return { code: 500, message: '更新失败' }
  }
}

async function elderShopStats() {
  try {
    const [totalRes, pendingRes, deliveringRes, completedRes, allOrders] = await Promise.all([
      db.collection('elder_shop_orders').count(),
      db.collection('elder_shop_orders').where({ orderStatus: 'pending_accept' }).count(),
      db.collection('elder_shop_orders').where({ orderStatus: db.command.in(['accepted', 'delivering']) }).count(),
      db.collection('elder_shop_orders').where({ orderStatus: 'completed' }).count(),
      db.collection('elder_shop_orders').where({ orderStatus: 'completed', payStatus: 'paid' }).field({ totalAmount: true }).limit(1000).get()
    ])

    const totalIncome = (allOrders.data || []).reduce((sum, o) => sum + (o.totalAmount || 0), 0)
    const unpaidRes = await db.collection('elder_shop_orders')
      .where({ payStatus: 'unpaid', orderStatus: db.command.neq('cancelled') })
      .field({ totalAmount: true }).limit(1000).get()
    const unpaidAmount = (unpaidRes.data || []).reduce((sum, o) => sum + (o.totalAmount || 0), 0)

    return {
      code: 200,
      data: {
        totalOrders: totalRes.total,
        pendingOrders: pendingRes.total,
        deliveringOrders: deliveringRes.total,
        completedOrders: completedRes.total,
        totalIncome: Math.round(totalIncome * 100) / 100,
        unpaidAmount: Math.round(unpaidAmount * 100) / 100
      }
    }
  } catch (e) {
    return { code: 500, message: '统计失败' }
  }
}
