<template>
  <view class="page">
    <!-- Nav Bar -->
    <view class="nav-bar">
      <view class="nav-back" @click="goBack">← 返回</view>
      <text class="nav-title">提现记录</text>
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

    <!-- Record List -->
    <view class="record-list">
      <view
        v-for="record in records"
        :key="record.id"
        class="record-card"
      >
        <view class="record-card__left">
          <view class="record-card__amount">¥{{ record.amount }}</view>
          <view class="record-card__date">{{ formatDate(record.created_at) }}</view>
        </view>
        <view class="record-card__right">
          <view class="status-tag" :class="'status-' + record.status">
            {{ record.status_text }}
          </view>
        </view>
      </view>

      <!-- Empty State -->
      <view v-if="!loading && records.length === 0" class="empty-state">
        <view class="empty-icon"><text>📋</text></view>
        <text class="empty-title">暂无提现记录</text>
        <text class="empty-desc">快去申请提现吧</text>
        <view class="empty-cta" @click="goBack">返回钱包</view>
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
import { agentApi } from '@/api/agent';

const tabs = [
  { label: '全部', value: -1 },
  { label: '审核中', value: 0 },
  { label: '已通过', value: 1 },
  { label: '已拒绝', value: 2 },
];

const currentTab = ref(-1);
const records = ref([]);
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
  loadRecords(true);
});

async function loadRecords(reset = false) {
  if (loading.value) return;
  loading.value = true;

  try {
    if (reset) {
      page.value = 1;
      records.value = [];
    }

    const params = {
      page: page.value,
      page_size: pageSize,
    };

    const res = await agentApi.withdrawRecord(params);
    const rows = (res.rows || []).map(r => {
      // 后端返回 status: 0审核中 1已通过 2已拒绝
      // 前端标签已在后端 agent.js 处理为 status_text
      return r;
    });

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

function goBack() {
  uni.navigateBack();
}

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
  position: sticky; top: 88rpx; z-index: 10;
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

.record-list { padding: 24rpx; }

.record-card {
  display: flex; justify-content: space-between; align-items: center;
  background: $card; border-radius: 24rpx; padding: 32rpx;
  margin-bottom: 20rpx; box-shadow: $shadow-card;
}
.record-card__left {}
.record-card__amount { font-size: 36rpx; font-weight: bold; color: $text-primary; margin-bottom: 8rpx; }
.record-card__date { font-size: 22rpx; color: $text-muted; }
.record-card__right {}

.status-tag {
  font-size: 24rpx; padding: 8rpx 20rpx; border-radius: 8rpx; font-weight: 500;
}
.status-tag.status-0 { background: rgba(255, 165, 0, 0.12); color: #ff9600; }   // 审核中
.status-tag.status-1 { background: rgba(0, 180, 60, 0.12); color: #00b43c; }    // 已通过
.status-tag.status-2 { background: rgba(168, 162, 158, 0.15); color: $text-secondary; } // 已拒绝

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
  .empty-desc { font-size: 26rpx; color: $text-muted; margin-bottom: 40rpx; }
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
