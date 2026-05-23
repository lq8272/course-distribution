<template>
  <view class="page">
    <!-- 统计栏 -->
    <view class="stats-row">
      <view class="stat-item">
        <text class="stat-value">{{ stats.total || 0 }}</text>
        <text class="stat-label">全部</text>
      </view>
      <view class="stat-item">
        <text class="stat-value warn">{{ stats.pending || 0 }}</text>
        <text class="stat-label">待处理</text>
      </view>
      <view class="stat-item">
        <text class="stat-value primary">{{ stats.replied || 0 }}</text>
        <text class="stat-label">已处理</text>
      </view>
      <view class="stat-item">
        <text class="stat-value gray">{{ stats.ignored || 0 }}</text>
        <text class="stat-label">已忽略</text>
      </view>
    </view>

    <!-- 筛选栏 -->
    <view class="filter-bar">
      <view
        v-for="f in filters"
        :key="f.value"
        :class="['filter-btn', currentFilter === f.value ? 'active' : '']"
        @click="currentFilter = f.value; page = 1; loadList()"
      >
        {{ f.label }}
      </view>
    </view>

    <!-- 反馈列表 -->
    <scroll-view class="list" scroll-y @scrolltolower="loadMore">
      <view v-if="loading && list.length === 0" class="empty-state">
        <view class="spinner"></view>
        <text>加载中...</text>
      </view>
      <view v-else-if="list.length === 0" class="empty-state">
        <text class="empty-icon">📝</text>
        <text class="empty-text">暂无反馈</text>
      </view>
      <view
        v-for="item in list"
        :key="item.id"
        class="card"
        @click="goDetail(item)"
      >
        <view class="card-header">
          <view class="user-avatar">{{ (item.user_nickname || '?').substring(0, 1) }}</view>
          <view class="user-info">
            <text class="nickname">{{ item.user_nickname || '用户' + item.user_id }}</text>
            <text class="phone">{{ item.user_phone || '无手机' }}</text>
          </view>
          <view :class="['status-tag', 'status-' + item.status]">
            {{ statusMap[item.status] }}
          </view>
        </view>
        <view class="card-body">
          <view class="type-row">
            <view :class="['type-tag', 'type-' + item.type]">{{ typeMap[item.type] }}</view>
            <text class="time">{{ formatTime(item.created_at) }}</text>
          </view>
          <text class="content">{{ item.content }}</text>
          <text v-if="item.reply" class="reply-preview">回复：{{ item.reply }}</text>
        </view>
      </view>
      <view v-if="hasMore && list.length > 0" class="load-more" @click="loadMore">
        {{ loadingMore ? '加载中...' : '加载更多' }}
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { adminFeedbackApi } from '@/api/service.js';

const list = ref([]);
const stats = ref({});
const loading = ref(false);
const loadingMore = ref(false);
const currentFilter = ref('all');
const page = ref(1);
const hasMore = ref(false);

const filters = [
  { label: '全部', value: 'all' },
  { label: '待处理', value: '0' },
  { label: '已处理', value: '2' },
  { label: '已忽略', value: '3' },
];

const statusMap = { 0: '待处理', 1: '处理中', 2: '已处理', 3: '已忽略' };
const typeMap = { bug: '功能异常', suggest: '体验建议', other: '其他' };

onShow(async () => {
  await loadStats();
  await loadList();
});

async function loadStats() {
  try {
    stats.value = await adminFeedbackApi.stats();
  } catch (e) { console.error(e); }
}

