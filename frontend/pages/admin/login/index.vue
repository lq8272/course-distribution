<template>
  <view class="login-page">
    <view class="header">
      <text class="title">管理后台</text>
      <text class="subtitle">视频课程分销系统</text>
    </view>

    <view class="form">
      <view class="form-item">
        <text class="label">管理员账号</text>
        <input
          class="input"
          type="text"
          v-model="form.username"
          placeholder="请输入管理员账号"
          placeholder-class="placeholder"
        />
      </view>
      <view class="form-item">
        <text class="label">密码</text>
        <view class="pwd-wrap">
          <input
            class="input"
            :class="{ 'pwd-masked': !showPassword && form.password }"
            :type="showPassword ? 'text' : 'password'"
            v-model="form.password"
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

      <view class="back-user" @click="goToUserLogin">
        返回用户登录
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { useUserStore } from '@/store/user';
import { api } from '@/api/index';

const userStore = useUserStore();
const form = ref({ username: '', password: '' });
const loading = ref(false);
const showPassword = ref(false);

function goToUserLogin() {
  uni.reLaunch({ url: '/pages/login/index' });
}

async function handleLogin() {
  if (!form.value.username) {
    uni.showToast({ title: '请输入账号', icon: 'none' }); return;
  }
  if (!form.value.password) {
    uni.showToast({ title: '请输入密码', icon: 'none' }); return;
  }

  loading.value = true;
  try {
    const res = await api.post('/admin/login', {
      username: form.value.username,
      password: form.value.password,
    });

    if (res.token) {
      // 管理员登录后存管理员专属 token（同时存到 token 供 API 拦截器使用）
      userStore.setAuth(res.user, res.token, null);
      uni.setStorageSync('token', res.token);
      uni.redirectTo({ url: '/pages/admin/index' });
    } else {
      uni.showToast({ title: '登录失败', icon: 'none' });
    }
  } catch (err) {
    console.error('admin login error', err);
    uni.showToast({ title: '账号或密码错误', icon: 'none' });
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
.pwd-masked { /* DevTools 模拟器不掩码，用 CSS 圆点字符模拟 */
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
