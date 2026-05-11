<template>
  <view class="page">
    <!-- 顶部搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrap" @click="goSearch">
        <text class="search-icon">🔍</text>
        <text class="placeholder">搜索课程...</text>
      </view>
    </view>

    <!-- 轮播 Banner -->
    <swiper class="banner" indicator-dots autoplay circular interval="3000">
      <swiper-item v-for="(banner, i) in banners" :key="i" @click="onBannerClick(banner)">
        <view class="banner-item" :style="{ background: banner.bg }">
          <view class="banner-content">
            <text class="banner-tag">{{ banner.tag }}</text>
            <text class="banner-title">{{ banner.title }}</text>
            <text class="banner-sub">{{ banner.sub }}</text>
          </view>
        </view>
      </swiper-item>
    </swiper>

    <!-- 分类横向滚动 -->
    <scroll-view scroll-x class="category-bar">
      <view
        v-for="cat in categories"
        :key="cat.id"
        :class="['cat-item', selectedCat === cat.id && 'active']"
        @click="selectCategory(cat.id)"
      >
        <text class="cat-icon">{{ cat.icon }}</text>
        <text class="cat-name">{{ cat.name }}</text>
      </view>
    </scroll-view>

    <!-- 课程列表 -->
    <view class="course-list">
      <view v-for="course in courses" :key="course.id" class="course-card" @click="goDetail(course.id)">
        <!-- 封面 + 价格标签 -->
        <view class="cover-wrap">
          <image :src="course.cover_image || '/static/default-cover.png'" mode="aspectFill" class="cover"/>
          <view v-if="course.is_free" class="free-tag">免费</view>
          <view v-else class="price-tag">¥{{ course.price }}</view>
        </view>
        <!-- 课程信息 -->
        <view class="info">
          <view class="title">{{ course.title }}</view>
          <view class="meta">
            <text class="instructor">{{ course.instructor || '平台讲师' }}</text>
          </view>
          <view class="bottom">
            <view class="rating">
              <text class="star">★★★★★</text>
              <text class="rating-num">{{ course.rating || '5.0' }}</text>
            </view>
            <text class="students">{{ course.student_count || 0 }}人学习</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-if="!loading && courses.length === 0" class="empty">
      <text class="empty-icon">📭</text>
      <text class="empty-text">暂无相关课程</text>
    </view>

    <!-- 加载中 -->
    <view v-if="loading" class="loading-wrap">
      <text class="loading-text">加载中...</text>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { courseApi } from '../../api/course';

const categories = ref([]);
const courses = ref([]);
const selectedCat = ref(null);
const loading = ref(false);

