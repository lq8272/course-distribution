<template>
  <view class="page">
    <!-- 导航 -->
    <view class="nav-bar">
      <view class="nav-back" @click="goBack">← 返回</view>
      <text class="nav-title">帮助与反馈</text>
      <view class="nav-placeholder"></view>
    </view>

    <!-- 常见问题 -->
    <view class="section">
      <view class="section-header">
        <view class="section-bar"></view>
        <text class="section-label">常见问题</text>
      </view>
      <view class="faq-list card">
        <view
          v-for="(faq, idx) in faqList"
          :key="idx"
          :class="'faq-item ' + (faq.open ? 'faq-item--open' : '')"
          @click="toggleFaq(idx)"
        >
          <view class="faq-item__question">
            <text>{{ faq.q }}</text>
            <text class="arrow">{{ faq.open ? '↑' : '↓' }}</text>
          </view>
          <view class="faq-item__answer" v-if="faq.open">{{ faq.a }}</view>
        </view>
      </view>
    </view>

    <!-- 反馈 -->
    <view class="section">
      <view class="section-header">
        <view class="section-bar"></view>
        <text class="section-label">意见反馈</text>
      </view>
      <view class="feedback-form card">
        <textarea
          class="feedback-textarea"
          v-model="feedbackContent"
          placeholder="请输入您的意见或建议..."
          maxlength="500"
        />
        <view class="feedback-type">
          <view class="type-label">问题类型</view>
          <view class="type-options">
            <view
              v-for="t in feedbackTypes"
              :key="t.value"
              :class="'type-tag ' + (feedbackType === t.value ? 'type-tag--selected' : '')"
              @click="feedbackType = t.value"
            >
              {{ t.label }}
            </view>
          </view>
        </view>
        <view class="feedback-submit" @click="submitFeedback">提交反馈</view>
      </view>
    </view>

    <!-- 客服 -->
    <view class="section">
      <view class="section-header">
        <view class="section-bar"></view>
        <text class="section-label">联系客服</text>
      </view>
      <view class="service-card card">
        <view class="service-item" @click="contactService">
          <view class="icon-wrap">📞</view>
          <text class="label">在线客服</text>
          <text class="arrow">›</text>
        </view>
        <view class="service-item" @click="copyWechat">
          <view class="icon-wrap">💬</view>
          <text class="label">微信号</text>
          <text class="value">{{ wechatId }}</text>
          <text class="arrow">›</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const feedbackContent = ref('');
const feedbackType = ref('bug');
const wechatId = ref('course_service');

const feedbackTypes = [
  { label: '功能异常', value: 'bug' },
  { label: '体验建议', value: 'suggest' },
  { label: '其他', value: 'other' },
];

const faqList = ref([
  { q: '如何成为分销商？', a: '点击"分销"tab，进入后点击"申请加入"按钮，提交申请后等待管理员审核通过即可。', open: false },
  { q: '佣金如何提现？', a: '进入"我的-钱包"页面，点击提现按钮，输入提现金额，提交后管理员会在1-3个工作日内处理。', open: false },
  { q: '推广码如何使用？', a: '在课程详情页或分销中心，点击"复制推广链接"，将链接分享给好友，好友通过该链接购买课程后，您可获得佣金。', open: false },
  { q: '课程可以退款吗？', a: '虚拟商品一经购买不支持退款，如有特殊情况请联系客服处理。', open: false },
  { q: '如何查看我的订单？', a: '进入"我的"页面，点击"我的订单"即可查看所有订单记录。', open: false },
]);

function toggleFaq(idx) {
  faqList.value[idx].open = !faqList.value[idx].open;
}

function submitFeedback() {
  if (!feedbackContent.value.trim()) {
    uni.showToast({ title: '请输入反馈内容', icon: 'none' });
    return;
  }
  uni.showToast({ title: '反馈已提交，感谢您的建议！', icon: 'success' });
  feedbackContent.value = '';
}

function contactService() {
  uni.navigateTo({ url: '/pages/service/conversations' });
}

function copyWechat() {
  uni.setClipboardData({
    data: wechatId.value,
    success: () => uni.showToast({ title: '微信号已复制', icon: 'success' }),
  });
}

function goBack() { uni.navigateBack(); }
</script>

<style lang="scss">
@import "@/common/styles/base.scss";

.page { min-height: 100vh; background: $bg-light; }

.nav-bar {
  display: flex; align-items: center; justify-content: space-between;
  height: 88rpx; padding: 0 24rpx; background: $bg-white;
  border-bottom: 1rpx solid $border-color; position: sticky; top: 0; z-index: 10;
}
.nav-back { font-size: 28rpx; color: $primary-color; min-width: 80rpx; }
.nav-title { font-size: 32rpx; font-weight: 500; color: $text-primary; }
.nav-placeholder { min-width: 80rpx; }

.section {
  padding: 16rpx 24rpx;
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

.card {
  background: $bg-white;
  border-radius: 24rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 16rpx rgba(0,0,0,0.06), 0 8rpx 32rpx rgba(0,0,0,0.04);
}

.faq-list {
  .faq-item { border-bottom: 1rpx solid $border-color; }
  .faq-item:last-child { border-bottom: none; }
  .faq-item__question {
    display: flex; justify-content: space-between; align-items: center;
    padding: 24rpx;
    font-size: 28rpx;
    color: $text-primary;
  }
  .faq-item__answer {
    padding: 0 24rpx 24rpx;
    font-size: 26rpx;
    color: $text-secondary;
    line-height: 1.8;
  }
  .faq-item .arrow {
    font-size: 24rpx;
    color: $text-gray;
    flex-shrink: 0;
    margin-left: 12rpx;
  }
}

.feedback-form {
  padding: 24rpx;
}

.feedback-textarea {
  width: 100%;
  min-height: 200rpx;
  font-size: 28rpx;
  color: $text-primary;
  background: $bg-light;
  border-radius: 16rpx;
  padding: 20rpx;
  box-sizing: border-box;
  margin-bottom: 20rpx;
}

.feedback-type { margin-bottom: 20rpx; }
.type-label { font-size: 26rpx; color: $text-gray; margin-bottom: 12rpx; }
.type-options { display: flex; gap: 16rpx; flex-wrap: wrap; }
.type-tag {
  padding: 8rpx 24rpx;
  border-radius: 20rpx;
  font-size: 24rpx;
  background: $bg-light;
  color: $text-secondary;
}
.type-tag--selected { background: rgba($primary-color, 0.1); color: $primary-color; }

.feedback-submit {
  width: 100%;
  padding: 24rpx 0;
  background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
  color: #fff;
  border-radius: 44rpx;
  text-align: center;
  font-size: 30rpx;
  font-weight: 500;
}

.service-card {
  overflow: hidden;
}

.service-item {
  display: flex;
  align-items: center;
  padding: 28rpx 24rpx;
  border-bottom: 1rpx solid $border-color;

  .icon-wrap {
    font-size: 40rpx;
    margin-right: 16rpx;
    width: 48rpx;
    text-align: center;
  }

  .label { flex: 1; font-size: 28rpx; color: $text-primary; }
  .value { font-size: 26rpx; color: $text-gray; margin-right: 8rpx; }
  .arrow { font-size: 28rpx; color: $text-gray; }
}
.service-item:last-child { border-bottom: none; }
</style>