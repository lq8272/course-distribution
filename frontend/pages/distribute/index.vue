<template>
  <view class="page">
    <!-- 顶部背景 -->
    <view class="header-bg">
      <view class="user-info">
        <view class="avatar-wrap">
          <image class="avatar" :src="userInfo.avatar || '/static/default-avatar.png'" mode="aspectFill" />
        </view>
        <view class="info">
          <text class="nickname">{{ userInfo.nickname || '未登录' }}</text>
          <text class="level-tag" v-if="userInfo.agent_level_name">{{ userInfo.agent_level_name }}</text>
        </view>
      </view>
    </view>

    <!-- 推广码卡片 -->
    <view class="card promo-card">
      <view class="promo-label">我的推广码</view>
      <view class="promo-code-wrap">
        <text class="promo-code">{{ myCode || '暂无' }}</text>
        <view class="copy-btn" @click="copyPromoCode">
          <text>复制推广码</text>
        </view>
      </view>
      <view class="promo-tip">推广码用于绑定下级分销商</view>
    </view>

    <!-- 统计数据 -->
    <view class="stats-row">
      <view class="stat-item">
        <text class="stat-value">{{ stats.today_orders || 0 }}</text>
        <text class="stat-label">今日订单</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-value">{{ stats.today_commission || '0.00' }}</text>
        <text class="stat-label">今日佣金(元)</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-value">{{ stats.team_count || 0 }}</text>
        <text class="stat-label">团队人数</text>
      </view>
    </view>

    <!-- 菜单列表 -->
    <view class="menu-list card">
      <view class="menu-item" @click="goApply">
        <text class="menu-icon">🎁</text>
        <text class="menu-text">申请成为分销商</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="goOrders">
        <text class="menu-icon">📋</text>
        <text class="menu-text">我的订单</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="goTeam">
        <text class="menu-icon">👥</text>
        <text class="menu-text">我的团队</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="goWallet">
        <text class="menu-icon">💰</text>
        <text class="menu-text">我的钱包</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { agentApi } from '@/api/agent';

const myCode = ref('');
const userInfo = ref({});
const stats = ref({});

onShow(() => {
  if (!uni.getStorageSync('token')) {
    uni.reLaunch({ url: '/pages/login/index' });
    return;
  }
  loadData();
});

async function loadData() {
  try {
    const [profile, statsData] = await Promise.all([
      agentApi.my().catch(() => ({})),
      agentApi.stats().catch(() => ({})),
    ]);
    userInfo.value = profile || {};
    myCode.value = profile.promotion_code || '';
    stats.value = statsData || {};
  } catch (e) {
    console.error('loadData error', e);
  }
}

function copyPromoCode() {
  if (!myCode.value) {
    uni.showToast({ title: '暂无推广码', icon: 'none' });
    return;
  }
  uni.setClipboardData({
    data: myCode.value,
    success: () => {
      uni.showToast({ title: '已复制', icon: 'success' });
    },
    fail: () => {
      uni.showModal({
        title: '推广码',
        content: myCode.value,
        showCancel: false,
      });
    },
  });
}

function goApply() {
  uni.navigateTo({ url: '/pages/agent/apply/index' });
}
function goOrders() {
  uni.navigateTo({ url: '/pages/order/list' });
}
function goTeam() {
  uni.switchTab({ url: '/pages/team/index' });
}
function goWallet() {
  uni.navigateTo({ url: '/pages/user/wallet' });
}
</script>

<style lang="scss" scoped>
@import "@/common/styles/base.scss";

.page { min-height: 100vh; background: $bg-light; }

.header-bg {
  background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
  padding: 40rpx 32rpx 80rpx;
}

.user-info {
  display: flex;
  align-items: center;
  .avatar-wrap {
    width: 100rpx;
    height: 100rpx;
    border-radius: 50%;
    overflow: hidden;
    border: 4rpx solid rgba(255,255,255,0.4);
    margin-right: 20rpx;
    .avatar { width: 100%; height: 100%; }
  }
  .info {
    display: flex;
    flex-direction: column;
    .nickname { font-size: 32rpx; color: #fff; font-weight: 600; margin-bottom: 8rpx; }
    .level-tag {
      font-size: 20rpx;
      color: rgba(255,255,255,0.85);
      background: rgba(255,255,255,0.2);
      padding: 4rpx 16rpx;
      border-radius: 20rpx;
      align-self: flex-start;
    }
  }
}

.card {
  background: #fff;
  border-radius: 24rpx;
  margin: 0 24rpx;
}

.promo-card {
  margin-top: -50rpx;
  padding: 32rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.08);
  .promo-label { font-size: 24rpx; color: $text-secondary; margin-bottom: 16rpx; }
  .promo-code-wrap {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12rpx;
    .promo-code {
      font-size: 40rpx;
      font-weight: 700;
      color: $primary-color;
      letter-spacing: 2rpx;
    }
    .copy-btn {
      background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
      color: #fff;
      font-size: 24rpx;
      padding: 12rpx 24rpx;
      border-radius: 32rpx;
      box-shadow: 0 4rpx 16rpx rgba($primary-color, 0.3);
    }
  }
  .promo-tip { font-size: 22rpx; color: $text-gray; }
}

.stats-row {
  display: flex;
  align-items: center;
  background: #fff;
  margin: 24rpx;
  border-radius: 16rpx;
  padding: 28rpx 0;
  .stat-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    .stat-value { font-size: 36rpx; font-weight: 700; color: $text-primary; margin-bottom: 8rpx; }
    .stat-label { font-size: 22rpx; color: $text-secondary; }
  }
  .stat-divider { width: 1rpx; height: 60rpx; background: $border-color; }
}

.menu-list {
  margin-top: 16rpx;
  padding: 8rpx 0;
  .menu-item {
    display: flex;
    align-items: center;
    padding: 28rpx 32rpx;
    .menu-icon { font-size: 36rpx; margin-right: 16rpx; }
    .menu-text { flex: 1; font-size: 28rpx; color: $text-primary; }
    .menu-arrow { font-size: 32rpx; color: $text-gray; }
  }
}
</style>
