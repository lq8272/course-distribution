// 用户状态管理（Vue3 Composition API / uni-app 兼容）
import { reactive, computed } from 'vue';

const state = reactive({
  userInfo: uni.getStorageSync('userInfo') || null,
  token: uni.getStorageSync('token') || null,
  refreshToken: uni.getStorageSync('refreshToken') || null,
});

export function useUserStore() {
  const setAuth = (data, token, refreshToken) => {
    state.userInfo = data;
    state.token = token;
    state.refreshToken = refreshToken;
    uni.setStorageSync('userInfo', data);
    uni.setStorageSync('token', token);
    uni.setStorageSync('refreshToken', refreshToken);
  };

  const clearAuth = () => {
    state.userInfo = null;
    state.token = null;
    state.refreshToken = null;
    uni.removeStorageSync('userInfo');
    uni.removeStorageSync('token');
    uni.removeStorageSync('refreshToken');
  };

  const isLoggedIn = computed(() => !!state.token);
  const isAdmin = computed(() => state.userInfo && state.userInfo.is_admin === true);

  return {
    userInfo: state.userInfo,
    token: state.token,
    refreshToken: state.refreshToken,
    setAuth,
    clearAuth,
    isLoggedIn,
    isAdmin,
  };
}
