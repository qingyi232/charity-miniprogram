const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action } = event
  const wxContext = cloud.getWXContext()

  switch (action) {
    case 'create': return createPair(event, wxContext)
    case 'myPairs': return getMyPairs(event, wxContext)
    case 'dissolve': return dissolvePair(event, wxContext)
    case 'pairDetail': return pairDetail(event, wxContext)
    default: return { code: 400, message: '未知操作' }
  }
}

async function createPair({ elderId, volunteerId }, wxContext) {
  try {
    const existRes = await db.collection('pairs').where({
      elderId, volunteerId, status: 'active'
    }).count()
    if (existRes.total > 0) return { code: 400, message: '已存在结对关系' }

    const elderRes = await db.collection('users').doc(elderId).get()
    const volunteerRes = await db.collection('users').doc(volunteerId).get()

    const now = db.serverDate()
    await db.collection('pairs').add({
      data: {
        elderId,
        elderName: elderRes.data.nickname || '老人',
        elderAvatar: elderRes.data.avatar || '',
        elderPhone: elderRes.data.phone || '',
        volunteerId,
        volunteerName: volunteerRes.data.nickname || '志愿者',
        volunteerAvatar: volunteerRes.data.avatar || '',
        volunteerPhone: volunteerRes.data.phone || '',
        status: 'active',
        createTime: now
      }
    })

    return { code: 200, message: '结对成功' }
  } catch (e) {
    console.error('创建结对失败', e)
    return { code: 500, message: '结对失败' }
  }
}

async function getMyPairs({ role }, wxContext) {
  const openid = wxContext.OPENID
  try {
    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length === 0) return { code: 401, message: '请先登录' }
    const userId = userRes.data[0]._id

    const query = { status: 'active' }
    if (role === 'elder') {
      query.elderId = userId
    } else {
      query.volunteerId = userId
    }

    const res = await db.collection('pairs').where(query).get()
    return { code: 200, data: res.data }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function dissolvePair({ pairId }, wxContext) {
  const openid = wxContext.OPENID
  if (!pairId) return { code: 400, message: '缺少结对ID' }
  try {
    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length === 0) return { code: 401, message: '请先登录' }
    const userId = userRes.data[0]._id

    const pairRes = await db.collection('pairs').doc(pairId).get()
    if (pairRes.data.elderId !== userId && pairRes.data.volunteerId !== userId) {
      return { code: 403, message: '无权解除此结对关系' }
    }

    await db.collection('pairs').doc(pairId).update({
      data: { status: 'dissolved', dissolveTime: db.serverDate() }
    })
    return { code: 200, message: '已解除结对' }
  } catch (e) {
    return { code: 500, message: '解除失败' }
  }
}

async function pairDetail({ pairId }) {
  try {
    const res = await db.collection('pairs').doc(pairId).get()
    return { code: 200, data: res.data }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}
