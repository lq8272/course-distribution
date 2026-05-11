<template>
  <view class="page">
    <!-- 导航 -->
    <view class="nav-bar">
      <view class="nav-back" @click="goBack">← 返回</view>
      <text class="nav-title">我的收藏</text>
      <view class="nav-placeholder"></view>
    </view>

    <!-- Section Header -->
    <view class="section-header" v-if="collections.length > 0">
      <view class="section-bar"></view>
      <text class="section-label">收藏内容</text>
    </view>

    <!-- 收藏列表 -->
    <view class="collection-list" v-if="collections.length > 0">
      <view
        v-for="item in collections"
        :key="item.id"
        class="collection-card"
        @click="goToCourse(item.course_id)"
      >
        <view class="icon-wrap">
          <text class="cover-icon">📖</text>
        </view>
        <view class="info">
          <view class="title">{{ item.course.title }}</view>
          <view class="meta">
            <text class="price">¥{{ item.course.price }}</text>
            <text class="date">收藏于 {{ formatDate(item.created_at) }}</text>
          </view>
        </view>
        <view class="remove-btn" @click.stop="removeCollection(item.id)">删除</view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else-if="!loading" class="empty-state">
      <text class="empty-icon">❤️</text>
      <text class="empty-text">暂无收藏内容</text>
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

const collections = ref([]);
const loading = ref(false);

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function loadCollections() {
  loading.value = true;
  try {
    const stored = uni.getStorageSync('collections') || [];
    if (stored.length === 0) {
      collections.value = [];
      return;
    }
    const courseIds = stored.map(c => c.course_id);
    const res = await courseApi.list({ page: 1, page_size: 100 });
    const allCourses = res.rows || [];
    collections.value = stored
      .map(sc => {
        const course = allCourses.find(c => c.id === sc.course_id);
        if (course) return { id: sc.id, course_id: sc.course_id, course, created_at: sc.created_at };
        return null;
      })
      .filter(Boolean);
  } catch (e) {
    console.error('loadCollections error', e);
  } finally {
    loading.value = false;
  }
}

function removeCollection(collectionId) {
  uni.showModal({
    title: '确认删除',
    content: '确定要取消收藏吗？',
    success: (res) => {
      if (res.confirm) {
        const stored = uni.getStorageSync('collections') || [];
        const updated = stored.filter(c => c.id !== collectionId);
        uni.setStorageSync('collections', updated);
        collections.value = collections.value.filter(c => c.id !== collectionId);
        uni.showToast({ title: '已取消收藏', icon: 'success' });
      }
    },
  });
}

function goToCourse(courseId) {
  uni.navigateTo({ url: `/pages/course/detail?id=${courseId}` });
}

function goToIndex() {
  uni.switchTab({ url: '/pages/index/index' });
}

function goBack() {
  uni.navigateBack();
}

onShow(() => {
  loadCollections();
});
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
  .nav-placeholder { min-width: 80rpx; }
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

.collection-list { padding: 0 24rpx; }

.collection-card {
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
    margin-right: 16rpx;
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

      .date {
        font-size: 22rpx;
        color: $text-gray;
      }
    }
  }

  .remove-btn {
    font-size: 24rpx;
    color: #ff4d4f;
    padding: 8rpx 16rpx;
    flex-shrink: 0;
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