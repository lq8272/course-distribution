<template>
  <view class="login-page">
    <view class="logo-area">
      <text class="logo">🎧</text>
      <text class="title">客服工作台</text>
      <text class="subtitle">customer service portal</text>
    </view>
    <view class="form">
      <view class="input-group">
        <text class="label">账号</text>
        <input class="input" v-model="username" placeholder="请输入客服账号" />
      </view>
      <view class="input-group">
        <text class="label">密码</text>
        <input class="input" v-model="password" type="password" placeholder="请输入密码" />
      </view>
      <view class="btn-login" @click="login">登录</view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { agentApi } from '@/api/agent.js';

const username = ref('');
const password = ref('');

async function login() {
  if (!username.value || !password.value) {
    uni.showToast({ title: '请输入账号密码', icon: 'none' }); return;
  }
  try {
    const res = await agentApi.login({ username: username.value, password: password.value });
    uni.setStorageSync('agent_token', res.token);
    uni.setStorageSync('agent_info', res.agent);
    uni.switchTab({ url: '/pages/agent/workbench/index' });
  } catch (e) {
    uni.showToast({ title: e.message || '登录失败', icon: 'none' });
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh; background: #f5f6fa; display: flex; flex-direction: column;
  align-items: center; padding: 120rpx 60rpx 0;
}
.logo-area { text-align: center; margin-bottom: 80rpx; }
.logo { display: block; font-size: 120rpx; margin-bottom: 24rpx; }
.title { display: block; font-size: 48rpx; font-weight: 700; color: #1a1a2e; }
.subtitle { display: block; font-size: 24rpx; color: #8e8e93; margin-top: 8rpx; }
.form { width: 100%; }
.input-group { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 24rpx; }
.label { display: block; font-size: 24rpx; color: #8e8e93; margin-bottom: 12rpx; }
.input { font-size: 32rpx; color: #1a1a2e; }
.btn-login {
  width: 100%; background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff; text-align: center; padding: 28rpx 0; border-radius: 16rpx;
  font-size: 32rpx; font-weight: 600; margin-top: 16rpx;
}
</style>
