<template>
  <view class="page">
    <!-- 页面标题 -->
    <view class="page-header">
      <view class="section-header">
        <view class="section-header__bar"></view>
        <text class="section-header__label">已购课程</text>
      </view>
    </view>

    <view class="course-list">
      <view v-if="loading && courses.length === 0" class="loading-state">
        <view class="loading-icon">
          <text>⏳</text>
        </view>
        <text class="loading-text">加载中...</text>
      </view>

      <view
        v-for="course in courses"
        :key="course.course_id"
        class="course-card"
        @click="goToDetail(course.course_id)"
      >
        <image class="course-card__cover" :src="course.cover_image || '/static/default-cover.png'" mode="aspectFill" />
        <view class="course-card__info">
          <view class="course-card__title">{{ course.title }}</view>
          <view class="course-card__meta">
            <text class="tag" :class="orderStatusTag(course.order_status).cls">{{ orderStatusTag(course.order_status).txt }}</text>
          </view>
          <view class="course-card__footer">
            <text class="price">¥{{ course.price }}</text>
            <text class="buy-time">{{ formatDate(course.buy_time) }}</text>
          </view>
        </view>
      </view>

      <view v-if="!loading && courses.length === 0" class="empty-state">
        <view class="empty-icon">
          <text>📚</text>
        </view>
        <text class="empty-text">暂无已购课程</text>
        <text class="empty-hint">快去选购心仪的课程吧</text>
        <view class="go-buy" @click="goToIndex">
          <text>去选购</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { api } from '@/api/index';
import { courseApi } from '@/api/course';

const courses = ref([]);
const loading = ref(false);

async function loadCourses() {
  loading.value = true;
  try {
    // 已购课程走 /api/my/courses（mounted at /api/my/courses，full path = BASE_URL + /my/courses）
    const res = await api.get('/my/courses');
    courses.value = res.rows || res || [];
  } catch (e) {
    console.error('loadCourses error', e);
    loading.value = false;
    const msg = e?.message || e?.msg || '';
    if (msg.includes('Token') || msg.includes('token') || e?.code === 401) {
      uni.showModal({
        title: '提示',
        content: '登录已过期，请重新登录',
        confirmText: '去登录',
        success: (res) => { if (res.confirm) uni.reLaunch({ url: '/pages/login/index' }); }
      });
    } else {
      uni.showModal({
        title: '加载失败',
        content: '网络异常，是否重试？',
        success: (res) => { if (res.confirm) loadCourses(); }
      });
    }
  } finally {
    loading.value = false;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function goToDetail(id) {
  uni.navigateTo({ url: `/pages/course/detail?id=${id}` });
}

function goToIndex() {
  uni.reLaunch({ url: '/pages/index/index' });
}

const ORDER_STATUS_MAP = {
  0: { txt: '待审核', cls: 'tag--warning' },
  1: { txt: '未确认', cls: 'tag--warning' },
  2: { txt: '已完成', cls: 'tag--success' },
  3: { txt: '已退款', cls: 'tag--danger' },
  4: { txt: '已关闭', cls: 'tag--muted' },
};

function orderStatusTag(status) {
  return ORDER_STATUS_MAP[status] || { txt: '未知', cls: 'tag--muted' };
}

onShow(() => {
  loadCourses();
});
</script>

<style lang="scss" scoped>
// Design System Variables
$bg: #f5f3ee;
$card: #ffffff;
$primary: #FF6B00;
$primary-light: #FF8533;
$gold: #d4a843;
$text-primary: #1c1917;
$text-secondary: #57534e;
$text-muted: #a8a29e;
$border: #ece8e1;
$shadow-card: 0 2rpx 16rpx rgba(0,0,0,0.06), 0 8rpx 32rpx rgba(0,0,0,0.04);

.page {
  min-height: 100vh;
  background: $bg;
  padding-bottom: 24rpx;
}

.page-header {
  padding: 24rpx 24rpx 0 24rpx;
}

// Section Header Component
.section-header {
  display: flex;
  align-items: center;
  margin-bottom: 24rpx;
}

.section-header__bar {
  width: 6rpx;
  height: 28rpx;
  background: linear-gradient(180deg, $primary 0%, $primary-light 100%);
  border-radius: 3rpx;
  margin-right: 16rpx;
}

.section-header__label {
  font-size: 28rpx;
  font-weight: 600;
  color: $text-primary;
  text-transform: uppercase;
  letter-spacing: 2rpx;
}

.course-list {
  padding: 0 24rpx;
}

// Loading State
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}

.loading-icon {
  width: 72rpx;
  height: 72rpx;
  background: linear-gradient(135deg, $primary 0%, $primary-light 100%);
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
  box-shadow: $shadow-card;
}

.loading-icon text {
  font-size: 32rpx;
}

.loading-text {
  font-size: 28rpx;
  color: $text-muted;
}

// Empty State
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}

.empty-icon {
  width: 72rpx;
  height: 72rpx;
  background: linear-gradient(135deg, $primary 0%, $primary-light 100%);
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
  box-shadow: $shadow-card;
}

.empty-icon text {
  font-size: 32rpx;
}

.empty-text {
  font-size: 32rpx;
  font-weight: 500;
  color: $text-primary;
  margin-bottom: 12rpx;
}

.empty-hint {
  font-size: 26rpx;
  color: $text-muted;
  margin-bottom: 48rpx;
}

.go-buy {
  background: linear-gradient(135deg, $primary 0%, $primary-light 100%);
  color: #FFFFFF;
  padding: 20rpx 64rpx;
  border-radius: 44rpx;
  font-size: 28rpx;
  font-weight: 500;
  box-shadow: $shadow-card;
}

// Course Card
.course-card {
  display: flex;
  background: $card;
  border-radius: 24rpx;
  overflow: hidden;
  margin-bottom: 20rpx;
  box-shadow: $shadow-card;
}

.course-card__cover {
  width: 200rpx;
  height: 150rpx;
  flex-shrink: 0;
}

.course-card__info {
  flex: 1;
  padding: 20rpx;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.course-card__title {
  font-size: 28rpx;
  font-weight: 500;
  color: $text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 340rpx;
}

.course-card__meta {
  margin: 8rpx 0;
}

.course-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8rpx;
  min-height: 32rpx;
}

.course-card .price {
  font-size: 30rpx;
  color: $primary;
  font-weight: bold;
  flex-shrink: 0;
}

.course-card .buy-time {
  font-size: 20rpx;
  color: $text-muted;
  flex: 1;
  text-align: right;
  padding-left: 12rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// Tag Component
.tag {
  display: inline-block;
  padding: 4rpx 10rpx;
  border-radius: 6rpx;
  font-size: 18rpx;
  white-space: nowrap;
}

.tag--primary {
  background: rgba($primary, 0.1);
  color: $primary;
}

.tag--success {
  background: rgba(#22c55e, 0.1);
  color: #22c55e;
}

.tag--warning {
  background: rgba(#f59e0b, 0.1);
  color: #f59e0b;
}

.tag--danger {
  background: rgba(#ef4444, 0.1);
  color: #ef4444;
}

.tag--muted {
  background: rgba($text-muted, 0.15);
  color: $text-muted;
}
</style>