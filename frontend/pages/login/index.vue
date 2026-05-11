<template>
  <view class="login-page">
    <!-- 顶部装饰光晕 -->
    <view class="orb orb--1"></view>
    <view class="orb orb--2"></view>

    <!-- 品牌区 -->
    <view class="brand">
      <view class="brand__logo">
        <image class="brand__logo-img" src="/static/logo.png" mode="aspectFit" />
      </view>
      <view class="brand__name">视频课程分销</view>
      <view class="brand__tagline">让学习创造价值，让分享带来收益</view>
    </view>

    <!-- 三大卖点 -->
    <view class="highlights">
      <view class="highlight-item">
        <text class="highlight-item__icon">🎓</text>
        <text class="highlight-item__text">精选课程</text>
      </view>
      <view class="highlight-item">
        <text class="highlight-item__icon">💰</text>
        <text class="highlight-item__text">分享赚佣</text>
      </view>
      <view class="highlight-item">
        <text class="highlight-item__icon">🏆</text>
        <text class="highlight-item__text">阶梯晋升</text>
      </view>
    </view>

    <!-- 登录卡片 -->
    <view class="login-card">
      <view class="login-card__greeting">欢迎回来</view>
      <view class="login-card__sub">登录后开启您的分销之旅</view>

      <!-- 微信一键登录 -->
      <button
        class="btn-wechat"
        :class="{ 'is-loading': loading }"
        :disabled="loading"
        open-type="getPhoneNumber"
        @getphonenumber="onGetPhone"
      >
        <view class="btn-wechat__inner">
          <image class="btn-wechat__icon" src="/static/wechat-icon.png" mode="aspectFit" />
          <text>微信一键登录</text>
        </view>
      </button>

      <!-- 管理员入口 -->
      <view class="admin-entry" @click="goAdminLogin">
        <text class="admin-entry__icon">🔐</text>
        <text class="admin-entry__text">管理员登录</text>
        <text class="admin-entry__arrow">›</text>
      </view>

      <!-- 协议 -->
      <view class="agreement">
        <view
          class="agreement__checkbox"
          :class="{ 'is-checked': agreed }"
          @click="agreed = !agreed"
        >
          <text v-if="agreed" class="agreement__check-icon">✓</text>
        </view>
        <text class="agreement__text">
          登录即表示同意
          <text class="agreement__link" @click.stop="openAgreement('user')">《用户协议》</text>
          和
          <text class="agreement__link" @click.stop="openAgreement('privacy')">《隐私政策》</text>
        </text>
      </view>
    </view>

    <!-- 底部备案信息 -->
    <view class="footer">
      <text class="footer__text">© 2024 视频课程分销 · 优质内容值得分享</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { useUserStore } from '@/store/user'
import { authApi } from '@/api/auth'

const userStore = useUserStore()
const loading = ref(false)
const agreed = ref(false)

