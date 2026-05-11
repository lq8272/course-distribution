<template>
  <view class="page">
    <!-- 导航 -->
    <view class="nav-bar">
      <view class="nav-back" @click="goBack">← 返回</view>
      <text class="nav-title">浏览历史</text>
      <view class="nav-clear" @click="clearHistory">清空</view>
    </view>

    <!-- Section Header -->
    <view class="section-header" v-if="history.length > 0">
      <view class="section-bar"></view>
      <text class="section-label">历史记录</text>
    </view>

    <!-- 历史列表 -->
    <view class="history-list" v-if="history.length > 0">
      <view
        v-for="item in history"
        :key="item.id"
        class="history-card"
        @click="goToCourse(item.course_id)"
      >
        <view class="icon-wrap">
          <text class="cover-icon">🎬</text>
        </view>
        <view class="info">
          <view class="title">{{ item.course.title }}</view>
          <view class="meta">
            <text class="price">¥{{ item.course.price }}</text>
            <text class="time">{{ formatTime(item.viewed_at) }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else-if="!loading" class="empty-state">
      <text class="empty-icon">🕐</text>
      <text class="empty-text">暂无浏览记录</text>
      <view class="empty-btn" @click="goToIndex">去逛逛</view>
    </view>

    <!-- 加载中 -->
    <view v-if="loading" class="loading-state">
      <view class="spinner"></view>
      <text>加载中...</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { courseApi } from '@/api/course';

const history = ref([]);
const loading = ref(false);

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const hours = diff / 3600000;
  if (hours < 1) return '刚刚';
  if (hours < 24) return `${Math.floor(hours)}小时前`;
  const days = diff / 86400000;
  if (days < 7) return `${Math.floor(days)}天前`;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function loadHistory() {
  loading.value = true;
  try {
    const stored = uni.getStorageSync('browse_history') || [];
    if (stored.length === 0) { history.value = []; return; }
    const res = await courseApi.list({ page: 1, page_size: 100 });
    const allCourses = res.rows || [];
    history.value = stored
      .map(h => {
        const course = allCourses.find(c => c.id === h.course_id);
        if (course) return { id: h.id, course_id: h.course_id, course, viewed_at: h.viewed_at };
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.viewed_at) - new Date(a.viewed_at));
  } catch (e) {
    console.error('loadHistory error', e);
  } finally {
    loading.value = false;
  }
}

function clearHistory() {
  uni.showModal({
    title: '确认清空',
    content: '确定要清空所有浏览记录吗？',
    success: (res) => {
      if (res.confirm) {
        uni.removeStorageSync('browse_history');
        history.value = [];
        uni.showToast({ title: '已清空', icon: 'success' });
      }
    },
  });
}

function goToCourse(courseId) {
  uni.navigateTo({ url: `/pages/course/detail?id=${courseId}` });
}

function goToIndex() { uni.switchTab({ url: '/pages/index/index' }); }
function goBack() { uni.navigateBack(); }

onShow(() => { loadHistory(); });
</script>

<style lang="scss" scoped>
@import "@/common/styles/base.scss";

.page { min-height: 100vh; background: $bg-light; }

.nav-bar {
  display: flex; align-items: center; justify-content: space-between;
  height: 88rpx; padding: 0 24rpx; background: $bg-white;
  border-bottom: 1rpx solid $border-color; position: sticky; top: 0; z-index: 10;
  .nav-back { font-size: 28rpx; color: $primary-color; min-width: 80rpx; }
  .nav-title { font-size: 32rpx; font-weight: 500; color: $text-primary; }
  .nav-clear { font-size: 28rpx; color: $text-gray; min-width: 80rpx; text-align: right; }
}

.section-header {
  display: flex;
  align-items: center;
  padding: 32rpx 24rpx 16rpx;
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

.history-list { padding: 0 24rpx; }

.history-card {
  display: flex;
  align-items: center;
  background: $bg-white;
  border-radius: 24rpx;
  padding: 20rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 16rpx rgba(0,0,0,0.06), 0 8rpx 32rpx rgba(0,0,0,0.04);

  .icon-wrap {
    width: 100rpx;
    height: 100rpx;
    border-radius: 16rpx;
    background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-right: 20rpx;

    .cover-icon { font-size: 48rpx; }
  }

  .info {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;

    .title {
      font-size: 28rpx;
      font-weight: 500;
      color: $text-primary;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-bottom: 8rpx;
    }

    .meta {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .price {
        font-size: 28rpx;
        color: $primary-color;
        font-weight: bold;
      }

      .time {
        font-size: 22rpx;
        color: $text-gray;
      }
    }
  }
}

.empty-state {
  text-align: center;
  padding: 120rpx 0;

  .empty-icon { display: block; font-size: 96rpx; margin-bottom: 24rpx; }
  .empty-text { display: block; font-size: 28rpx; color: $text-gray; margin-bottom: 40rpx; }

  .empty-btn {
    display: inline-block;
    background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
    color: #fff;
    padding: 16rpx 48rpx;
    border-radius: 44rpx;
    font-size: 28rpx;
  }
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 80rpx;
  color: $text-gray;
  font-size: 28rpx;

  .spinner {
    width: 32rpx;
    height: 32rpx;
    border: 3rpx solid $border-color;
    border-top-color: $primary-color;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>