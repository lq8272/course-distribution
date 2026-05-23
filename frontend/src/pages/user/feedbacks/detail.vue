<template>
  <view class="page">
    <!-- 状态+类型 -->
    <view class="status-bar">
      <view :class="['type-tag', 'type-' + detail.type]">{{ typeMap[detail.type] }}</view>
      <view :class="['status-tag', 'status-' + detail.status]">{{ statusMap[detail.status] }}</view>
    </view>

    <!-- 反馈内容 -->
    <view class="section">
      <view class="section-title">反馈内容</view>
      <view class="content-card">
        <text class="content-text">{{ detail.content }}</text>
        <text class="time">{{ formatTime(detail.created_at) }}</text>
      </view>
    </view>

    <!-- 处理回复 -->
    <view class="section">
      <view class="section-title">处理回复</view>
      <view v-if="detail.reply" class="reply-card">
        <text class="reply-text">{{ detail.reply }}</text>
        <text class="reply-time">{{ formatTime(detail.updated_at) }}</text>
      </view>
      <view v-else class="no-reply">
        <text>暂无回复，请耐心等待</text>
      </view>
    </view>

    <!-- 关联客服会话 -->
    <view v-if="detail.conversation_id" class="section">
      <view class="section-title">关联会话</view>
      <view class="conv-card" @click="goConversation">
        <text class="conv-label">查看客服会话记录</text>
        <text class="arrow">›</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { feedbackApi } from '@/api/service.js';

const detail = ref({});

const statusMap = { 0: '待处理', 1: '处理中', 2: '已处理', 3: '已忽略' };
const typeMap = { bug: '功能异常', suggest: '体验建议', other: '其他' };

onLoad(async (opts) => {
  if (!opts.id) return;
  try {
    detail.value = await feedbackApi.detail(opts.id);
  } catch (e) {
    uni.showToast({ title: '加载失败', icon: 'none' });
  }
});

function goConversation() {
  if (detail.value.conversation_id) {
    uni.navigateTo({ url: `/pages/service/chat?conversationId=${detail.value.conversation_id}` });
  }
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}
</script>

<style lang="scss" scoped>
@import "@/common/styles/base.scss";

.page { min-height: 100vh; background: $bg-light; padding: 24rpx; }

.status-bar {
  display: flex; gap: 16rpx; margin-bottom: 24rpx;
}

.type-tag, .status-tag {
  padding: 8rpx 24rpx; border-radius: 16rpx; font-size: 24rpx;
}
.type-bug { background: rgba(255,59,48,0.1); color: #ff3b30; }
.type-suggest { background: rgba(0,122,255,0.1); color: #007aff; }
.type-other { background: rgba(142,142,147,0.1); color: #8e8e93; }
.status-0 { background: rgba(255,107,0,0.1); color: #ff6b00; }
.status-1 { background: rgba(0,122,255,0.1); color: #007aff; }
.status-2 { background: rgba(52,199,89,0.1); color: #34c759; }
.status-3 { background: rgba(142,142,147,0.1); color: #8e8e93; }

.section { margin-bottom: 24rpx; }
.section-title {
  font-size: 26rpx; font-weight: 600; color: $text-secondary; margin-bottom: 12rpx;
}

.content-card, .reply-card {
  background: #fff; border-radius: 16rpx; padding: 24rpx;
}
.content-text { font-size: 28rpx; color: $text-primary; line-height: 1.8; display: block; }
.time { font-size: 22rpx; color: $text-gray; margin-top: 12rpx; display: block; text-align: right; }

.reply-card .reply-text { font-size: 28rpx; color: $primary-color; line-height: 1.8; display: block; }
.reply-time { font-size: 22rpx; color: $text-gray; margin-top: 12rpx; display: block; text-align: right; }

.no-reply {
  background: #fff; border-radius: 16rpx; padding: 48rpx; text-align: center;
  text { font-size: 26rpx; color: $text-gray; }
}

.conv-card {
  background: #fff; border-radius: 16rpx; padding: 24rpx;
  display: flex; justify-content: space-between; align-items: center;
  .conv-label { font-size: 28rpx; color: $primary-color; }
  .arrow { font-size: 32rpx; color: $primary-color; }
}
</style>