// 模拟 Banner 数据（后续可对接后端接口）
const banners = ref([
  { tag: '🔥 热门推荐', title: 'Vue3 + TypeScript 实战', sub: '从入门到精通，打造高颜值后台管理系统', bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { tag: '💰 限时优惠', title: 'Node.js 高级实战', sub: '掌握全栈技能，提升职场竞争力', bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { tag: '🎓 新课上架', title: 'React 18 + Recoil 状态管理', sub: '现代 React 开发，理论与实战并重', bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
]);

// 带 icon 的分类
const CAT_ICONS = {
  1: '💻',  // 编程开发
  2: '📱',  // 产品运营
  3: '🎨',  // 设计创意
  4: '📈',  // 营销推广
};

onMounted(async () => {
  loading.value = true;
  try {
    const [cats, list] = await Promise.all([
      courseApi.categories(),
      courseApi.list({ page: 1, page_size: 20 }),
    ]);
    // 附加 icon
    categories.value = [
      { id: null, name: '全部', icon: '✨' },
      ...cats.map(c => ({ ...c, icon: CAT_ICONS[c.id] || '📖' })),
    ];
    courses.value = list.rows || [];
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
});

async function selectCategory(catId) {
  selectedCat.value = catId;
  loading.value = true;
  try {
    const params = { page: 1, page_size: 20 };
    if (catId) params.category_id = catId;
    const list = await courseApi.list(params);
    courses.value = list.rows || [];
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

function goDetail(id) {
  uni.navigateTo({ url: `/pages/course/detail?id=${id}` });
}

function goSearch() {
  uni.showToast({ title: '搜索功能开发中', icon: 'none' });
}

function onBannerClick(banner) {
  uni.showToast({ title: banner.title, icon: 'none' });
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--bg-light);
  padding-bottom: 24rpx;
}

/* 搜索栏 */
.search-bar {
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
  padding: 16rpx 24rpx 24rpx;
}
.search-input-wrap {
  display: flex;
  align-items: center;
  background: rgba(255,255,255,0.2);
  border-radius: 36rpx;
  padding: 16rpx 24rpx;
  backdrop-filter: blur(4px);
}
.search-icon {
  font-size: 28rpx;
  margin-right: 12rpx;
}
.placeholder {
  font-size: 26rpx;
  color: rgba(255,255,255,0.8);
}

/* Banner */
.banner {
  height: 300rpx;
  margin: 0;
}
.banner-item {
  width: 100%;
  height: 300rpx;
  display: flex;
  align-items: center;
  padding: 0 48rpx;
  box-sizing: border-box;
}
.banner-content {
  display: flex;
  flex-direction: column;
}
.banner-tag {
  font-size: 22rpx;
  color: rgba(255,255,255,0.9);
  background: rgba(255,255,255,0.2);
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  display: inline-block;
  margin-bottom: 16rpx;
  align-self: flex-start;
}
.banner-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 12rpx;
}
.banner-sub {
  font-size: 24rpx;
  color: rgba(255,255,255,0.8);
}

/* 分类 */
.category-bar {
  white-space: nowrap;
  background: var(--bg-white);
  padding: 20rpx 0;
  border-bottom: 1rpx solid var(--border-color);
}
.cat-item {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  padding: 8rpx 28rpx;
  margin: 0 4rpx;
}
.cat-item.active .cat-name {
  color: var(--brand-primary);
  font-weight: 600;
}
.cat-icon {
  font-size: 40rpx;
  margin-bottom: 6rpx;
}
.cat-name {
  font-size: 24rpx;
  color: var(--text-gray);
  transition: all 0.2s;
}

/* 课程列表 */
.course-list {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
  padding: 20rpx 24rpx;
}
.course-card {
  width: calc(50% - 10rpx);
  background: var(--bg-white);
  border-radius: var(--border-radius);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}
.cover-wrap {
  position: relative;
  width: 100%;
  height: 220rpx;
  overflow: hidden;
}
.cover {
  width: 100%;
  height: 100%;
}
.free-tag {
  position: absolute;
  top: 12rpx;
  left: 12rpx;
  background: var(--success-color);
  color: #fff;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
}
.price-tag {
  position: absolute;
  bottom: 12rpx;
  right: 12rpx;
  background: var(--price-color);
  color: #fff;
  font-size: 22rpx;
  font-weight: bold;
  padding: 4rpx 14rpx;
  border-radius: 6rpx;
}
.info {
  padding: 16rpx;
}
.title {
  font-size: 28rpx;
  color: var(--text-primary);
  margin-bottom: 10rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.4;
}
.meta {
  margin-bottom: 10rpx;
}
.instructor {
  font-size: 22rpx;
  color: var(--text-gray);
}
.bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.rating {
  display: flex;
  align-items: center;
  gap: 6rpx;
}
.star {
  font-size: 20rpx;
  color: #FFB800;
}
.rating-num {
  font-size: 22rpx;
  color: var(--text-secondary);
}
.students {
  font-size: 22rpx;
  color: var(--text-gray);
}

/* 空/加载状态 */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}
.empty-icon {
  font-size: 96rpx;
  margin-bottom: 24rpx;
}
.empty-text {
  font-size: 28rpx;
  color: var(--text-gray);
}
.loading-wrap {
  text-align: center;
  padding: 40rpx;
}
.loading-text {
  font-size: 26rpx;
  color: var(--text-gray);
}
</style>