async function loadList() {
  loading.value = true;
  try {
    const params = { page: 1, page_size: 20 };
    if (currentFilter.value !== 'all') params.status = currentFilter.value;
    const res = await adminFeedbackApi.list({ params });
    list.value = res.rows || [];
    hasMore.value = (res.rows || []).length >= 20;
    page.value = 1;
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (loadingMore.value || !hasMore.value) return;
  loadingMore.value = true;
  try {
    const nextPage = page.value + 1;
    const params = { page: nextPage, page_size: 20 };
    if (currentFilter.value !== 'all') params.status = currentFilter.value;
    const res = await adminFeedbackApi.list({ params });
    list.value.push(...(res.rows || []));
    hasMore.value = (res.rows || []).length >= 20;
    page.value = nextPage;
  } catch (e) {
    console.error(e);
  } finally {
    loadingMore.value = false;
  }
}

function goDetail(item) {
  uni.navigateTo({ url: `/pages/admin/feedback/detail?id=${item.id}` });
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}
</script>

<style lang="scss" scoped>
@import "@/common/styles/base.scss";

.page { min-height: 100vh; background: $bg-light; }

.stats-row {
  display: flex; background: #fff; padding: 24rpx 0;
  border-bottom: 1rpx solid $border-color;
}
.stat-item {
  flex: 1; text-align: center;
  .stat-value { display: block; font-size: 40rpx; font-weight: 700; color: $text-primary; }
  .stat-value.warn { color: #ff6b00; }
  .stat-value.primary { color: $primary-color; }
  .stat-value.gray { color: $text-gray; }
  .stat-label { font-size: 22rpx; color: $text-gray; margin-top: 4rpx; display: block; }
}

.filter-bar {
  display: flex; gap: 16rpx; padding: 16rpx 24rpx; background: #fff;
  border-bottom: 1rpx solid $border-color;
  .filter-btn {
    padding: 8rpx 24rpx; border-radius: 20rpx; font-size: 24rpx;
    background: $bg-light; color: $text-secondary;
  }
  .filter-btn.active {
    background: rgba($primary-color, 0.1); color: $primary-color; font-weight: 600;
  }
}

.list { height: calc(100vh - 280rpx); padding: 16rpx 24rpx; }

.card {
  background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}

.card-header {
  display: flex; align-items: center; margin-bottom: 16rpx;
}
.user-avatar {
  width: 64rpx; height: 64rpx; border-radius: 50%;
  background: linear-gradient(135deg, $primary-color, $secondary-color);
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-size: 28rpx; font-weight: 600; margin-right: 16rpx; flex-shrink: 0;
}
.user-info { flex: 1; }
.nickname { font-size: 28rpx; font-weight: 600; color: $text-primary; display: block; }
.phone { font-size: 22rpx; color: $text-gray; }

.status-tag {
  padding: 4rpx 16rpx; border-radius: 12rpx; font-size: 22rpx;
}
.status-0 { background: rgba(255,107,0,0.1); color: #ff6b00; }
.status-1 { background: rgba(0,122,255,0.1); color: #007aff; }
.status-2 { background: rgba(52,199,89,0.1); color: #34c759; }
.status-3 { background: rgba(142,142,147,0.1); color: #8e8e93; }

.card-body { }
.type-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.type-tag {
  padding: 4rpx 12rpx; border-radius: 8rpx; font-size: 22rpx;
}
.type-bug { background: rgba(255,59,48,0.1); color: #ff3b30; }
.type-suggest { background: rgba(0,122,255,0.1); color: #007aff; }
.type-other { background: rgba(142,142,147,0.1); color: #8e8e93; }
.time { font-size: 22rpx; color: $text-gray; }

.content {
  font-size: 26rpx; color: $text-primary; line-height: 1.6;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
  overflow: hidden;
}
.reply-preview {
  font-size: 24rpx; color: $primary-color; margin-top: 8rpx;
  display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.empty-state {
  text-align: center; padding: 120rpx 0;
  .empty-icon { display: block; font-size: 96rpx; margin-bottom: 24rpx; }
  .empty-text { font-size: 28rpx; color: $text-gray; }
}
.load-more {
  text-align: center; padding: 24rpx; font-size: 26rpx; color: $text-gray;
}

.spinner {
  width: 48rpx; height: 48rpx; border: 4rpx solid $border-color;
  border-top-color: $primary-color; border-radius: 50%;
  animation: spin 0.8s linear infinite; margin: 0 auto 16rpx;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
