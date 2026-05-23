<template>
  <view class="page">
    <!-- 顶部 -->
    <view class="chat-header">
      <text class="back-btn" @click="goBack">‹</text>
      <view class="user-info">
        <text class="username">{{ nickname }}</text>
        <text class="conv-type">{{ typeMap[convType] || convType }}</text>
      </view>
      <text class="close-btn" @click="closeConv">关闭</text>
    </view>

    <!-- 消息列表 -->
    <scroll-view
      class="messages"
      scroll-y
      :scroll-top="scrollTop"
      :scroll-into-view="scrollInto"
      @scrolltolower="loadMore"
    >
      <view v-if="loading && messages.length === 0" class="loading-state">
        <view class="spinner"></view><text>加载中...</text>
      </view>
      <view
        v-for="msg in messages"
        :key="msg.id"
        :id="'msg-' + msg.id"
        :class="['msg-row', msg.is_from_admin ? 'admin-msg' : 'user-msg']"
      >
        <view class="avatar">{{ msg.is_from_admin ? (msg.agent_nickname ? msg.agent_nickname[0] : 'S') : 'U' }}</view>
        <view class="bubble">
          <text class="msg-text">{{ msg.content }}</text>
          <text class="msg-time">{{ formatTime(msg.created_at) }}</text>
        </view>
      </view>
      <view id="bottom-anchor"></view>
    </scroll-view>

    <!-- 输入区 -->
    <view class="input-area">
      <input class="input" v-model="inputText" placeholder="输入回复..." @confirm="send" />
      <view class="btn-send" @click="send">发送</view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { agentApi } from '@/api/agent.js';

const convId = ref(0);
const nickname = ref('用户');
const convType = ref('');
const messages = ref([]);
const inputText = ref('');
const loading = ref(false);
const scrollTop = ref(0);
const scrollInto = ref('');
let timer = null;

const typeMap = { consultation: '咨询', complaint: '投诉', refund: '退款', upgrade: '升级', feedback: '反馈' };

onMounted(() => {
  const pages = getCurrentPages();
  const page = pages[pages.length - 1];
  const opts = page.options || page.$page?.options || {};
  convId.value = parseInt(opts.id) || 0;
  nickname.value = decodeURIComponent(opts.nickname || '用户');
  convType.value = opts.type || '';

  loadMessages();
  timer = setInterval(loadMessages, 3000);

  uni.$on('ws_admin_reply', onReply);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
  uni.$off('ws_admin_reply', onReply);
});

async function loadMessages() {
  if (!convId.value) return;
  try {
    const res = await agentApi.messages(convId.value);
    if (res.rows) {
      messages.value = res.rows.map(m => ({ ...m, is_from_admin: !!m.is_from_admin }));
      scrollToBottom();
    }
  } catch (e) { console.error(e); }
}

function onReply(data) {
  if (String(data.conversation_id) === String(convId.value)) {
    if (!messages.value.some(m => m.id === data.id)) {
      messages.value.push({
        id: data.id,
        content: data.content,
        is_from_admin: 1,
        agent_nickname: data.from_admin_nickname,
        created_at: new Date(data.created_at),
      });
      setTimeout(() => scrollToBottom(), 50);
    }
  }
}

function scrollToBottom() {
  scrollInto.value = '';
  setTimeout(() => { scrollInto.value = 'bottom-anchor'; }, 10);
}

async function send() {
  const content = inputText.value.trim();
  if (!content || !convId.value) return;
  inputText.value = '';
  try {
    await agentApi.reply(convId.value, { content });
    await loadMessages();
  } catch (e) {
    uni.showToast({ title: '发送失败', icon: 'none' });
  }
}

async function closeConv() {
  try {
    await agentApi.close(convId.value);
    uni.showToast({ title: '会话已关闭', icon: 'success' });
    setTimeout(() => uni.navigateBack(), 1000);
  } catch (e) {
    uni.showToast({ title: '操作失败', icon: 'none' });
  }
}

function goBack() { uni.navigateBack(); }

async function loadMore() { /* 已自动刷新 */ }

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}
</script>

<style lang="scss" scoped>
@import "@/common/styles/base.scss";

.page { display: flex; flex-direction: column; height: 100vh; background: $bg-light; }

.chat-header {
  display: flex; align-items: center; padding: 40rpx 24rpx 20rpx;
  background: #fff; border-bottom: 1rpx solid $border-color;
  .back-btn { font-size: 48rpx; color: $text-primary; margin-right: 16rpx; }
  .user-info { flex: 1; }
  .username { font-size: 32rpx; font-weight: 600; color: $text-primary; display: block; }
  .conv-type { font-size: 22rpx; color: $text-gray; }
  .close-btn { font-size: 28rpx; color: #667eea; }
}

.messages {
  flex: 1; padding: 24rpx;
  .loading-state { text-align: center; padding: 80rpx 0; color: $text-gray; font-size: 26rpx; }
}

.msg-row {
  display: flex; margin-bottom: 24rpx; align-items: flex-end;
  &.admin-msg { flex-direction: row-reverse; }
}

.avatar {
  width: 64rpx; height: 64rpx; border-radius: 50%; background: #667eea;
  color: #fff; font-size: 24rpx; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; margin: 0 16rpx;
}
.user-msg .avatar { background: #34c759; }

.bubble {
  max-width: 70%;
  .msg-text { display: block; font-size: 28rpx; color: $text-primary; line-height: 1.6; }
  .msg-time { display: block; font-size: 20rpx; color: $text-gray; margin-top: 6rpx; text-align: right; }
}
.admin-msg .bubble { background: #667eea; border-radius: 20rpx 4rpx 20rpx 20rpx; padding: 16rpx 20rpx; }
.user-msg .bubble { background: #fff; border-radius: 4rpx 20rpx 20rpx 20rpx; padding: 16rpx 20rpx; }
.admin-msg .bubble .msg-text { color: #fff; }
.admin-msg .bubble .msg-time { color: rgba(255,255,255,0.7); text-align: left; }

.input-area {
  display: flex; gap: 16rpx; padding: 16rpx 24rpx;
  background: #fff; border-top: 1rpx solid $border-color;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  .input { flex: 1; background: $bg-light; border-radius: 40rpx; padding: 16rpx 24rpx; font-size: 28rpx; }
  .btn-send {
    background: linear-gradient(135deg, #667eea, #764ba2); color: #fff;
    border-radius: 40rpx; padding: 16rpx 32rpx; font-size: 28rpx;
  }
}

.spinner {
  width: 40rpx; height: 40rpx; border: 4rpx solid $border-color;
  border-top-color: #667eea; border-radius: 50%;
  animation: spin 0.8s linear infinite; margin: 0 auto 12rpx;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
