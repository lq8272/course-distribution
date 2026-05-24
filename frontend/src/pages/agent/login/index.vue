<template>
  <view class="login-page">
    <view class="header">
      <text class="title">客服登录</text>
      <text class="subtitle">视频课程分销系统</text>
    </view>

    <view class="form">
      <view class="form-item">
        <text class="label">客服账号</text>
        <input
          class="input"
          type="text"
          v-model="username"
          placeholder="请输入客服账号"
          placeholder-class="placeholder"
        />
      </view>
      <view class="form-item">
        <text class="label">密码</text>
        <view class="pwd-wrap">
          <input
            class="input"
            :class="{ 'pwd-masked': !showPassword && password }"
            :type="showPassword ? 'text' : 'password'"
            v-model="password"
            placeholder="请输入密码"
            placeholder-class="placeholder"
            maxlength="32"
          />
          <text class="toggle-pwd" @click="showPassword = !showPassword">
            {{ showPassword ? '🙈' : '👁' }}
          </text>
        </view>
      </view>

      <button class="login-btn" type="primary" :loading="loading" @click="handleLogin">
        登录
      </button>

      <view class="back-user" @click="goBack">
        返回
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { agentApi } from '@/api/agent.js';

const username = ref('');
const password = ref('');
const loading = ref(false);
const showPassword = ref(false);

function goBack() {
  uni.navigateBack();
}

async function handleLogin() {
  if (!username.value) {
    uni.showToast({ title: '请输入账号', icon: 'none' }); return;
  }
  if (!password.value) {
    uni.showToast({ title: '请输入密码', icon: 'none' }); return;
  }

  loading.value = true;
  try {
    const res = await agentApi.login({ username: username.value, password: password.value });
    uni.setStorageSync('agent_token', res.token);
    uni.setStorageSync('agent_info', res.agent);
    uni.reLaunch({ url: '/pages/agent/workbench/index' });
  } catch (e) {
    uni.showToast({ title: e.message || '登录失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped lang="scss">
$primary-color: #FF6B00;
$secondary-color: #FF8533;

.login-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #fff5ee 0%, #fff 50%, #fff5f5 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 60rpx 60rpx;
}

.header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 80rpx;
}

.title {
  font-size: 52rpx;
  font-weight: 700;
  color: $primary-color;
  margin-bottom: 12rpx;
}

.subtitle {
  font-size: 26rpx;
  color: #999;
}

.form {
  width: 100%;
}

.form-item {
  position: relative;
  margin-bottom: 32rpx;
}

.label {
  display: block;
  font-size: 26rpx;
  color: #666;
  margin-bottom: 12rpx;
}

.input {
  width: 100%;
  height: 88rpx;
  background: #fff;
  border: 1rpx solid #eee;
  border-radius: 16rpx;
  padding: 0 32rpx;
  font-size: 28rpx;
  color: #333;
  box-sizing: border-box;
}

.placeholder {
  color: #bbb;
}

.pwd-wrap { position: relative; }
.pwd-masked {
  -webkit-text-security: disc;
  text-security: disc;
}
.toggle-pwd {
  position: absolute;
  right: 24rpx;
  bottom: 26rpx;
  font-size: 32rpx;
}

.login-btn {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
  color: #fff;
  font-size: 32rpx;
  font-weight: 600;
  border-radius: 48rpx;
  border: none;
  margin-top: 24rpx;
}

.login-btn::after {
  border: none;
}

.back-user {
  margin-top: 32rpx;
  text-align: center;
  font-size: 24rpx;
  color: #999;
}
</style>
