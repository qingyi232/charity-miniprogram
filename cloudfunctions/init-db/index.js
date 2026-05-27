const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const COLLECTIONS = [
  'users', 'orders', 'pairs', 'messages', 'points_log',
  'shop_goods', 'exchange_records', 'admins', 'health_data',
  'announcements', 'service_records', 'service_checkins',
  'supplement_records', 'certificates', 'reject_logs',
  'training_content', 'elder_shop_goods', 'elder_shop_orders',
  'activity_signups', 'favorites'
]

const TEST_DATA = {
  admins: [
    { _id: 'admin001', username: 'admin', password: 'admin123', role: 'superAdmin', status: 'active', createTime: new Date('2026-01-01') }
  ],
  users: [
    { _id: 'elder001', openid: 'test_elder_001', nickname: '张奶奶', phone: '13800001001', role: 'elder', verified: true, age: 72, address: '幸福社区3号楼', emergencyContacts: [{ name: '张明', phone: '13900001001', relation: '儿子' }], createTime: new Date('2026-01-15') },
    { _id: 'elder002', openid: 'test_elder_002', nickname: '李爷爷', phone: '13800001002', role: 'elder', verified: true, age: 78, address: '和谐社区5号楼', emergencyContacts: [{ name: '李华', phone: '13900001002', relation: '女儿' }, { name: '李强', phone: '13900001003', relation: '儿子' }], createTime: new Date('2026-02-10') },
    { _id: 'elder003', openid: 'test_elder_003', nickname: '王阿姨', phone: '13800001003', role: 'elder', verified: true, age: 68, address: '阳光社区2号楼', emergencyContacts: [{ name: '王芳', phone: '13900001004', relation: '女儿' }], createTime: new Date('2026-03-05') },
    { _id: 'volunteer001', openid: 'test_vol_001', nickname: '小陈', phone: '13800002001', role: 'volunteer', verified: true, serviceArea: '幸福社区', serviceTypes: ['代购', '陪伴', '就医陪同'], totalServiceHours: 56, points: 560, createTime: new Date('2026-01-20') },
    { _id: 'volunteer002', openid: 'test_vol_002', nickname: '小刘', phone: '13800002002', role: 'volunteer', verified: true, serviceArea: '和谐社区', serviceTypes: ['家务', '陪伴'], totalServiceHours: 32, points: 320, createTime: new Date('2026-02-15') },
    { _id: 'volunteer003', openid: 'test_vol_003', nickname: '小赵', phone: '13800002003', role: 'volunteer', verified: false, serviceArea: '阳光社区', serviceTypes: ['代购', '就医陪同'], totalServiceHours: 0, points: 0, createTime: new Date('2026-05-20') }
  ],
  orders: [
    { _id: 'order001', title: '帮忙去超市买菜', category: '代购', elderName: '张奶奶', elderId: 'elder001', volunteerName: '小陈', volunteerId: 'volunteer001', status: 'completed', address: '幸福社区3号楼', description: '需要买一些蔬菜和水果', createTime: new Date('2026-04-10') },
    { _id: 'order002', title: '陪同去医院检查', category: '就医陪同', elderName: '李爷爷', elderId: 'elder002', volunteerName: '小陈', volunteerId: 'volunteer001', status: 'completed', address: '和谐社区5号楼', description: '例行体检需要人陪同', createTime: new Date('2026-04-15') },
    { _id: 'order003', title: '聊天陪伴', category: '陪伴', elderName: '王阿姨', elderId: 'elder003', volunteerName: '小刘', volunteerId: 'volunteer002', status: 'in_progress', address: '阳光社区2号楼', description: '老人独居希望有人陪聊', createTime: new Date('2026-05-20') },
    { _id: 'order004', title: '代买药品', category: '代购', elderName: '张奶奶', elderId: 'elder001', status: 'pending', address: '幸福社区3号楼', description: '需要去药店买降压药', urgent: true, createTime: new Date('2026-05-24') },
    { _id: 'order005', title: '打扫卫生', category: '家务', elderName: '李爷爷', elderId: 'elder002', status: 'pending', address: '和谐社区5号楼', description: '房间需要打扫整理', createTime: new Date('2026-05-25') }
  ],
  pairs: [
    { _id: 'pair001', elderId: 'elder001', elderName: '张奶奶', volunteerId: 'volunteer001', volunteerName: '小陈', status: 'active', createTime: new Date('2026-02-01') },
    { _id: 'pair002', elderId: 'elder002', elderName: '李爷爷', volunteerId: 'volunteer001', volunteerName: '小陈', status: 'active', createTime: new Date('2026-03-01') },
    { _id: 'pair003', elderId: 'elder003', elderName: '王阿姨', volunteerId: 'volunteer002', volunteerName: '小刘', status: 'active', createTime: new Date('2026-04-01') }
  ],
  messages: [
    { _id: 'sos001', type: 'sos', fromUserId: 'elder001', fromUserName: '张奶奶', content: '感觉头很晕站不稳', location: { lat: 31.2304, lng: 121.4737 }, read: false, createTime: new Date('2026-05-24T15:30:00') },
    { _id: 'sos002', type: 'sos', fromUserId: 'elder002', fromUserName: '李爷爷', content: '摔倒了需要帮助', location: { lat: 31.232, lng: 121.475 }, read: false, createTime: new Date('2026-05-25T10:00:00') },
    { _id: 'sos003', type: 'sos', fromUserId: 'elder003', fromUserName: '王阿姨', content: '家里水管漏水了', location: { lat: 31.228, lng: 121.47 }, read: true, createTime: new Date('2026-05-23T16:00:00') }
  ],
  health_data: [
    { _id: 'health001', userId: 'elder001', systolic: 135, diastolic: 85, heartRate: 72, bloodOxygen: 97, bloodSugar: 5.8, temperature: 36.5, source: '手动录入', createTime: new Date('2026-05-24T08:00:00') },
    { _id: 'health002', userId: 'elder002', systolic: 155, diastolic: 95, heartRate: 88, bloodOxygen: 93, bloodSugar: 7.2, temperature: 36.8, source: '智能设备', createTime: new Date('2026-05-24T09:00:00') },
    { _id: 'health003', userId: 'elder003', systolic: 128, diastolic: 80, heartRate: 68, bloodOxygen: 98, bloodSugar: 5.5, temperature: 36.4, source: '手动录入', createTime: new Date('2026-05-25T07:30:00') },
    { _id: 'health004', userId: 'elder001', systolic: 142, diastolic: 92, heartRate: 76, bloodOxygen: 96, bloodSugar: 6.1, temperature: 36.6, source: '智能设备', createTime: new Date('2026-05-25T08:00:00') }
  ],
  shop_goods: [
    { _id: 'goods001', name: '志愿者荣誉证书', category: 'certificate', pointsPrice: 100, stock: 999, exchangeCount: 12, description: '电子公益服务证书可下载打印', status: 'active', createTime: new Date('2026-01-01') },
    { _id: 'goods002', name: '爱心志愿者徽章', category: 'gift', pointsPrice: 200, stock: 50, exchangeCount: 8, description: '精美金属徽章彰显志愿精神', status: 'active', createTime: new Date('2026-01-15') },
    { _id: 'goods003', name: '急救技能培训课程', category: 'course', pointsPrice: 300, stock: 30, exchangeCount: 5, description: '老年急救基础培训线上课程', status: 'active', createTime: new Date('2026-02-01') },
    { _id: 'goods004', name: '志愿者文化衫', category: 'gift', pointsPrice: 500, stock: 20, exchangeCount: 3, description: '纯棉定制文化衫印有公益标志', status: 'active', createTime: new Date('2026-03-01') }
  ],
  announcements: [
    { _id: 'ann001', title: '五月社区公益活动招募', type: 'activity', content: '本月将在幸福社区举办暖心陪伴公益活动招募志愿者10名', isTop: true, status: 'active', createTime: new Date('2026-05-01') },
    { _id: 'ann002', title: '平台新功能上线通知', type: 'notice', content: '积分商城功能已正式上线志愿者可通过服务积累积分兑换奖励', isTop: false, status: 'active', createTime: new Date('2026-05-10') },
    { _id: 'ann003', title: '夏季高温关怀提醒', type: 'notice', content: '近期气温持续升高请志愿者在服务过程中注意老人防暑降温', isTop: true, status: 'active', createTime: new Date('2026-05-20') }
  ]
}

exports.main = async (event, context) => {
  const results = []

  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name)
      results.push({ name, status: 'created' })
    } catch (e) {
      if (e.errCode === -502005 || (e.message && e.message.includes('already exists'))) {
        results.push({ name, status: 'already_exists' })
      } else {
        results.push({ name, status: 'error', error: e.message })
      }
    }
  }

  if (event.seedData) {
    for (const [colName, records] of Object.entries(TEST_DATA)) {
      let inserted = 0, skipped = 0
      for (const record of records) {
        try {
          await db.collection(colName).add({ data: record })
          inserted++
        } catch (e) {
          skipped++
        }
      }
      results.push({ name: colName, seedStatus: `inserted:${inserted}, skipped:${skipped}` })
    }
  }

  return { total: COLLECTIONS.length, seedData: !!event.seedData, results }
}
