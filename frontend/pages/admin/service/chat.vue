<template>
  <view class="page">
    <!-- 顶部信息栏 -->
    <view class="top-bar">
      <view class="user-info">
        <view class="user-avatar">{{ nickname ? nickname.substring(0, 1) : '?' }}</view>
        <text class="nickname">{{ nickname || '用户' + options.id }}</text>
        <view :class="['status-badge', 'status-' + conversation.status]">
          {{ statusMap[conversation.status] }}
        </view>
      </view>
      <picker :value="statusIndex" :range="statusOptions" @change="onStatusChange">
        <text class="change-btn">改状态 ▾</text>
      </picker>
    </view>

    <!-- 消息列表 -->
    <scroll-view
      class="msg-list"
      scroll-y
      :scroll-top="scrollTop"
      :scroll-into-view="scrollInto"
      @scrolltoupper="loadMore"
    >
      <view v-if="loading" class="loading-tip">
        <view class="spinner"></view>
        <text>加载中...</text>
      </view>
      <view v-if="!loading && rows.length === 0" class="empty-tip">
        <text class="empty-icon">💬</text>
        <text>暂无消息记录</text>
      </view>
      <view
        v-for="(row, i) in rows"
        :key="row.id"
        :id="'msg-' + row.id"
        :class="['msg-item', row.is_from_admin ? 'msg-admin' : 'msg-user']"
      >
        <view class="msg-avatar">
          {{ row.is_from_admin ? '🛡' : '👤' }}
        </view>
        <view class="msg-content">
          <view :class="['bubble', row.is_from_admin ? 'bubble-admin' : 'bubble-user']">
            <text>{{ row.content }}</text>
          </view>
          <view class="msg-time">{{ formatTime(row.created_at) }}</view>
        </view>
      </view>
      <view id="bottom" style="height:1px"></view>
    </scroll-view>

    <!-- 底部输入框 -->
    <view v-if="conversation.status != 2" class="input-bar">
      <input
        v-model="content"
        class="input-field"
        placeholder="输入回复内容..."
        confirm-type="send"
        @confirm="send"
      />
      <view class="send-btn" @click="send">发送</view>
    </view>
    <view v-else class="input-bar closed">
      <text class="closed-tip">会话已关闭，无法发送消息</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { onUnmounted } from 'vue';
import { adminServiceApi } from '@/api/service.js';

const options = ref({});
const nickname = ref('');
const rows = ref([]);
const content = ref('');
const loading = ref(false);
const scrollTop = ref(0);
const scrollInto = ref('');
const conversation = ref({ status: 0 });
const statusIndex = ref(0);
const statusOptions = ['待回复', '已回复', '已关闭'];
const statusMap = { 0: '待回复', 1: '已回复', 2: '已关闭' };

uni.$on('ws_customer_message', (data) => {
  if (!options.value.id) return;
  if (String(data.conversation_id) === String(options.value.id)) {
    const exists = rows.value.some(r => r.id === data.id || r.id === data.message_id);
    if (!exists) {
      rows.value.push({
        id: data.id || data.message_id,
        content: data.content,
        is_from_admin: 0,
        created_at: data.created_at || Math.floor(Date.now() / 1000),
      });
      scrollToBottom();
    }
  }
});

onUnmounted(() => {
  uni.$off('ws_customer_message');
});

onShow(() => {
  const pages = getCurrentPages();
  const page = pages[pages.length - 1];
  const { id, nick } = page.options || {};
  options.value = { id: Number(id) };
  nickname.value = decodeURIComponent(nick || '');
  loadConversation();
  loadMessages();
});

async function loadConversation() {
  try {
    const res = await adminServiceApi.conversationDetail(options.value.id);
    if (res.code === 0) {
      conversation.value = res.data;
      statusIndex.value = res.data.status ?? 0;
    }
  } catch (e) {
    console.error(e);
  }
}

