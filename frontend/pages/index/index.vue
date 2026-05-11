<template>
  <view class="page">

    <!-- Banner 轮播 -->
    <view class="banner-section">
      <swiper class="banner-swiper" autoplay circular indicator-dots indicator-active-color="#FF6B00">
        <swiper-item>
          <view class="banner-item banner-1">
            <view class="banner-decoration">
              <view class="b-deco b-deco-1"></view>
              <view class="b-deco b-deco-2"></view>
            </view>
            <view class="banner-content">
              <view class="banner-tag">精品课程</view>
              <view class="banner-title">学习提升从这里开始</view>
              <view class="banner-sub">海量课程 · 名师授课 · 随时学习</view>
              <view class="banner-cta">立即选购</view>
            </view>
          </view>
        </swiper-item>
        <swiper-item>
          <view class="banner-item banner-2">
            <view class="banner-decoration">
              <view class="b-deco b-deco-3"></view>
            </view>
            <view class="banner-content">
              <view class="banner-tag">分销赚钱</view>
              <view class="banner-title">分享课程赚取佣金</view>
              <view class="banner-sub">一键推广 · 实时到账 · 轻松收益</view>
              <view class="banner-cta gold-cta">成为分销商</view>
            </view>
          </view>
        </swiper-item>
      </swiper>
    </view>

    <!-- 搜索栏 -->
    <view class="search-bar-wrap">
      <view class="search-bar">
        <view class="search-icon">
          <text>🔍</text>
        </view>
        <view class="search-input" @click="goToSearch">
          <text class="placeholder">搜索你想要的课程</text>
        </view>
      </view>
    </view>

    <!-- 分类标签 -->
    <view class="categories-section">
      <scroll-view class="categories" scroll-x enhanced :show-scrollbar="false">
        <view
          v-for="(cat, index) in categories"
          :key="cat.id || index"
          :class="['category-item', currentCategory === index ? 'active' : '']"
          @click="selectCategory(index)"
        >
          <text class="cat-text">{{ cat.name }}</text>
          <view class="cat-dot" v-if="currentCategory === index"></view>
        </view>
      </scroll-view>
    </view>

    <!-- 课程列表 -->
    <view class="course-section">
      <!-- 空状态 -->
      <view v-if="!loading && courses.length === 0" class="empty-state">
        <view class="empty-icon">📚</view>
        <text class="empty-text">暂无相关课程</text>
        <text class="empty-sub">去看看其他分类吧</text>
      </view>

      <view v-else>
        <view
          v-for="course in filteredCourses"
          :key="course.id"
          class="course-card"
          @click="goToDetail(course.id)"
        >
          <!-- 封面 -->
          <view class="card-cover">
            <image class="cover-img" :src="course.cover_image || course.cover || '/static/course-placeholder.png'" mode="aspectFill" />
            <view class="cover-tag" v-if="course.is_distribution">
              <text class="cover-tag-text">分销</text>
            </view>
          </view>

          <!-- 信息 -->
          <view class="card-body">
            <text class="card-title">{{ course.title }}</text>

            <view class="card-meta">
              <view class="meta-tags">
                <text class="tag-green" v-if="course.is_distribution">分销</text>
                <text class="tag-gray">{{ course.category_name || course.category }}</text>
              </view>
            </view>

            <view class="card-bottom">
              <view class="price-wrap">
                <text class="price">¥{{ course.price }}</text>
                <text class="price-original" v-if="course.original_price">¥{{ course.original_price }}</text>
              </view>
              <text class="sales">{{ course.sales || 0 }}人已购</text>
            </view>

            <!-- 佣金提示 -->
            <view class="commission-strip" v-if="course.is_distribution && course.price">
              <view class="comm-icon">💰</view>
              <text class="comm-label">预估佣金</text>
              <text class="comm-amount">¥{{ calcCommission(course) }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 加载中 -->
      <view v-if="loading && courses.length === 0" class="loading-state">
        <text>加载中...</text>
      </view>
    </view>

  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { courseApi } from '@/api/course';

const currentCategory = ref(0);
const categories = ref([{ id: null, name: '全部' }]);
const courses = ref([]);
const loading = ref(false);

const filteredCourses = computed(() => {
  const cat = categories.value[currentCategory.value];
  if (!cat || cat.id === null) return courses.value;
  return courses.value.filter(c => String(c.category_id) === String(cat.id));
});

function calcCommission(course) {
  if (!course.commission_ratio || !course.price) return '0.00';
  return (course.price * (course.commission_ratio / 100)).toFixed(2);
}

async function loadData() {
  loading.value = true;
  try {
    const [cats, listData] = await Promise.all([
      courseApi.categories(),
      courseApi.list({ page_size: 50 }),
    ]);
    categories.value = [{ id: null, name: '全部' }, ...cats];
    courses.value = listData.rows || listData || [];
  } catch (e) {
    console.error('loadData error', e);
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function selectCategory(index) {
  currentCategory.value = index;
}

function goToDetail(id) {
  uni.navigateTo({ url: `/pages/course/detail?id=${id}` });
}

function goToSearch() {
  uni.showToast({ title: '暂未开放', icon: 'none' });
}

loadData();
</script>

<style scoped lang="scss">
$bg:            #f5f3ee;
$card:          #ffffff;
$primary:       #FF6B00;
$primary-light: #FF8533;
$gold:          #d4a843;
$text-primary:  #1c1917;
$text-secondary:#57534e;
$text-muted:    #a8a29e;
$border:        #ece8e1;
$shadow-card:   0 2rpx 16rpx rgba(0,0,0,0.06), 0 8rpx 32rpx rgba(0,0,0,0.04);

.page {
  min-height: 100vh;
  background: $bg;
}

/* ============================================
   Banner
   ============================================ */
.banner-section {
  background: $card;
}
.banner-swiper {
  height: 340rpx;
  width: 100%;
}
.banner-item {
  height: 340rpx;
  display: flex;
  align-items: center;
  padding: 0 48rpx;
  position: relative;
  overflow: hidden;
}
.banner-1 {
  background: linear-gradient(135deg, $primary 0%, $primary-light 60%, #ffb347 100%);
}
.banner-2 {
  background: linear-gradient(135deg, $primary-light 0%, $primary 60%, #ff6b35 100%);
}
.banner-decoration {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.b-deco {
  position: absolute;
  border-radius: 50%;
  opacity: 0.12;
}
.b-deco-1 {
  width: 400rpx; height: 400rpx;
  background: #fff;
  top: -150rpx; right: -100rpx;
}
.b-deco-2 {
  width: 200rpx; height: 200rpx;
  background: rgba(#fff, 0.4);
  bottom: -80rpx; right: 30%;
}
.b-deco-3 {
  width: 500rpx; height: 500rpx;
  background: rgba(#fff, 0.1);
  top: -200rpx; left: -150rpx;
}
.banner-content {
  position: relative;
  z-index: 1;
  width: 100%;
}
.banner-tag {
  display: inline-block;
  background: rgba(255,255,255,0.25);
  color: #fff;
  font-size: 20rpx;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  margin-bottom: 16rpx;
  backdrop-filter: blur(4rpx);
}
.banner-title {
  font-size: 44rpx;
  font-weight: 800;
  color: #fff;
  margin-bottom: 12rpx;
  letter-spacing: 1rpx;
}
.banner-sub {
  font-size: 24rpx;
  color: rgba(255,255,255,0.85);
  margin-bottom: 28rpx;
  letter-spacing: 1rpx;
}
.banner-cta {
  display: inline-block;
  background: #fff;
  color: $primary;
  font-size: 24rpx;
  font-weight: 600;
  padding: 12rpx 36rpx;
  border-radius: 32rpx;
}
.gold-cta {
  background: linear-gradient(135deg, $gold, #f0d078);
  color: #7d4a00;
}

/* ============================================
   搜索栏
   ============================================ */
.search-bar-wrap {
  background: $card;
  padding: 0 24rpx 20rpx;
}
.search-bar {
  display: flex;
  align-items: center;
  background: $bg;
  border-radius: 40rpx;
  padding: 0 24rpx;
  height: 72rpx;
}
.search-icon {
  margin-right: 12rpx;
  font-size: 28rpx;
  flex-shrink: 0;
}
.search-input {
  flex: 1;
}
.search-input .placeholder {
  color: $text-muted;
  font-size: 26rpx;
}

/* ============================================
   分类
   ============================================ */
.categories-section {
  background: $card;
  border-bottom: 1rpx solid $border;
  margin-bottom: 8rpx;
}
.categories {
  white-space: nowrap;
  padding: 16rpx 16rpx 20rpx;
}
.category-item {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  padding: 10rpx 28rpx;
  margin-left: 8rpx;
  position: relative;
}
.cat-text {
  font-size: 26rpx;
  color: $text-secondary;
  transition: color 0.15s;
}
.category-item.active .cat-text {
  color: $primary;
  font-weight: 600;
}
.cat-dot {
  position: absolute;
  bottom: 2rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 6rpx;
  height: 6rpx;
  border-radius: 50%;
  background: $primary;
}

/* ============================================
   课程卡片
   ============================================ */
.course-section {
  padding: 16rpx 24rpx 40rpx;
}

.course-card {
  background: $card;
  border-radius: 24rpx;
  box-shadow: $shadow-card;
  overflow: hidden;
  margin-bottom: 20rpx;
  display: flex;
  flex-direction: column;
}

/* 封面 */
.card-cover {
  position: relative;
  height: 320rpx;
  overflow: hidden;
  background: linear-gradient(135deg, #f0ede8 0%, #e8e4dc 100%);
}
.cover-img {
  width: 100%;
  height: 100%;
  display: block;
}
.cover-tag {
  position: absolute;
  top: 16rpx;
  left: 16rpx;
  background: linear-gradient(135deg, $primary, $primary-light);
  border-radius: 8rpx;
  padding: 4rpx 12rpx;
}
.cover-tag-text {
  font-size: 18rpx;
  color: #fff;
  font-weight: 600;
}

/* 内容 */
.card-body {
  padding: 24rpx;
}
.card-title {
  font-size: 28rpx;
  font-weight: 600;
  color: $text-primary;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 14rpx;
}
.card-meta {
  margin-bottom: 14rpx;
}
.meta-tags {
  display: flex;
  gap: 10rpx;
}
.tag-green {
  font-size: 20rpx;
  color: $primary;
  background: rgba($primary, 0.08);
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
}
.tag-gray {
  font-size: 20rpx;
  color: $text-muted;
  background: #f5f3ee;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
}
.card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.price-wrap {
  display: flex;
  align-items: baseline;
  gap: 10rpx;
}
.price {
  font-size: 38rpx;
  font-weight: 800;
  color: $primary;
}
.price-original {
  font-size: 22rpx;
  color: $text-muted;
  text-decoration: line-through;
}
.sales {
  font-size: 22rpx;
  color: $text-muted;
}

/* 佣金条 */
.commission-strip {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid $border;
}
.comm-icon {
  font-size: 22rpx;
}
.comm-label {
  font-size: 22rpx;
  color: $text-muted;
}
.comm-amount {
  font-size: 24rpx;
  color: $gold;
  font-weight: 600;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0;
  gap: 16rpx;
}
.empty-icon {
  font-size: 80rpx;
}
.empty-text {
  font-size: 28rpx;
  font-weight: 600;
  color: $text-secondary;
}
.empty-sub {
  font-size: 24rpx;
  color: $text-muted;
}
.loading-state {
  text-align: center;
  padding: 40rpx;
  color: $text-muted;
  font-size: 26rpx;
}
</style>
