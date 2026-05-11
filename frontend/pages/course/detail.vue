<template>
  <view class="page">
    <!-- 课程封面 -->
    <view class="course-cover">
      <image :src="course.cover_image || course.cover" mode="aspectFill" />
      <view class="course-cover__tag">
        <text class="tag tag--primary" v-if="course.is_distribution">分销课程</text>
      </view>
    </view>

    <!-- ========== 视频播放区 ========== -->

    <!-- 方案A：无权限时显示封面 + 试看按钮 -->
    <view class="video-section card"
      v-if="course.video_key && !signedVideoSrc && !videoLoading && !canWatchFull"
    >
      <view class="video-cover-wrapper" @click="handleTrialPlay">
        <image :src="course.cover_image" mode="aspectFill" class="video-cover-img" />
        <!-- 试看遮罩 -->
        <view class="trial-overlay">
          <view class="trial-overlay__icon">▶</view>
          <text class="trial-overlay__text">免费试看15秒</text>
        </view>
        <!-- 未解锁提示 -->
        <view class="unlock-hint" v-if="!course.is_bought && !course.is_free">
          <text>购买后可观看完整课程</text>
        </view>
      </view>
    </view>

    <!-- 方案B：已加载签名 URL 后显示播放器 -->
    <view class="video-section card" v-else-if="course.video_key && signedVideoSrc">
      <video
        class="video-player"
        :src="signedVideoSrc"
        :poster="course.cover_image"
        controls
        show-fullscreen-btn
        object-fit="contain"
        enable-danmu
        danmu-list="{{[]}}"
        @timeupdate="onTimeUpdate"
        @ended="onVideoEnded"
        @error="handleVideoError"
        @waiting="videoWaiting = true"
        @playing="videoWaiting = false"
      />

      <!-- 视频缓冲加载动画 -->
      <view class="video-waiting" v-if="videoWaiting">
        <view class="spinner"></view>
        <text>加载中...</text>
      </view>

      <!-- 试看结束遮罩（15秒到时） -->
      <view class="trial-end-overlay" v-if="trialEnded">
        <view class="trial-end-overlay__mask"></view>
        <view class="trial-end-overlay__content">
          <view class="trial-end-overlay__icon">🔒</view>
          <text class="trial-end-overlay__title">试看结束</text>
          <text class="trial-end-overlay__sub">购买课程后解锁完整内容</text>
          <view class="trial-end-overlay__price" v-if="!course.is_free">
            <text class="yen">¥</text>
            <text class="amount">{{ course.price }}</text>
          </view>
          <view class="trial-end-overlay__btn" @click="handleBuy">
            {{ course.is_free ? '立即学习' : '立即购买' }}
          </view>
          <text class="trial-end-overlay__tip" v-if="!course.is_free">支付 ¥{{ course.price }} 解锁完整课程</text>
        </view>
      </view>
    </view>

    <!-- 方案C：正在加载签名 URL -->
    <view class="video-section card" v-else-if="videoLoading">
      <view class="video-loading">
        <view class="spinner"></view>
        <text class="loading-text">正在加载视频...</text>
        <text class="loading-sub">获取播放权限中</text>
      </view>
    </view>

    <!-- 方案D：无视频或无权限 -->
    <view class="video-locked card"
      v-else-if="course.id && !course.video_key && !course.is_free">
      <view class="video-locked__icon">
        <text>🔒</text>
      </view>
      <text class="video-locked__text">购买后可观看视频</text>
    </view>

    <!-- 课程信息 -->
    <view class="course-info card">
      <view class="course-info__title">{{ course.title }}</view>
      <view class="course-info__meta">
        <text class="sales">{{ course.sales || 0 }}人已购</text>
        <text class="divider">|</text>
        <text class="category">{{ course.category_name || '' }}</text>
      </view>
      <view class="course-info__price">
        <text class="current">¥{{ course.price }}</text>
        <text v-if="course.original_price" class="original">¥{{ course.original_price }}</text>
        <text v-if="course.original_price" class="discount">{{ calcDiscount() }}折</text>
      </view>
    </view>

    <!-- 分销信息 -->
    <view class="distribution-info card" v-if="course.is_distribution">
      <view class="section-header">
        <view class="section-header__bar"></view>
        <text class="section-header__label">分销佣金</text>
      </view>
      <view class="commission-rules">
        <view class="rule-item">
          <text class="rule-label">直接推广佣金</text>
          <text class="rule-value primary">{{ course.commission_ratio || 0 }}%</text>
        </view>
        <view class="rule-item">
          <text class="rule-label">二级管理奖</text>
          <text class="rule-value">{{ course.level2_ratio || 0 }}%</text>
        </view>
        <view class="rule-item">
          <text class="rule-label">三级管理奖</text>
          <text class="rule-value">{{ course.level3_ratio || 0 }}%</text>
        </view>
      </view>
      <view class="commission-preview">
        <view class="commission-preview__item">
          <text class="label">课程价格</text>
          <text class="value">¥{{ course.price }}</text>
        </view>
        <view class="commission-preview__item">
          <text class="label">你的收益</text>
          <text class="value highlight">¥{{ calcCommission() }}</text>
        </view>
      </view>
    </view>

    <!-- 课程简介 -->
    <view class="course-intro card" v-if="course.description">
      <view class="section-header">
        <view class="section-header__bar"></view>
        <text class="section-header__label">课程简介</text>
      </view>
      <view class="intro-content">
        {{ course.description }}
      </view>
    </view>

    <!-- 底部操作 -->
    <view class="bottom-actions">
      <view class="action-icons">
        <view class="action-icon" @click="toggleFavorite">
          <view class="action-icon__box">
            <text>{{ isFavorite ? '❤️' : '🤍' }}</text>
          </view>
          <text class="label">收藏</text>
        </view>
        <view class="action-icon" @click="sharePoster">
          <view class="action-icon__box">
            <text>📤</text>
          </view>
          <text class="label">分享</text>
        </view>
      </view>
      <view class="action-buttons">
        <view v-if="buyButton.disabled" class="btn-buy btn-buy--disabled">{{ buyButton.text }}</view>
        <view v-else class="btn-buy" @click="handleBuy">{{ buyButton.text }}</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { courseApi } from '@/api/course';
