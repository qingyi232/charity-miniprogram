const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action } = event
  const wxContext = cloud.getWXContext()

  switch (action) {
    case 'upload': return uploadHealthData(event)
    case 'latest': return getLatestData(event, wxContext)
    case 'history': return getHistoryData(event, wxContext)
    case 'deviceUpload': return deviceUploadData(event)
    case 'registerDevice': return registerDevice(event, wxContext)
    case 'seedMockData': return seedMockData(wxContext)
    default: return { code: 400, message: '未知操作' }
  }
}

async function deviceUploadData({ deviceId, userId, data, apiKey }) {
  if (!apiKey) {
    return { code: 401, message: '缺少 apiKey，请先注册设备获取密钥' }
  }
  if (!deviceId || !userId) {
    return { code: 400, message: '缺少设备编号或用户ID' }
  }
  if (!data || typeof data !== 'object') {
    return { code: 400, message: '缺少健康数据' }
  }

  try {
    const deviceRes = await db.collection('devices').where({
      deviceId: String(deviceId),
      apiKey: String(apiKey),
      status: 'active'
    }).get()

    if (deviceRes.data.length === 0) {
      return { code: 403, message: 'API Key 无效或设备未注册' }
    }

    const userRes = await db.collection('users').doc(userId).get()
    if (!userRes.data) return { code: 404, message: '用户不存在' }

    const sanitized = {
      systolic: Number(data.systolic) || null,
      diastolic: Number(data.diastolic) || null,
      heartRate: Number(data.heartRate) || null,
      bloodOxygen: Number(data.bloodOxygen) || null,
      bloodSugar: Number(data.bloodSugar) || null,
      temperature: Number(data.temperature) || null
    }

    const record = {
      userId,
      deviceId: String(deviceId),
      ...sanitized,
      source: 'device',
      createTime: db.serverDate()
    }

    await db.collection('health_data').add({ data: record })

    await db.collection('devices').where({
      deviceId: String(deviceId), apiKey: String(apiKey)
    }).update({ data: { lastUploadTime: db.serverDate() } })

    const alerts = checkHealthAlerts(data)
    if (alerts.length > 0) {
      await sendHealthAlerts(userId, alerts)
    }

    return { code: 200, message: '数据上传成功' }
  } catch (e) {
    console.error('设备数据上传失败', e)
    return { code: 500, message: '上传失败' }
  }
}

async function registerDevice({ deviceId, deviceType, manufacturer, apiKey }, wxContext) {
  if (!deviceId) return { code: 400, message: '缺少设备编号 deviceId' }

  try {
    const existing = await db.collection('devices').where({ deviceId: String(deviceId) }).get()
    if (existing.data.length > 0) {
      return { code: 409, message: '设备已注册', data: { deviceId, apiKey: existing.data[0].apiKey } }
    }

    const generatedKey = 'hk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)

    await db.collection('devices').add({
      data: {
        deviceId: String(deviceId),
        deviceType: deviceType || 'health_monitor',
        manufacturer: manufacturer || '',
        apiKey: generatedKey,
        status: 'active',
        lastUploadTime: null,
        createTime: db.serverDate()
      }
    })

    return {
      code: 200,
      message: '设备注册成功',
      data: { deviceId, apiKey: generatedKey }
    }
  } catch (e) {
    console.error('设备注册失败', e)
    return { code: 500, message: '注册失败' }
  }
}

async function seedMockData(wxContext) {
  try {
    const openid = wxContext.OPENID
    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length === 0) return { code: 401, message: '请先登录' }

    const userId = userRes.data[0]._id
    const now = new Date()
    const records = []

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      date.setHours(8, 0, 0, 0)

      records.push({
        userId,
        deviceId: 'MOCK_DEVICE',
        systolic: 110 + Math.floor(Math.random() * 35),
        diastolic: 65 + Math.floor(Math.random() * 25),
        heartRate: 60 + Math.floor(Math.random() * 30),
        bloodOxygen: 94 + Math.floor(Math.random() * 6),
        bloodSugar: +(4.0 + Math.random() * 3).toFixed(1),
        temperature: +(36.0 + Math.random() * 1.2).toFixed(1),
        source: 'mock',
        createTime: date
      })
    }

    let count = 0
    for (const r of records) {
      await db.collection('health_data').add({ data: r })
      count++
    }

    return { code: 200, message: `已导入 ${count} 条模拟健康数据（近7天）` }
  } catch (e) {
    console.error('导入模拟数据失败', e)
    return { code: 500, message: '导入失败' }
  }
}

