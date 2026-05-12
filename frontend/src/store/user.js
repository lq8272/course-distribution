// 用户状态管理 - Pinia 版本
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export const useUserStore = defineStore('user', () => {
  // 状态
  const userInfo = ref(uni.getStorageSync('userInfo') || null);
  const token = ref(uni.getStorageSync('token') || null);
  const refreshToken = ref(uni.getStorageSync('refreshToken') || null);

  // 计算属性
  const isLoggedIn = computed(() => !!token.value);
  const isAdmin = computed(() => userInfo.value && userInfo.value.is_admin === true);

  // 方法
  const setAuth = (data, newToken, newRefreshToken) => {
    userInfo.value = data;
    token.value = newToken;
    refreshToken.value = newRefreshToken;
    uni.setStorageSync('userInfo', data);
    uni.setStorageSync('token', newToken);
    uni.setStorageSync('refreshToken', newRefreshToken);
  };

  const clearAuth = () => {
    userInfo.value = null;
    token.value = null;
    refreshToken.value = null;
    uni.removeStorageSync('userInfo');
    uni.removeStorageSync('token');
    uni.removeStorageSync('refreshToken');
  };

  const updateUserInfo = (data) => {
    userInfo.value = { ...userInfo.value, ...data };
    uni.setStorageSync('userInfo', userInfo.value);
  };

  return {
    userInfo,
    token,
    refreshToken,
    isLoggedIn,
    isAdmin,
    setAuth,
    clearAuth,
    updateUserInfo,
  };
});
