<template>
  <view class="page">
    <view v-if="!userStore.isLoggedIn">
      <view class="login-tip">
        <text>登录后查看团队信息</text>
        <button class="btn-login" @click="goLogin">去登录</button>
      </view>
    </view>
    <view v-else-if="loading" class="loading-wrap">
      <text class="loading-text">加载中...</text>
    </view>
    <view v-else>
      <!-- 团队概况卡 -->
      <view class="overview-card">
        <view class="overview-bg"></view>
        <view class="overview-content">
          <view class="my-info">
            <view class="avatar">{{ userStore.user?.nickname?.charAt(0) || '我' }}</view>
            <view class="info">
              <text class="name">{{ userStore.user?.nickname || '我' }}</text>
              <text class="role-tag">{{ isAgent ? '🎖️ 已认证分销商' : '🌱 体验用户' }}</text>
            </view>
          </view>
          <view class="divider"></view>
          <view class="stats-grid">
            <view class="stat-item">
              <text class="stat-val">{{ stats.total || 0 }}</text>
              <text class="stat-lbl">团队总人数</text>
            </view>
            <view class="stat-item">
              <text class="stat-val">{{ stats.direct || 0 }}</text>
              <text class="stat-lbl">直接下级</text>
            </view>
            <view class="stat-item">
              <text class="stat-val">{{ overview?.parent ? '1' : '0' }}</text>
              <text class="stat-lbl">上级链路</text>
            </view>
            <view class="stat-item">
              <text class="stat-val">{{ teamRoots }}</text>
              <text class="stat-lbl">团队根节点</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 上级 -->
      <view v-if="overview?.parent" class="section">
        <view class="section-title">⬆️ 我的上级</view>
        <view class="member-card parent">
          <view class="avatar sm">{{ overview.parent.nickname?.charAt(0) || '上' }}</view>
          <view class="info">
            <text class="nickname">{{ overview.parent.nickname }}</text>
            <text class="meta">上级</text>
          </view>
          <text class="arrow">›</text>
        </view>
      </view>

      <!-- 直接下级 -->
      <view class="section">
        <view class="section-title">
          ⬇️ 直接下级 ({{ children.length }})
        </view>
        <view v-if="children.length" class="member-list">
          <view v-for="child in children" :key="child.user_id" class="member-card">
            <view class="avatar sm" :style="{ background: avatarColor(child.nickname) }">
              {{ child.nickname?.charAt(0) || '?' }}
            </view>
            <view class="info">
              <text class="nickname">{{ child.nickname || '未知' }}</text>
              <text class="meta">{{ child.created_at ? '加入 ' + formatDate(child.created_at) : '' }}</text>
            </view>
            <view class="badge" :class="child.is_agent ? 'agent' : 'trial'">
              {{ child.is_agent ? '认证分销商' : '体验用户' }}
            </view>
          </view>
        </view>
        <view v-else class="empty-tip">
          <text>暂无直接下级，分享链接邀请好友加入吧～</text>
        </view>
      </view>

      <!-- 我的推广链接 -->
      <view class="section share-section">
        <view class="section-title">🔗 推广链接</view>
        <view class="share-box">
          <text class="share-url">{{ inviteLink }}</text>
        </view>
        <button class="btn-copy" @click="copyLink">复制链接</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onShow } from 'vue';
import { useUserStore } from '../../store/user';
import { teamApi } from '../../api/team';
import { agentApi } from '../../api/agent';

const userStore = useUserStore();
const loading = ref(true);
const overview = ref(null);

const isAgent = computed(() => userStore.user?.is_agent === 1);
const stats = computed(() => overview.value?.stats || {});
const children = computed(() => overview.value?.children || []);
const teamRoots = computed(() => {
  const roots = overview.value?.stats?.byRootId || [];
  return roots.length;
});

const inviteLink = computed(() => {
  const base = userStore.user?.invite_code
    ? `https://example.com/invite/${userStore.user.invite_code}`
    : '登录后生成推广链接';
  return base;
});

onShow(async () => {
  if (!userStore.isLoggedIn) { loading.value = false; return; }
  try {
    loading.value = true;
    overview.value = await teamApi.overview();
  } catch (e) {
    console.error('team overview error', e);
  } finally {
    loading.value = false;
  }
});

