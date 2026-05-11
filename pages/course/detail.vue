<template>
  <view class="page">
    <!-- 课程封面 -->
    <view class="course-cover">
      <image :src="course.cover" mode="aspectFill" />
      <view class="course-cover__tag">
        <text class="tag tag--primary" v-if="course.isDistribution">分销课程</text>
      </view>
    </view>
    
    <!-- 课程信息 -->
    <view class="course-info card">
      <view class="course-info__title">{{ course.title }}</view>
      <view class="course-info__meta">
        <text class="sales">{{ course.sales }}人已购</text>
        <text class="divider">|</text>
        <text class="category">{{ course.category }}</text>
      </view>
      <view class="course-info__price">
        <text class="current">¥{{ course.price }}</text>
        <text v-if="course.originalPrice" class="original">¥{{ course.originalPrice }}</text>
        <text class="discount">{{ discount }}折</text>
      </view>
    </view>
    
    <!-- 分销信息 -->
    <view class="distribution-info card" v-if="course.isDistribution">
      <view class="section-title">
        <text class="icon">💰</text>
        <text>分销佣金</text>
      </view>
      <view class="commission-rules">
        <view class="rule-item">
          <text class="rule-label">直接推广佣金</text>
          <text class="rule-value primary">{{ course.level1Commission }}%</text>
        </view>
        <view class="rule-item">
          <text class="rule-label">二级管理奖</text>
          <text class="rule-value">{{ course.level2Commission }}%</text>
        </view>
        <view class="rule-item">
          <text class="rule-label">三级管理奖</text>
          <text class="rule-value">{{ course.level3Commission }}%</text>
        </view>
      </view>
      <view class="commission-preview">
        <view class="commission-preview__item">
          <text class="label">预估佣金</text>
          <text class="value">¥{{ course.commission }}</text>
        </view>
        <view class="commission-preview__item">
          <text class="label">你的收益</text>
          <text class="value highlight">¥{{ course.commission }}</text>
        </view>
      </view>
    </view>
    
    <!-- 课程大纲 -->
    <view class="course-outline card">
      <view class="section-title">
        <text class="icon">📚</text>
        <text>课程大纲</text>
      </view>
      <view class="outline-list">
        <view v-for="(chapter, index) in course.outline" :key="index" class="outline-item">
          <view class="outline-item__num">{{ index + 1 }}</view>
          <view class="outline-item__content">
            <view class="outline-item__title">{{ chapter.title }}</view>
            <view class="outline-item__duration">{{ chapter.duration }}</view>
          </view>
          <view class="outline-item__icon">▶</view>
        </view>
      </view>
    </view>
    
    <!-- 课程简介 -->
    <view class="course-intro card">
      <view class="section-title">
        <text class="icon">📝</text>
        <text>课程简介</text>
      </view>
      <view class="intro-content">
        {{ course.intro }}
      </view>
    </view>
    
    <!-- 底部操作 -->
    <view class="bottom-actions">
      <view class="action-icons">
        <view class="action-icon" @click="toggleFavorite">
          <text>{{ isFavorite ? '❤️' : '🤍' }}</text>
          <text class="label">收藏</text>
        </view>
        <view class="action-icon" @click="sharePoster">
          <text>📤</text>
          <text class="label">分享</text>
        </view>
      </view>
      <view class="action-buttons">
        <view class="btn-buy" @click="handleBuy">立即购买 ¥{{ course.price }}</view>
      </view>
    </view>
  </view>
</template>

<script>
import { courseApi } from '../../api/course';
import { orderApi } from '../../api/order';
import { useUserStore } from '../../store/user';

export default {
  data() {
    return {
      isFavorite: false,
      course: {
        id: null,
        title: '',
        cover: '',
        price: 0,
        originalPrice: 0,
        sales: 0,
        category: '',
        isDistribution: false,
        level1Commission: 0,
        level2Commission: 0,
        level3Commission: 0,
        commission: 0,
        outline: [],
        intro: ''
      }
    }
  },
  computed: {
    discount() {
      if (!this.course.originalPrice) return 0;
      return Math.round((this.course.price / this.course.originalPrice) * 100 / 10)
    }
  },
  onLoad(options) {
    if (options.id) {
      this.loadCourse(options.id);
    }
  },
  methods: {
    async loadCourse(id) {
      try {
        const c = await courseApi.detail(id);
        this.course = {
          id: c.id,
          title: c.title || '',
          cover: c.cover_image || '',
          price: c.price || 0,
          originalPrice: c.original_price || 0,
          sales: c.sales_count || 0,
          category: c.category_name || '',
          isDistribution: !!(c.commission),
          level1Commission: c.level1_commission || 0,
          level2Commission: c.level2_commission || 0,
          level3Commission: c.level3_commission || 0,
          commission: c.commission || 0,
          outline: c.outline || [],
          intro: c.description || ''
        };
      } catch (e) {
        console.error('loadCourse error', e);
      }
    },
    toggleFavorite() {
      this.isFavorite = !this.isFavorite
      uni.showToast({
        title: this.isFavorite ? '收藏成功' : '取消收藏',
        icon: 'none'
      })
    },
    sharePoster() {
      uni.showToast({
        title: '生成分享海报',
        icon: 'none'
      })
    },
    handleBuy() {
      const userStore = useUserStore();
      if (!userStore.isLoggedIn) {
        uni.showToast({ title: '请先登录', icon: 'none' });
        uni.switchTab({ url: '/pages/login/index' });
        return;
      }
      uni.showModal({
        title: '确认购买',
        content: `确定要购买该课程吗？支付 ¥${this.course.price}`,
        success: async (res) => {
          if (res.confirm) {
            try {
              const orderId = await orderApi.create({
                courseId: this.course.id
              });
              uni.showToast({ title: '订单已创建', icon: 'success' });
              setTimeout(() => {
                uni.switchTab({ url: '/pages/user/index' });
              }, 1500);
            } catch (e) {
              uni.showToast({ title: '创建订单失败', icon: 'none' });
            }
          }
        }
      });
    }
  }
}
</script>

