<template>
  <view class="page">
    <!-- Tabs -->
    <view class="tabs">
      <view
        v-for="tab in tabs"
        :key="tab.value"
        :class="'tab' + (currentTab === tab.value ? ' active' : '')"
        @click="switchTab(tab.value)"
      >
        {{ tab.label }}
      </view>
    </view>

    <!-- Order List -->
    <view class="order-list">
      <view
        v-for="order in orders"
        :key="order.id"
        class="order-card"
        @click="goDetail(order.id)"
      >
        <view class="order-card__cover">
          <image :src="order.course_cover || '/static/default-cover.png'" mode="aspectFill" class="cover" />
        </view>
        <view class="order-card__body">
          <view class="order-card__title">{{ order.course_title }}</view>
          <view class="order-card__info">
            <text class="price">¥{{ order.total_amount || 0 }}</text>
            <text class="status-tag" :class="'status-' + order.status">{{ statusText(order.status) }}</text>
            <text class="date">{{ formatDate(order.created_at) }}</text>
          </view>
        </view>
      </view>

      <!-- Empty State -->
      <view v-if="!loading && orders.length === 0" class="empty-state">
        <view class="empty-icon">
          <text>📋</text>
        </view>
        <text class="empty-title">暂无订单</text>
        <text class="empty-desc">快去挑选心仪的课程吧</text>
        <view class="empty-cta" @click="goExplore">去逛逛</view>
      </view>

      <!-- Loading -->
      <view v-if="loading" class="loading-state">
        <view class="spinner"></view>
        <text class="loading-text">加载中...</text>
      </view>

      <!-- Load More -->
      <view v-if="hasMore && !loading && orders.length > 0" class="load-more" @click="loadMore">
        <text>加载更多</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { orderApi } from '@/api/order';

const tabs = [
  { label: '全部', value: -1 },
  { label: '待支付', value: 0 },
  { label: '已完成', value: 1 },
  { label: '退款', value: 3 },
];

const currentTab = ref(-1);
const orders = ref([]);
const page = ref(1);
const pageSize = 10;
const hasMore = ref(false);
const loading = ref(false);

onLoad((options) => {
  if (!uni.getStorageSync('token')) {
    uni.showModal({
      title: '提示',
      content: '请先登录',
      showCancel: false,
      success: () => {
        uni.reLaunch({ url: '/pages/login/index' });
      },
    });
    return;
  }
  if (options.status !== undefined) {
    currentTab.value = parseInt(options.status);
  }
  loadOrders(true);
});

function switchTab(value) {
  currentTab.value = value;
  loadOrders(true);
}

async function loadOrders(reset = false) {
  if (loading.value) return;
  loading.value = true;

  try {
    if (reset) {
      page.value = 1;
      orders.value = [];
    }

    const params = {
      page: page.value,
      page_size: pageSize,
    };
    if (currentTab.value !== -1) {
      if (currentTab.value === 1) {
        // 已完成: status in (1,2)
        params.status = '1,2';
      } else {
        params.status = currentTab.value;
      }
    }

    const res = await orderApi.list(params);
    const rows = res.rows || [];

    if (reset) {
      orders.value = rows;
    } else {
      orders.value.push(...rows);
    }

    hasMore.value = orders.value.length < (res.total || 0) && rows.length === pageSize;
  } catch (e) {
    console.error('loadOrders error', e);
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function loadMore() {
  if (!hasMore.value) return;
  page.value++;
  loadOrders(false);
}

function goDetail(id) {
  uni.navigateTo({ url: `/pages/order/detail?id=${id}` });
}

function goExplore() {
  uni.switchTab({ url: '/pages/index/index' });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function statusText(status) {
  const map = { 0: '待支付', 1: '已完成', 2: '已完成', 3: '已退款' };
  return map[status] || '未知';
}
</script>

<style lang="scss" scoped>
// Design System Variables (local scope for this page)
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

.page {
  min-height: 100vh;
  background: $bg;
}

// Tabs
.tabs {
  display: flex;
  background: $card;
  position: sticky;
  top: 0;
  z-index: 10;
  padding: 0 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04);
}

.tab {
  flex: 1;
  text-align: center;
  padding: 28rpx 0;
  font-size: 28rpx;
  color: $text-muted;
  position: relative;
  transition: color 0.2s;
}

.tab.active {
  color: $primary;
  font-weight: 600;
}

.tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 48rpx;
  height: 4rpx;
  background: linear-gradient(135deg, $primary 0%, $primary-light 100%);
  border-radius: 2rpx;
}

// Order List
.order-list {
  padding: 24rpx;
}

// Section Header
.section-header {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;

  .section-bar {
    width: 6rpx;
    height: 28rpx;
    background: linear-gradient(180deg, $primary 0%, $primary-light 100%);
    border-radius: 3rpx;
    margin-right: 12rpx;
  }

  .section-label {
    font-size: 24rpx;
    font-weight: 600;
    color: $text-primary;
    text-transform: uppercase;
    letter-spacing: 2rpx;
  }
}

// Order Card
.order-card {
  display: flex;
  background: $card;
  border-radius: 24rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: $shadow-card;
  transition: transform 0.2s, box-shadow 0.2s;

  &:active {
    transform: scale(0.98);
    box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.06);
  }
}

