<template>
  <view class="page">
    <!-- Section Header -->
    <view class="section-header">
      <view class="section-bar"></view>
      <text class="section-label">会话概览</text>
    </view>

    <!-- 统计栏 -->
    <view class="stats-row">
      <view class="stat-item">
        <view class="stat-icon">💬</view>
        <text class="stat-value">{{ stats.total || 0 }}</text>
        <text class="stat-label">总会话</text>
      </view>
      <view class="stat-item">
        <view class="stat-icon stat-icon--warn">⏳</view>
        <text class="stat-value warn">{{ stats.pending || 0 }}</text>
        <text class="stat-label">待回复</text>
      </view>
      <view class="stat-item">
        <view class="stat-icon stat-icon--primary">✓</view>
        <text class="stat-value primary">{{ stats.replied || 0 }}</text>
        <text class="stat-label">已回复</text>
      </view>
      <view class="stat-item">
        <view class="stat-icon stat-icon--gray">✕</view>
        <text class="stat-value gray">{{ stats.closed || 0 }}</text>
        <text class="stat-label">已关闭</text>
      </view>
    </view>

    <!-- Section Header -->
    <view class="section-header" style="margin-top: 8rpx;">
      <view class="section-bar"></view>
      <text class="section-label">筛选会话</text>
    </view>

    <!-- 筛选栏 -->
    <view class="filter-bar">
      <view
        v-for="f in filters"
        :key="f.value"
        :class="['filter-btn', currentFilter === f.value ? 'active' : '']"
        @click="currentFilter = f.value; loadList()"
      >
        {{ f.label }}
        <view v-if="f.value === 'pending' && stats.unread_user_messages > 0" class="badge">
          {{ stats.unread_user_messages }}
        </view>
      </view>
    </view>

    <!-- 会话列表 -->
    <scroll-view class="list" scroll-y @scrolltolower="loadMore">
      <view v-if="loading && list.length === 0" class="empty-state">
        <view class="spinner"></view>
        <text>加载中...</text>
      </view>
      <view v-else-if="list.length === 0" class="empty-state">
        <text class="empty-icon">📭</text>
        <text class="empty-text">暂无会话</text>
      </view>
      <view
        v-for="item in list"
        :key="item.id"
        :class="['card', item.unread > 0 ? 'unread' : '']"
        @click="goChat(item)"
      >
        <view class="card-header">
          <view class="user-avatar">{{ item.nickname ? item.nickname.substring(0, 1) : '?' }}</view>
          <text class="nickname">{{ item.nickname || '用户' + item.user_id }}</text>
          <view class="meta">
            <view :class="['status-tag', 'status-' + item.status]">
              {{ statusMap[item.status] }}
            </view>
            <text class="time">{{ formatTime(item.updated_at) }}</text>
          </view>
        </view>
        <view class="card-body">
          <text class="last-msg">{{ item.last_message || '暂无消息' }}</text>
        </view>
        <view class="card-footer">
          <text class="type-tag">{{ typeMap[item.type] || '其他' }}</text>
          <view v-if="item.unread > 0" class="unread-badge">{{ item.unread }} 未读</view>
        </view>
      </view>
      <view v-if="hasMore && list.length > 0" class="load-more" @click="loadMore">
        {{ loading ? '加载中...' : '加载更多' }}
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { onUnmounted } from 'vue';
import { adminServiceApi } from '@/api/service.js';

const list = ref([]);
const stats = ref({});
const loading = ref(false);
const currentFilter = ref('all');
const page = ref(1);
const hasMore = ref(false);

const filters = [
  { label: '全部', value: 'all' },
  { label: '待回复', value: '0' },
  { label: '已回复', value: '1' },
  { label: '已关闭', value: '2' },
];

const statusMap = { 0: '待回复', 1: '已回复', 2: '已关闭' };
const typeMap = { 1: '功能咨询', 2: '佣金提现', 3: '课程问题', 4: '投诉建议', 5: '其他' };

onShow(() => {
  loadStats();
  loadList();
});

uni.$on('ws_customer_message', () => { loadStats(); loadList(); });
uni.$on('ws_conversation_updated', () => { loadStats(); loadList(); });

onUnmounted(() => {
  uni.$off('ws_customer_message');
  uni.$off('ws_conversation_updated');
});

async function loadStats() {
  try {
    const res = await adminServiceApi.stats();
    if (res.code === 0) {
      stats.value = res.data || {};
    }
  } catch (e) {
    console.error('loadStats error', e);
  }
}

