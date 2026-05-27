const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  switch (action) {
    case 'getMyPoints': return getMyPoints(openid)
    case 'getPointsHistory': return getPointsHistory(openid, event)
    case 'getRanking': return getRanking(event)
    case 'earnPoints': return earnPoints(openid, event)
    case 'exchangePoints': return exchangePoints(openid, event)
    case 'getExchangeRecords': return getExchangeRecords(openid, event)
    case 'getShopGoods': return getShopGoods(event)
    case 'getGoodsDetail': return getGoodsDetail(event)
    case 'adminListGoods': return adminListGoods(event)
    case 'adminSaveGoods': return adminSaveGoods(event)
    case 'adminDeleteGoods': return adminDeleteGoods(event)
    case 'adminListExchangeOrders': return adminListExchangeOrders(event)
    case 'adminUpdateExchangeOrder': return adminUpdateExchangeOrder(event)
    default: return { code: 400, message: '未知操作' }
  }
}

async function getMyPoints(openid) {
  try {
    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length === 0) return { code: 404, message: '用户不存在' }
    const user = userRes.data[0]

    let totalPoints = user.totalPoints || 0
    let totalServiceHours = user.totalServiceHours || 0

    if (totalPoints === 0) {
      const [orderRes, suppRes] = await Promise.all([
        db.collection('orders')
          .where({ volunteerId: user._id, status: 'completed' })
          .get().catch(() => ({ data: [] })),
        db.collection('supplement_records')
          .where({ _openid: openid, status: 'approved' })
          .count().catch(() => ({ total: 0 }))
      ])
      const orderCount = orderRes.data.length
      const orderHours = orderRes.data.reduce((sum, r) => sum + (r.serviceHours || 1), 0)
      const suppCount = suppRes.total || 0
      totalPoints = (orderCount + suppCount) * 10 + (orderHours + suppCount)
      totalServiceHours = orderHours + suppCount

      if (totalPoints > 0) {
        await db.collection('users').where({ openid }).update({
          data: {
            totalPoints,
            availablePoints: totalPoints - (user.usedPoints || 0),
            totalServiceHours,
            updateTime: db.serverDate()
          }
        }).catch(() => {})
      }
    }

    return {
      code: 200,
      data: {
        totalPoints,
        availablePoints: (totalPoints - (user.usedPoints || 0)),
        usedPoints: user.usedPoints || 0,
        totalServiceHours
      }
    }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function getPointsHistory(openid, { page = 1, pageSize = 20 }) {
  try {
    const skip = (page - 1) * pageSize
    const countRes = await db.collection('points_log')
      .where({ openid })
      .count()
    const res = await db.collection('points_log')
      .where({ openid })
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    return { code: 200, data: { list: res.data, total: countRes.total } }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function getRanking({ scope = 'all', page = 1, pageSize = 20 }) {
  try {
    const skip = (page - 1) * pageSize
    const query = { role: 'volunteer' }
    const res = await db.collection('users')
      .where(query)
      .orderBy('totalPoints', 'desc')
      .skip(skip)
      .limit(pageSize)
      .field({ nickname: true, avatar: true, totalPoints: true, totalServiceHours: true, starLevel: true })
      .get()
    return { code: 200, data: res.data }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function earnPoints(openid, { amount, reason, orderId }) {
  if (!amount || amount <= 0) return { code: 400, message: '积分数量无效' }
  try {
    await db.collection('users').where({ openid }).update({
      data: {
        totalPoints: _.inc(amount),
        availablePoints: _.inc(amount),
        updateTime: db.serverDate()
      }
    })
    await db.collection('points_log').add({
      data: {
        openid,
        type: 'earn',
        amount,
        reason: reason || '服务奖励',
        orderId: orderId || '',
        createTime: db.serverDate()
      }
    })
    return { code: 200, message: '积分到账' }
  } catch (e) {
    return { code: 500, message: '操作失败' }
  }
}

async function exchangePoints(openid, { goodsId, quantity = 1 }) {
  if (!goodsId) return { code: 400, message: '缺少商品ID' }
  try {
    const goodsRes = await db.collection('shop_goods').doc(goodsId).get()
    const goods = goodsRes.data
    if (!goods || goods.status !== 'active') return { code: 404, message: '商品不存在或已下架' }
    if (goods.stock < quantity) return { code: 400, message: '库存不足' }

    const totalCost = goods.pointsPrice * quantity

    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length === 0) return { code: 404, message: '用户不存在' }
    const user = userRes.data[0]
    if ((user.availablePoints || 0) < totalCost) return { code: 400, message: '积分不足' }

    await db.collection('users').where({ openid }).update({
      data: {
        availablePoints: _.inc(-totalCost),
        usedPoints: _.inc(totalCost),
        updateTime: db.serverDate()
      }
    })

    await db.collection('shop_goods').doc(goodsId).update({
      data: { stock: _.inc(-quantity), exchangeCount: _.inc(quantity) }
    })

    const orderRes = await db.collection('exchange_records').add({
      data: {
        openid,
        goodsId,
        goodsName: goods.name,
        goodsImage: goods.image || '',
        quantity,
        totalPoints: totalCost,
        status: 'pending',
        createTime: db.serverDate()
      }
    })

    await db.collection('points_log').add({
      data: {
        openid,
        type: 'spend',
        amount: -totalCost,
        reason: `兑换商品：${goods.name} x${quantity}`,
        orderId: orderRes._id,
        createTime: db.serverDate()
      }
    })

    return { code: 200, data: { orderId: orderRes._id }, message: '兑换成功' }
  } catch (e) {
    console.error('兑换失败', e)
    return { code: 500, message: '兑换失败' }
  }
}

async function getExchangeRecords(openid, { page = 1, pageSize = 20 }) {
  try {
    const skip = (page - 1) * pageSize
    const res = await db.collection('exchange_records')
      .where({ openid })
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    return { code: 200, data: res.data }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function getShopGoods({ category, page = 1, pageSize = 20 }) {
  try {
    const query = { status: 'active' }
    if (category) query.category = category
    const skip = (page - 1) * pageSize
    const countRes = await db.collection('shop_goods').where(query).count()
    const res = await db.collection('shop_goods')
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

async function getGoodsDetail({ goodsId }) {
  if (!goodsId) return { code: 400, message: '缺少商品ID' }
  try {
    const res = await db.collection('shop_goods').doc(goodsId).get()
    return { code: 200, data: res.data }
  } catch (e) {
    return { code: 404, message: '商品不存在' }
  }
}

async function adminListGoods({ page = 1, pageSize = 20 }) {
  try {
    const skip = (page - 1) * pageSize
    const countRes = await db.collection('shop_goods')
      .where({ status: _.neq('deleted') })
      .count()
    const res = await db.collection('shop_goods')
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

async function adminSaveGoods({ goodsData, goodsId }) {
  try {
    const now = db.serverDate()
    if (goodsId) {
      delete goodsData._id
      goodsData.updateTime = now
      await db.collection('shop_goods').doc(goodsId).update({ data: goodsData })
      return { code: 200, message: '更新成功' }
    } else {
      goodsData.status = goodsData.status || 'active'
      goodsData.exchangeCount = 0
      goodsData.sortOrder = goodsData.sortOrder || 100
      goodsData.createTime = now
      goodsData.updateTime = now
      const res = await db.collection('shop_goods').add({ data: goodsData })
      return { code: 200, data: { _id: res._id } }
    }
  } catch (e) {
    return { code: 500, message: '保存失败' }
  }
}

async function adminDeleteGoods({ goodsId }) {
  if (!goodsId) return { code: 400, message: '缺少商品ID' }
  try {
    await db.collection('shop_goods').doc(goodsId).update({
      data: { status: 'deleted', updateTime: db.serverDate() }
    })
    return { code: 200, message: '删除成功' }
  } catch (e) {
    return { code: 500, message: '删除失败' }
  }
}

async function adminListExchangeOrders({ page = 1, pageSize = 20, status }) {
  try {
    const query = {}
    if (status) query.status = status
    const skip = (page - 1) * pageSize
    const countRes = await db.collection('exchange_records').where(query).count()
    const res = await db.collection('exchange_records')
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

async function adminUpdateExchangeOrder({ orderId, status }) {
  if (!orderId) return { code: 400, message: '缺少订单ID' }
  const validStatus = ['pending', 'shipped', 'completed']
  if (!validStatus.includes(status)) return { code: 400, message: '无效状态' }
  try {
    await db.collection('exchange_records').doc(orderId).update({
      data: { status, updateTime: db.serverDate() }
    })
    return { code: 200, message: '更新成功' }
  } catch (e) {
    return { code: 500, message: '更新失败' }
  }
}
