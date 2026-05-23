<template>
  <view class="page">
    <!-- 反馈信息 -->
    <view class="section">
      <view class="section-title">反馈信息</view>
      <view class="info-card">
        <view class="info-row">
          <text class="label">用户</text>
          <text class="value">{{ detail.user_nickname || '用户' + detail.user_id }}</text>
        </view>
        <view class="info-row">
          <text class="label">手机</text>
          <text class="value">{{ detail.user_phone || '无' }}</text>
        </view>
        <view class="info-row">
          <text class="label">类型</text>
          <view :class="['type-tag', 'type-' + detail.type]">{{ typeMap[detail.type] }}</view>
        </view>
        <view class="info-row">
          <text class="label">状态</text>
          <view :class="['status-tag', 'status-' + detail.status]">{{ statusMap[detail.status] }}</view>
        </view>
        <view class="info-row">
          <text class="label">时间</text>
          <text class="value">{{ formatTime(detail.created_at) }}</text>
        </view>
      </view>
    </view>

    <!-- 反馈内容 -->
    <view class="section">
      <view class="section-title">反馈内容</view>
      <view class="content-card">
        <text class="content-text">{{ detail.content }}</text>
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
        <text>暂无回复</text>
      </view>
    </view>

    <!-- 回复输入（待处理/处理中状态显示） -->
    <view v-if="detail.status === 0 || detail.status === 1" class="reply-area">
      <textarea
        v-model="replyContent"
        class="reply-input"
        placeholder="请输入处理回复..."
        maxlength="1000"
      />
      <view class="action-row">
        <view
          :class="['action-btn', 'action-ignore', { disabled: submitting }]"
          @click="handleReply(3)"
        >忽略</view>
        <view
          :class="['action-btn', 'action-reply', { disabled: submitting }]"
          @click="handleReply(2)"
        >{{ submitting ? '提交中...' : '提交回复' }}</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { adminFeedbackApi } from '@/api/service.js';

const detail = ref({});
const replyContent = ref('');
const submitting = ref(false);

const statusMap = { 0: '待处理', 1: '处理中', 2: '已处理', 3: '已忽略' };
const typeMap = { bug: '功能异常', suggest: '体验建议', other: '其他' };

onLoad(async (opts) => {
  if (!opts.id) return;
  try {
    detail.value = await adminFeedbackApi.detail(opts.id);
  } catch (e) {
    console.error(e);
    uni.showToast({ title: '加载失败', icon: 'none' });
  }
});

async function handleReply(status) {
  if (status === 2 && !replyContent.value.trim()) {
    uni.showToast({ title: '请输入回复内容', icon: 'none' }); return;
  }
  submitting.value = true;
  try {
    await adminFeedbackApi.reply(detail.value.id, {
      reply: replyContent.value.trim() || '已忽略',
      status,
    });
    uni.showToast({ title: '处理成功', icon: 'success' });
    detail.value = await adminFeedbackApi.detail(detail.value.id);
  } catch (e) {
    console.error(e);
    uni.showToast({ title: '操作失败', icon: 'none' });
  } finally {
    submitting.value = false;
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

.section { margin-bottom: 24rpx; }
.section-title {
  font-size: 26rpx; font-weight: 600; color: $text-secondary;
  margin-bottom: 12rpx; text-transform: uppercase; letter-spacing: 2rpx;
}

.info-card, .content-card, .reply-card {
  background: #fff; border-radius: 16rpx; padding: 24rpx;
}
.info-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12rpx 0; border-bottom: 1rpx solid $border-color;
  &:last-child { border-bottom: none; }
  .label { font-size: 26rpx; color: $text-gray; }
  .value { font-size: 26rpx; color: $text-primary; }
}

.type-tag, .status-tag {
  padding: 4rpx 16rpx; border-radius: 12rpx; font-size: 22rpx;
}
.type-bug { background: rgba(255,59,48,0.1); color: #ff3b30; }
.type-suggest { background: rgba(0,122,255,0.1); color: #007aff; }
.type-other { background: rgba(142,142,147,0.1); color: #8e8e93; }
.status-0 { background: rgba(255,107,0,0.1); color: #ff6b00; }
.status-1 { background: rgba(0,122,255,0.1); color: #007aff; }
.status-2 { background: rgba(52,199,89,0.1); color: #34c759; }
.status-3 { background: rgba(142,142,147,0.1); color: #8e8e93; }

.content-card { }
.content-text { font-size: 28rpx; color: $text-primary; line-height: 1.8; }

.reply-card {
  .reply-text { font-size: 28rpx; color: $primary-color; line-height: 1.8; display: block; }
  .reply-time { font-size: 22rpx; color: $text-gray; margin-top: 12rpx; display: block; text-align: right; }
}

.no-reply {
  background: #fff; border-radius: 16rpx; padding: 48rpx; text-align: center;
  text { font-size: 26rpx; color: $text-gray; }
}

.reply-area {
  background: #fff; border-radius: 16rpx; padding: 24rpx; margin-top: 24rpx;
}
.reply-input {
  width: 100%; min-height: 160rpx; background: $bg-light;
  border-radius: 12rpx; padding: 20rpx; font-size: 28rpx;
  color: $text-primary; box-sizing: border-box; margin-bottom: 16rpx;
}
.action-row { display: flex; gap: 16rpx; }
.action-btn {
  flex: 1; text-align: center; padding: 24rpx 0; border-radius: 44rpx;
  font-size: 28rpx; font-weight: 600;
}
.action-ignore {
  background: $bg-light; color: $text-secondary;
  &.disabled { opacity: 0.5; }
}
.action-reply {
  background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
  color: #fff; &.disabled { opacity: 0.5; }
}
</style>
