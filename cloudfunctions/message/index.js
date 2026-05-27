const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action } = event
  const wxContext = cloud.getWXContext()

  switch (action) {
    case 'send': return sendMessage(event, wxContext)
    case 'list': return listMessages(event, wxContext)
    case 'chatHistory': return chatHistory(event, wxContext)
    case 'markRead': return markRead(event, wxContext)
    case 'unreadCount': return unreadCount(event, wxContext)
    case 'sendSOS': return sendSOS(event, wxContext)
    default: return { code: 400, message: '未知操作' }
  }
}

async function sendMessage({ toUserId, content, msgType = 'text', voiceDuration }, wxContext) {
  const openid = wxContext.OPENID
  try {
    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length === 0) return { code: 401, message: '请先登录' }
    const sender = userRes.data[0]

    const msgData = {
      type: 'chat',
      msgType,
      fromUserId: sender._id,
      fromUserName: sender.nickname || '用户',
      fromUserAvatar: sender.avatar || '',
      toUserId,
      content,
      read: false,
      createTime: db.serverDate()
    }

    if (msgType === 'voice' && voiceDuration) {
      msgData.voiceDuration = Number(voiceDuration)
    }

    await db.collection('messages').add({ data: msgData })

    return { code: 200, message: '发送成功' }
  } catch (e) {
    return { code: 500, message: '发送失败' }
  }
}

async function listMessages({ page = 1, pageSize = 20 }, wxContext) {
  const openid = wxContext.OPENID
  try {
    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length === 0) return { code: 401, message: '请先登录' }
    const userId = userRes.data[0]._id

    const skip = (page - 1) * pageSize
    const res = await db.collection('messages')
      .where({ toUserId: userId })
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()

    return { code: 200, data: res.data }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function chatHistory({ targetUserId, page = 1, pageSize = 30 }, wxContext) {
  const openid = wxContext.OPENID
  try {
    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length === 0) return { code: 401, message: '请先登录' }
    const userId = userRes.data[0]._id

    const skip = (page - 1) * pageSize
    const res = await db.collection('messages')
      .where(_.or([
        { fromUserId: userId, toUserId: targetUserId, type: 'chat' },
        { fromUserId: targetUserId, toUserId: userId, type: 'chat' }
      ]))
      .orderBy('createTime', 'asc')
      .skip(skip)
      .limit(pageSize)
      .get()

    return { code: 200, data: res.data }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function markRead({ messageIds }, wxContext) {
  const openid = wxContext.OPENID
  if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
    return { code: 400, message: '缺少消息ID' }
  }
  try {
    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length === 0) return { code: 401, message: '请先登录' }
    const userId = userRes.data[0]._id

    let markedCount = 0
    for (const id of messageIds) {
      const msgRes = await db.collection('messages').doc(id).get()
      if (msgRes.data.toUserId === userId) {
        await db.collection('messages').doc(id).update({ data: { read: true } })
        markedCount++
      }
    }
    return { code: 200, message: '已读', data: { markedCount } }
  } catch (e) {
    return { code: 500, message: '标记失败' }
  }
}

async function unreadCount(event, wxContext) {
  const openid = wxContext.OPENID
  try {
    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length === 0) return { code: 200, data: 0 }
    const userId = userRes.data[0]._id

    const res = await db.collection('messages')
      .where({ toUserId: userId, read: false })
      .count()
    return { code: 200, data: res.total }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function sendSOS({ userId, location }, wxContext) {
  try {
    const userRes = await db.collection('users').doc(userId).get()
    const elder = userRes.data

    const pairRes = await db.collection('pairs')
      .where({ elderId: userId, status: 'active' })
      .get()

    const sosContent = `[紧急求助] 老人：${elder.nickname || '未知'}\n地址：${elder.address || '未知'}\n${location ? `定位：${location.lat}, ${location.lng}` : '未获取定位'}`

    for (const pair of pairRes.data) {
      await db.collection('messages').add({
        data: {
          type: 'sos',
          msgType: 'sos',
          fromUserId: userId,
          fromUserName: elder.nickname || '老人',
          toUserId: pair.volunteerId,
          content: sosContent,
          read: false,
          location,
          createTime: db.serverDate()
        }
      })
    }

    await db.collection('messages').add({
      data: {
        type: 'sos',
        msgType: 'sos',
        fromUserId: userId,
        fromUserName: elder.nickname || '老人',
        toUserId: 'admin',
        content: sosContent,
        read: false,
        location,
        createTime: db.serverDate()
      }
    })

    return { code: 200, message: '求助信号已发送' }
  } catch (e) {
    console.error('SOS发送失败', e)
    return { code: 500, message: '发送失败' }
  }
}
