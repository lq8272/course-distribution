<template>
  <view class="page">
    <view class="back-home" @click="goHome">
      <text class="back-home__arrow">←</text>
      <text class="back-home__text">返回首页</text>
    </view>

    <!-- Section Header -->
    <view class="section-header">
      <view class="section-bar"></view>
      <text class="section-label">申请加入</text>
    </view>

    <view class="header">
      <view class="icon-wrap">
        <text class="icon">🤝</text>
      </view>
      <text class="title">申请成为分销商</text>
      <text class="subtitle">分享课程，赚取佣金</text>
    </view>

    <!-- 协议勾选 -->
    <view class="agreement-row">
      <view class="checkbox" :class="{ checked: agreed }" @click="agreed = !agreed">
        <text v-if="agreed">✓</text>
      </view>
      <text class="agreement-text" @click="agreed = !agreed">
        我已阅读并同意
        <text class="link" @click.stop="showProtocol = true">《分销商协议》</text>
      </text>
    </view>

    <!-- 推广码输入（可选） -->
    <view class="form card">
      <view class="form-title">推荐人推广码（选填）</view>
      <view class="form-desc">如有推荐人，请填写其推广码</view>
      <input
        class="form-input"
        v-model="promoCode"
        placeholder="请输入推荐人推广码"
        maxlength="20"
      />
    </view>

    <!-- 等级选择 -->
    <view class="card">
      <view class="section-header" style="padding: 0 0 16rpx 0;">
        <view class="section-bar"></view>
        <text class="section-label">选择分销等级</text>
        <text class="required" style="margin-left: 4rpx;">*</text>
      </view>
      <view class="level-list" v-if="!loadingLevels && levels.length">
        <view
          v-for="lv in levels"
          :key="lv.level"
          class="level-item"
          :class="{ selected: selectedLevel === lv.level }"
          @click="selectedLevel = lv.level"
        >
          <view class="level-item__left">
            <view class="level-name">{{ lv.name }}</view>
            <view class="level-rate">返佣比例：{{ (lv.rebate_rate * 100).toFixed(0) }}%</view>
            <view class="level-gift" v-if="lv.gift_accounts">赠送账户：{{ lv.gift_accounts }}个</view>
          </view>
          <view class="level-item__right">
            <view class="level-radio" :class="{ active: selectedLevel === lv.level }">
              <text v-if="selectedLevel === lv.level">✓</text>
            </view>
          </view>
        </view>
      </view>
      <view class="loading-levels" v-if="loadingLevels">
        <view class="spinner"></view>
        <text>加载等级中...</text>
      </view>
      <view class="no-levels" v-if="!loadingLevels && levels.length === 0">
        <text>暂无可选等级，请联系客服</text>
      </view>
    </view>

    <!-- 提交按钮 -->
    <view class="submit-row">
      <view
        class="btn-submit"
        :class="{ disabled: !agreed || !selectedLevel || loading }"
        @click="handleSubmit"
      >
        {{ loading ? '提交中...' : '提交申请' }}
      </view>
    </view>

    <!-- 协议弹窗 -->
    <view class="protocol-mask" v-if="showProtocol" @click="showProtocol = false">
      <view class="protocol-panel" @click.stop>
        <view class="protocol-title">分销商协议</view>
        <scroll-view class="protocol-content" scroll-y>
          <view>1. 分销商需遵守平台相关法律法规。</view>
          <view>2. 佣金结算按平台规则执行，每月提现一次。</view>
          <view>3. 严禁刷单、虚假宣传等违规行为。</view>
          <view>4. 平台有权对违规分销商进行处罚。</view>
          <view>5. 推广码归平台所有，不可转让。</view>
        </scroll-view>
        <view class="protocol-close" @click="showProtocol = false">我已知晓</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { agentApi } from '@/api/agent';

const agreed = ref(false);
const promoCode = ref('');
const selectedLevel = ref(null);
const levels = ref([]);
const loadingLevels = ref(false);
const loading = ref(false);
const showProtocol = ref(false);

onShow(() => {
  if (!uni.getStorageSync('token')) {
    uni.showModal({
      title: '提示',
      content: '请先登录后再申请成为分销商',
      showCancel: false,
      success: () => {
        uni.reLaunch({ url: '/pages/login/index' });
      },
    });
    return;
  }

  const pages = getCurrentPages();
  const current = pages[pages.length - 1];
  const { code } = current.options || {};
  if (code) promoCode.value = code;
  loadLevels();
});

async function loadLevels() {
  loadingLevels.value = true;
  try {
    const res = await agentApi.levels();
    levels.value = res || [];
    if (levels.value.length > 0 && !selectedLevel.value) {
      selectedLevel.value = levels.value[0].level;
    }
  } catch (e) {
    console.error('loadLevels error', e);
    levels.value = [];
  } finally {
    loadingLevels.value = false;
  }
}

function goHome() {
  uni.reLaunch({ url: '/pages/index/index' });
}