<style lang="scss" scoped>
.page { padding-bottom: 140rpx; background: var(--bg-light); }

.course-cover { position: relative; width: 100%; height: 480rpx; image { width: 100%; height: 100%; } &__tag { position: absolute; top: 24rpx; left: 24rpx; } }

.card { margin: 24rpx; background: var(--bg-white); border-radius: var(--border-radius); padding: 24rpx; box-shadow: var(--shadow-sm); }

.section-title { display: flex; align-items: center; font-size: 28rpx; font-weight: 500; color: var(--text-primary); margin-bottom: 20rpx; .icon { margin-right: 12rpx; } }

.course-info {
  &__title { font-size: 32rpx; font-weight: 500; color: var(--text-primary); line-height: 1.5; margin-bottom: 16rpx; }
  &__meta { font-size: 24rpx; color: var(--text-gray); margin-bottom: 20rpx; .divider { margin: 0 16rpx; } }
  &__price { display: flex; align-items: baseline; .current { font-size: 48rpx; font-weight: bold; color: var(--price-color); } .original { font-size: 26rpx; color: var(--text-gray); text-decoration: line-through; margin-left: 16rpx; } .discount { margin-left: 16rpx; background: color-mix(in srgb, var(--price-color) 10%, transparent); color: var(--price-color); padding: 4rpx 12rpx; border-radius: 8rpx; font-size: 22rpx; } }
}

.commission-rules { display: flex; justify-content: space-between; margin-bottom: 24rpx; }

.rule-item { text-align: center; .rule-label { display: block; font-size: 22rpx; color: var(--text-gray); margin-bottom: 8rpx; } .rule-value { font-size: 32rpx; font-weight: bold; color: var(--text-secondary); &.primary { color: var(--price-color); } } }

.commission-preview { display: flex; background: linear-gradient(135deg, color-mix(in srgb, var(--price-color) 10%, transparent) 0%, color-mix(in srgb, var(--price-color) 10%, transparent) 100%); border-radius: 12rpx; padding: 20rpx; &__item { flex: 1; text-align: center; .label { display: block; font-size: 22rpx; color: var(--text-gray); margin-bottom: 8rpx; } .value { font-size: 36rpx; font-weight: bold; color: var(--text-primary); &.highlight { color: var(--price-color); } } } }

.outline-list { .outline-item { display: flex; align-items: center; padding: 20rpx 0; border-bottom: 1rpx solid var(--border-color); &:last-child { border-bottom: none; } &__num { width: 48rpx; height: 48rpx; background: var(--bg-light); border-radius: 50%; text-align: center; line-height: 48rpx; font-size: 24rpx; color: var(--text-secondary); margin-right: 16rpx; } &__content { flex: 1; } &__title { font-size: 26rpx; color: var(--text-primary); margin-bottom: 4rpx; } &__duration { font-size: 22rpx; color: var(--text-gray); } &__icon { font-size: 20rpx; color: var(--text-gray); } } }

.intro-content { font-size: 26rpx; color: var(--text-secondary); line-height: 1.8; }

.bottom-actions { position: fixed; bottom: 0; left: 0; right: 0; display: flex; align-items: center; background: var(--bg-white); padding: 16rpx 24rpx; padding-bottom: calc(16rpx + env(safe-area-inset-bottom)); box-shadow: 0 -2rpx 10rpx rgba(0,0,0,0.05); .action-icons { display: flex; margin-right: 32rpx; } .action-icon { display: flex; flex-direction: column; align-items: center; margin-right: 32rpx; font-size: 20rpx; color: var(--text-secondary); .label { margin-top: 4rpx; } } .btn-buy { flex: 1; background: linear-gradient(135deg, var(--price-color) 0%, var(--price-color) 100%); color: #FFFFFF; border-radius: 44rpx; text-align: center; padding: 24rpx 0; font-size: 30rpx; font-weight: 500; } }
</style>
