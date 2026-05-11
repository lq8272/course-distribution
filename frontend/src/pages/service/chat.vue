<template>
  <view class="page">
    <!-- 顶部标题栏 -->
    <view class="header">
      <text class="header-title">{{ title }}</text>
    </view>

    <!-- 消息列表 -->
    <scroll-view class="messages" scroll-y @scrolltoupper="loadMore">
      <view v-if="messages.length > 0">
        <view v-for="msg in messages" :key="msg.id" class="msg-row" :class="msg.is_mine ? 'mine' : 'other'">
          <view class="bubble" :class="msg.is_mine ? 'bubble-mine' : 'bubble-other'">
            <text>{{ msg.content }}</text>
          </view>
        </view>
      </view>
      <view v-if="!messages.length" class="empty-state">
        <text class="empty-icon">💬</text>
        <text class="empty-text">暂无消息，开始聊天吧</text>
      </view>
      <view id="bottom" style="height:1px"></view>
    </scroll-view>

    <!-- 底部输入框 -->
    <view class="input-area">
      <input
        v-model="inputText"
        class="input-field"
        placeholder="输入消息..."
        confirm-type="send"
        @confirm="send"
      />
      <view class="send-btn" @click="send">发送</view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onShow, onLoad } from '@dcloudio/uni-app';
import { onUnmounted } from 'vue';
import { useUserStore } from '@/store/user';
import { serviceApi } from '@/api/service';

const userStore = useUserStore();
const options = ref({});
const messages = ref([]);
const userId = ref(null);
const inputText = ref('');
let timer = null;

const typeMap = { consultation: '课程咨询', complaint: '投诉建议', refund: '退款申请', upgrade: '升级申请' };
const title = computed(() => typeMap[options.value.type] || '客服聊天');

onLoad(async (opts) => {
  options.value = opts;
  userId.value = userStore.userInfo && userStore.userInfo.id || null;
  loadMessages();
});

onShow(() => {
  timer = setInterval(loadMessages, 3000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
  uni.$off('ws_admin_reply');
});

// WebSocket：收到客服回复 → 追加消息，不再依赖轮询
uni.$on('ws_admin_reply', (data) => {
  if (!options.value.id) return;
  if (String(data.conversation_id) === String(options.value.id)) {
    const exists = messages.value.some(m => m.id === data.id || m.id === data.message_id);
    if (!exists) {
      messages.value.push({
        id: data.id || data.message_id,
        content: data.content,
        sender_id: data.sender_id || 0,
        is_mine: false,
        created_at: data.created_at || Math.floor(Date.now() / 1000),
      });
    }
  }
});

async function loadMessages() {
  if (!options.value.id) return;
  try {
    const rows = await serviceApi.messages(options.value.id);
    messages.value = (rows || []).map(m => ({ ...m, is_mine: m.sender_id === userId }));
  } catch (e) {
    console.error('load messages error', e);
  }
}

async function send() {
  if (!inputText.value.trim() || !options.value.id) return;
  const content = inputText.value.trim();
  inputText.value = '';
  try {
    await serviceApi.sendMessage(options.value.id, content);
    await loadMessages();
  } catch (e) {
    uni.showToast({ title: '发送失败', icon: 'none' });
  }
}
</script>

<style lang="scss" scoped>
@import "@/common/styles/base.scss";

$primary: $primary-color;
$primary-light: $secondary-color;

.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $bg-light;
}

.header {
  padding: 24rpx;
  background: $bg-white;
  font-size: 28rpx;
  font-weight: bold;
  text-align: center;
  border-bottom: 1rpx solid $border-color;
}

.messages {
  flex: 1;
  padding: 24rpx;
  overflow-y: auto;
}

.msg-row {
  display: flex;
  margin-bottom: 24rpx;
}
.msg-row.mine { justify-content: flex-end; }
.msg-row.other { justify-content: flex-start; }

.bubble {
  max-width: 70%;
  padding: 20rpx 24rpx;
  border-radius: 20rpx;
  font-size: 28rpx;
  line-height: 1.5;
  word-break: break-all;
}
.bubble-mine {
  background: linear-gradient(135deg, $primary 0%, $primary-light 100%);
  color: #fff;
}
.bubble-other {
  background: $bg-white;
  color: $text-primary;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}

.empty-state {
  text-align: center;
  padding: 120rpx 0;
  .empty-icon { display: block; font-size: 96rpx; margin-bottom: 24rpx; }
  .empty-text { display: block; font-size: 28rpx; color: $text-gray; }
}

.input-area {
  display: flex;
  align-items: center;
  padding: 16rpx 24rpx;
  background: $bg-white;
  border-top: 1rpx solid $border-color;
  gap: 16rpx;
}

.input-field {
  flex: 1;
  padding: 16rpx 24rpx;
  border: 1rpx solid $border-color;
  border-radius: 40rpx;
  font-size: 28rpx;
  background: $bg-light;
}

.send-btn {
  background: linear-gradient(135deg, $primary 0%, $primary-light 100%);
  color: #fff;
  font-size: 28rpx;
  padding: 16rpx 36rpx;
  border-radius: 40rpx;
  flex-shrink: 0;
}
</style>