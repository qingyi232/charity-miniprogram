const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const COLLECTIONS = [
  'users', 'orders', 'pairs', 'messages',
  'health_data', 'announcements', 'service_records',
  'activity_signups', 'admins', 'devices', 'certificates'
]

exports.main = async (event, context) => {
  const { action } = event
  if (action === 'createCollections') return createAllCollections()
  if (action === 'seedData') return seedAllData()
  if (action === 'initAll') {
    const createResult = await createAllCollections()
    const seedResult = await seedAllData()
    return { code: 200, message: '初始化完成', createResult, seedResult }
  }
  return { code: 400, message: '请传入 action: createCollections / seedData / initAll' }
}

async function createAllCollections() {
  const results = []
  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name)
      results.push({ collection: name, status: 'created' })
    } catch (e) {
      if (e.errCode === -502005 || (e.message && e.message.includes('already exists'))) {
        results.push({ collection: name, status: 'already_exists' })
      } else {
        results.push({ collection: name, status: 'error', message: e.message })
      }
    }
  }
  return { code: 200, data: results }
}

async function seedAllData() {
  const results = []

  const users = [
    {_id:'user_elder_001',openid:'oTest_elder_001',role:'elder',nickname:'张奶奶',name:'张秀英',avatar:'',phone:'13812341234',age:72,gender:'女',address:'北京市朝阳区幸福小区3号楼',addressDetail:'2单元501',location:{lat:39.9042,lng:116.4074},height:158,weight:55,medicalHistory:'高血压、轻度糖尿病',emergencyContacts:[{name:'张明',phone:'13912345678',relation:'儿子'},{name:'李红',phone:'13698765432',relation:'女儿'}],serviceTypes:[],serviceArea:'',totalServiceHours:0,starLevel:1,verified:true,status:'active',createTime:new Date('2026-01-15'),updateTime:new Date('2026-05-10')},
    {_id:'user_elder_002',openid:'oTest_elder_002',role:'elder',nickname:'王大爷',name:'王建国',avatar:'',phone:'13798765432',age:78,gender:'男',address:'北京市海淀区阳光花园1号楼',addressDetail:'3单元102',location:{lat:39.9842,lng:116.3074},height:170,weight:65,medicalHistory:'冠心病',emergencyContacts:[{name:'王刚',phone:'13711112222',relation:'儿子'}],serviceTypes:[],serviceArea:'',totalServiceHours:0,starLevel:1,verified:true,status:'active',createTime:new Date('2026-02-20'),updateTime:new Date('2026-05-10')},
    {_id:'user_elder_003',openid:'oTest_elder_003',role:'elder',nickname:'刘阿姨',name:'刘芳',avatar:'',phone:'13687654321',age:68,gender:'女',address:'北京市西城区和平里8号',addressDetail:'1楼101',location:{lat:39.9342,lng:116.3874},height:155,weight:52,medicalHistory:'',emergencyContacts:[],serviceTypes:[],serviceArea:'',totalServiceHours:0,starLevel:1,verified:true,status:'active',createTime:new Date('2026-03-10'),updateTime:new Date('2026-05-10')},
    {_id:'user_vol_001',openid:'oTest_vol_001',role:'volunteer',nickname:'李志愿',name:'李明',avatar:'',phone:'13912345678',age:22,gender:'男',address:'北京市朝阳区',serviceTypes:['陪伴','代购','就医陪同'],serviceArea:'朝阳区',totalServiceHours:45,starLevel:2,verified:true,status:'active',createTime:new Date('2026-01-20'),updateTime:new Date('2026-05-15')},
    {_id:'user_vol_002',openid:'oTest_vol_002',role:'volunteer',nickname:'赵小明',name:'赵强',avatar:'',phone:'13856781234',age:20,gender:'男',address:'北京市海淀区',serviceTypes:['家务','陪伴'],serviceArea:'海淀区',totalServiceHours:28,starLevel:1,verified:true,status:'active',createTime:new Date('2026-02-15'),updateTime:new Date('2026-05-15')},
    {_id:'user_vol_003',openid:'oTest_vol_003',role:'volunteer',nickname:'陈小芳',name:'陈芳',avatar:'',phone:'13712349876',age:21,gender:'女',address:'北京市西城区',serviceTypes:['就医陪同','聊天'],serviceArea:'西城区',totalServiceHours:12,starLevel:1,verified:false,status:'active',createTime:new Date('2026-03-05'),updateTime:new Date('2026-05-15')}
  ]
  results.push(await batchInsert('users', users))

  const orders = [
    {_id:'order_001',elderId:'user_elder_001',elderName:'张奶奶',elderAvatar:'',elderPhone:'13812341234',title:'需要代购蔬菜水果',description:'需要帮忙去菜市场买新鲜蔬菜和水果',category:'代购',serviceTime:'2026-05-18',address:'北京市朝阳区幸福小区3号楼',urgency:3,volunteerId:'user_vol_001',volunteerName:'李志愿',status:'completed',rating:5,comment:'非常热心',serviceHours:2.5,createTime:new Date('2026-05-08'),acceptTime:new Date('2026-05-09'),completeTime:new Date('2026-05-10'),updateTime:new Date('2026-05-10')},
    {_id:'order_002',elderId:'user_elder_002',elderName:'王大爷',elderAvatar:'',elderPhone:'13798765432',title:'陪同就医看心内科',description:'需要志愿者陪同去医院心内科',category:'就医陪同',serviceTime:'2026-05-20',address:'北京市海淀区阳光花园1号楼',urgency:4,volunteerId:'',volunteerName:'',status:'pending',rating:0,comment:'',serviceHours:0,createTime:new Date('2026-05-15'),updateTime:new Date('2026-05-15')},
    {_id:'order_003',elderId:'user_elder_001',elderName:'张奶奶',elderAvatar:'',elderPhone:'13812341234',title:'家务帮忙打扫卫生',description:'家里需要大扫除',category:'家务帮忙',serviceTime:'2026-05-22',address:'北京市朝阳区幸福小区3号楼',urgency:2,volunteerId:'user_vol_002',volunteerName:'赵小明',status:'accepted',rating:0,comment:'',serviceHours:0,createTime:new Date('2026-05-14'),acceptTime:new Date('2026-05-15'),updateTime:new Date('2026-05-15')},
    {_id:'order_004',elderId:'user_elder_003',elderName:'刘阿姨',elderAvatar:'',elderPhone:'13687654321',title:'上门陪伴聊天',description:'一个人比较孤独想有人陪聊天',category:'日常聊天',serviceTime:'2026-05-19',address:'北京市西城区和平里8号',urgency:2,volunteerId:'user_vol_001',volunteerName:'李志愿',status:'in_progress',rating:0,comment:'',serviceHours:0,createTime:new Date('2026-05-13'),acceptTime:new Date('2026-05-14'),updateTime:new Date('2026-05-16')},
    {_id:'order_005',elderId:'user_elder_002',elderName:'王大爷',elderAvatar:'',elderPhone:'13798765432',title:'代购日用品',description:'需要帮忙买日用品',category:'代购',serviceTime:'2026-05-16',address:'北京市海淀区阳光花园1号楼',urgency:1,volunteerId:'user_vol_002',volunteerName:'赵小明',status:'completed',rating:4,comment:'服务很好',serviceHours:1,createTime:new Date('2026-05-12'),acceptTime:new Date('2026-05-13'),completeTime:new Date('2026-05-16'),updateTime:new Date('2026-05-16')}
  ]
  results.push(await batchInsert('orders', orders))

  const pairs = [
    {_id:'pair_001',elderId:'user_elder_001',elderName:'张奶奶',elderAvatar:'',elderPhone:'13812341234',elderAddress:'北京市朝阳区幸福小区3号楼',elderAge:72,volunteerId:'user_vol_001',volunteerName:'李志愿',volunteerAvatar:'',volunteerPhone:'13912345678',status:'active',createTime:new Date('2026-03-01')},
    {_id:'pair_002',elderId:'user_elder_003',elderName:'刘阿姨',elderAvatar:'',elderPhone:'13687654321',elderAddress:'北京市西城区和平里8号',elderAge:68,volunteerId:'user_vol_001',volunteerName:'李志愿',volunteerAvatar:'',volunteerPhone:'13912345678',status:'active',createTime:new Date('2026-04-15')},
    {_id:'pair_003',elderId:'user_elder_002',elderName:'王大爷',elderAvatar:'',elderPhone:'13798765432',elderAddress:'北京市海淀区阳光花园1号楼',elderAge:78,volunteerId:'user_vol_002',volunteerName:'赵小明',volunteerAvatar:'',volunteerPhone:'13856781234',status:'active',createTime:new Date('2026-04-20')}
  ]
  results.push(await batchInsert('pairs', pairs))

  const healthData = [
    {_id:'hd_001',userId:'user_elder_001',deviceId:'DEV001',systolic:128,diastolic:82,heartRate:72,bloodOxygen:97,bloodSugar:5.6,temperature:36.5,source:'device',createTime:new Date('2026-05-16T08:00:00')},
    {_id:'hd_002',userId:'user_elder_001',deviceId:'DEV001',systolic:135,diastolic:88,heartRate:78,bloodOxygen:96,bloodSugar:5.8,temperature:36.3,source:'device',createTime:new Date('2026-05-15T08:00:00')},
    {_id:'hd_003',userId:'user_elder_001',deviceId:'DEV001',systolic:122,diastolic:78,heartRate:70,bloodOxygen:98,bloodSugar:5.2,temperature:36.6,source:'device',createTime:new Date('2026-05-14T08:00:00')},
    {_id:'hd_004',userId:'user_elder_001',deviceId:'DEV001',systolic:142,diastolic:92,heartRate:85,bloodOxygen:95,bloodSugar:6.1,temperature:36.7,source:'device',createTime:new Date('2026-05-13T08:00:00')},
    {_id:'hd_005',userId:'user_elder_002',deviceId:'DEV002',systolic:155,diastolic:95,heartRate:88,bloodOxygen:93,bloodSugar:7.2,temperature:37.1,source:'device',createTime:new Date('2026-05-16T09:00:00')},
    {_id:'hd_006',userId:'user_elder_002',deviceId:'DEV002',systolic:148,diastolic:90,heartRate:82,bloodOxygen:95,bloodSugar:6.8,temperature:36.8,source:'device',createTime:new Date('2026-05-15T09:00:00')},
    {_id:'hd_007',userId:'user_elder_003',deviceId:'DEV003',systolic:118,diastolic:75,heartRate:68,bloodOxygen:98,bloodSugar:4.8,temperature:36.4,source:'device',createTime:new Date('2026-05-16T07:30:00')}
  ]
  results.push(await batchInsert('health_data', healthData))

  const announcements = [
    {_id:'ann_001',title:'五月社区义诊活动通知',content:'5月25日上午9:00-12:00，在社区活动中心举办免费义诊活动。',type:'activity',isTop:true,activityDate:'2026-05-25',activityLocation:'朝阳区幸福社区活动中心',signupCount:2,maxSignup:50,signups:['user_vol_001'],status:'active',createTime:new Date('2026-05-01')},
    {_id:'ann_002',title:'志愿者招募启事',content:'面向在校大学生和社会爱心人士招募志愿者。',type:'notice',isTop:false,activityDate:'',activityLocation:'',signupCount:0,maxSignup:0,signups:[],status:'active',createTime:new Date('2026-04-20')},
    {_id:'ann_003',title:'端午节敬老联欢活动',content:'6月8日端午节，社区将举办敬老联欢活动。',type:'activity',isTop:false,activityDate:'2026-06-08',activityLocation:'海淀区阳光社区礼堂',signupCount:0,maxSignup:30,signups:[],status:'active',createTime:new Date('2026-05-10')},
    {_id:'ann_004',title:'健康监测设备使用说明',content:'请老年用户在每日早晨8:00左右使用监测设备测量。',type:'notice',isTop:false,activityDate:'',activityLocation:'',signupCount:0,maxSignup:0,signups:[],status:'active',createTime:new Date('2026-04-15')}
  ]
  results.push(await batchInsert('announcements', announcements))

  const messages = [
    {_id:'msg_001',type:'chat',fromUserId:'user_vol_001',fromUserName:'李志愿',toUserId:'user_elder_001',toUserName:'张奶奶',content:'张奶奶您好，明天上午我去帮您买菜',read:true,createTime:new Date('2026-05-09T18:00:00')},
    {_id:'msg_002',type:'chat',fromUserId:'user_elder_001',fromUserName:'张奶奶',toUserId:'user_vol_001',toUserName:'李志愿',content:'好的小李，辛苦你了',read:true,createTime:new Date('2026-05-09T18:05:00')},
    {_id:'msg_003',type:'system',fromUserId:'system',toUserId:'user_elder_001',content:'订单已被志愿者李志愿接单',read:true,createTime:new Date('2026-05-09T08:00:00')},
    {_id:'msg_004',type:'health_alert',fromUserId:'system',toUserId:'user_elder_001',content:'血压异常: 142/92 mmHg',level:'warning',read:false,createTime:new Date('2026-05-13T08:05:00')},
    {_id:'msg_005',type:'health_alert',fromUserId:'system',toUserId:'user_elder_002',content:'血压异常: 155/95 mmHg',level:'warning',read:false,createTime:new Date('2026-05-16T09:05:00')},
    {_id:'msg_006',type:'health_alert',fromUserId:'system',toUserId:'user_elder_002',content:'血氧偏低: 93%',level:'danger',read:false,createTime:new Date('2026-05-16T09:05:00')}
  ]
  results.push(await batchInsert('messages', messages))

  const serviceRecords = [
    {_id:'sr_001',orderId:'order_001',volunteerId:'user_vol_001',elderId:'user_elder_001',type:'check_in',location:{lat:39.9042,lng:116.4074},createTime:new Date('2026-05-10T09:00:00')},
    {_id:'sr_002',orderId:'order_001',volunteerId:'user_vol_001',elderId:'user_elder_001',type:'check_out',serviceHours:2.5,serviceNote:'帮张奶奶买了蔬菜水果',location:{lat:39.9042,lng:116.4074},createTime:new Date('2026-05-10T11:30:00')}
  ]
  results.push(await batchInsert('service_records', serviceRecords))

  const signups = [
    {_id:'signup_001',activityId:'ann_001',userId:'user_vol_001',userName:'李志愿',userRole:'volunteer',createTime:new Date('2026-05-05')}
  ]
  results.push(await batchInsert('activity_signups', signups))

  const admins = [
    {_id:'admin_001',username:'admin',password:'admin123',name:'系统管理员',role:'super_admin',phone:'13800000000',status:'active',createTime:new Date('2026-01-01')}
  ]
  results.push(await batchInsert('admins', admins))

  return { code: 200, data: results }
}

async function batchInsert(collectionName, records) {
  let success = 0, skipped = 0, failed = 0
  for (const record of records) {
    try {
      await db.collection(collectionName).add({ data: record })
      success++
    } catch (e) {
      if (e.errCode === -502003) {
        skipped++
      } else {
        failed++
      }
    }
  }
  return { collection: collectionName, success, skipped, failed, total: records.length }
}