async function onGetPhone(e) {
  if (!agreed.value) {
    uni.showToast({ title: '请先同意用户协议', icon: 'none' })
    return
  }
  if (!e.detail.code) {
    uni.showToast({ title: '请允许微信授权', icon: 'none' })
    return
  }

  loading.value = true
  try {
    const pages = getCurrentPages()
    const currentPage = pages[pages.length - 1]
    const promotionCode = currentPage?.options?.code || ''

    const data = await authApi.login(e.detail.code, '', promotionCode)
    userStore.setAuth(data.user, data.token, data.refreshToken)
    uni.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => {
      uni.switchTab({ url: '/pages/index/index' })
    }, 1200)
  } catch (err) {
    console.error('login error', err)
    uni.showToast({ title: '登录失败，请重试', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function goAdminLogin() {
  uni.navigateTo({ url: '/pages/admin/login/index' })
}

function openAgreement(type) {
  const url = type === 'user' ? '/pages/user/agreement' : '/pages/user/privacy'
  uni.navigateTo({ url })
}
</script>

<style scoped>
/* ===== 页面基础 ===== */
.login-page {
  min-height: 100vh;
  background: linear-gradient(160deg, #FF6B00 0%, #FF8533 50%, #FFB366 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  overflow: hidden;
  padding: 0 32rpx;
  padding-top: calc(80rpx + constant(safe-area-inset-top));
  padding-top: calc(80rpx + env(safe-area-inset-top));
  box-sizing: border-box;
}

/* ===== 装饰光晕 ===== */
.orb {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  pointer-events: none;
}
.orb--1 {
  width: 500rpx;
  height: 500rpx;
  top: calc(-200rpx + constant(safe-area-inset-top));
  top: calc(-200rpx + env(safe-area-inset-top));
  right: -160rpx;
}
.orb--2 {
  width: 280rpx;
  height: 280rpx;
  bottom: 120rpx;
  left: -100rpx;
  background: rgba(255, 255, 255, 0.06);
}

/* ===== 品牌区 ===== */
.brand {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 80rpx;
  padding-bottom: 32rpx;
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}
.brand__logo {
  width: 120rpx;
  height: 120rpx;
  background: #ffffff;
  border-radius: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 16rpx 40rpx rgba(0, 0, 0, 0.18);
  margin-bottom: 20rpx;
  overflow: hidden;
}
.brand__logo-img {
  width: 88rpx;
  height: 88rpx;
}
.brand__name {
  font-size: 44rpx;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 3rpx;
  margin-bottom: 10rpx;
}
.brand__tagline {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
}

/* ===== 三大卖点 ===== */
.highlights {
  width: 100%;
  display: flex;
  justify-content: center;
  gap: 60rpx;
  padding: 0 16rpx 32rpx;
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}
.highlight-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}
.highlight-item__icon {
  font-size: 40rpx;
}
.highlight-item__text {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.9);
}

/* ===== 登录卡片 ===== */
.login-card {
  width: 100%;
  background: #ffffff;
  border-radius: 24rpx;
  padding: 40rpx 36rpx 36rpx;
  box-shadow: 0 24rpx 64rpx rgba(0, 0, 0, 0.16);
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}
.login-card__greeting {
  font-size: 38rpx;
  font-weight: 700;
  color: #1a1a1a;
  text-align: center;
  margin-bottom: 6rpx;
}
.login-card__sub {
  font-size: 24rpx;
  color: #999999;
  text-align: center;
  margin-bottom: 36rpx;
}

/* ===== 微信登录按钮 ===== */
.btn-wechat {
  background: linear-gradient(135deg, #07C160 0%, #1AAD19 100%);
  border: none;
  border-radius: 48rpx;
  padding: 0;
  margin: 0;
  box-shadow: 0 6rpx 24rpx rgba(7, 193, 96, 0.35);
}
.btn-wechat::after {
  border: none;
}
.btn-wechat.is-loading {
  opacity: 0.7;
}
.btn-wechat__inner {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 26rpx 0;
  gap: 10rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #ffffff;
}
.btn-wechat__icon {
  width: 40rpx;
  height: 40rpx;
}

/* ===== 管理员入口 ===== */
.admin-entry {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 20rpx 0;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 48rpx;
  margin-top: 20rpx;
  transition: background 0.2s;
}
.admin-entry:active {
  background: rgba(0, 0, 0, 0.08);
}
.admin-entry__icon {
  font-size: 28rpx;
}
.admin-entry__text {
  font-size: 26rpx;
  color: #666666;
}
.admin-entry__arrow {
  font-size: 28rpx;
  color: #CCCCCC;
}

/* ===== 协议 ===== */
.agreement {
  display: flex;
  align-items: flex-start;
  gap: 10rpx;
  margin-top: 28rpx;
  padding: 0 4rpx;
}
.agreement__checkbox {
  width: 30rpx;
  height: 30rpx;
  border-radius: 50%;
  border: 2rpx solid #DDDDDD;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1rpx;
  transition: all 0.2s;
}
.agreement__checkbox.is-checked {
  background: #FF6B00;
  border-color: #FF6B00;
}
.agreement__check-icon {
  color: #ffffff;
  font-size: 18rpx;
  line-height: 1;
}
.agreement__text {
  font-size: 21rpx;
  color: #999999;
  line-height: 1.5;
  flex: 1;
}
.agreement__link {
  color: #FF6B00;
}

/* ===== 底部 ===== */
.footer {
  width: 100%;
  padding: 28rpx 0 36rpx;
  text-align: center;
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}
.footer__text {
  font-size: 18rpx;
  color: rgba(255, 255, 255, 0.5);
}
</style>
