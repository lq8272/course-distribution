<template>
  <view class="page">
    <!-- Section Header -->
    <view class="section-header">
      <view class="section-bar"></view>
      <text class="section-label">我的会话</text>
    </view>

    <!-- 会话列表 -->
    <view class="conv-list">
      <view v-if="conversations.length > 0">
        <view v-for="c in conversations" :key="c.id" class="conv-item" @click="openChat(c)">
          <view class="conv-icon">
            <text>{{ getTypeEmoji(c.type) }}</text>
          </view>
          <view class="conv-body">
            <view class="conv-subject">{{ c.subject || getTypeName(c.type) }}</view>
            <view class="conv-last">{{ c.last_content || '暂无消息' }}</view>
          </view>
          <view class="conv-arrow">›</view>
        </view>
      </view>
      <!-- 空状态 -->
      <view v-if="!conversations.length" class="empty-state">
        <text class="empty-icon">💬</text>
        <text class="empty-text">暂无会话记录</text>
        <view class="empty-btn" @click="createNew">新建会话</view>
      </view>
    </view>

    <!-- 新建会话按钮 -->
    <view class="bottom-action">
      <view class="btn-new" @click="createNew">+ 新建会话</view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useUserStore } from '@/store/user';
import { serviceApi } from '@/api/service';

const userStore = useUserStore();
const conversations = ref([]);

const typeMap = {
  consultation: '课程咨询',
  complaint: '投诉建议',
  refund: '退款申请',
  upgrade: '升级申请',
};

const typeEmoji = {
  consultation: '📚',
  complaint: '⚠️',
  refund: '💰',
  upgrade: '📈',
};

function getTypeName(type) {
  return typeMap[type] || '其他';
}

function getTypeEmoji(type) {
  return typeEmoji[type] || '💬';
}

onShow(async () => {
  if (!uni.getStorageSync('token')) return;
  conversations.value = await serviceApi.conversations();
});

function openChat(c) { uni.navigateTo({ url: `/pages/service/chat?id=${c.id}&type=${c.type}` }); }

async function createNew() {
  uni.showActionSheet({
    itemList: ['课程咨询', '投诉建议', '退款申请', '升级申请'],
    success: async ({ tapIndex }) => {
      const types = ['consultation', 'complaint', 'refund', 'upgrade'];
      const res = await serviceApi.createConversation({ type: types[tapIndex] });
      uni.navigateTo({ url: `/pages/service/chat?id=${res.id}&type=${types[tapIndex]}` });
    },
  });
}
</script>

<style lang="scss" scoped>
@import "@/common/styles/base.scss";

.page {
  min-height: 100vh;
  background: $bg-light;
  padding-bottom: 140rpx;
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

.conv-list {
  padding: 0 24rpx;
}

.conv-item {
  display: flex;
  align-items: center;
  background: $bg-white;
  border-radius: $border-radius;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: $shadow-sm;
}

.conv-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  flex-shrink: 0;
  text { font-size: 36rpx; }
}

.conv-body {
  flex: 1;
  overflow: hidden;
}

.conv-subject {
  font-size: 28rpx;
  font-weight: 500;
  color: $text-primary;
  margin-bottom: 8rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-last {
  font-size: 24rpx;
  color: $text-gray;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-arrow {
  font-size: 28rpx;
  color: $text-gray;
  margin-left: 12rpx;
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

.bottom-action {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16rpx 24rpx;
  background: $bg-light;
  .btn-new {
    width: 100%;
    background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
    color: #fff;
    text-align: center;
    padding: 28rpx 0;
    border-radius: 44rpx;
    font-size: 30rpx;
    font-weight: 500;
    box-shadow: 0 4rpx 20rpx rgba(255, 107, 0, 0.3);
  }
}
</style>