const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action } = event
  const wxContext = cloud.getWXContext()

  switch (action) {
    case 'login': return handleLogin(event, wxContext)
    case 'updateProfile': return handleUpdateProfile(event, wxContext)
    case 'getUserInfo': return handleGetUserInfo(event, wxContext)
    case 'searchUsers': return handleSearchUsers(event, wxContext)
    case 'applyCertificate': return applyCertificate(event, wxContext)
    case 'checkCertificate': return checkCertificate(event, wxContext)
    case 'getMySupplements': return getMySupplements(event, wxContext)
    case 'getMyCheckins': return getMyCheckins(event, wxContext)
    default: return { code: 400, message: '未知操作' }
  }
}

async function handleLogin({ role }, wxContext) {
  const openid = wxContext.OPENID
  if (!openid) return { code: 401, message: '获取用户身份失败' }

  try {
    const userRes = await db.collection('users').where({ openid }).get()

    if (userRes.data.length > 0) {
      const user = userRes.data[0]
      if (role && user.role !== role) {
        await db.collection('users').doc(user._id).update({ data: { role } })
        user.role = role
      }
      return { code: 200, data: user }
    }

    const now = db.serverDate()
    const newUser = {
      openid,
      role: role || 'elder',
      nickname: '',
      avatar: '',
      phone: '',
      age: 0,
      address: '',
      emergencyContact: '',
      emergencyPhone: '',
      healthInfo: '',
      serviceTypes: [],
      serviceArea: '',
      totalServiceHours: 0,
      totalPoints: 0,
      availablePoints: 0,
      usedPoints: 0,
      starLevel: 1,
      verified: false,
      status: 'active',
      createTime: now,
      updateTime: now
    }

    const addRes = await db.collection('users').add({ data: newUser })
    newUser._id = addRes._id
    return { code: 200, data: newUser }
  } catch (e) {
    console.error('登录失败', e)
    return { code: 500, message: '服务器错误' }
  }
}

async function handleUpdateProfile({ data }, wxContext) {
  const openid = wxContext.OPENID
  try {
    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length === 0) return { code: 404, message: '用户不存在' }

    const userId = userRes.data[0]._id
    const updateData = { ...data, updateTime: db.serverDate() }
    delete updateData._id
    delete updateData.openid

    await db.collection('users').doc(userId).update({ data: updateData })
    const updated = await db.collection('users').doc(userId).get()
    return { code: 200, data: updated.data }
  } catch (e) {
    console.error('更新资料失败', e)
    return { code: 500, message: '更新失败' }
  }
}

async function handleGetUserInfo({ userId }, wxContext) {
  try {
    const id = userId || wxContext.OPENID
    let res
    if (userId) {
      res = await db.collection('users').doc(userId).get()
      return { code: 200, data: res.data }
    }
    res = await db.collection('users').where({ openid: id }).get()
    if (res.data.length === 0) return { code: 404, message: '用户不存在' }
    return { code: 200, data: res.data[0] }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function handleSearchUsers({ keyword, role }) {
  try {
    const query = {}
    if (role) query.role = role
    if (keyword) {
      query.nickname = db.RegExp({ regexp: keyword, options: 'i' })
    }
    const res = await db.collection('users').where(query).limit(20).get()
    return { code: 200, data: res.data }
  } catch (e) {
    return { code: 500, message: '搜索失败' }
  }
}

async function applyCertificate({ data }, wxContext) {
  const openid = wxContext.OPENID
  try {
    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length === 0) return { code: 401, message: '请先登录' }
    const user = userRes.data[0]

    if (user.role !== 'volunteer') return { code: 403, message: '仅志愿者可申请' }

    const hours = user.totalServiceHours || 0
    if (hours < 10) return { code: 400, message: '服务时长不足10小时' }

    const existing = await db.collection('certificates').where({
      userId: user._id, status: db.command.in(['pending', 'approved'])
    }).get()
    if (existing.data.length > 0) {
      return { code: 409, message: '已有申请记录' }
    }

    const now = new Date()
    const applyTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    await db.collection('certificates').add({
      data: {
        userId: user._id,
        userName: user.nickname || '志愿者',
        serviceHours: hours,
        totalOrders: data?.totalOrders || 0,
        pairCount: data?.pairCount || 0,
        starLevel: user.starLevel || 1,
        status: 'pending',
        applyTime,
        createTime: db.serverDate()
      }
    })

    return { code: 200, message: '证书申请已提交' }
  } catch (e) {
    console.error('证书申请失败', e)
    return { code: 500, message: '申请失败' }
  }
}

async function checkCertificate(event, wxContext) {
  const openid = wxContext.OPENID
  try {
    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length === 0) return { code: 401, message: '请先登录' }

    const res = await db.collection('certificates')
      .where({ userId: userRes.data[0]._id })
      .orderBy('createTime', 'desc')
      .limit(1)
      .get()

    if (res.data.length === 0) return { code: 404, message: '暂无申请' }
    return { code: 200, data: res.data[0] }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function getMySupplements({ status }, wxContext) {
  const openid = wxContext.OPENID
  try {
    const query = { _openid: openid }
    if (status) query.status = status
    const res = await db.collection('supplement_records')
      .where(query)
      .orderBy('createTime', 'desc')
      .limit(50)
      .get()
    return { code: 200, data: res.data }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function getMyCheckins(event, wxContext) {
  const openid = wxContext.OPENID
  try {
    const res = await db.collection('service_checkins')
      .where({ _openid: openid })
      .orderBy('createTime', 'desc')
      .limit(50)
      .get()
    return { code: 200, data: res.data }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}
