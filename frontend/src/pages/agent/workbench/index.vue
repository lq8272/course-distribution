<template>
  <view class="page">
    <!-- 顶部状态栏 -->
    <view class="header">
      <view class="agent-info">
        <text class="nickname">{{ agent.nickname }}</text>
        <text class="status-tag" :class="agent.online ? 'online' : 'offline'">
          {{ agent.online ? '在线' : '离线' }}
        </text>
      </view>
      <text class="handling-count">当前处理: {{ handlingCount }}/{{ agent.max_handling }}</text>
    </view>

    <!-- Tab切换 -->
    <view class="tabs">
      <view
        v-for="t in tabs"
        :key="t.key"
        :class="['tab', activeTab === t.key ? 'active' : '']"
        @click="activeTab = t.key"
      >{{ t.label }}</view>
    </view>

    <!-- 我的会话 -->
    <scroll-view v-if="activeTab === 'mine'" class="list" scroll-y @scrolltolower="loadMore">
      <view v-if="loading && conversations.length === 0" class="empty-state">
        <view class="spinner"></view><text>加载中...</text>
      </view>
      <view v-else-if="conversations.length === 0" class="empty-state">
        <text class="empty-icon">📭</text><text class="empty-text">暂无会话</text>
      </view>
      <view
        v-for="conv in conversations"
        :key="conv.id"
        :class="['conv-item', conv.unread_count > 0 ? 'unread' : '']"
        @click="goChat(conv)"
      >
        <view class="conv-header">
          <text class="user-name">{{ conv.user_nickname || '用户' }}</text>
          <text class="conv-type">{{ typeMap[conv.type] || conv.type }}</text>
        </view>
        <text class="last-msg">{{ conv.last_content || '暂无消息' }}</text>
        <view class="conv-footer">
          <text class="time">{{ formatTime(conv.last_message_at) }}</text>
          <view v-if="conv.unread_count > 0" class="badge">{{ conv.unread_count }}</view>
        </view>
      </view>
      <view v-if="hasMore" class="load-more" @click="loadMore">{{ loadingMore ? '加载中...' : '加载更多' }}</view>
    </scroll-view>

    <!-- 待接单队列 -->
    <scroll-view v-if="activeTab === 'queue'" class="list" scroll-y>
      <view v-if="queueLoading" class="empty-state"><view class="spinner"></view><text>加载中...</text></view>
      <view v-else-if="queue.length === 0" class="empty-state">
        <text class="empty-icon">✅</text><text class="empty-text">暂无待接会话</text>
      </view>
      <view
        v-for="conv in queue"
        :key="conv.id"
        class="conv-item queue-item"
        @click="claimConv(conv)"
      >
        <view class="conv-header">
          <text class="user-name">{{ conv.user_nickname || '用户' }}</text>
          <text :class="['type-badge', 'type-' + conv.type]">{{ typeMap[conv.type] || conv.type }}</text>
        </view>
        <text class="last-msg">{{ conv.last_content || '暂无消息' }}</text>
        <view class="conv-footer">
          <text class="time">{{ formatTime(conv.last_message_at) }}</text>
          <text class="claim-btn">点击接单</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { agentApi } from '@/api/agent.js';

const agent = ref({ id: 0, nickname: '', max_handling: 20, online: true });
const handlingCount = ref(0);
const activeTab = ref('mine');
const tabs = [{ key: 'mine', label: '我的会话' }, { key: 'queue', label: '待接单' }];

const conversations = ref([]);
const loading = ref(false);
const hasMore = ref(false);
const loadingMore = ref(false);
const page = ref(1);

const queue = ref([]);
const queueLoading = ref(false);

const typeMap = { consultation: '咨询', complaint: '投诉', refund: '退款', upgrade: '升级', feedback: '反馈' };

onMounted(() => {
  const info = uni.getStorageSync('agent_info');
  if (info) agent.value = { ...agent.value, ...info };
  loadInfo();
  loadConversations();
  loadQueue();
  // WebSocket 新消息监听
  uni.$on('ws_customer_message', onNewMessage);
  uni.$on('ws_conversation_updated', loadConversations);
});

onUnmounted(() => {
  uni.$off('ws_customer_message', onNewMessage);
  uni.$off('ws_conversation_updated', loadConversations);
});

async function loadInfo() {
  try {
    const info = await agentApi.info();
    agent.value = { ...agent.value, ...info };
    handlingCount.value = info.handling_count || 0;
  } catch (e) { /* ignore */ }
}

