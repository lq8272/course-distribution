<template>
  <view class="page">
    <!-- Tabs -->
    <view class="tabs">
      <view
        v-for="tab in tabs"
        :key="tab.value"
        :class="['tab', { active: currentTab === tab.value }]"
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
        <view class="order-card__left">
          <image :src="order.course_cover || '/static/default-cover.png'" mode="aspectFill" class="cover" />
        </view>
        <view class="order-card__right">
          <view class="order-card__title">{{ order.course_title }}</view>
          <view class="order-card__meta">
            <text class="date">{{ formatDate(order.created_at) }}</text>
          </view>
          <view class="order-card__footer">
            <text class="price">¥{{ order.amount || 0 }}</text>
            <text :class="['status', statusClass(order.status)]">{{ statusText(order.status) }}</text>
          </view>
        </view>
      </view>

      <!-- Empty -->
      <view v-if="!loading && orders.length === 0" class="empty">
        <text>暂无订单</text>
      </view>

      <!-- Loading -->
      <view v-if="loading" class="loading">
          <view class="spinner"></view>
        <text class="loading-text">加载中...</text>
      </view>

      <!-- Load More -->
      <view v-if="hasMore && !loading" class="load-more" @click="loadMore">
        <text>加载更多</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { orderApi } from '../../api/order';

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

    hasMore.value = orders.value.length < (res.total || 0);
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

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function statusText(status) {
  const map = { 0: '待支付', 1: '已完成', 2: '已完成', 3: '已退款' };
  return map[status] || '未知';
}

function statusClass(status) {
  const map = { 0: 'orange', 1: 'green', 2: 'green', 3: 'gray' };
  return map[status] || '';
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: var(--bg-light); }

.tabs { display: flex; background: var(--bg-white); position: sticky; top: 0; z-index: 10; }
.tab { flex: 1; text-align: center; padding: 24rpx 0; font-size: 28rpx; color: var(--text-gray); position: relative; transition: color 0.2s; }
.tab.active { color: var(--accent-blue); font-weight: 500; }
.tab.active::after { content: ''; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 48rpx; height: 4rpx; background: var(--accent-blue); border-radius: 2rpx; }

.order-list { padding: 16rpx; }

.order-card { display: flex; background: var(--bg-white); border-radius: var(--border-radius); padding: 20rpx; margin-bottom: 16rpx; box-shadow: var(--shadow-sm); }
.order-card__left .cover { width: 160rpx; height: 120rpx; border-radius: 8rpx; }
.order-card__right { flex: 1; margin-left: 20rpx; display: flex; flex-direction: column; justify-content: space-between; }
.order-card__title { font-size: 28rpx; color: var(--text-primary); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.order-card__meta .date { font-size: 22rpx; color: var(--text-gray); }
.order-card__footer { display: flex; justify-content: space-between; align-items: center; }
.order-card__footer .price { font-size: 30rpx; color: var(--text-primary); font-weight: bold; }
.status-tag { font-size: 24rpx; padding: 4rpx 16rpx; border-radius: 8rpx; display: inline-block; }
.status-tag.pending { background: rgba(255, 150, 0, 0.1); color: #ff9600; }
.status-tag.done { background: rgba(0, 180, 60, 0.1); color: #00b43c; }
.status-tag.refund { background: rgba(153, 153, 153, 0.1); color: #999; }

.empty { text-align: center; color: var(--text-gray); padding: 100rpx 0; font-size: 28rpx; }
.loading { display: flex; align-items: center; justify-content: center; gap: 12rpx; padding: 32rpx; }
.spinner { width: 32rpx; height: 32rpx; border: 3rpx solid var(--border-color); border-top-color: var(--accent-blue); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.loading-text { color: var(--text-gray); font-size: 24rpx; }
.load-more { text-align: center; color: var(--accent-blue); padding: 32rpx; font-size: 26rpx; }
</style>
