<template>
  <view class="page">
    <view class="header">{{ title }}</view>
    <scroll-view class="messages" scroll-y @scrolltoupper="loadMore">
      <view v-for="msg in messages" :key="msg.id" class="msg-row" :class="msg.is_mine ? 'mine' : 'other'">
        <view class="bubble" :class="msg.is_mine ? 'mine' : 'other'">{{ msg.content }}</view>
      </view>
      <view v-if="!messages.length" class="empty">暂无消息</view>
    </scroll-view>
    <view class="input-area">
      <input v-model="inputText" class="input" placeholder="输入消息..." @confirm="send" />
      <button class="send-btn" @click="send">发送</button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, onShow, onLoad } from 'vue';
import { serviceApi } from '../../api/service';

const options = ref({});
const messages = ref([]);
const userId = ref(null);
const inputText = ref('');
let timer = null;

const typeMap = { consultation: '课程咨询', complaint: '投诉建议', refund: '退款申请', upgrade: '升级申请' };
const title = computed(() => typeMap[options.value.type] || '客服聊天');

onLoad(async (opts) => {
  options.value = opts;
  // get current user id for is_mine
  try {
    const { useUserStore } = require('../../store/user');
    userId.value = useUserStore().user?.id || null;
  } catch(e) {}
  loadMessages();
});

onShow(() => {
  timer = setInterval(loadMessages, 3000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

async function loadMessages() {
  if (!options.value.id) return;
  try {
    const rows = await serviceApi.messages(options.value.id);
    // backend returns array: {id, conversation_id, sender_id, content, created_at, sender_nickname}
    // compute is_mine on frontend
    messages.value = (rows || []).map(m => ({ ...m, is_mine: m.sender_id === userId }));
  } catch (e) {
    console.error('load messages error', e);
  }
}

async function send() {
  if (!inputText.value.trim() || !options.value.id) return;
  const content = inputText.value.trim();
  inputText.value = '';
  try {
    await serviceApi.sendMessage(options.value.id, content);
    await loadMessages();
  } catch (e) {
    uni.showToast({ title: '发送失败', icon: 'none' });
  }
}
</script>

<style scoped>
.page { display: flex; flex-direction: column; height: 100vh; background: var(--bg-light); }
.header { padding: 24rpx; background: var(--bg-white); font-size: 28rpx; font-weight: bold; text-align: center; border-bottom: 1rpx solid var(--border-color); }
.messages { flex: 1; padding: 16rpx; overflow-y: auto; }
.msg-row { display: flex; margin-bottom: 16rpx; }
.msg-row.mine { justify-content: flex-end; }
.msg-row.other { justify-content: flex-start; }
.bubble { max-width: 70%; padding: 16rpx 20rpx; border-radius: 16rpx; font-size: 28rpx; line-height: 1.5; word-break: break-all; }
.bubble.mine { background: var(--accent-blue); color: #fff; }
.bubble.other { background: var(--bg-white); color: var(--text-primary); }
.empty { text-align: center; color: var(--text-gray); padding: 100rpx; }
.input-area { display: flex; padding: 16rpx; background: var(--bg-white); border-top: 1rpx solid var(--border-color); gap: 16rpx; }
.input { flex: 1; padding: 16rpx; border: 1rpx solid var(--border-color); border-radius: 8rpx; font-size: 28rpx; }
.send-btn { background: var(--accent-blue); color: #fff; font-size: 28rpx; padding: 0 32rpx; border-radius: 8rpx; }
</style>