async function handleSubmit() {
  if (loading.value) return;
  if (!agreed.value) {
    uni.showToast({ title: '请先阅读并同意协议', icon: 'none' });
    return;
  }
  if (!selectedLevel.value) {
    uni.showToast({ title: '请选择分销等级', icon: 'none' });
    return;
  }
  loading.value = true;
  try {
    await agentApi.apply({
      level: selectedLevel.value,
      promotion_code: promoCode.value.trim() || undefined,
    });
    uni.showToast({ title: '申请提交成功', icon: 'success' });
    setTimeout(() => uni.reLaunch({ url: '/pages/index/index' }), 1500);
  } catch (e) {
    const msg = (e && e.message) || '申请失败，请重试';
    uni.showToast({ title: msg, icon: 'none' });
  } finally {
    loading.value = false;
  }
}
</script>

<style lang="scss" scoped>
@import "@/common/styles/base.scss";

.page {
  min-height: 100vh;
  background: $bg-light;
  padding: 24rpx;
  padding-bottom: 40rpx;
}

.back-home {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
  &__arrow { font-size: 32rpx; color: $primary-color; margin-right: 8rpx; }
  &__text { font-size: 26rpx; color: $primary-color; }
}

.section-header {
  display: flex;
  align-items: center;
  padding-bottom: 16rpx;
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

.header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40rpx 0 32rpx;

  .icon-wrap {
    width: 120rpx;
    height: 120rpx;
    border-radius: 28rpx;
    background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20rpx;
    box-shadow: 0 8rpx 32rpx rgba(255, 107, 0, 0.25);

    .icon { font-size: 60rpx; }
  }

  .title { font-size: 36rpx; font-weight: 600; color: $text-primary; margin-bottom: 8rpx; }
  .subtitle { font-size: 26rpx; color: $text-secondary; }
}

.agreement-row {
  display: flex;
  align-items: center;
  margin-bottom: 32rpx;

  .checkbox {
    width: 36rpx;
    height: 36rpx;
    border: 2rpx solid $border-color;
    border-radius: 8rpx;
    margin-right: 12rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22rpx;
    color: #fff;
    background: #fff;
    &.checked {
      background: $primary-color;
      border-color: $primary-color;
    }
  }

  .agreement-text {
    font-size: 24rpx;
    color: $text-secondary;
    .link { color: $primary-color; }
  }
}

.card {
  background: $bg-white;
  border-radius: 24rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 16rpx rgba(0,0,0,0.06), 0 8rpx 32rpx rgba(0,0,0,0.04);
}

.form {
  .form-title {
    font-size: 28rpx;
    font-weight: 500;
    color: $text-primary;
    margin-bottom: 8rpx;
  }

  .form-desc { font-size: 22rpx; color: $text-gray; margin-bottom: 20rpx; }

  .form-input {
    border: 1rpx solid $border-color;
    border-radius: 16rpx;
    padding: 20rpx 24rpx;
    font-size: 28rpx;
    background: $bg-light;
    color: $text-primary;
  }
}

.level-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.level-item {
  display: flex;
  align-items: center;
  border: 2rpx solid $border-color;
  border-radius: 16rpx;
  padding: 24rpx;
  transition: border-color 0.2s, background 0.2s;

  &.selected {
    border-color: $primary-color;
    background: rgba($primary-color, 0.05);
  }

  &__left {
    flex: 1;

    .level-name { font-size: 28rpx; font-weight: 500; color: $text-primary; margin-bottom: 8rpx; }
    .level-rate { font-size: 24rpx; color: $primary-color; margin-bottom: 4rpx; }
    .level-gift { font-size: 22rpx; color: $text-gray; }
  }

  &__right {
    .level-radio {
      width: 40rpx;
      height: 40rpx;
      border: 2rpx solid $border-color;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22rpx;
      color: #fff;
      &.active {
        background: $primary-color;
        border-color: $primary-color;
      }
    }
  }
}

.loading-levels, .no-levels {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 32rpx 0;
  font-size: 26rpx;
  color: $text-gray;
}

.spinner {
  width: 32rpx;
  height: 32rpx;
  border: 3rpx solid $border-color;
  border-top-color: $primary-color;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.submit-row {
  .btn-submit {
    background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
    color: #fff;
    text-align: center;
    padding: 28rpx 0;
    border-radius: 44rpx;
    font-size: 32rpx;
    font-weight: 500;
    box-shadow: 0 4rpx 20rpx rgba(255, 107, 0, 0.3);

    &.disabled { opacity: 0.5; }
  }
}

.protocol-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.protocol-panel {
  width: 600rpx;
  max-height: 70vh;
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx 32rpx 32rpx;
  display: flex;
  flex-direction: column;
}

.protocol-title {
  font-size: 32rpx;
  font-weight: 600;
  text-align: center;
  margin-bottom: 24rpx;
  color: $text-primary;
}

.protocol-content {
  flex: 1;
  max-height: 50vh;

  view {
    font-size: 26rpx;
    color: $text-secondary;
    line-height: 1.8;
    margin-bottom: 16rpx;
  }
}

.protocol-close {
  margin-top: 24rpx;
  background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
  color: #fff;
  text-align: center;
  padding: 24rpx 0;
  border-radius: 44rpx;
  font-size: 28rpx;
  box-shadow: 0 4rpx 16rpx rgba(255, 107, 0, 0.25);
}
</style>