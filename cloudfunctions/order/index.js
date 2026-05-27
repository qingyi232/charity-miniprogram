const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action } = event
  const wxContext = cloud.getWXContext()

  switch (action) {
    case 'create': return createOrder(event, wxContext)
    case 'list': return listOrders(event, wxContext)
    case 'myOrders': return myOrders(event, wxContext)
    case 'detail': return orderDetail(event, wxContext)
    case 'accept': return acceptOrder(event, wxContext)
    case 'complete': return completeOrder(event, wxContext)
    case 'cancel': return cancelOrder(event, wxContext)
    case 'rate': return rateOrder(event, wxContext)
    case 'checkIn': return checkIn(event, wxContext)
    case 'checkOut': return checkOut(event, wxContext)
    case 'reject': return rejectOrder(event, wxContext)
    default: return { code: 400, message: '未知操作' }
  }
}

async function createOrder({ data }, wxContext) {
  const openid = wxContext.OPENID
  try {
    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length === 0) return { code: 401, message: '请先登录' }
    const user = userRes.data[0]

    const now = db.serverDate()
    const order = {
      elderId: user._id,
      elderName: user.nickname || '老人',
      elderAvatar: user.avatar || '',
      elderPhone: user.phone || '',
      elderAddress: user.address || '',
      title: data.title,
      description: data.description,
      category: data.category,
      serviceTime: data.serviceTime,
      location: data.location || {},
      address: data.address || user.address,
      urgency: data.urgency || 3,
      volunteerId: '',
      volunteerName: '',
      status: 'pending',
      rating: 0,
      comment: '',
      createTime: now,
      updateTime: now,
      acceptTime: null,
      completeTime: null
    }

    const res = await db.collection('orders').add({ data: order })
    return { code: 200, data: { _id: res._id } }
  } catch (e) {
    console.error('创建订单失败', e)
    return { code: 500, message: '创建失败' }
  }
}

