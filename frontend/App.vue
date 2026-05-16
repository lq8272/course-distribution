<script>
import { wsManager } from '@/utils/ws';

export default {
  onLaunch() {
    console.log('App Launch');
    // 有 token 时自动建立 WebSocket 连接
    if (uni.getStorageSync('token')) {
      wsManager.connect();
    }
  },
  onShow() {
    console.log('App Show')
  },
  onHide() {
    console.log('App Hide')
  }
}
</script>

<style lang="scss">
@import "@/common/styles/base.scss";

page {
  background-color: #F5F5F5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.container {
  padding: 24rpx;
}
</style>
