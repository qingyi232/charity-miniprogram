const app = getApp()
const db = wx.cloud.database()
const _ = db.command

const recorderManager = wx.getRecorderManager()
const innerAudioContext = wx.createInnerAudioContext()

Page({
  data: {
    targetId: '',
    targetName: '',
    messageList: [],
    inputValue: '',
    scrollToId: '',
    loading: true,
    pullDownTriggered: false,
    myAvatar: '',
    myUserId: '',
    currentPage: 1,
    hasMore: true,
    voiceMode: false,
    recording: false,
    cancelRecording: false,
    recordingTime: 0,
    playingIndex: -1
  },

  _pollTimer: null,
  _recordTimer: null,
  _recordStartY: 0,
  _tempFilePath: '',
  _recordDuration: 0,

  onLoad(options) {
    const { targetId, targetName } = options
    if (!targetId) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1000)
      return
    }
    wx.setNavigationBarTitle({ title: targetName || '聊天' })
    this.setData({
      targetId,
      targetName: targetName || '对方',
      myUserId: app.globalData.userInfo?._id || '',
      myAvatar: app.globalData.userInfo?.avatar || ''
    })
    this.loadMessages()
    this.startPolling()
    this.initRecorder()
  },

  onUnload() {
    this.stopPolling()
    this.stopPlayback()
    if (this._recordTimer) clearInterval(this._recordTimer)
  },

  initRecorder() {
    recorderManager.onStop((res) => {
      if (this._recordTimer) {
        clearInterval(this._recordTimer)
        this._recordTimer = null
      }

      if (this.data.cancelRecording) {
        this.setData({ recording: false, cancelRecording: false, recordingTime: 0 })
        return
      }

      this._tempFilePath = res.tempFilePath
      this._recordDuration = Math.ceil(res.duration / 1000)

      if (this._recordDuration < 1) {
        wx.showToast({ title: '录音太短', icon: 'none' })
        this.setData({ recording: false, recordingTime: 0 })
        return
      }

      this.setData({ recording: false, recordingTime: 0 })
      this.sendVoiceMessage(res.tempFilePath, this._recordDuration)
    })

    recorderManager.onError((err) => {
      console.error('录音错误', err)
      if (this._recordTimer) clearInterval(this._recordTimer)
      this.setData({ recording: false, cancelRecording: false, recordingTime: 0 })
      wx.showToast({ title: '录音失败', icon: 'none' })
    })

    innerAudioContext.onEnded(() => {
      this.setData({ playingIndex: -1 })
    })
    innerAudioContext.onError(() => {
      this.setData({ playingIndex: -1 })
    })
  },

  toggleInputMode() {
    this.setData({ voiceMode: !this.data.voiceMode })
  },

  startRecord(e) {
    this._recordStartY = e.touches[0].clientY
    this.setData({ recording: true, cancelRecording: false, recordingTime: 0 })

    let seconds = 0
    this._recordTimer = setInterval(() => {
      seconds++
      this.setData({ recordingTime: seconds })
      if (seconds >= 60) {
        this.stopRecord()
      }
    }, 1000)

    recorderManager.start({
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'mp3'
    })
  },

  onRecordMove(e) {
    if (!this.data.recording) return
    const moveY = e.touches[0].clientY
    const cancel = this._recordStartY - moveY > 80
    if (cancel !== this.data.cancelRecording) {
      this.setData({ cancelRecording: cancel })
    }
  },

  stopRecord() {
    if (!this.data.recording) return
    recorderManager.stop()
  },

  cancelRecord() {
    this.setData({ cancelRecording: true })
    recorderManager.stop()
  },

  async sendVoiceMessage(filePath, duration) {
    const tempId = 'temp-' + Date.now()
    const tempMsg = {
      _id: tempId,
      msgType: 'voice',
      voiceDuration: duration,
      isSelf: true,
      fromUserId: this.data.myUserId,
      createTime: new Date().toISOString(),
      sendStatus: 'sending',
      showTime: false,
      timeStr: ''
    }
    const newList = [...this.data.messageList, tempMsg]
    this.setData({ messageList: newList })
    this.scrollToBottom()

    try {
      const cloudPath = `voice/${this.data.myUserId}/${Date.now()}.mp3`
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath
      })

      const userInfo = app.globalData.userInfo || {}
      await db.collection('messages').add({
        data: {
          type: 'chat',
          msgType: 'voice',
          fromUserId: this.data.myUserId,
          fromUserName: userInfo.nickname || '用户',
          fromUserAvatar: userInfo.avatar || '',
          toUserId: this.data.targetId,
          content: uploadRes.fileID,
          voiceDuration: Number(duration),
          read: false,
          createTime: db.serverDate()
        }
      })

      const idx = this.data.messageList.findIndex(m => m._id === tempId)
      if (idx >= 0) {
        this.setData({
          [`messageList[${idx}].sendStatus`]: '',
          [`messageList[${idx}].content`]: uploadRes.fileID
        })
      }
    } catch (e) {
      console.error('发送语音失败', e)
      const idx = this.data.messageList.findIndex(m => m._id === tempId)
      if (idx >= 0) {
        this.setData({ [`messageList[${idx}].sendStatus`]: 'failed' })
      }
      wx.showToast({ title: '发送失败', icon: 'none' })
    }
  },

  playVoice(e) {
    const index = e.currentTarget.dataset.index
    const msg = this.data.messageList[index]
    if (!msg || msg.msgType !== 'voice' || !msg.content) return

    if (this.data.playingIndex === index) {
      this.stopPlayback()
      return
    }

    this.stopPlayback()
    this.setData({ playingIndex: index })

    innerAudioContext.src = msg.content
    innerAudioContext.play()
  },

  stopPlayback() {
    innerAudioContext.stop()
    this.setData({ playingIndex: -1 })
  },

  formatTime(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    if (isToday) return `${h}:${m}`
    const mon = d.getMonth() + 1
    const day = d.getDate()
    return `${mon}/${day} ${h}:${m}`
  },

  processMessages(list) {
    let lastTime = 0
    return list.map(msg => {
      const msgTime = new Date(msg.createTime).getTime()
      let showTime = false
      let timeStr = ''
      if (msgTime - lastTime > 5 * 60 * 1000) {
        showTime = true
        timeStr = this.formatTime(msg.createTime)
        lastTime = msgTime
      }
      return {
        ...msg,
        isSelf: msg.fromUserId === this.data.myUserId,
        showTime,
        timeStr
      }
    })
  },

  async loadMessages() {
    const { targetId, myUserId } = this.data
    if (!myUserId || !targetId) {
      this.setData({ loading: false })
      return
    }

    try {
      const res = await db.collection('messages')
        .where(_.or([
          { fromUserId: myUserId, toUserId: targetId, type: 'chat' },
          { fromUserId: targetId, toUserId: myUserId, type: 'chat' }
        ]))
        .orderBy('createTime', 'asc')
        .limit(50)
        .get()

      const list = this.processMessages(res.data || [])
      this.setData({
        messageList: list,
        loading: false,
        currentPage: 1,
        hasMore: (res.data || []).length >= 50
      })
      this.scrollToBottom()
      this.markMessagesRead(list)
    } catch (e) {
      console.error('加载聊天记录失败', e)
      this.setData({ loading: false })
    }
  },

  async onPullDown() {
    if (!this.data.hasMore) {
      this.setData({ pullDownTriggered: false })
      wx.showToast({ title: '没有更多消息了', icon: 'none' })
      return
    }

    const nextPage = this.data.currentPage + 1
    const skip = (nextPage - 1) * 50
    try {
      const res = await db.collection('messages')
        .where(_.or([
          { fromUserId: this.data.myUserId, toUserId: this.data.targetId, type: 'chat' },
          { fromUserId: this.data.targetId, toUserId: this.data.myUserId, type: 'chat' }
        ]))
        .orderBy('createTime', 'asc')
        .skip(skip)
        .limit(50)
        .get()

      const oldData = res.data || []
      if (oldData.length === 0) {
        this.setData({ hasMore: false, pullDownTriggered: false })
        return
      }
      const allMessages = [...oldData, ...this.data.messageList.map(m => {
        const { showTime, timeStr, isSelf, ...rest } = m
        return rest
      })]
      const processed = this.processMessages(allMessages)
      this.setData({
        messageList: processed,
        currentPage: nextPage,
        hasMore: oldData.length >= 50,
        pullDownTriggered: false
      })
    } catch (e) {
      this.setData({ pullDownTriggered: false })
    }
  },

  async markMessagesRead(list) {
    const unreadIds = list
      .filter(m => !m.isSelf && !m.read)
      .map(m => m._id)
    if (unreadIds.length === 0) return
    try {
      for (const id of unreadIds) {
        await db.collection('messages').doc(id).update({ data: { read: true } })
      }
    } catch (e) {
      console.error('标记已读失败', e)
    }
  },

  startPolling() {
    this._pollTimer = setInterval(() => {
      this.pollNewMessages()
    }, 3000)
  },

  stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer)
      this._pollTimer = null
    }
  },

  async pollNewMessages() {
    const { targetId, myUserId, messageList } = this.data
    if (!myUserId || !targetId) return

    try {
      const res = await db.collection('messages')
        .where(_.or([
          { fromUserId: myUserId, toUserId: targetId, type: 'chat' },
          { fromUserId: targetId, toUserId: myUserId, type: 'chat' }
        ]))
        .orderBy('createTime', 'asc')
        .limit(50)
        .get()

      const serverList = res.data || []
      const realMsgs = messageList.filter(m => !String(m._id).startsWith('temp-'))
      if (serverList.length !== realMsgs.length) {
        const list = this.processMessages(serverList)
        this.setData({ messageList: list })
        this.scrollToBottom()
        this.markMessagesRead(list)
      }
    } catch (e) {
      // polling failure is acceptable
    }
  },

  onInput(e) {
    this.setData({ inputValue: e.detail.value })
  },

  async handleSend() {
    const content = this.data.inputValue.trim()
    if (!content) return

    this.setData({ inputValue: '' })

    const tempId = 'temp-' + Date.now()
    const tempMsg = {
      _id: tempId,
      content,
      msgType: 'text',
      isSelf: true,
      fromUserId: this.data.myUserId,
      createTime: new Date().toISOString(),
      sendStatus: 'sending',
      showTime: false,
      timeStr: ''
    }
    const newList = [...this.data.messageList, tempMsg]
    this.setData({ messageList: newList })
    this.scrollToBottom()

    try {
      const userInfo = app.globalData.userInfo || {}
      await db.collection('messages').add({
        data: {
          type: 'chat',
          msgType: 'text',
          fromUserId: this.data.myUserId,
          fromUserName: userInfo.nickname || '用户',
          fromUserAvatar: userInfo.avatar || '',
          toUserId: this.data.targetId,
          content,
          read: false,
          createTime: db.serverDate()
        }
      })
      const idx = this.data.messageList.findIndex(m => m._id === tempId)
      if (idx >= 0) {
        this.setData({ [`messageList[${idx}].sendStatus`]: '' })
      }
    } catch (e) {
      const idx = this.data.messageList.findIndex(m => m._id === tempId)
      if (idx >= 0) {
        this.setData({ [`messageList[${idx}].sendStatus`]: 'failed' })
      }
      wx.showToast({ title: '发送失败', icon: 'none' })
    }
  },

  async resendMsg(e) {
    const index = e.currentTarget.dataset.index
    const msg = this.data.messageList[index]
    if (!msg) return

    this.setData({ [`messageList[${index}].sendStatus`]: 'sending' })

    try {
      const userInfo = app.globalData.userInfo || {}
      await db.collection('messages').add({
        data: {
          type: 'chat',
          msgType: msg.msgType || 'text',
          fromUserId: this.data.myUserId,
          fromUserName: userInfo.nickname || '用户',
          fromUserAvatar: userInfo.avatar || '',
          toUserId: this.data.targetId,
          content: msg.content,
          read: false,
          createTime: db.serverDate()
        }
      })
      this.setData({ [`messageList[${index}].sendStatus`]: '' })
    } catch (e) {
      this.setData({ [`messageList[${index}].sendStatus`]: 'failed' })
      wx.showToast({ title: '发送失败', icon: 'none' })
    }
  },

  scrollToBottom() {
    setTimeout(() => {
      this.setData({ scrollToId: 'chat-bottom' })
    }, 100)
  }
})
