<template>
  <view class="page">
    <!-- 导航 -->
    <view class="nav-bar">
      <view class="nav-back" @click="goBack">← 返回</view>
      <text class="nav-title">优惠券</text>
      <view class="nav-placeholder"></view>
    </view>

    <!-- Section Header -->
    <view class="section-header" v-if="coupons.length > 0">
      <view class="section-bar"></view>
      <text class="section-label">我的优惠券</text>
    </view>

    <!-- 优惠券列表 -->
    <view class="coupon-list" v-if="coupons.length > 0">
      <view
        v-for="coupon in coupons"
        :key="coupon.id"
        :class="'coupon-card ' + (coupon.status === 'used' ? 'coupon-card--used' : coupon.status === 'expired' ? 'coupon-card--expired' : '')"
      >
        <view class="coupon-card__left">
          <view class="amount">
            <text class="yuan">¥</text>
            <text class="num">{{ coupon.value }}</text>
          </view>
          <view class="condition">{{ coupon.condition }}</view>
        </view>
        <view class="coupon-card__right">
          <view class="name">{{ coupon.name }}</view>
          <view class="desc">{{ coupon.desc }}</view>
          <view class="time">有效期至 {{ coupon.expire_time }}</view>
        </view>
        <view class="coupon-card__status" v-if="coupon.status !== 'available'">
          {{ coupon.status === 'used' ? '已使用' : '已过期' }}
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else-if="!loading" class="empty-state">
      <text class="empty-icon">🎫</text>
      <text class="empty-text">暂无优惠券</text>
      <view class="empty-btn" @click="goToIndex">去领券</view>
    </view>

    <!-- 加载中 -->
    <view v-if="loading" class="loading-state">
      <view class="spinner"></view>
      <text>加载中...</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';

const coupons = ref([]);
const loading = ref(false);

function loadCoupons() {
  loading.value = true;
  try {
    const stored = uni.getStorageSync('my_coupons') || [];
    coupons.value = stored;
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

function goBack() { uni.navigateBack(); }
function goToIndex() { uni.switchTab({ url: '/pages/index/index' }); }

onShow(() => { loadCoupons(); });
</script>

<style lang="scss" scoped>
@import "@/common/styles/base.scss";

.page { min-height: 100vh; background: $bg-light; }

.nav-bar {
  display: flex; align-items: center; justify-content: space-between;
  height: 88rpx; padding: 0 24rpx; background: $bg-white;
  border-bottom: 1rpx solid $border-color; position: sticky; top: 0; z-index: 10;
}
.nav-back { font-size: 28rpx; color: $primary-color; min-width: 80rpx; }
.nav-title { font-size: 32rpx; font-weight: 500; color: $text-primary; }
.nav-placeholder { min-width: 80rpx; }

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

.coupon-list { padding: 0 24rpx; }

.coupon-card {
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
  border-radius: 24rpx;
  overflow: hidden;
  margin-bottom: 16rpx;
  position: relative;
  box-shadow: 0 4rpx 20rpx rgba(255, 107, 0, 0.2);
}
.coupon-card--used { filter: grayscale(80%); opacity: 0.6; }
.coupon-card--expired { filter: grayscale(100%); opacity: 0.4; }
.coupon-card__left {
  width: 200rpx;
  padding: 24rpx;
  text-align: center;
  color: #fff;
  border-right: 2rpx dashed rgba(255,255,255,0.4);
}
.amount { display: flex; align-items: baseline; justify-content: center; }
.yuan { font-size: 28rpx; font-weight: bold; }
.num { font-size: 56rpx; font-weight: bold; line-height: 1; }
.condition { font-size: 22rpx; opacity: 0.85; margin-top: 8rpx; }
.coupon-card__right { flex: 1; padding: 20rpx 24rpx; color: #fff; }
.name { font-size: 28rpx; font-weight: 500; margin-bottom: 8rpx; }
.desc { font-size: 22rpx; opacity: 0.85; margin-bottom: 8rpx; }
.time { font-size: 20rpx; opacity: 0.7; }
.coupon-card__status {
  position: absolute; right: 20rpx; top: 20rpx;
  font-size: 20rpx; color: rgba(255,255,255,0.6);
}

.empty-state {
  text-align: center;
  padding: 120rpx 0;
  .empty-icon { display: block; font-size: 96rpx; margin-bottom: 24rpx; }
  .empty-text { display: block; font-size: 28rpx; color: $text-gray; margin-bottom: 40rpx; }
  .empty-btn {
    display: inline-block;
    background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
    color: #fff;
    padding: 16rpx 48rpx;
    border-radius: 44rpx;
    font-size: 28rpx;
  }
}

.loading-state {
  display: flex; align-items: center; justify-content: center; gap: 12rpx; padding: 80rpx; color: $text-gray; font-size: 28rpx;
}
.spinner {
  width: 32rpx; height: 32rpx;
  border: 3rpx solid $border-color;
  border-top-color: $primary-color;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>