async function listOrders({ page = 1, pageSize = 10, category, status }) {
  try {
    const query = {}
    if (category) query.category = category
    query.status = status || 'pending'

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

async function myOrders({ role, status, page = 1, pageSize = 10 }, wxContext) {
  const openid = wxContext.OPENID
  try {
    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length === 0) return { code: 401, message: '请先登录' }
    const userId = userRes.data[0]._id

    const query = {}
    if (role === 'elder') {
      query.elderId = userId
    } else {
      query.volunteerId = userId
    }
    if (status) query.status = status

    const skip = (page - 1) * pageSize
    const countRes = await db.collection('orders').where(query).count()
    const res = await db.collection('orders')
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

async function orderDetail({ orderId }) {
  try {
    const res = await db.collection('orders').doc(orderId).get()
    return { code: 200, data: res.data }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function acceptOrder({ orderId }, wxContext) {
  const openid = wxContext.OPENID
  if (!orderId) return { code: 400, message: '缺少订单ID' }
  try {
    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length === 0) return { code: 401, message: '请先登录' }
    const volunteer = userRes.data[0]
    if (volunteer.role !== 'volunteer') return { code: 403, message: '仅志愿者可接单' }

    const orderRes = await db.collection('orders').doc(orderId).get()
    if (orderRes.data.status !== 'pending') {
      return { code: 400, message: '订单已被接单' }
    }
    if (orderRes.data.elderId === volunteer._id) {
      return { code: 400, message: '不能接自己的订单' }
    }

    await db.collection('orders').doc(orderId).update({
      data: {
        volunteerId: volunteer._id,
        volunteerName: volunteer.nickname || '志愿者',
        volunteerAvatar: volunteer.avatar || '',
        volunteerPhone: volunteer.phone || '',
        status: 'accepted',
        acceptTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })

    await autoCreatePair(orderRes.data.elderId, volunteer._id, volunteer)

    try {
      await db.collection('messages').add({
        data: {
          fromUserId: volunteer._id,
          fromUserName: volunteer.nickname || '志愿者',
          toUserId: orderRes.data.elderId,
          content: `志愿者 ${volunteer.nickname || ''} 已接单您的帮扶需求「${orderRes.data.title || ''}」，请查看订单详情。`,
          type: 'order_notice',
          orderId,
          read: false,
          createTime: db.serverDate()
        }
      })
    } catch (msgErr) {
      console.log('消息发送跳过', msgErr.message)
    }

    return { code: 200, message: '接单成功' }
  } catch (e) {
    return { code: 500, message: '接单失败' }
  }
}

async function completeOrder({ orderId }, wxContext) {
  const openid = wxContext.OPENID
  if (!orderId) return { code: 400, message: '缺少订单ID' }
  try {
    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length === 0) return { code: 401, message: '请先登录' }
    const user = userRes.data[0]
    const userId = user._id

    const orderRes = await db.collection('orders').doc(orderId).get()
    const order = orderRes.data
    if (order.volunteerId !== userId && order.elderId !== userId) {
      return { code: 403, message: '无权操作此订单' }
    }
    if (order.status !== 'accepted' && order.status !== 'in_progress') {
      return { code: 400, message: '订单状态不允许完成' }
    }

    const serviceHours = order.serviceHours || 1
    await db.collection('orders').doc(orderId).update({
      data: {
        status: 'completed',
        serviceHours,
        completeTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })

    if (order.volunteerId) {
      const earnedPoints = Math.round(serviceHours * 10)
      try {
        const volUser = await db.collection('users').doc(order.volunteerId).get()
        const volOpenid = volUser.data.openid
        await db.collection('users').doc(order.volunteerId).update({
          data: {
            totalServiceHours: _.inc(serviceHours),
            totalPoints: _.inc(earnedPoints),
            availablePoints: _.inc(earnedPoints),
            updateTime: db.serverDate()
          }
        })
        await db.collection('points_log').add({
          data: {
            openid: volOpenid,
            userId: order.volunteerId,
            type: 'earn',
            amount: earnedPoints,
            reason: `完成服务：${order.title || '帮扶任务'}`,
            orderId,
            createTime: db.serverDate()
          }
        })
      } catch (e) {
        console.log('积分/时长更新跳过', e.message)
      }
    }

    if (order.volunteerId && order.elderId) {
      let volunteer = user
      if (userId === order.elderId) {
        const volRes = await db.collection('users').doc(order.volunteerId).get()
        volunteer = volRes.data
      }
      await autoCreatePair(order.elderId, order.volunteerId, volunteer)
    }

    return { code: 200, message: '订单已完成' }
  } catch (e) {
    return { code: 500, message: '操作失败' }
  }
}

async function cancelOrder({ orderId }, wxContext) {
  const openid = wxContext.OPENID
  if (!orderId) return { code: 400, message: '缺少订单ID' }
  try {
    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length === 0) return { code: 401, message: '请先登录' }
    const userId = userRes.data[0]._id

    const orderRes = await db.collection('orders').doc(orderId).get()
    if (orderRes.data.elderId !== userId) {
      return { code: 403, message: '只能取消自己的订单' }
    }
    if (orderRes.data.status === 'completed' || orderRes.data.status === 'cancelled') {
      return { code: 400, message: '订单已完成或已取消' }
    }

    await db.collection('orders').doc(orderId).update({
      data: { status: 'cancelled', updateTime: db.serverDate() }
    })
    return { code: 200, message: '订单已取消' }
  } catch (e) {
    return { code: 500, message: '取消失败' }
  }
}

async function rateOrder({ orderId, rating, comment }, wxContext) {
  const openid = wxContext.OPENID
  if (!orderId) return { code: 400, message: '缺少订单ID' }
  if (!rating || rating < 1 || rating > 5) return { code: 400, message: '评分须为1-5' }
  try {
    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length === 0) return { code: 401, message: '请先登录' }
    const userId = userRes.data[0]._id

    const orderRes = await db.collection('orders').doc(orderId).get()
    if (orderRes.data.elderId !== userId) {
      return { code: 403, message: '只能评价自己的订单' }
    }
    if (orderRes.data.status !== 'completed') {
      return { code: 400, message: '订单未完成，无法评价' }
    }
    if (orderRes.data.rating > 0) {
      return { code: 400, message: '已评价过' }
    }

    await db.collection('orders').doc(orderId).update({
      data: { rating, comment: comment || '', updateTime: db.serverDate() }
    })
    return { code: 200, message: '评价成功' }
  } catch (e) {
    return { code: 500, message: '评价失败' }
  }
}

async function checkIn({ orderId, location }, wxContext) {
  const openid = wxContext.OPENID
  if (!orderId) return { code: 400, message: '缺少订单ID' }
  try {
    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length === 0) return { code: 401, message: '请先登录' }
    const userId = userRes.data[0]._id

    const orderRes = await db.collection('orders').doc(orderId).get()
    if (orderRes.data.volunteerId !== userId) {
      return { code: 403, message: '无权操作此订单' }
    }
    if (orderRes.data.status !== 'accepted') {
      return { code: 400, message: '订单状态不允许签到' }
    }

    await db.collection('orders').doc(orderId).update({
      data: {
        status: 'in_progress',
        checkInTime: db.serverDate(),
        checkInLocation: location || null,
        updateTime: db.serverDate()
      }
    })

    await db.collection('service_records').add({
      data: {
        orderId,
        volunteerId: userId,
        elderId: orderRes.data.elderId,
        type: 'check_in',
        location: location || null,
        createTime: db.serverDate()
      }
    })

    return { code: 200, message: '签到成功' }
  } catch (e) {
    return { code: 500, message: '签到失败' }
  }
}

async function checkOut({ orderId, location, serviceNote }, wxContext) {
  const openid = wxContext.OPENID
  if (!orderId) return { code: 400, message: '缺少订单ID' }
  try {
    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length === 0) return { code: 401, message: '请先登录' }
    const volunteer = userRes.data[0]
    const userId = volunteer._id

    const orderRes = await db.collection('orders').doc(orderId).get()
    const order = orderRes.data
    if (order.volunteerId !== userId) {
      return { code: 403, message: '无权操作此订单' }
    }
    if (order.status !== 'in_progress') {
      return { code: 400, message: '请先签到' }
    }

    const checkInTime = order.checkInTime
    let serviceHours = 1
    if (checkInTime) {
      const diffMs = Date.now() - new Date(checkInTime).getTime()
      serviceHours = Math.max(0.5, Math.round(diffMs / 3600000 * 10) / 10)
    }

    await db.collection('orders').doc(orderId).update({
      data: {
        status: 'completed',
        checkOutTime: db.serverDate(),
        checkOutLocation: location || null,
        serviceHours,
        serviceNote: serviceNote || '',
        completeTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })

    await db.collection('service_records').add({
      data: {
        orderId,
        volunteerId: userId,
        elderId: order.elderId,
        type: 'check_out',
        serviceHours,
        serviceNote: serviceNote || '',
        location: location || null,
        createTime: db.serverDate()
      }
    })

    const earnedPoints = Math.round(serviceHours * 10)
    await db.collection('users').where({ openid }).update({
      data: {
        totalServiceHours: _.inc(serviceHours),
        totalPoints: _.inc(earnedPoints),
        availablePoints: _.inc(earnedPoints),
        updateTime: db.serverDate()
      }
    })

    try {
      await db.collection('points_log').add({
        data: {
          openid,
          userId,
          type: 'earn',
          amount: earnedPoints,
          reason: `完成服务：${order.title || '帮扶任务'}（${serviceHours}小时）`,
          orderId,
          createTime: db.serverDate()
        }
      })
    } catch (logErr) {
      console.log('积分日志记录跳过', logErr.message)
    }

    await autoCreatePair(order.elderId, userId, volunteer)

    return { code: 200, message: '签退成功', data: { serviceHours, earnedPoints } }
  } catch (e) {
    return { code: 500, message: '签退失败' }
  }
}

async function autoCreatePair(elderId, volunteerId, volunteer) {
  try {
    const existRes = await db.collection('pairs').where({
      elderId, volunteerId, status: 'active'
    }).get()

    if (existRes.data.length > 0) {
      await db.collection('pairs').doc(existRes.data[0]._id).update({
        data: {
          serviceCount: _.inc(1),
          lastServiceTime: db.serverDate()
        }
      })
      return
    }

    const elderRes = await db.collection('users').doc(elderId).get()
    const elder = elderRes.data

    const now = new Date()
    const pairDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    await db.collection('pairs').add({
      data: {
        elderId,
        elderName: elder.nickname || '老人',
        elderAvatar: elder.avatar || '',
        elderPhone: elder.phone || '',
        volunteerId,
        volunteerName: volunteer.nickname || '志愿者',
        volunteerAvatar: volunteer.avatar || '',
        volunteerPhone: volunteer.phone || '',
        volunteerLevel: volunteer.level || '初级志愿者',
        volunteerServiceHours: volunteer.totalServiceHours || 0,
        serviceCount: 1,
        pairDate,
        status: 'active',
        createTime: db.serverDate(),
        lastServiceTime: db.serverDate()
      }
    })
  } catch (e) {
    console.error('自动结对失败（不影响签退）', e)
  }
}

async function rejectOrder({ orderId, reason }, wxContext) {
  const openid = wxContext.OPENID
  if (!orderId) return { code: 400, message: '缺少订单ID' }
  try {
    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length === 0) return { code: 401, message: '请先登录' }
    const userId = userRes.data[0]._id

    const orderRes = await db.collection('orders').doc(orderId).get()
    if (orderRes.data.status === 'pending') {
      await db.collection('reject_logs').add({
        data: {
          orderId,
          volunteerId: userId,
          reason: reason || '',
          createTime: db.serverDate()
        }
      })
      return { code: 200, message: '已拒绝' }
    }

    if (orderRes.data.volunteerId !== userId) {
      return { code: 403, message: '无权操作此订单' }
    }
    if (orderRes.data.status !== 'accepted') {
      return { code: 400, message: '只能放弃已接单的订单' }
    }

    await db.collection('orders').doc(orderId).update({
      data: {
        volunteerId: '',
        volunteerName: '',
        status: 'pending',
        acceptTime: null,
        rejectReason: reason || '',
        updateTime: db.serverDate()
      }
    })
    return { code: 200, message: '已放弃订单' }
  } catch (e) {
    return { code: 500, message: '操作失败' }
  }
}
