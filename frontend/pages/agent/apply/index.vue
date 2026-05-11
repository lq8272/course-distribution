<template>
  <view class="page">
    <!-- 导航 -->
    <view class="nav-bar">
      <view class="nav-back" @click="goBack">← 返回</view>
      <text class="nav-title">申请成为分销商</text>
      <view class="nav-placeholder"></view>
    </view>

    <!-- 加载中 -->
    <view v-if="loading" class="loading">加载中...</view>

    <!-- 等级选择 -->
    <view v-else class="content">
      <view class="section-title">选择分销等级</view>

      <view
        v-for="level in levels"
        :key="level.level"
        :class="'level-card' + (selectedLevel === level.level ? ' level-card--selected' : '')"
        @click="selectedLevel = level.level"
      >
        <view class="level-card__header">
          <view class="level-card__radio">
            <view v-if="selectedLevel === level.level" class="radio-dot"></view>
          </view>
          <text class="level-card__name">{{ level.name }}</text>
        </view>

        <view class="level-card__detail">
          <view class="detail-item">
            <text class="detail-label">销售佣金比例</text>
            <text class="detail-value">{{ (level.rebate_rate * 100).toFixed(1) }}%</text>
          </view>
          <view class="detail-item">
            <text class="detail-label">拿货名额</text>
            <text class="detail-value">{{ level.gift_accounts }} 件</text>
          </view>
          <view class="detail-item">
            <text class="detail-label">升级条件</text>
            <text class="detail-value">推荐 {{ level.upgrade_referral_min }} 人</text>
          </view>
        </view>
      </view>

      <!-- 推荐人提示 -->
      <view class="tips card">
        <view class="tips__title">📌 申请须知</view>
        <view class="tips__item">• 提交申请后，管理员审核通过即可成为分销商</view>
        <view class="tips__item">• 审核结果将通过站内消息通知您</view>
        <view class="tips__item">• 成为分销商后可获得推广码，推荐他人购买获取佣金</view>
      </view>

      <!-- 提交按钮 -->
      <view :class="'submit-btn' + (submitting ? ' submitting' : '')" @click="handleSubmit">
        {{ submitting ? '提交中...' : '提交申请' }}
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { agentApi } from '@/api/agent';

const loading = ref(true);
const submitting = ref(false);
const levels = ref([]);
const selectedLevel = ref('');

onMounted(async () => {
  try {
    const res = await agentApi.levels();
    levels.value = res || [];
    if (levels.value.length > 0) {
      selectedLevel.value = levels.value[0].level;
    }
  } catch (e) {
    console.error('加载等级失败', e);
  } finally {
    loading.value = false;
  }
});

function goBack() {
  uni.navigateBack();
}

async function handleSubmit() {
  if (!selectedLevel.value) {
    uni.showToast({ title: '请选择分销等级', icon: 'none' });
    return;
  }
  if (submitting.value) return;
  submitting.value = true;
  try {
    await agentApi.apply({ level: selectedLevel.value });
    uni.showToast({ title: '申请已提交', icon: 'success' });
    setTimeout(() => uni.navigateBack(), 1500);
  } catch (e) {
    const msg = (e && e.message) || '提交失败，请重试';
    uni.showToast({ title: msg, icon: 'none' });
  } finally {
    submitting.value = false;
  }
}
</script>

<style lang="scss" scoped>
@import "@/common/styles/base.scss";

.page {
  min-height: 100vh;
  background: $bg-light;
}

.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  padding: 0 24rpx;
  background: $bg-white;
  border-bottom: 1rpx solid $border-color;
  position: sticky;
  top: 0;
  z-index: 10;
  .nav-back {
    font-size: 28rpx;
    color: $primary-color;
    min-width: 80rpx;
  }
  .nav-title {
    font-size: 32rpx;
    font-weight: 500;
    color: $text-primary;
  }
  .nav-placeholder {
    min-width: 80rpx;
  }
}

.loading {
  text-align: center;
  padding: 80rpx 0;
  color: $text-gray;
  font-size: 28rpx;
}

.content {
  padding: 24rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 500;
  color: $text-primary;
  margin-bottom: 20rpx;
}

.level-card {
  background: $bg-white;
  border-radius: $border-radius;
  padding: 24rpx;
  margin-bottom: 20rpx;
  border: 3rpx solid transparent;
  box-shadow: $shadow-sm;

  &--selected {
    border-color: $primary-color;
    background: rgba($primary-color, 0.03);
  }

  &__header {
    display: flex;
    align-items: center;
    margin-bottom: 20rpx;
  }

  &__radio {
    width: 36rpx;
    height: 36rpx;
    border: 3rpx solid $border-color;
    border-radius: 50%;
    margin-right: 16rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    .radio-dot {
      width: 20rpx;
      height: 20rpx;
      border-radius: 50%;
      background: $primary-color;
    }
  }

  &__name {
    flex: 1;
    font-size: 32rpx;
    font-weight: 500;
    color: $text-primary;
  }

  &__detail {
    display: flex;
    flex-wrap: wrap;
    gap: 12rpx;
  }

  .detail-item {
    background: $bg-light;
    border-radius: 8rpx;
    padding: 10rpx 16rpx;
    min-width: 140rpx;
    .detail-label {
      display: block;
      font-size: 20rpx;
      color: $text-gray;
      margin-bottom: 4rpx;
    }
    .detail-value {
      display: block;
      font-size: 24rpx;
      color: $text-primary;
      font-weight: 500;
    }
  }
}

.tips {
  margin-top: 8rpx;
  &__title {
    font-size: 26rpx;
    font-weight: 500;
    color: $text-primary;
    margin-bottom: 16rpx;
  }
  &__item {
    font-size: 24rpx;
    color: $text-secondary;
    line-height: 1.8;
  }
}

.submit-btn {
  margin-top: 32rpx;
  padding: 28rpx 0;
  background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
  color: #FFFFFF;
  border-radius: 44rpx;
  text-align: center;
  font-size: 32rpx;
  font-weight: 500;
  &.submitting {
    opacity: 0.6;
  }
}
</style>