import { orderApi } from '@/api/order';
import { videoApi } from '@/api/video';
import { useUserStore } from '@/store/user';

const userStore = useUserStore();
const courseId = ref(null);
const course = ref({});
const isFavorite = ref(false);
const loading = ref(false);
const promotionCode = ref('');

// 视频签名 URL 状态
const signedVideoSrc = ref('');
const videoLoading = ref(false);
const videoWaiting = ref(false);

// 试看功能
const TRIAL_SECONDS = 15; // 试看15秒
const trialEnded = ref(false);   // 试看是否已结束
const trialCountdown = ref(TRIAL_SECONDS);
let trialTimer = null;
let trialVideoContext = null;

// 是否有权限看完整视频
const canWatchFull = computed(() => {
  const c = course.value;
  if (!c || !c.video_key) return false;
  if (c.is_free === 1) return true;      // 免费课
  if (userStore.isAdmin.value) return true; // 管理员
  if (c.is_bought) return true;           // 已购买
  return false;
});

const buyButton = computed(() => {
  const c = course.value;
  const isAdmin = userStore.isAdmin.value;
  if (c.is_free === 1) {
    return { text: '免费学习', disabled: true };
  }
  if (isAdmin) {
    return { text: '管理员不可购买', disabled: true };
  }
  if (c.has_pending_order) {
    return { text: '已购买（待审核）', disabled: true };
  }
  if (c.is_bought) {
    return { text: '已购买', disabled: true };
  }
  return { text: `立即购买 ¥${c.price || 0}`, disabled: false };
});

function calcDiscount() {
  if (!course.value.original_price || !course.value.price) return '';
  return Math.round((course.value.price / course.value.original_price) * 100) / 10;
}

function calcCommission() {
  if (!course.value.commission_ratio || !course.value.price) return '0.00';
  return (course.value.price * (course.value.commission_ratio / 100)).toFixed(2);
}