async function uploadHealthData({ userId, data }) {
  try {
    const record = {
      userId,
      systolic: data.systolic || null,
      diastolic: data.diastolic || null,
      heartRate: data.heartRate || null,
      bloodOxygen: data.bloodOxygen || null,
      bloodSugar: data.bloodSugar || null,
      temperature: data.temperature || null,
      source: 'manual',
      createTime: db.serverDate()
    }

    await db.collection('health_data').add({ data: record })
    return { code: 200, message: '记录成功' }
  } catch (e) {
    return { code: 500, message: '记录失败' }
  }
}

async function getLatestData({ userId }, wxContext) {
  try {
    const targetId = userId || ''
    let query = {}

    if (targetId) {
      query.userId = targetId
    } else {
      const openid = wxContext.OPENID
      const userRes = await db.collection('users').where({ openid }).get()
      if (userRes.data.length === 0) return { code: 401, message: '请先登录' }
      query.userId = userRes.data[0]._id
    }

    const res = await db.collection('health_data')
      .where(query)
      .orderBy('createTime', 'desc')
      .limit(1)
      .get()

    return { code: 200, data: res.data[0] || null }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

async function getHistoryData({ userId, days = 7, page = 1, pageSize = 20 }, wxContext) {
  try {
    let targetId = userId
    if (!targetId) {
      const openid = wxContext.OPENID
      const userRes = await db.collection('users').where({ openid }).get()
      if (userRes.data.length === 0) return { code: 401, message: '请先登录' }
      targetId = userRes.data[0]._id
    }

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const skip = (page - 1) * pageSize
    const res = await db.collection('health_data')
      .where({
        userId: targetId,
        createTime: db.command.gte(startDate)
      })
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()

    return { code: 200, data: res.data }
  } catch (e) {
    return { code: 500, message: '查询失败' }
  }
}

function checkHealthAlerts(data) {
  const alerts = []
  if (data.systolic && (data.systolic > 140 || data.systolic < 90)) {
    alerts.push({ type: 'bloodPressure', message: `血压异常: ${data.systolic}/${data.diastolic} mmHg`, level: 'warning' })
  }
  if (data.heartRate && (data.heartRate > 100 || data.heartRate < 50)) {
    alerts.push({ type: 'heartRate', message: `心率异常: ${data.heartRate} bpm`, level: 'warning' })
  }
  if (data.bloodOxygen && data.bloodOxygen < 94) {
    alerts.push({ type: 'bloodOxygen', message: `血氧偏低: ${data.bloodOxygen}%`, level: 'danger' })
  }
  if (data.temperature && (data.temperature > 37.5 || data.temperature < 35)) {
    alerts.push({ type: 'temperature', message: `体温异常: ${data.temperature}°C`, level: 'warning' })
  }
  return alerts
}

async function sendHealthAlerts(userId, alerts) {
  try {
    // 查找结对志愿者
    const pairRes = await db.collection('pairs')
      .where({ elderId: userId, status: 'active' })
      .get()

    for (const alert of alerts) {
      const msg = {
        type: 'health_alert',
        fromUserId: 'system',
        toUserId: userId,
        content: alert.message,
        level: alert.level,
        read: false,
        createTime: db.serverDate()
      }
      await db.collection('messages').add({ data: msg })

      // 通知结对志愿者
      for (const pair of pairRes.data) {
        await db.collection('messages').add({
          data: { ...msg, toUserId: pair.volunteerId }
        })
      }
    }
  } catch (e) {
    console.error('发送健康预警失败', e)
  }
}
