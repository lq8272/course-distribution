<template>
  <view class="page">
    <view class="conv-list">
      <view v-for="c in conversations" :key="c.id" class="conv-item" @click="openChat(c)">
        <view class="subject">{{ c.subject || c.type }}</view>
        <view class="last">{{ c.last_content }}</view>
      </view>
      <view v-if="!conversations.length" class="empty">暂无会话</view>
    </view>
    <button class="new-btn" @click="createNew">新建会话</button>
  </view>
</template>

<script setup>
import { ref, onShow } from 'vue';
import { useUserStore } from '../../store/user';
import { serviceApi } from '../../api/service';

const userStore = useUserStore();
const conversations = ref([]);

onShow(async () => {
  if (!userStore.isLoggedIn) return;
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
<style scoped>
.page { display: flex; flex-direction: column; height: 100vh; background: var(--bg-light); }
.conv-list { flex: 1; }
.conv-item { background: var(--bg-white); padding: 24rpx; border-bottom: 1rpx solid var(--border-color); }
.subject { font-weight: 500; margin-bottom: 8rpx; font-size: 28rpx; color: var(--text-primary); }
.last { font-size: 24rpx; color: var(--text-gray); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.empty { text-align: center; color: var(--text-gray); padding: 100rpx; }
.new-btn { margin: 16rpx; background: var(--accent-blue); color: #fff; border-radius: 44rpx; }
</style>