async function loadConversations() {
  loading.value = true;
  try {
    const res = await agentApi.conversations({ status: '' });
    conversations.value = res.rows || [];
    hasMore.value = false;
  } catch (e) { console.error(e); }
  finally { loading.value = false; }
}

async function loadMore() {
  if (loadingMore.value || !hasMore.value) return;
  loadingMore.value = true;
  try {
    const res = await agentApi.conversations({ page: page.value + 1, status: '' });
    conversations.value.push(...(res.rows || []));
    hasMore.value = (res.rows || []).length >= 20;
    page.value++;
  } catch (e) { console.error(e); }
  finally { loadingMore.value = false; }
}

async function loadQueue() {
  queueLoading.value = true;
  try {
    const res = await agentApi.queue();
    queue.value = res.rows || [];
  } catch (e) { console.error(e); }
  finally { queueLoading.value = false; }
}

function onNewMessage() {
  loadConversations();
  loadQueue();
}

function goChat(conv) {
  uni.navigateTo({ url: `/pages/agent/chat/index?id=${conv.id}&nickname=${encodeURIComponent(conv.user_nickname || '用户')}` });
}

async function claimConv(conv) {
  try {
    await agentApi.claim(conv.id);
    uni.showToast({ title: '接单成功', icon: 'success' });
    loadConversations();
    loadQueue();
  } catch (e) {
    uni.showToast({ title: e.message || '接单失败', icon: 'none' });
  }
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return `${d.getMonth()+1}-${d.getDate()}`;
}
</script>

<style lang="scss" scoped>
@import "@/common/styles/base.scss";

.page { min-height: 100vh; background: $bg-light; }

.header {
  background: linear-gradient(135deg, #667eea, #764ba2);
  padding: 40rpx 32rpx 80rpx; color: #fff;
}
.agent-info { display: flex; align-items: center; gap: 16rpx; margin-bottom: 8rpx; }
.nickname { font-size: 36rpx; font-weight: 700; }
.status-tag { font-size: 22rpx; padding: 4rpx 16rpx; border-radius: 20rpx; }
.status-tag.online { background: rgba(52,199,89,0.3); }
.status-tag.offline { background: rgba(255,255,255,0.2); }
.handling-count { font-size: 24rpx; opacity: 0.8; }

.tabs {
  display: flex; background: #fff; margin: -40rpx 24rpx 0; border-radius: 16rpx;
  padding: 8rpx; gap: 8rpx;
}
.tab {
  flex: 1; text-align: center; padding: 16rpx 0; border-radius: 12rpx;
  font-size: 28rpx; color: $text-secondary;
}
.tab.active { background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; font-weight: 600; }

.list { height: calc(100vh - 280rpx); padding: 24rpx; }

.conv-item {
  background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
  &.unread { border-left: 6rpx solid #667eea; }
}
.conv-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8rpx; }
.user-name { font-size: 28rpx; font-weight: 600; color: $text-primary; }
.conv-type { font-size: 22rpx; color: $text-gray; }

.last-msg {
  font-size: 26rpx; color: $text-secondary; display: block;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.conv-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 12rpx; }
.time { font-size: 22rpx; color: $text-gray; }

.badge {
  background: #ff3b30; color: #fff; font-size: 20rpx; padding: 2rpx 12rpx;
  border-radius: 20rpx; min-width: 36rpx; text-align: center;
}

.type-badge { padding: 4rpx 12rpx; border-radius: 10rpx; font-size: 20rpx; }
.type-bug, .type-complaint { background: rgba(255,59,48,0.1); color: #ff3b30; }
.type-suggest, .type-consultation { background: rgba(0,122,255,0.1); color: #007aff; }
.type-other, .type-refund { background: rgba(255,107,0,0.1); color: #ff6b00; }
.type-feedback, .type-upgrade { background: rgba(52,199,89,0.1); color: #34c759; }

.queue-item { cursor: pointer; }
.claim-btn {
  font-size: 24rpx; color: #667eea; font-weight: 600;
}

.empty-state { text-align: center; padding: 120rpx 0; }
.empty-icon { display: block; font-size: 96rpx; margin-bottom: 24rpx; }
.empty-text { font-size: 28rpx; color: $text-gray; }
.load-more { text-align: center; padding: 24rpx; font-size: 26rpx; color: $text-gray; }

.spinner {
  width: 48rpx; height: 48rpx; border: 4rpx solid $border-color;
  border-top-color: #667eea; border-radius: 50%;
  animation: spin 0.8s linear infinite; margin: 0 auto 16rpx;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
