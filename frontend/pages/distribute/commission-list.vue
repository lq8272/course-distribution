<template>
  <view class="page">
    <!-- Nav Bar -->
    <view class="nav-bar">
      <view class="nav-back" @click="goBack">← 返回</view>
      <text class="nav-title">佣金明细</text>
      <view class="nav-placeholder"></view>
    </view>

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

    <!-- Summary Stats -->
    <view class="summary-bar">
      <view class="summary-item">
        <text class="summary-label">可提现</text>
        <text class="summary-value primary">¥{{ summary.available || '0.00' }}</text>
      </view>
      <view class="summary-divider"></view>
      <view class="summary-item">
        <text class="summary-label">已提现</text>
        <text class="summary-value">¥{{ summary.withdrawn || '0.00' }}</text>
      </view>
      <view class="summary-divider"></view>
      <view class="summary-item">
        <text class="summary-label">累计佣金</text>
        <text class="summary-value">¥{{ summary.total || '0.00' }}</text>
      </view>
    </view>

    <!-- Record List -->
    <view class="record-list">
      <view
        v-for="record in records"
        :key="record.id"
        class="record-card"
      >
        <!-- 左：课程+类型 -->
        <view class="record-left">
          <view class="record-course">{{ record.course_title || '课程订单' }}</view>
          <view class="record-meta">
            <text class="type-tag" :class="'type-' + record.type">{{ record.type_text }}</text>
            <text class="record-date">{{ formatDate(record.created_at) }}</text>
          </view>
        </view>
        <!-- 右：金额+状态 -->
        <view class="record-right">
          <view class="record-amount" :class="{ 'amount-plus': record.status === 1, 'amount-minus': record.status === 2 }">
            {{ record.status === 1 ? '+' : record.status === 2 ? '-' : '' }}¥{{ record.amount }}
          </view>
          <view class="status-tag" :class="'status-' + record.status">{{ record.status_text }}</view>
        </view>
      </view>

      <!-- Empty State -->
      <view v-if="!loading && records.length === 0" class="empty-state">
        <view class="empty-icon"><text>💰</text></view>
        <text class="empty-title">暂无佣金记录</text>
        <text class="empty-desc">分享课程给好友购买后，即可获得佣金</text>
        <view class="empty-cta" @click="goToCourse">去选课</view>
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
import { commissionApi } from '@/api/commission';

const tabs = [
  { label: '全部', value: -1 },
  { label: '可提现', value: 1 },
  { label: '已提现', value: 2 },
  { label: '已撤销', value: 3 },
];

const currentTab = ref(-1);
const records = ref([]);
const summary = ref({});
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
    // 并行加载统计+列表
    const [statsData, listData] = await Promise.all([
      commissionApi.stats().catch(() => ({})),
      loadRecords(true).catch(() => []),
    ]);
    summary.value = statsData;
  } catch (e) {
    console.error('loadData error', e);
  } finally {
    loading.value = false;
  }
}

