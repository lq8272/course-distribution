<template>
  <view class="login-page">
    <!-- 顶部品牌区 -->
    <view class="brand-area">
      <view class="logo-icon">📚</view>
      <view class="logo-text">视频课程分销</view>
      <view class="tagline">让学习创造价值，让分享带来收益</view>
    </view>

    <!-- 中部说明 -->
    <view class="features">
      <view class="feature-item">
        <text class="feature-icon">🎓</text>
        <text class="feature-text">精选课程，品质保障</text>
      </view>
      <view class="feature-item">
        <text class="feature-icon">💰</text>
        <text class="feature-text">分享赚佣，实时到账</text>
      </view>
      <view class="feature-item">
        <text class="feature-icon">🏆</text>
        <text class="feature-text">专属团队，阶梯晋升</text>
      </view>
    </view>

    <!-- 底部登录区 -->
    <view class="bottom-area">
      <button class="login-btn" open-type="getPhoneNumber" @getphonenumber="onGetPhone">
        <text class="btn-icon">📱</text>
        <text class="btn-text">微信一键登录</text>
      </button>
      <view class="agreement">
        登录即表示同意
        <text class="link" @click="openAgreement('user')">《用户协议》</text>
        和
        <text class="link" @click="openAgreement('privacy')">《隐私政策》</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { useUserStore } from '../../store/user';
import { authApi } from '../../api/auth';

const userStore = useUserStore();

async function onGetPhone(e) {
  if (!e.detail.code) {
    uni.showToast({ title: '请允许微信授权', icon: 'none' });
    return;
  }
  try {
    const data = await authApi.login(e.detail.code);
    userStore.setAuth(data.user, data.token, data.refreshToken);
    uni.switchTab({ url: '/pages/index/index' });
  } catch (err) {
    console.error('login error', err);
    uni.showToast({ title: '登录失败，请重试', icon: 'none' });
  }
}

function openAgreement(type) {
  uni.showToast({ title: `《${type === 'user' ? '用户协议' : '隐私政策'}》`, icon: 'none' });
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(160deg, #667eea 0%, #764ba2 50%, #8a4fbd 100%);
  padding: 0 48rpx;
  box-sizing: border-box;
}

/* 顶部品牌 */
.brand-area {
  padding-top: 160rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.logo-icon {
  font-size: 120rpx;
  line-height: 1;
  margin-bottom: 24rpx;
  /* 光晕效果 */
  filter: drop-shadow(0 8rpx 24rpx rgba(0,0,0,0.15));
}
.logo-text {
  font-size: 52rpx;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 6rpx;
  margin-bottom: 20rpx;
  text-shadow: 0 2rpx 8rpx rgba(0,0,0,0.1);
}
.tagline {
  font-size: 26rpx;
  color: rgba(255,255,255,0.8);
  letter-spacing: 2rpx;
}

/* 中部功能说明 */
.features {
  margin-top: 80rpx;
  background: rgba(255,255,255,0.12);
  border-radius: 24rpx;
  padding: 40rpx 36rpx;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.feature-item {
  display: flex;
  align-items: center;
  margin-bottom: 28rpx;
}
.feature-item:last-child {
  margin-bottom: 0;
}
.feature-icon {
  font-size: 40rpx;
  margin-right: 20rpx;
  width: 56rpx;
  text-align: center;
}
.feature-text {
  font-size: 28rpx;
  color: rgba(255,255,255,0.95);
  letter-spacing: 1rpx;
}

/* 底部登录 */
.bottom-area {
  margin-top: auto;
  padding-bottom: 80rpx;
}
.login-btn {
  width: 100%;
  height: 96rpx;
  background: #ffffff;
  border-radius: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 32rpx rgba(0,0,0,0.15);
  border: none;
}
.btn-icon {
  font-size: 36rpx;
  margin-right: 12rpx;
}
.btn-text {
  font-size: 32rpx;
  font-weight: 600;
  color: #667eea;
  letter-spacing: 2rpx;
}
.agreement {
  text-align: center;
  font-size: 22rpx;
  color: rgba(255,255,255,0.65);
  margin-top: 32rpx;
  line-height: 1.6;
}
.link {
  color: rgba(255,255,255,0.9);
  text-decoration: underline;
}
</style>