async function loadCourse(id) {
  loading.value = true;
  try {
    const data = await courseApi.detail(id);
    course.value = data || {};
  } catch (e) {
    console.error('loadCourse error', e);
    const msg = (e && e.message) || '课程加载失败，请稍后重试';
    uni.showToast({ title: msg, icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function toggleFavorite() {
  isFavorite.value = !isFavorite.value;
  uni.showToast({
    title: isFavorite.value ? '收藏成功' : '取消收藏',
    icon: 'none'
  });
}

// 试看播放：请求签名 URL → 加载播放器 → 开始15秒倒计时
async function handleTrialPlay() {
  if (!course.value.video_key) return;
  videoLoading.value = true;
  trialEnded.value = false;
  trialCountdown.value = TRIAL_SECONDS;
  try {
    signedVideoSrc.value = await videoApi.playUrl(course.value.video_key);
    // 等待 video 组件渲染后创建上下文
    setTimeout(() => {
      trialVideoContext = uni.createVideoContext('trial-video');
    }, 200);
  } catch (e) {
    console.error('handleTrialPlay error', e);
    uni.showToast({ title: '视频加载失败', icon: 'none' });
    videoLoading.value = false;
  }
}

// 点击正式购买/试看结束后购买
async function handleBuy() {
  if (buyButton.value.disabled) return;
  const token = uni.getStorageSync('token');
  if (!token) {
    uni.navigateTo({ url: '/pages/login/index' + (promotionCode.value ? '?code=' + promotionCode.value : '') });
    return;
  }
  uni.showModal({
    title: '确认购买',
    content: `确定要购买该课程吗？支付 ¥${course.value.price}`,
    success: async (res) => {
      if (res.confirm) {
        try {
          uni.showLoading({ title: '下单中...' });
          await orderApi.create({ course_id: course.value.id, promotion_code: promotionCode.value });
          uni.hideLoading();
          uni.showToast({ title: '下单成功，等待管理员确认', icon: 'none' });
          course.value.has_pending_order = true;
          setTimeout(() => {
            uni.navigateTo({ url: '/pages/order/list' });
          }, 1500);
        } catch (e) {
          uni.hideLoading();
          console.error('create order error', e);
          uni.showToast({ title: (e && e.message) || '下单失败', icon: 'none' });
        }
      }
    }
  });
}

// video 组件 timeupdate 事件：检测试看时间
function onTimeUpdate(e) {
  const currentTime = e.detail.currentTime;
  // 试看逻辑：非完整权限用户看到15秒就停止
  if (!canWatchFull.value && currentTime >= TRIAL_SECONDS) {
    stopTrial();
  }
}

// 停止试看，显示解锁遮罩
function stopTrial() {
  if (trialEnded.value) return; // 防止重复触发
  trialEnded.value = true;
  // 暂停视频
  if (trialVideoContext) {
    trialVideoContext.pause();
  }
  clearInterval(trialTimer);
}

function onVideoEnded() {
  if (!canWatchFull.value) {
    trialEnded.value = true;
  }
}

function handleVideoError(e) {
  console.error('video error', e);
  signedVideoSrc.value = '';
  trialEnded.value = false;
  clearInterval(trialTimer);
  uni.showToast({ title: '视频播放失败，请重试', icon: 'none' });
}

function sharePoster() {
  uni.showToast({ title: '分享功能开发中', icon: 'none' });
}

onLoad((options) => {
  courseId.value = options.id;
  promotionCode.value = options.code || '';
  if (courseId.value) {
    loadCourse(courseId.value);
  }
});
</script>

<style lang="scss" scoped>
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
  padding-bottom: 140rpx;
}

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

.course-cover {
  position: relative;
  width: 100%;
  height: 480rpx;
}
.course-cover image {
  width: 100%;
  height: 100%;
}
.course-cover__tag {
  position: absolute;
  top: 24rpx;
  left: 24rpx;
}

// Video Section
.video-section {
  margin: 0;
  border-radius: 0;
  box-shadow: none;
  padding: 0;
  position: relative;
}
.video-section .video-player {
  width: 100%;
  height: 420rpx;
  display: block;
}
.video-section .video-cover-wrapper {
  position: relative;
  width: 100%;
  height: 420rpx;
  background: #000;
}
.video-section .video-cover-wrapper .video-cover-img {
  width: 100%;
  height: 100%;
  opacity: 0.6;
}

// 试看遮罩
.trial-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.trial-overlay__icon {
  width: 100rpx;
  height: 100rpx;
  background: rgba(255,255,255,0.9);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  color: $primary;
  margin-bottom: 16rpx;
}
.trial-overlay__text {
  font-size: 26rpx;
  color: #fff;
  background: rgba($primary, 0.7);
  padding: 6rpx 20rpx;
  border-radius: 24rpx;
}

// 未解锁提示
.unlock-hint {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  background: linear-gradient(transparent, rgba(0,0,0,0.7));
  text-align: center;
  padding: 40rpx 0 20rpx;
}
.unlock-hint text {
  font-size: 24rpx;
  color: rgba(255,255,255,0.9);
}

// 视频加载中
.video-loading {
  width: 100%;
  height: 420rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #000;
  gap: 16rpx;
}
.video-loading .loading-text {
  font-size: 28rpx;
  color: rgba(255,255,255,0.9);
}
.video-loading .loading-sub {
  font-size: 22rpx;
  color: rgba(255,255,255,0.5);
}

// 视频缓冲动画
.video-waiting {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.4);
  gap: 12rpx;
  color: #fff;
  font-size: 24rpx;
  pointer-events: none;
}

// 试看结束遮罩
.trial-end-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.trial-end-overlay__mask {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.75);
}
.trial-end-overlay__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48rpx 60rpx;
  gap: 12rpx;
  width: 100%;
}
.trial-end-overlay__icon {
  font-size: 64rpx;
  margin-bottom: 8rpx;
}
.trial-end-overlay__title {
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
}
.trial-end-overlay__sub {
  font-size: 26rpx;
  color: rgba(255,255,255,0.7);
  margin-bottom: 16rpx;
}
.trial-end-overlay__price {
  display: flex;
  align-items: baseline;
  margin-bottom: 8rpx;
}
.trial-end-overlay__price .yen {
  font-size: 32rpx;
  color: #fff;
  font-weight: bold;
}
.trial-end-overlay__price .amount {
  font-size: 56rpx;
  font-weight: bold;
  color: #fff;
}
.trial-end-overlay__btn {
  width: 100%;
  background: linear-gradient(135deg, $primary 0%, $primary-light 100%);
  color: #fff;
  border-radius: 44rpx;
  text-align: center;
  padding: 24rpx 0;
  font-size: 30rpx;
  font-weight: 500;
  margin-bottom: 12rpx;
}
.trial-end-overlay__tip {
  font-size: 22rpx;
  color: rgba(255,255,255,0.5);
}

