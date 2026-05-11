<template>
  <view class="page">
    <!-- 加载中 -->
    <view v-if="loading" class="loading-state">
      <view class="spinner"></view>
      <text>加载中...</text>
    </view>

    <!-- 订单信息 -->
    <view v-else-if="order" class="order-detail">
      <!-- 课程卡片 -->
      <view class="hero-card card">
        <view class="course-header">
          <image :src="order.course_cover || '/static/default-cover.png'" mode="aspectFill" class="cover" />
          <view class="course-info">
            <view class="course-title">{{ order.course_title || '课程' }}</view>
            <view class="course-meta">订单号：{{ order.id }}</view>
            <view class="course-meta">下单时间：{{ formatDate(order.created_at) }}</view>
          </view>
        </view>
      </view>

      <!-- 订单状态 -->
      <view class="card">
        <view class="section-header">
          <view class="section-bar"></view>
          <text class="section-label">订单状态</text>
        </view>
        <view class="status-row">
          <text class="label">订单状态</text>
          <text class="status-tag" :class="'status-' + order.status">{{ statusText(order.status) }}</text>
        </view>
        <view class="status-row" v-if="order.confirm_time">
          <text class="label">支付时间</text>
          <text class="value">{{ formatDate(order.confirm_time) }}</text>
        </view>
        <view class="status-row" v-if="order.refund_time">
          <text class="label">退款时间</text>
          <text class="value">{{ formatDate(order.refund_time) }}</text>
        </view>
      </view>

      <!-- 金额信息 -->
      <view class="card">
        <view class="section-header">
          <view class="section-bar"></view>
          <text class="section-label">金额信息</text>
        </view>
        <view class="amount-row">
          <text class="label">课程金额</text>
          <text class="amount">¥{{ order.total_amount || 0 }}</text>
        </view>
        <view class="amount-row total">
          <text class="label">实付金额</text>
          <text class="amount primary">¥{{ order.total_amount || 0 }}</text>
        </view>
      </view>

      <!-- 退款信息（仅退款订单） -->
      <view class="card" v-if="order.status === 3">
        <view class="section-header">
          <view class="section-bar"></view>
          <text class="section-label">退款信息</text>
        </view>
        <view class="refund-reason" v-if="order.refund_reason">退款原因：{{ order.refund_reason }}</view>
        <view class="refund-reason" v-else>退款已完成</view>
      </view>

      <!-- 操作按钮 -->
      <view class="action-row" v-if="order.status === 0">
        <button class="btn-cancel" @click="cancelOrder">取消订单</button>
        <button class="btn-pay" @click="goPay">立即支付</button>
      </view>

      <!-- 底部留白 -->
      <view class="bottom-spacer"></view>
    </view>

    <!-- 订单不存在 -->
    <view v-else class="empty-state">
      <view class="empty-icon">
        <text>📋</text>
      </view>
      <text class="empty-title">订单不存在</text>
      <text class="empty-desc">该订单可能已删除或不存在</text>
      <view class="empty-cta" @click="goBack">返回订单列表</view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { orderApi } from '@/api/order';

const order = ref(null);
const loading = ref(true);

onLoad((options) => {
  if (options.id) {
    loadDetail(options.id);
  }
});

async function loadDetail(id) {
  loading.value = true;
  try {
    order.value = await orderApi.detail(id);
  } catch (e) {
    console.error('loadDetail error', e);
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function statusText(status) {
  const map = { 0: '待支付', 1: '已完成', 2: '已完成', 3: '已退款', 4: '已关闭' };
  return map[status] || '未知';
}

function cancelOrder() {
  uni.showModal({
    title: '取消订单',
    content: '确定要取消该订单吗？',
    success: (res) => {
      if (res.confirm) {
        uni.showToast({ title: '功能开发中', icon: 'none' });
      }
    },
  });
}

function goPay() {
  uni.showToast({ title: '功能开发中', icon: 'none' });
}

function goBack() {
  uni.navigateBack();
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
  padding: 24rpx;
}

// Loading State
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 160rpx 0;
  gap: 24rpx;

  text {
    color: $text-muted;
    font-size: 28rpx;
  }
}

.spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid $border;
  border-top-color: $primary;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// Cards
.card {
  background: $card;
  border-radius: 24rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: $shadow-card;
}

// Hero Card (larger border radius for emphasis)
.hero-card {
  border-radius: 28rpx;
  background: linear-gradient(135deg, $card 0%, #fdfcfa 100%);
}

// Section Header
.section-header {
  display: flex;
  align-items: center;
  margin-bottom: 24rpx;

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

// Course Header
.course-header {
  display: flex;

  .cover {
    width: 160rpx;
    height: 120rpx;
    border-radius: 20rpx;
    margin-right: 24rpx;
    flex-shrink: 0;
  }

  .course-info {
    flex: 1;
  }

  .course-title {
    font-size: 30rpx;
    font-weight: 600;
    color: $text-primary;
    margin-bottom: 16rpx;
    line-height: 1.4;
  }

  .course-meta {
    font-size: 22rpx;
    color: $text-muted;
    margin-bottom: 8rpx;
  }
}

// Status Row
.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid $border;

  &:last-child {
    border-bottom: none;
  }

  .label {
    font-size: 26rpx;
    color: $text-secondary;
  }

  .value {
    font-size: 26rpx;
    color: $text-primary;
    font-weight: 500;
  }
}

// Status Tags (using rgba backgrounds)
.status-tag {
  font-size: 24rpx;
  padding: 8rpx 20rpx;
  border-radius: 10rpx;
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

.status-tag.status-4 {
  background: rgba(168, 162, 158, 0.15);
  color: $text-secondary;
}

// Amount Row
.amount-card {
  background: $card;
  border-radius: 24rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: $shadow-card;

  .amount-row {
    display: flex;
    justify-content: space-between;
    padding: 16rpx 0;

    .label {
      font-size: 26rpx;
      color: $text-secondary;
    }

    .amount {
      font-size: 28rpx;
      color: $text-primary;
      font-weight: 500;
    }

    &.total {
      border-top: 1rpx solid $border;
      margin-top: 12rpx;
      padding-top: 24rpx;

      .label {
        font-weight: 600;
        color: $text-primary;
        font-size: 28rpx;
      }

      .amount.primary {
        font-size: 40rpx;
        font-weight: bold;
        color: $primary;
      }
    }
  }
}

// Refund Card
.refund-card {
  .refund-title {
    font-size: 28rpx;
    font-weight: 600;
    margin-bottom: 16rpx;
  }

  .refund-reason {
    font-size: 26rpx;
    color: $text-secondary;
    line-height: 1.6;
  }
}

// Action Row
.action-row {
  display: flex;
  gap: 24rpx;
  margin-top: 32rpx;

  .btn-cancel,
  .btn-pay {
    flex: 1;
    padding: 28rpx 0;
    border-radius: 44rpx;
    font-size: 30rpx;
    font-weight: 600;
    text-align: center;
    border: none;
  }

  .btn-cancel {
    background: $card;
    color: $text-secondary;
    border: 2rpx solid $border;
    box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04);
  }

  .btn-pay {
    background: linear-gradient(135deg, $primary 0%, $primary-light 100%);
    color: #fff;
    box-shadow: 0 4rpx 16rpx rgba(255, 107, 0, 0.35);
  }
}

// Bottom Spacer
.bottom-spacer {
  height: 40rpx;
}

// Empty State
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 160rpx 0;
  gap: 16rpx;

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
</style>