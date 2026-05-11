<template>
  <view class="page">
    <!-- 导航 -->
    <view class="nav-bar">
      <view class="nav-back" @click="goBack">← 返回</view>
      <text class="nav-title">收货地址</text>
      <view class="nav-add" @click="goToAdd">添加</view>
    </view>

    <!-- Section Header -->
    <view class="section-header" v-if="addresses.length > 0">
      <view class="section-bar"></view>
      <text class="section-label">我的地址</text>
    </view>

    <!-- 地址列表 -->
    <view class="address-list" v-if="addresses.length > 0">
      <view
        v-for="addr in addresses"
        :key="addr.id"
        :class="'address-card ' + (addr.is_default ? 'address-card--default' : '')"
      >
        <view class="address-card__info" @click="selectAddress(addr)">
          <view class="name-phone">
            <text class="name">{{ addr.name }}</text>
            <text class="phone">{{ addr.phone }}</text>
            <view v-if="addr.is_default" class="default-tag">默认</view>
          </view>
          <view class="detail">{{ addr.province }} {{ addr.city }} {{ addr.district }} {{ addr.detail }}</view>
        </view>
        <view class="address-card__actions">
          <view class="action" @click="setDefault(addr.id)" v-if="!addr.is_default">设为默认</view>
          <view class="action" @click="editAddress(addr)">编辑</view>
          <view class="action action--danger" @click="deleteAddress(addr.id)">删除</view>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else-if="!loading" class="empty-state">
      <text class="empty-icon">📍</text>
      <text class="empty-text">暂无收货地址</text>
      <view class="empty-btn" @click="goToAdd">添加地址</view>
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

const addresses = ref([]);
const loading = ref(false);

function loadAddresses() {
  loading.value = true;
  try {
    const stored = uni.getStorageSync('addresses') || [];
    addresses.value = stored;
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

function setDefault(id) {
  const updated = addresses.value.map(a => ({ ...a, is_default: a.id === id }));
  uni.setStorageSync('addresses', updated);
  addresses.value = updated;
  uni.showToast({ title: '已设为默认', icon: 'success' });
}

function editAddress(addr) {
  uni.navigateTo({ url: `/pages/user/address-edit?id=${addr.id}&name=${encodeURIComponent(addr.name)}&phone=${addr.phone}&province=${encodeURIComponent(addr.province)}&city=${encodeURIComponent(addr.city)}&district=${encodeURIComponent(addr.district)}&detail=${encodeURIComponent(addr.detail)}&is_default=${addr.is_default ? 1 : 0}` });
}

function deleteAddress(id) {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除该地址吗？',
    success: (res) => {
      if (res.confirm) {
        const updated = addresses.value.filter(a => a.id !== id);
        uni.setStorageSync('addresses', updated);
        addresses.value = updated;
        uni.showToast({ title: '已删除', icon: 'success' });
      }
    },
  });
}

function selectAddress(addr) {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    const prevPage = pages[pages.length - 2];
    prevPage.onAddressSelected && prevPage.onAddressSelected(addr);
    uni.navigateBack();
  }
}

function goToAdd() {
  uni.navigateTo({ url: '/pages/user/address-edit' });
}

function goBack() { uni.navigateBack(); }

onShow(() => { loadAddresses(); });
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
.nav-add { font-size: 28rpx; color: $primary-color; min-width: 80rpx; text-align: right; }

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

.address-list { padding: 0 24rpx; }

.address-card {
  background: $bg-white;
  border-radius: 24rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 16rpx rgba(0,0,0,0.06), 0 8rpx 32rpx rgba(0,0,0,0.04);
}
.address-card--default { border-left: 6rpx solid $primary-color; }
.address-card__info { margin-bottom: 16rpx; }
.address-card__actions { display: flex; gap: 32rpx; border-top: 1rpx solid $border-color; padding-top: 16rpx; }
.name-phone { display: flex; align-items: center; gap: 12rpx; margin-bottom: 12rpx; }
.name { font-size: 30rpx; font-weight: 500; color: $text-primary; }
.phone { font-size: 28rpx; color: $text-secondary; }
.default-tag { background: $primary-color; color: #fff; font-size: 18rpx; padding: 2rpx 10rpx; border-radius: 4rpx; }
.detail { font-size: 26rpx; color: $text-gray; line-height: 1.6; }
.action { font-size: 26rpx; color: $text-secondary; }
.action--danger { color: #ff4d4f; }

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