// 视频锁定
.video-locked {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 24rpx;
}
.video-locked__icon {
  width: 72rpx;
  height: 72rpx;
  background: linear-gradient(135deg, $primary 0%, $primary-light 100%);
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;
  box-shadow: $shadow-card;
}
.video-locked__icon text { font-size: 32rpx; }
.video-locked__text { font-size: 26rpx; color: $text-muted; }

// Card
.card {
  margin: 24rpx;
  background: $card;
  border-radius: 24rpx;
  padding: 24rpx;
  box-shadow: $shadow-card;
}

.course-info__title {
  font-size: 32rpx;
  font-weight: 500;
  color: $text-primary;
  line-height: 1.5;
  margin-bottom: 16rpx;
}
.course-info__meta {
  font-size: 24rpx;
  color: $text-muted;
  margin-bottom: 20rpx;
}
.course-info__meta .divider { margin: 0 16rpx; }
.course-info__price {
  display: flex;
  align-items: baseline;
}
.course-info__price .current {
  font-size: 48rpx;
  font-weight: bold;
  color: $primary;
}
.course-info__price .original {
  font-size: 26rpx;
  color: $text-muted;
  text-decoration: line-through;
  margin-left: 16rpx;
}
.course-info__price .discount {
  margin-left: 16rpx;
  background: rgba($primary, 0.1);
  color: $primary;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
}

.commission-rules {
  display: flex;
  justify-content: space-between;
  margin-bottom: 24rpx;
}
.rule-item { text-align: center; }
.rule-item .rule-label {
  display: block;
  font-size: 22rpx;
  color: $text-muted;
  margin-bottom: 8rpx;
}
.rule-item .rule-value {
  font-size: 32rpx;
  font-weight: bold;
  color: $text-secondary;
}
.rule-item .rule-value.primary { color: $primary; }

.commission-preview {
  display: flex;
  background: linear-gradient(135deg, rgba($primary, 0.1) 0%, rgba($primary-light, 0.1) 100%);
  border-radius: 16rpx;
  padding: 20rpx;
}
.commission-preview__item { flex: 1; text-align: center; }
.commission-preview__item .label {
  display: block;
  font-size: 22rpx;
  color: $text-muted;
  margin-bottom: 8rpx;
}
.commission-preview__item .value {
  font-size: 36rpx;
  font-weight: bold;
  color: $text-primary;
}
.commission-preview__item .value.highlight { color: $primary; }

.intro-content {
  font-size: 26rpx;
  color: $text-secondary;
  line-height: 1.8;
}

.bottom-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  background: $card;
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.05);
}
.bottom-actions .action-icons {
  display: flex;
  margin-right: 32rpx;
}
.bottom-actions .action-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: 32rpx;
  font-size: 20rpx;
  color: $text-secondary;
}
.bottom-actions .action-icon__box {
  width: 72rpx;
  height: 72rpx;
  background: linear-gradient(135deg, $primary 0%, $primary-light 100%);
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8rpx;
  box-shadow: $shadow-card;
}
.bottom-actions .action-icon__box text { font-size: 28rpx; }
.bottom-actions .action-icon .label {
  margin-top: 4rpx;
  color: $text-muted;
  font-size: 20rpx;
}
.bottom-actions .btn-buy {
  flex: 1;
  background: linear-gradient(135deg, $primary 0%, $primary-light 100%);
  color: #FFFFFF;
  border-radius: 44rpx;
  text-align: center;
  padding: 24rpx 0;
  font-size: 30rpx;
  font-weight: 500;
  box-shadow: $shadow-card;
}
.bottom-actions .btn-buy--disabled {
  background: #c0c0c0;
  box-shadow: none;
}

.tag {
  display: inline-block;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  font-size: 20rpx;
}
.tag--primary {
  background: rgba($primary, 0.1);
  color: $primary;
}

// ========== 加载动画 spinner ==========
.spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid rgba(255,255,255,0.2);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.spinner--dark {
  border-color: rgba($primary,0.2);
  border-top-color: $primary;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
