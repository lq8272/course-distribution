<template>
  <view class="page">
    <!-- 账号安全 -->
    <view class="section-title">账号安全</view>
    <view class="list card">
      <view class="item" @click="changePassword">
        <text class="icon">🔒</text>
        <text class="label">修改密码</text>
        <text class="arrow">></text>
      </view>
      <view class="item" @click="bindPhone">
        <text class="icon">📱</text>
        <text class="label">绑定手机</text>
        <text class="arrow">></text>
      </view>
    </view>

    <!-- 通用设置 -->
    <view class="section-title">通用设置</view>
    <view class="list card">
      <view class="item" @click="toggleNotification">
        <text class="icon">🔔</text>
        <text class="label">消息通知</text>
        <switch :checked="notifEnabled" color="var(--brand-primary)" @change="toggleNotification" />
      </view>
      <view class="item" @click="clearCache">
        <text class="icon">🗑</text>
        <text class="label">清理缓存</text>
        <view class="right">
          <text class="value">{{ cacheSize }}</text>
          <text class="arrow">></text>
        </view>
      </view>
    </view>

    <!-- 关于 -->
    <view class="section-title">关于</view>
    <view class="list card">
      <view class="item" @click="showAbout">
        <text class="icon">ℹ️</text>
        <text class="label">关于我们</text>
        <text class="arrow">></text>
      </view>
      <view class="item" @click="showVersion">
        <text class="icon">📌</text>
        <text class="label">版本信息</text>
        <view class="right">
          <text class="value">v1.0.0</text>
          <text class="arrow">></text>
        </view>
      </view>
      <view class="item" @click="showAgreement">
        <text class="icon">📄</text>
        <text class="label">用户协议</text>
        <text class="arrow">></text>
      </view>
      <view class="item" @click="showPrivacy">
        <text class="icon">🔐</text>
        <text class="label">隐私政策</text>
        <text class="arrow">></text>
      </view>
    </view>

    <!-- 退出登录 -->
    <view class="logout-section">
      <button class="logout-btn" @click="logout">退出登录</button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { useUserStore } from '../../store/user';

const userStore = useUserStore();
const notifEnabled = ref(true);
const cacheSize = ref('2.3 MB');

function changePassword() {
  uni.showToast({ title: '功能开发中', icon: 'none' });
}

function bindPhone() {
  uni.showToast({ title: '功能开发中', icon: 'none' });
}

function toggleNotification(e) {
  notifEnabled.value = e.detail.value;
  uni.showToast({
    title: notifEnabled.value ? '已开启通知' : '已关闭通知',
    icon: 'none',
  });
}

function clearCache() {
  uni.showModal({
    title: '清理缓存',
    content: '确定要清理本地缓存吗？',
    success: (res) => {
      if (res.confirm) {
        try {
          uni.clearStorageSync();
          cacheSize.value = '0 KB';
          uni.showToast({ title: '清理完成', icon: 'success' });
        } catch {
          uni.showToast({ title: '清理失败', icon: 'none' });
        }
      }
    },
  });
}

function showAbout() {
  uni.showModal({
    title: '关于我们',
    content: '视频课程分销小程序\n为您提供优质的视频课程资源\n和灵活的分销推广体验。',
    showCancel: false,
  });
}

function showVersion() {
  uni.showModal({
    title: '版本信息',
    content: '当前版本：v1.0.0\n构建时间：2026-04-22',
    showCancel: false,
  });
}

function showAgreement() {
  uni.showToast({ title: '《用户协议》', icon: 'none' });
}

function showPrivacy() {
  uni.showToast({ title: '《隐私政策》', icon: 'none' });
}

function logout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出当前账号吗？',
    success: (res) => {
      if (res.confirm) {
        userStore.logout();
        uni.reLaunch({ url: '/pages/login/index' });
      }
    },
  });
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--bg-light);
  padding: 0 24rpx 48rpx;
}

.section-title {
  font-size: 24rpx;
  color: var(--text-gray);
  padding: 32rpx 0 12rpx;
  letter-spacing: 1rpx;
}

.list.card {
  background: var(--bg-white);
  border-radius: var(--border-radius);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.item {
  display: flex;
  align-items: center;
  padding: 28rpx 24rpx;
  border-bottom: 1rpx solid var(--border-color);
}
.item:last-child {
  border-bottom: none;
}

.item .icon {
  font-size: 36rpx;
  margin-right: 20rpx;
  width: 48rpx;
  text-align: center;
}

.item .label {
  flex: 1;
  font-size: 28rpx;
  color: var(--text-primary);
}

.right {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.value {
  font-size: 24rpx;
  color: var(--text-gray);
}

.arrow {
  font-size: 24rpx;
  color: var(--text-gray);
}

.logout-section {
  margin-top: 64rpx;
}

.logout-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: var(--bg-white);
  color: var(--danger-color);
  font-size: 30rpx;
  border-radius: var(--border-radius);
  text-align: center;
  border: none;
  box-shadow: var(--shadow-sm);
}
</style>
