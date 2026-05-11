<template>
  <view class="page">
    <!-- Nav Bar -->
    <view class="nav-bar">
      <view class="nav-back" @click="goBack">← 返回</view>
      <text class="nav-title">通知中心</text>
      <view class="nav-action" @click="markAllRead" v-if="records.length > 0">全部已读</view>
      <view class="nav-placeholder" v-else></view>
    </view>

    <!-- Unread Badge -->
    <view class="unread-bar" v-if="unreadCount > 0" @click="markAllRead">
      <text class="unread-text">有 {{ unreadCount }} 条未读通知</text>
      <text class="unread-action">点击标记全部已读 ›</text>
    </view>

    <!-- Notification List -->
    <view class="record-list">
      <view
        v-for="record in records"
        :key="record.id"
        :class="'record-card ' + (record.is_read ? 'read' : 'unread')"
        @click="handleClick(record)"
      >
        <!-- Icon -->
        <view class="record-icon" :class="'icon-' + record.type">
          <text>{{ typeIcon(record.type) }}</text>
        </view>
        <!-- Content -->
        <view class="record-body">
          <view class="record-header">
            <text class="record-title">{{ record.title }}</text>
            <view class="unread-dot" v-if="!record.is_read"></view>
          </view>
          <text class="record-desc">{{ record.content || '暂无详情' }}</text>
          <text class="record-date">{{ formatDate(record.created_at) }}</text>
        </view>
      </view>

      <!-- Empty State -->
      <view v-if="!loading && records.length === 0" class="empty-state">
        <view class="empty-icon"><text>🔔</text></view>
        <text class="empty-title">暂无通知</text>
        <text class="empty-desc">暂时没有新的通知消息</text>
      </view>

      <!-- Loading -->
      <view v-if="loading" class="loading-state">
        <view class="spinner"></view>
        <text class="loading-text">加载中...</text>
      </view>

      <!-- Load More -->
      <view v-if="hasMore && !loading && records.length > 0" class="load-more" @click="loadMore">
        <text>加载更多</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { notificationApi } from '@/api/notification';

const records = ref([]);
const unreadCount = ref(0);
const page = ref(1);
const pageSize = 20;
const hasMore = ref(false);
const loading = ref(false);

onShow(() => {
  if (!uni.getStorageSync('token')) {
    uni.showModal({
      title: '提示',
      content: '请先登录',
      showCancel: false,
      success: () => uni.reLaunch({ url: '/pages/login/index' }),
    });
    return;
  }
  loadData();
});