async function loadList() {
  loading.value = true;
  page.value = 1;
  try {
    const params = { page: 1, limit: 20 };
    if (currentFilter.value !== 'all') params.status = currentFilter.value;
    const res = await adminServiceApi.conversations(params);
    if (res.code === 0) {
      list.value = res.data.rows || [];
      hasMore.value = list.value.length >= 20;
    }
  } catch (e) {
    console.error('loadList error', e);
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (loading.value || !hasMore.value) return;
  loading.value = true;
  page.value++;
  try {
    const params = { page: page.value, limit: 20 };
    if (currentFilter.value !== 'all') params.status = currentFilter.value;
    const res = await adminServiceApi.conversations(params);
    if (res.code === 0) {
      list.value.push(...(res.data.rows || []));
      hasMore.value = res.data.rows && res.data.rows.length >= 20;
    }
  } catch (e) {
    page.value--;
  } finally {
    loading.value = false;
  }
}

function goChat(item) {
  uni.navigateTo({ url: `/pages/admin/service/chat?id=${item.id}&nickname=${encodeURIComponent(item.nickname || '')}` });
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
</script>

<style scoped lang="scss">
@import "@/common/styles/base.scss";

.page { min-height: 100vh; background: $bg-light; }

.section-header {
  display: flex;
  align-items: center;
  padding: 32rpx 24rpx 16rpx;
  .section-bar {
    width: 6rpx;
    height: 28rpx;
    background: linear-gradient(180deg, $primary-color 0%, $secondary-color 100%);
    border-radius: 3rpx;
    margin-right: 12rpx;
  }
  .section-label {
    font-size: 24rpx;
    font-weight: 600;
    color: $text-secondary;
    text-transform: uppercase;
    letter-spacing: 2rpx;
  }
}

.stats-row {
  display: flex;
  background: $bg-white;
  border-radius: 24rpx;
  padding: 32rpx 0;
  margin: 0 24rpx 24rpx;
  box-shadow: 0 2rpx 16rpx rgba(0,0,0,0.06), 0 8rpx 32rpx rgba(0,0,0,0.04);
}

.stat-item {
  flex: 1;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;

  .stat-icon {
    font-size: 40rpx;
    margin-bottom: 8rpx;
    width: 64rpx;
    height: 64rpx;
    border-radius: 16rpx;
    background: $bg-light;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .stat-icon--warn { background: rgba(#ff9500, 0.1); }
  .stat-icon--primary { background: rgba($primary-color, 0.1); }
  .stat-icon--gray { background: $bg-light; }

  .stat-value {
    display: block;
    font-size: 36rpx;
    font-weight: 700;
    color: $text-primary;
    margin-bottom: 4rpx;
  }
  .stat-item .warn { color: #ff9500; }
  .stat-item .primary { color: $primary-color; }
  .stat-item .gray { color: $text-gray; }
  .stat-label { font-size: 22rpx; color: $text-gray; display: block; }
}

.filter-bar {
  display: flex;
  gap: 16rpx;
  padding: 0 24rpx 16rpx;
}

.filter-btn {
  padding: 8rpx 24rpx;
  border-radius: 32rpx;
  font-size: 24rpx;
  color: $text-secondary;
  background: $bg-white;
  position: relative;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04);
}

.filter-btn.active {
  background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
  color: #fff;
}

.filter-btn .badge {
  position: absolute;
  top: -8rpx;
  right: -8rpx;
  background: #ff3b30;
  color: #fff;
  font-size: 18rpx;
  border-radius: 16rpx;
  padding: 2rpx 8rpx;
  min-width: 32rpx;
  text-align: center;
}

.list { height: calc(100vh - 360rpx); padding: 0 24rpx; }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
  color: $text-gray;
  font-size: 28rpx;

  .empty-icon { font-size: 96rpx; margin-bottom: 24rpx; display: block; }
  .empty-text { display: block; margin-bottom: 24rpx; }
}

.spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid $border-color;
  border-top-color: $primary-color;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16rpx;
}
@keyframes spin { to { transform: rotate(360deg); } }

.card {
  background: $bg-white;
  margin-bottom: 16rpx;
  border-radius: 24rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 16rpx rgba(0,0,0,0.06), 0 8rpx 32rpx rgba(0,0,0,0.04);
}

.card.unread { border-left: 6rpx solid $primary-color; }

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
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
  margin-right: 16rpx;
  flex-shrink: 0;
}

.nickname {
  flex: 1;
  font-size: 30rpx;
  font-weight: 600;
  color: $text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta { display: flex; align-items: center; gap: 12rpx; }
.time { font-size: 22rpx; color: $text-gray; }

.status-tag { font-size: 20rpx; padding: 4rpx 12rpx; border-radius: 12rpx; }
.status-tag.status-0 { background: rgba(#ff9500, 0.1); color: #ff9500; }
.status-tag.status-1 { background: rgba(#4caf50, 0.1); color: #4caf50; }
.status-tag.status-2 { background: $bg-light; color: $text-gray; }

.card-body { margin-bottom: 12rpx; }
.last-msg { font-size: 26rpx; color: $text-secondary; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }

.card-footer { display: flex; justify-content: space-between; align-items: center; }
.type-tag { font-size: 20rpx; color: $text-gray; background: $bg-light; padding: 4rpx 12rpx; border-radius: 8rpx; }
.unread-badge { font-size: 20rpx; color: #fff; background: #ff3b30; padding: 4rpx 12rpx; border-radius: 8rpx; }

.load-more { text-align: center; padding: 24rpx; color: $primary-color; font-size: 26rpx; }
</style>