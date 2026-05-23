<template>
  <view class="page">
    <!-- 筛选栏 -->
    <view class="filter-bar">
      <view
        v-for="f in filters"
        :key="f.value"
        :class="['filter-btn', currentFilter === f.value ? 'active' : '']"
        @click="currentFilter = f.value; page = 1; loadList()"
      >{{ f.label }}</view>
    </view>

    <!-- 反馈列表 -->
    <scroll-view class="list" scroll-y @scrolltolower="loadMore">
      <view v-if="loading && list.length === 0" class="empty-state">
        <view class="spinner"></view>
        <text>加载中...</text>
      </view>
      <view v-else-if="list.length === 0" class="empty-state">
        <text class="empty-icon">📝</text>
        <text class="empty-text">暂无反馈记录</text>
      </view>
      <view
        v-for="item in list"
        :key="item.id"
        class="card"
        @click="goDetail(item)"
      >
        <view class="card-header">
          <view :class="['type-tag', 'type-' + item.type]">{{ typeMap[item.type] }}</view>
          <view :class="['status-tag', 'status-' + item.status]">{{ statusMap[item.status] }}</view>
        </view>
        <text class="content">{{ item.content }}</text>
        <view class="card-footer">
          <text class="time">{{ formatTime(item.created_at) }}</text>
          <text v-if="item.reply" class="has-reply">已回复 ›</text>
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
import { feedbackApi } from '@/api/service.js';

const list = ref([]);
const loading = ref(false);
const loadingMore = ref(false);
const currentFilter = ref('all');
const page = ref(1);
const hasMore = ref(false);

const filters = [
  { label: '全部', value: 'all' },
  { label: '待处理', value: '0' },
  { label: '已处理', value: '2' },
];

const statusMap = { 0: '待处理', 1: '处理中', 2: '已处理', 3: '已忽略' };
const typeMap = { bug: '功能异常', suggest: '体验建议', other: '其他' };

onShow(() => loadList());

async function loadList() {
  loading.value = true;
  try {
    const params = { page: 1, page_size: 20 };
    if (currentFilter.value !== 'all') params.status = currentFilter.value;
    const res = await feedbackApi.list(params);
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
    const res = await feedbackApi.list(params);
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
  uni.navigateTo({ url: `/pages/user/feedbacks/detail?id=${item.id}` });
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
}
</script>

<style lang="scss" scoped>
@import "@/common/styles/base.scss";

.page { min-height: 100vh; background: $bg-light; }

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

.list { height: calc(100vh - 100rpx); padding: 16rpx 24rpx; }

.card {
  background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}

.card-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx;
}

.type-tag {
  padding: 4rpx 16rpx; border-radius: 12rpx; font-size: 22rpx;
}
.type-bug { background: rgba(255,59,48,0.1); color: #ff3b30; }
.type-suggest { background: rgba(0,122,255,0.1); color: #007aff; }
.type-other { background: rgba(142,142,147,0.1); color: #8e8e93; }

.status-tag {
  padding: 4rpx 16rpx; border-radius: 12rpx; font-size: 22rpx;
}
.status-0 { background: rgba(255,107,0,0.1); color: #ff6b00; }
.status-1 { background: rgba(0,122,255,0.1); color: #007aff; }
.status-2 { background: rgba(52,199,89,0.1); color: #34c759; }
.status-3 { background: rgba(142,142,147,0.1); color: #8e8e93; }

.content {
  font-size: 28rpx; color: $text-primary; line-height: 1.6;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}

.card-footer {
  display: flex; justify-content: space-between; align-items: center; margin-top: 16rpx;
  .time { font-size: 22rpx; color: $text-gray; }
  .has-reply { font-size: 24rpx; color: $primary-color; }
}

.empty-state { text-align: center; padding: 120rpx 0; }
.empty-icon { display: block; font-size: 96rpx; margin-bottom: 24rpx; }
.empty-text { font-size: 28rpx; color: $text-gray; }

.load-more { text-align: center; padding: 24rpx; font-size: 26rpx; color: $text-gray; }

.spinner {
  width: 48rpx; height: 48rpx; border: 4rpx solid $border-color;
  border-top-color: $primary-color; border-radius: 50%;
  animation: spin 0.8s linear infinite; margin: 0 auto 16rpx;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