async function loadData() {
  loading.value = true;
  try {
    const [listRes, countRes] = await Promise.all([
      notificationApi.list({ page: 1, page_size: pageSize }).catch(() => ({ rows: [], total: 0 })),
      notificationApi.unreadCount().catch(() => ({ count: 0 })),
    ]);
    records.value = (listRes.rows || []).map(r => ({
      ...r,
      content: parseContent(r.content, r.type),
    }));
    unreadCount.value = countRes.count || 0;
    hasMore.value = records.value.length < (listRes.total || 0);
  } catch (e) {
    console.error('loadData error', e);
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (!hasMore.value) return;
  loading.value = true;
  try {
    page.value++;
    const res = await notificationApi.list({ page: page.value, page_size: pageSize }).catch(() => ({ rows: [] }));
    const rows = (res.rows || []).map(r => ({ ...r, content: parseContent(r.content, r.type) }));
    records.value.push(...rows);
    hasMore.value = rows.length === pageSize;
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

async function markAllRead() {
  try {
    await notificationApi.markAllRead();
    records.value.forEach(r => (r.is_read = 1));
    unreadCount.value = 0;
  } catch (e) {
    console.error(e);
  }
}

async function handleClick(record) {
  if (!record.is_read) {
    try {
      await notificationApi.markRead(record.id);
      record.is_read = 1;
      unreadCount.value = Math.max(0, unreadCount.value - 1);
    } catch (e) {
      console.error(e);
    }
  }
}

function parseContent(content, type) {
  if (!content) return '';
  let obj = content;
  if (typeof content === 'string') {
    try { obj = JSON.parse(content); } catch { return content; }
  }
  switch (type) {
    case 'withdraw_approved': return `提现金额 ¥${obj.amount || 0} 已到账，请注意查收`;
    case 'withdraw_rejected': return `提现金额 ¥${obj.amount || 0} 已拒绝${obj.remark ? '，原因：' + obj.remark : ''}，金额已退回可提现余额`;
    case 'agent_approved': return `恭喜！您已成功升级为${obj.level_name || '分销商'}`;
    case 'agent_rejected': return `您的分销商申请已被拒绝${obj.remark ? '，原因：' + obj.remark : ''}`;
    default: return typeof obj === 'object' ? JSON.stringify(obj) : String(obj);
  }
}

function typeIcon(type) {
  const map = {
    withdraw_approved: '💰',
    withdraw_rejected: '❌',
    agent_approved: '⚡',
    agent_rejected: '📋',
  };
  return map[type] || '🔔';
}

function goBack() { uni.navigateBack(); }

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
</script>

<style lang="scss" scoped>
$bg: #f5f3ee;
$card: #ffffff;
$primary: #FF6B00;
$primary-light: #FF8533;
$gold: #d4a843;
$text-primary: #1c1917;
$text-secondary: #57534e;
$text-muted: #a8a29e;
$border: #ece8e1;
$shadow-card: 0 2rpx 16rpx rgba(0,0,0,0.06), 0 8rpx 32rpx rgba(0,0,0,0.04);

.page { min-height: 100vh; background: $bg; }

.nav-bar {
  display: flex; align-items: center; justify-content: space-between;
  height: 88rpx; padding: 0 24rpx; background: $card;
  border-bottom: 1rpx solid $border; position: sticky; top: 0; z-index: 10;
}
.nav-back { font-size: 28rpx; color: $primary; min-width: 80rpx; }
.nav-title { font-size: 32rpx; font-weight: 500; color: $text-primary; }
.nav-action { font-size: 26rpx; color: $primary; min-width: 80rpx; text-align: right; }
.nav-placeholder { min-width: 80rpx; }

.unread-bar {
  display: flex; justify-content: space-between; align-items: center;
  background: rgba($primary, 0.08); padding: 20rpx 32rpx;
  .unread-text { font-size: 26rpx; color: $primary; font-weight: 500; }
  .unread-action { font-size: 24rpx; color: $primary; }
}

.record-list { padding: 24rpx; }

.record-card {
  display: flex; gap: 24rpx;
  background: $card; border-radius: 24rpx; padding: 28rpx;
  margin-bottom: 16rpx; box-shadow: $shadow-card;
  transition: opacity 0.2s;
}
.record-card.read { opacity: 0.7; }
.record-card.unread { opacity: 1; }

.record-icon {
  width: 80rpx; height: 80rpx; border-radius: 20rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 40rpx; flex-shrink: 0;
}
.icon-withdraw_approved { background: rgba(0, 180, 60, 0.12); }
.icon-withdraw_rejected { background: rgba(255, 80, 80, 0.1); }
.icon-agent_approved { background: rgba(212, 168, 67, 0.12); }
.icon-agent_rejected { background: rgba(255, 165, 0, 0.1); }
.icon-default { background: rgba($primary, 0.08); }

.record-body { flex: 1; overflow: hidden; }
.record-header {
  display: flex; align-items: center; gap: 12rpx; margin-bottom: 8rpx;
}
.record-title { font-size: 28rpx; font-weight: 600; color: $text-primary; flex: 1; }
.record-desc { display: block; font-size: 24rpx; color: $text-secondary; margin-bottom: 8rpx; line-height: 1.4; }
.record-date { font-size: 22rpx; color: $text-muted; }

.unread-dot {
  width: 12rpx; height: 12rpx; border-radius: 50%;
  background: $primary; flex-shrink: 0;
}

.empty-state {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 120rpx 0;
  .empty-icon {
    width: 120rpx; height: 120rpx;
    background: linear-gradient(135deg, $primary 0%, $primary-light 100%);
    border-radius: 24rpx; display: flex; align-items: center;
    justify-content: center; margin-bottom: 32rpx;
    box-shadow: 0 8rpx 24rpx rgba(255, 107, 0, 0.25);
    text { font-size: 56rpx; }
  }
  .empty-title { font-size: 32rpx; font-weight: 600; color: $text-primary; margin-bottom: 12rpx; }
  .empty-desc { font-size: 26rpx; color: $text-muted; }
}

.loading-state { display: flex; align-items: center; justify-content: center; gap: 16rpx; padding: 48rpx; }
.spinner {
  width: 36rpx; height: 36rpx; border: 3rpx solid $border;
  border-top-color: $primary; border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loading-text { color: $text-muted; font-size: 26rpx; }

.load-more { text-align: center; color: $primary; padding: 32rpx; font-size: 26rpx; font-weight: 500; }
</style>