async function loadMessages() {
  loading.value = true;
  try {
    const res = await adminServiceApi.messages(options.value.id);
    if (res.code === 0) {
      rows.value = res.data.rows || [];
      scrollToBottom();
    }
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

async function send() {
  const txt = content.value.trim();
  if (!txt || conversation.value.status == 2) return;
  content.value = '';
  const tmpId = Date.now();
  rows.value.push({ id: tmpId, content: txt, is_from_admin: 1, created_at: Math.floor(Date.now() / 1000), _tmp: true });
  scrollToBottom();
  try {
    const res = await adminServiceApi.sendMessage(options.value.id, txt);
    if (res.code === 0) {
      const idx = rows.value.findIndex(r => r.id === tmpId);
      if (idx >= 0) rows.value.splice(idx, 1, res.data);
    } else {
      uni.showToast({ title: res.message || '发送失败', icon: 'none' });
      rows.value = rows.value.filter(r => r.id !== tmpId);
    }
  } catch (e) {
    uni.showToast({ title: '发送失败', icon: 'none' });
    rows.value = rows.value.filter(r => r.id !== tmpId);
  }
}

async function onStatusChange(e) {
  const idx = Number(e.detail.value);
  const newStatus = idx;
  try {
    const res = await adminServiceApi.updateStatus(options.value.id, newStatus);
    if (res.code === 0) {
      conversation.value.status = newStatus;
      statusIndex.value = idx;
      uni.showToast({ title: '状态已更新', icon: 'success' });
    } else {
      uni.showToast({ title: res.message || '更新失败', icon: 'none' });
    }
  } catch (e) {
    uni.showToast({ title: '更新失败', icon: 'none' });
  }
}

function scrollToBottom() {
  setTimeout(() => {
    scrollInto.value = '';
    setTimeout(() => { scrollInto.value = 'bottom'; }, 50);
  }, 100);
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}
</script>

<style scoped lang="scss">
@import "@/common/styles/base.scss";

.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $bg-light;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 32rpx;
  background: $bg-white;
  border-bottom: 1rpx solid $border-color;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.user-avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
  color: #fff;
  font-size: 28rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nickname {
  font-size: 30rpx;
  font-weight: 600;
  color: $text-primary;
}

.status-badge { font-size: 20rpx; padding: 4rpx 12rpx; border-radius: 12rpx; }
.status-badge.status-0 { background: rgba(#ff9500, 0.1); color: #ff9500; }
.status-badge.status-1 { background: rgba(#4caf50, 0.1); color: #4caf50; }
.status-badge.status-2 { background: $bg-light; color: $text-gray; }

.change-btn { font-size: 26rpx; color: $primary-color; }

.msg-list { flex: 1; padding: 24rpx; }

.loading-tip, .empty-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx;
  color: $text-gray;
  font-size: 26rpx;
}
.empty-icon { font-size: 80rpx; margin-bottom: 16rpx; display: block; }

.spinner {
  width: 40rpx;
  height: 40rpx;
  border: 4rpx solid $border-color;
  border-top-color: $primary-color;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16rpx;
}
@keyframes spin { to { transform: rotate(360deg); } }

.msg-item { display: flex; margin-bottom: 32rpx; align-items: flex-end; }
.msg-item.msg-admin { flex-direction: row; }
.msg-item.msg-user { flex-direction: row-reverse; }

.msg-avatar { font-size: 36rpx; margin: 0 16rpx; }

.msg-content { max-width: 70%; }

.bubble {
  padding: 20rpx 24rpx;
  border-radius: 20rpx;
  font-size: 28rpx;
  line-height: 1.5;
  word-break: break-all;
}
.bubble-admin {
  background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
  color: #fff;
  border-bottom-left-radius: 8rpx;
}
.bubble-user {
  background: $bg-white;
  color: $text-primary;
  border-bottom-right-radius: 8rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}

.msg-time { font-size: 20rpx; color: $text-gray; margin-top: 6rpx; clear: both; }
.msg-admin .msg-time { float: left; }
.msg-user .msg-time { float: right; }

.input-bar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 24rpx;
  background: $bg-white;
  border-top: 1rpx solid $border-color;
}

.input-bar.closed { justify-content: center; }
.closed-tip { font-size: 26rpx; color: $text-gray; }

.input-field {
  flex: 1;
  border: 1rpx solid $border-color;
  border-radius: 40rpx;
  padding: 16rpx 24rpx;
  font-size: 28rpx;
  background: $bg-light;
  color: $text-primary;
}

.send-btn {
  background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
  color: #fff;
  padding: 16rpx 36rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  flex-shrink: 0;
}
</style>