.order-card__cover {
  flex-shrink: 0;

  .cover {
    width: 160rpx;
    height: 120rpx;
    border-radius: 16rpx;
  }
}

.order-card__body {
  flex: 1;
  margin-left: 24rpx;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  min-height: 120rpx;
}

.order-card__title {
  font-size: 28rpx;
  color: $text-primary;
  font-weight: 600;
  line-height: 1.4;
  flex: 1;
}

.order-card__info {
  display: flex;
  align-items: center;
  flex-shrink: 0;

  .price {
    font-size: 28rpx;
    color: $text-primary;
    font-weight: bold;
    margin-right: 16rpx;
  }

  .status-tag {
    flex: 1;
    text-align: center;
  }

  .date {
    font-size: 22rpx;
    color: $text-muted;
    text-align: right;
    margin-left: 16rpx;
  }
}

// Status Tags (using rgba backgrounds)
.status-tag {
  font-size: 22rpx;
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  font-weight: 500;
}

.status-tag.status-0 {
  background: rgba(255, 107, 0, 0.12);
  color: $primary;
}

.status-tag.status-1,
.status-tag.status-2 {
  background: rgba(0, 180, 60, 0.12);
  color: #00b43c;
}

.status-tag.status-3 {
  background: rgba(168, 162, 158, 0.15);
  color: $text-secondary;
}

// Empty State
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;

  .empty-icon {
    width: 120rpx;
    height: 120rpx;
    background: linear-gradient(135deg, $primary 0%, $primary-light 100%);
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 32rpx;
    box-shadow: 0 8rpx 24rpx rgba(255, 107, 0, 0.25);

    text {
      font-size: 56rpx;
    }
  }

  .empty-title {
    font-size: 32rpx;
    font-weight: 600;
    color: $text-primary;
    margin-bottom: 12rpx;
  }

  .empty-desc {
    font-size: 26rpx;
    color: $text-muted;
    margin-bottom: 40rpx;
  }

  .empty-cta {
    padding: 20rpx 48rpx;
    background: linear-gradient(135deg, $primary 0%, $primary-light 100%);
    color: #ffffff;
    font-size: 28rpx;
    font-weight: 500;
    border-radius: 40rpx;
    box-shadow: 0 4rpx 16rpx rgba(255, 107, 0, 0.3);
  }
}

// Loading State
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  padding: 48rpx;
}

.spinner {
  width: 36rpx;
  height: 36rpx;
  border: 3rpx solid $border;
  border-top-color: $primary;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  color: $text-muted;
  font-size: 26rpx;
}

// Load More
.load-more {
  text-align: center;
  color: $primary;
  padding: 32rpx;
  font-size: 26rpx;
  font-weight: 500;
}
</style>