function goLogin() { uni.switchTab({ url: '/pages/login/index' }); }

function copyLink() {
  uni.setClipboardData({
    data: inviteLink.value,
    success: () => uni.showToast({ title: '链接已复制', icon: 'success' }),
    fail: () => uni.showToast({ title: '复制失败', icon: 'none' })
  });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}`;
}

const AVATAR_COLORS = ['#667eea','#764ba2','#f093fb','#f5576c','#4facfe','#00f2fe','#43e97b','#fa709a','#fee140','#fa709a'];
function avatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
</script>

<style scoped>
.page { padding: 16rpx; min-height: 100vh; background: var(--bg-light); }

.login-tip { display: flex; flex-direction: column; align-items: center; padding: 120rpx 0; gap: 24rpx; color: var(--text-gray); }
.btn-login { background: var(--accent-blue); color: #fff; border-radius: 44rpx; width: 240rpx; font-size: 28rpx; }

.loading-wrap { display: flex; justify-content: center; align-items: center; padding: 120rpx; }
.loading-text { color: var(--text-gray); font-size: 28rpx; }

.overview-card { position: relative; border-radius: var(--border-radius); overflow: hidden; margin-bottom: 16rpx; box-shadow: var(--shadow-md); }
.overview-bg { position: absolute; inset: 0; background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary)); }
.overview-content { position: relative; padding: 32rpx 24rpx; }
.my-info { display: flex; align-items: center; gap: 16rpx; margin-bottom: 24rpx; }
.avatar { width: 80rpx; height: 80rpx; border-radius: 50%; background: linear-gradient(135deg, rgba(255,255,255,0.3), rgba(255,255,255,0.1)); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 36rpx; font-weight: bold; flex-shrink: 0; border: 2rpx solid rgba(255,255,255,0.4); }
.avatar.sm { width: 56rpx; height: 56rpx; font-size: 24rpx; border: none; }
.info { display: flex; flex-direction: column; gap: 6rpx; }
.name { color: #fff; font-size: 32rpx; font-weight: 600; }
.role-tag { color: rgba(255,255,255,0.8); font-size: 22rpx; }
.divider { height: 1rpx; background: rgba(255,255,255,0.2); margin-bottom: 24rpx; }
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16rpx; }
.stat-item { text-align: center; }
.stat-val { display: block; color: #fff; font-size: 36rpx; font-weight: bold; }
.stat-lbl { color: rgba(255,255,255,0.7); font-size: 20rpx; margin-top: 4rpx; }

.section { background: var(--bg-white); border-radius: var(--border-radius); padding: 24rpx; margin-bottom: 16rpx; box-shadow: var(--shadow-sm); }
.section-title { font-size: 28rpx; font-weight: bold; color: var(--text-primary); margin-bottom: 16rpx; }

.member-list { display: flex; flex-direction: column; gap: 12rpx; }
.member-card { display: flex; align-items: center; gap: 16rpx; padding: 16rpx; background: var(--bg-light); border-radius: 12rpx; }
.member-card.parent { background: color-mix(in srgb, var(--accent-blue) 5%, transparent); border: 1rpx solid color-mix(in srgb, var(--accent-blue) 15%, transparent); }
.member-card .info { flex: 1; }
.nickname { display: block; font-size: 28rpx; font-weight: 500; color: var(--text-primary); }
.meta { font-size: 22rpx; color: var(--text-gray); margin-top: 2rpx; }
.arrow { font-size: 40rpx; color: var(--text-gray); }
.badge { font-size: 20rpx; padding: 4rpx 12rpx; border-radius: 8rpx; }
.badge.agent { background: color-mix(in srgb, var(--price-color) 10%, transparent); color: var(--price-color); }
.badge.trial { background: var(--bg-light); color: var(--text-gray); }

.empty-tip { text-align: center; color: var(--text-gray); font-size: 26rpx; padding: 24rpx 0; line-height: 1.6; }

.share-section .share-box { background: var(--bg-light); border-radius: 8rpx; padding: 16rpx; margin-bottom: 16rpx; overflow: hidden; }
.share-url { font-size: 22rpx; color: var(--text-secondary); word-break: break-all; }
.btn-copy { background: var(--accent-blue); color: #fff; border-radius: 44rpx; font-size: 28rpx; }
</style>