async function loadRecords(reset = false) {
  if (loading.value) return;
  loading.value = true;

  try {
    if (reset) page.value = 1;

    const params = {
      page: page.value,
      page_size: pageSize,
    };
    if (currentTab.value !== -1) {
      params.status = currentTab.value;
    }

    const res = await commissionApi.list(params);
    const rows = res.rows || [];

    if (reset) {
      records.value = rows;
    } else {
      records.value.push(...rows);
    }

    hasMore.value = records.value.length < (res.total || 0) && rows.length === pageSize;
  } catch (e) {
    console.error('loadRecords error', e);
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function switchTab(value) {
  currentTab.value = value;
  loadRecords(true);
}

function loadMore() {
  if (!hasMore.value) return;
  page.value++;
  loadRecords(false);
}

function goBack() { uni.navigateBack(); }
function goToCourse() { uni.switchTab({ url: '/pages/index/index' }); }

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
.nav-placeholder { min-width: 80rpx; }

.tabs {
  display: flex; background: $card;
  position: sticky; top: 88rpx; z-index: 9;
  padding: 0 24rpx; box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04);
}
.tab {
  flex: 1; text-align: center; padding: 28rpx 0;
  font-size: 28rpx; color: $text-muted; position: relative; transition: color 0.2s;
}
.tab.active { color: $primary; font-weight: 600; }
.tab.active::after {
  content: ''; position: absolute; bottom: 0; left: 50%;
  transform: translateX(-50%); width: 48rpx; height: 4rpx;
  background: linear-gradient(135deg, $primary 0%, $primary-light 100%); border-radius: 2rpx;
}

.summary-bar {
  display: flex; align-items: center;
  background: linear-gradient(135deg, $primary 0%, $primary-light 100%);
  padding: 24rpx 32rpx; margin: 0 24rpx; border-radius: 16rpx; margin-top: 24rpx;
}
.summary-item {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  .summary-label { font-size: 22rpx; color: rgba(255,255,255,0.75); margin-bottom: 6rpx; }
  .summary-value { font-size: 30rpx; font-weight: bold; color: #fff; }
  .summary-value.primary { color: #ffe4b5; }
}
.summary-divider { width: 1rpx; height: 48rpx; background: rgba(255,255,255,0.3); }

.record-list { padding: 24rpx; }

.record-card {
  display: flex; justify-content: space-between; align-items: center;
  background: $card; border-radius: 24rpx; padding: 28rpx;
  margin-bottom: 16rpx; box-shadow: $shadow-card;
}
.record-left {
  flex: 1; overflow: hidden;
  .record-course { font-size: 28rpx; color: $text-primary; font-weight: 500; margin-bottom: 8rpx; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .record-meta { display: flex; align-items: center; gap: 12rpx; }
  .record-date { font-size: 22rpx; color: $text-muted; }
}
.record-right {
  display: flex; flex-direction: column; align-items: flex-end; gap: 8rpx;
  .record-amount { font-size: 30rpx; font-weight: bold; color: $text-primary; }
  .record-amount.amount-plus { color: #00b43c; }
  .record-amount.amount-minus { color: $text-secondary; }
}

.type-tag {
  font-size: 20rpx; padding: 4rpx 12rpx; border-radius: 6rpx; font-weight: 500;
}
.type-tag.type-SALES { background: rgba(255, 107, 0, 0.1); color: $primary; }
.type-tag.type-MANAGEMENT { background: rgba(212, 168, 67, 0.12); color: $gold; }
.type-tag.type-REFERRAL { background: rgba(102, 126, 234, 0.12); color: #667eea; }

.status-tag {
  font-size: 20rpx; padding: 4rpx 12rpx; border-radius: 6rpx; font-weight: 500;
}
.status-tag.status-1 { background: rgba(0, 180, 60, 0.1); color: #00b43c; }
.status-tag.status-2 { background: rgba(168, 162, 158, 0.12); color: $text-secondary; }
.status-tag.status-3 { background: rgba(255, 80, 80, 0.1); color: #ff5050; }
.status-tag.status-0 { background: rgba(255, 165, 0, 0.1); color: #ff9600; }

.empty-state {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 100rpx 0;
  .empty-icon {
    width: 120rpx; height: 120rpx;
    background: linear-gradient(135deg, $primary 0%, $primary-light 100%);
    border-radius: 24rpx; display: flex; align-items: center;
    justify-content: center; margin-bottom: 32rpx;
    box-shadow: 0 8rpx 24rpx rgba(255, 107, 0, 0.25);
    text { font-size: 56rpx; }
  }
  .empty-title { font-size: 32rpx; font-weight: 600; color: $text-primary; margin-bottom: 12rpx; }
  .empty-desc { font-size: 26rpx; color: $text-muted; margin-bottom: 40rpx; text-align: center; }
  .empty-cta {
    padding: 20rpx 48rpx;
    background: linear-gradient(135deg, $primary 0%, $primary-light 100%);
    color: #ffffff; font-size: 28rpx; font-weight: 500;
    border-radius: 40rpx; box-shadow: 0 4rpx 16rpx rgba(255, 107, 0, 0.3);
  }
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
