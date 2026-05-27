const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action } = event
  const wxContext = cloud.getWXContext()

  switch (action) {
    case 'list': return listAnnouncements(event)
    case 'detail': return announcementDetail(event)
    case 'listActivities': return listActivities(event)
    case 'joinActivity': return joinActivity(event, wxContext)
    case 'signup': return joinActivity({ activityId: event.activityId }, wxContext)
    case 'adminCreate': return adminCreate(event, wxContext)
    case 'adminUpdate': return adminUpdate(event, wxContext)
    case 'adminDelete': return adminDelete(event, wxContext)
    case 'getTrainingContent': return getTrainingContent(event)
    case 'getCasePreviews': return getCasePreviews(event)
    default: return { code: 400, message: '未知操作' }
  }
}

async function listAnnouncements({ page = 1, pageSize = 10, type }) {
  try {
    const query = { status: 'active' }
    if (type) query.type = type

    const skip = (page - 1) * pageSize
    const countRes = await db.collection('announcements').where(query).count()
    const res = await db.collection('announcements')
      .where(query)
      .orderBy('isTop', 'desc')
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()

    return { code: 200, data: { list: res.data, total: countRes.total } }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function announcementDetail({ id }) {
  if (!id) return { code: 400, message: '缺少公告ID' }
  try {
    const res = await db.collection('announcements').doc(id).get()
    return { code: 200, data: res.data }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function listActivities({ page = 1, pageSize = 10 }) {
  try {
    const skip = (page - 1) * pageSize
    const res = await db.collection('announcements')
      .where({ type: 'activity', status: 'active' })
      .orderBy('activityDate', 'asc')
      .skip(skip)
      .limit(pageSize)
      .get()
    return { code: 200, data: res.data }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function joinActivity({ activityId }, wxContext) {
  const openid = wxContext.OPENID
  if (!activityId) return { code: 400, message: '缺少活动ID' }
  try {
    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length === 0) return { code: 401, message: '请先登录' }
    const user = userRes.data[0]

    const existRes = await db.collection('activity_signups')
      .where({ activityId, userId: user._id })
      .count()
    if (existRes.total > 0) return { code: 400, message: '已报名' }

    await db.collection('activity_signups').add({
      data: {
        activityId,
        userId: user._id,
        userName: user.nickname || '用户',
        userRole: user.role,
        createTime: db.serverDate()
      }
    })

    await db.collection('announcements').doc(activityId).update({
      data: {
        signupCount: db.command.inc(1),
        signups: db.command.push([user._id])
      }
    })

    return { code: 200, message: '报名成功' }
  } catch (e) {
    return { code: 500, message: '报名失败' }
  }
}

async function adminCreate({ data }, wxContext) {
  const openid = wxContext.OPENID
  try {
    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length === 0) return { code: 401, message: '请先登录' }

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
      signups: [],
      maxSignup: data.maxSignup || 0,
      status: 'active',
      creatorId: userRes.data[0]._id,
      createTime: now,
      updateTime: now
    }

    const res = await db.collection('announcements').add({ data: announcement })
    return { code: 200, data: { _id: res._id } }
  } catch (e) {
    return { code: 500, message: '创建失败' }
  }
}

async function adminUpdate({ id, data }, wxContext) {
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

async function adminDelete({ id }, wxContext) {
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

async function getTrainingContent({ type }) {
  try {
    const query = { status: 'active' }
    if (type) query.type = type
    const res = await db.collection('training_content')
      .where(query)
      .orderBy('sortOrder', 'asc')
      .orderBy('createTime', 'desc')
      .limit(100)
      .get()

    return { code: 200, data: res.data || [] }
  } catch (e) {
    return { code: 200, data: [] }
  }
}

async function getCasePreviews({ limit = 3 }) {
  try {
    const res = await db.collection('training_content')
      .where({ type: 'case', status: 'active' })
      .orderBy('sortOrder', 'asc')
      .limit(limit)
      .get()

    return { code: 200, data: res.data || [] }
  } catch (e) {
    return { code: 200, data: [] }
  }
}

