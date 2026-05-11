<template>
  <view class="page">

    <!-- 顶部用户档案卡 -->
    <view class="profile-hero">
      <!-- 装饰背景 -->
      <view class="hero-decoration">
        <view class="deco-circle deco-1"></view>
        <view class="deco-circle deco-2"></view>
        <view class="deco-circle deco-3"></view>
      </view>

      <view class="hero-card">
        <!-- 头像区 -->
        <view class="avatar-section">
          <view class="avatar-container">
            <image
              class="avatar"
              :src="avatarUrl || '/static/default-avatar.png'"
              mode="aspectFill"
            />
            <view class="avatar-ring" :class="isAgent ? 'ring-gold' : 'ring-silver'"></view>
            <!-- VIP 徽章 -->
            <view class="vip-badge" v-if="isAgent">
              <text class="vip-star">★</text>
            </view>
          </view>
        </view>

        <!-- 用户信息 -->
        <view class="user-info">
          <view class="user-name-row">
            <text class="user-name">{{ nickname || '未登录用户' }}</text>
            <view class="role-tag" :class="isAgent ? 'tag-agent' : 'tag-user'">
              <text class="role-icon">{{ isAgent ? '⚡' : '◇' }}</text>
              <text class="role-text">{{ isAgent ? '分销商' : '普通用户' }}</text>
            </view>
          </view>
          <text class="user-id">ID {{ userId || '——' }}</text>
          <text class="user-phone" v-if="phoneNum">{{ phoneNum }}</text>
        </view>

        <!-- 编辑入口 -->
        <view class="edit-btn" @click="editProfile">
          <text class="edit-text">编辑</text>
          <text class="edit-arrow">›</text>
        </view>
      </view>

      <!-- 数据统计条 -->
      <view class="stats-bar">
        <view class="stat-item">
          <text class="stat-num">{{ stats.orders || 0 }}</text>
          <text class="stat-label">订单</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-num">{{ stats.commissions || '0.00' }}</text>
          <text class="stat-label">佣金(元)</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-num">{{ stats.courses || 0 }}</text>
          <text class="stat-label">课程</text>
        </view>
      </view>
    </view>

    <!-- 账号安全 -->
    <view class="section">
      <view class="section-header">
        <view class="section-line"></view>
        <text class="section-title">账号安全</text>
      </view>
      <view class="content-card">
        <view class="menu-item" @click="changePassword">
          <view class="item-left">
            <view class="icon-box" style="background: linear-gradient(145deg, #667eea 0%, #764ba2 100%);">
              <text class="icon-char">🔐</text>
            </view>
            <view class="item-texts">
              <text class="item-title">修改密码</text>
              <text class="item-sub">定期更换，降低风险</text>
            </view>
          </view>
          <view class="item-right">
            <text class="arrow">›</text>
          </view>
        </view>

        <view class="menu-divider"></view>

        <view class="menu-item" @click="bindPhone">
          <view class="item-left">
            <view class="icon-box" style="background: linear-gradient(145deg, #11998e 0%, #38ef7d 100%);">
              <text class="icon-char">📱</text>
            </view>
            <view class="item-texts">
              <text class="item-title">绑定手机</text>
              <text class="item-sub" :class="{ 'sub-empty': !phoneNum }">
                {{ phoneNum || '尚未绑定' }}
              </text>
            </view>
          </view>
          <view class="item-right">
            <text class="arrow">›</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 偏好设置 -->
    <view class="section">
      <view class="section-header">
        <view class="section-line"></view>
        <text class="section-title">偏好设置</text>
      </view>
      <view class="content-card">
        <view class="menu-item">
          <view class="item-left">
            <view class="icon-box" style="background: linear-gradient(145deg, #f093fb 0%, #f5576c 100%);">
              <text class="icon-char">🔔</text>
            </view>
            <view class="item-texts">
              <text class="item-title">消息通知</text>
              <text class="item-sub">订单与佣金推送</text>
            </view>
          </view>
          <view class="item-right">
            <switch
              class="toggle"
              :checked="notifEnabled"
              color="#FF6B00"
              @change="toggleNotification"
            />
          </view>
        </view>

        <view class="menu-divider"></view>

        <view class="menu-item" @click="clearCache">
          <view class="item-left">
            <view class="icon-box" style="background: linear-gradient(145deg, #4facfe 0%, #00f2fe 100%);">
              <text class="icon-char">🗑</text>
            </view>
            <view class="item-texts">
              <text class="item-title">清理缓存</text>
              <text class="item-sub">当前 {{ cacheSize }}</text>
            </view>
          </view>
          <view class="item-right">
            <text class="arrow">›</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 关于 -->
    <view class="section">
      <view class="section-header">
        <view class="section-line"></view>
        <text class="section-title">关于</text>
      </view>
      <view class="content-card">
        <view class="menu-item" @click="showAgreement">
          <view class="item-left">
            <view class="icon-box" style="background: linear-gradient(145deg, #a8edea 0%, #fed6e3 100%);">
              <text class="icon-char">📄</text>
            </view>
            <view class="item-texts">
              <text class="item-title">用户协议</text>
            </view>
          </view>
          <view class="item-right">
            <text class="arrow">›</text>
          </view>
        </view>

        <view class="menu-divider"></view>

        <view class="menu-item" @click="showPrivacy">
          <view class="item-left">
            <view class="icon-box" style="background: linear-gradient(145deg, #d299c2 0%, #fef9d7 100%);">
              <text class="icon-char">🔐</text>
            </view>
            <view class="item-texts">
              <text class="item-title">隐私政策</text>
            </view>
          </view>
          <view class="item-right">
            <text class="arrow">›</text>
          </view>
        </view>

        <view class="menu-divider"></view>

        <view class="menu-item" @click="showAbout">
          <view class="item-left">
            <view class="icon-box" style="background: linear-gradient(145deg, #89f7fe 0%, #66a6ff 100%);">
              <text class="icon-char">ℹ</text>
            </view>
            <view class="item-texts">
              <text class="item-title">关于我们</text>
            </view>
          </view>
          <view class="item-right">
            <text class="arrow">›</text>
          </view>
        </view>

        <view class="menu-divider"></view>

        <view class="menu-item" @click="showVersion">
          <view class="item-left">
            <view class="icon-box" style="background: linear-gradient(145deg, #e0c3fc 0%, #8ec5fc 100%);">
              <text class="icon-char">📌</text>
            </view>
            <view class="item-texts">
              <text class="item-title">版本信息</text>
            </view>
          </view>
          <view class="item-right version-row">
            <text class="version-num">v1.0.0</text>
            <text class="arrow">›</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 管理入口 -->
    <view class="section">
      <view class="section-header">
        <view class="section-line"></view>
        <text class="section-title">管理</text>
      </view>
      <view class="content-card card-admin">
        <view class="menu-item" @click="goToAdminLogin">
          <view class="item-left">
            <view class="icon-box" style="background: linear-gradient(145deg, #f79711 0%, #FF6B00 100%);">
              <text class="icon-char">⚙</text>
            </view>
            <view class="item-texts">
              <text class="item-title">管理后台</text>
              <text class="item-sub">进入系统管理</text>
            </view>
          </view>
          <view class="item-right">
            <text class="arrow">›</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 退出登录 -->
    <view class="logout-section">
      <button class="logout-btn" @click="logout">
        <text class="logout-icon">⏻</text>
        退出登录
      </button>
    </view>

    <!-- 底部留白 + 版权 -->
    <view class="bottom-space">
      <view class="brand-mark">
        <view class="brand-dot"></view>
        <text class="brand-text">视频课程分销</text>
        <view class="brand-dot"></view>
      </view>
      <text class="copyright-text">© 2026 · 保留所有权利</text>
    </view>

  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useUserStore } from '@/store/user';

const userStore = useUserStore();

const notifEnabled = ref(true);
const cacheSize = ref('2.3 MB');
const stats = ref({ orders: 0, commissions: '0.00', courses: 0 });

const nickname = computed(() => userStore.userInfo?.nickname || '');
const avatarUrl = computed(() => userStore.userInfo?.avatar || '');
const phoneNum = computed(() => {
  const p = userStore.userInfo?.phone;
  if (!p) return '';
  return p.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
});
const isAgent = computed(() => userStore.isAgent);
const isAdmin = computed(() => userStore.isAdmin);
const userId = computed(() => userStore.userInfo?.id || '');

function changePassword() {
  uni.showToast({ title: '暂未开放', icon: 'none' });
}

function bindPhone() {
  uni.showToast({ title: '暂未开放', icon: 'none' });
}

function toggleNotification(e) {
  notifEnabled.value = e.detail.value;
  uni.showToast({
    title: notifEnabled.value ? '已开启通知' : '已关闭通知',
    icon: 'none',
  });
}

function clearCache() {
  uni.showModal({
    title: '清理缓存',
    content: '确定要清理本地缓存吗？',
    success: (res) => {
      if (res.confirm) {
        try {
          userStore.clearAuth();
          cacheSize.value = '0 KB';
          uni.showToast({ title: '清理完成', icon: 'success' });
        } catch {
          uni.showToast({ title: '清理失败', icon: 'none' });
        }
      }
    },
  });
}

function showAbout() {
  uni.showModal({
    title: '关于我们',
    content: '视频课程分销小程序\n为您提供优质的视频课程资源\n和灵活的分销推广体验。\n\n如有问题请联系客服。',
    showCancel: false,
  });
}

function showVersion() {
  uni.showModal({
    title: '版本信息',
    content: '当前版本：v1.0.0\n构建时间：2026-04-22',
    showCancel: false,
  });
}

function showAgreement() {
  uni.navigateTo({ url: '/pages/user/agreement' });
}

function showPrivacy() {
  uni.navigateTo({ url: '/pages/user/privacy' });
}

function editProfile() {
  uni.showToast({ title: '暂未开放', icon: 'none' });
}

function goToAdminLogin() {
  uni.navigateTo({ url: '/pages/admin/login/index' });
}

function logout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出当前账号吗？',
    success: (res) => {
      if (res.confirm) {
        userStore.clearAuth();
        uni.reLaunch({ url: '/pages/login/index' });
      }
    },
  });
}
</script>

<style scoped lang="scss">
/* ============================================
   色彩系统
   ============================================ */
$bg:            #f5f3ee;   /* 暖米色背景 */
$card:          #ffffff;   /* 纯白卡片 */
$primary:       #FF6B00;   /* 品牌橙 */
$primary-light: #FF8533;
$gold:          #d4a843;
$gold-light:    #f0d078;
$text-primary:  #1c1917;   /* 近黑色文字 */
$text-secondary:#57534e;   /* 次要文字 */
$text-muted:    #a8a29e;   /* 弱化文字 */
$border:        #ece8e1;   /* 暖灰分割线 */
$shadow-card:   0 2rpx 16rpx rgba(0,0,0,0.06), 0 8rpx 32rpx rgba(0,0,0,0.04);
$shadow-btn:    0 4rpx 20rpx rgba(239,68,68,0.18);

/* ============================================
   页面容器
   ============================================ */
.page {
  min-height: 100vh;
  background: $bg;
  padding-bottom: 60rpx;
}

/* ============================================
   顶部英雄档案卡
   ============================================ */
.profile-hero {
  position: relative;
  margin: 0 0 8rpx;
  overflow: hidden;
}

/* 装饰背景圆 */
.hero-decoration {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 280rpx;
  overflow: hidden;
  pointer-events: none;
}
.deco-circle {
  position: absolute;
  border-radius: 50%;
  opacity: 0.12;
}
.deco-1 {
  width: 400rpx; height: 400rpx;
  background: $primary;
  top: -160rpx; right: -100rpx;
}
.deco-2 {
  width: 280rpx; height: 280rpx;
  background: $gold;
  top: -80rpx; left: -60rpx;
}
.deco-3 {
  width: 180rpx; height: 180rpx;
  background: $primary-light;
  bottom: -60rpx; left: 40%;
}

/* 主体卡片 */
.hero-card {
  position: relative;
  margin: 24rpx 28rpx 0;
  background: $card;
  border-radius: 28rpx;
  box-shadow: $shadow-card;
  padding: 40rpx 36rpx 32rpx;
  display: flex;
  align-items: flex-start;
  gap: 28rpx;
}

/* 头像 */
.avatar-section {
  flex-shrink: 0;
}
.avatar-container {
  position: relative;
  width: 120rpx;
  height: 120rpx;
}
.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: #f0ede8;
  display: block;
}
.avatar-ring {
  position: absolute;
  inset: -6rpx;
  border-radius: 50%;
  border: 3rpx solid transparent;
  background-clip: padding-box;
}
.ring-gold {
  background: linear-gradient(135deg, $gold, $gold-light) border-box;
  -webkit-mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: destination-out;
  mask-composite: exclude;
  border-color: transparent;
  border: 3rpx solid $gold;
  box-shadow: 0 0 16rpx rgba($gold, 0.4);
}
.ring-silver {
  border: 3rpx solid $border;
}
.vip-badge {
  position: absolute;
  bottom: -4rpx; right: -4rpx;
  width: 40rpx; height: 40rpx;
  background: linear-gradient(135deg, $gold, $gold-light);
  border-radius: 50%;
  border: 3rpx solid #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 12rpx rgba($gold, 0.4);
}
.vip-star {
  font-size: 18rpx;
  color: #7d4a00;
  line-height: 1;
}

/* 用户信息 */
.user-info {
  flex: 1;
  padding-top: 8rpx;
}
.user-name-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-bottom: 8rpx;
}
.user-name {
  font-size: 36rpx;
  font-weight: 700;
  color: $text-primary;
  letter-spacing: 1rpx;
}
.role-tag {
  display: inline-flex;
  align-items: center;
  gap: 4rpx;
  padding: 4rpx 12rpx;
  border-radius: 20rpx;
  font-size: 20rpx;
}
.tag-agent {
  background: rgba($gold, 0.12);
  color: $gold;
}
.tag-user {
  background: rgba($primary, 0.08);
  color: $primary;
}
.role-icon {
  font-size: 16rpx;
}
.role-text {
  line-height: 1;
}
.user-id {
  display: block;
  font-size: 22rpx;
  color: $text-muted;
  margin-bottom: 4rpx;
}
.user-phone {
  display: block;
  font-size: 22rpx;
  color: $text-secondary;
}

/* 编辑按钮 */
.edit-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 2rpx;
  padding: 10rpx 20rpx;
  border-radius: 20rpx;
  background: rgba($primary, 0.06);
  align-self: flex-start;
  margin-top: 8rpx;
}
.edit-text {
  font-size: 22rpx;
  color: $primary;
  font-weight: 500;
}
.edit-arrow {
  font-size: 24rpx;
  color: $primary;
}

/* 数据统计条 */
.stats-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 28rpx;
  background: $card;
  border-radius: 0 0 28rpx 28rpx;
  box-shadow: $shadow-card;
  padding: 28rpx 0;
  transform: translateY(-1rpx);
  position: relative;
  z-index: -1;
}
.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}
.stat-num {
  font-size: 36rpx;
  font-weight: 700;
  color: $text-primary;
  letter-spacing: -1rpx;
}
.stat-label {
  font-size: 20rpx;
  color: $text-muted;
}
.stat-divider {
  width: 1rpx;
  height: 40rpx;
  background: $border;
}

/* ============================================
   内容区块
   ============================================ */
.section {
  margin-top: 32rpx;
  padding: 0 28rpx;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-bottom: 16rpx;
  padding-left: 4rpx;
}
.section-line {
  width: 6rpx;
  height: 28rpx;
  background: linear-gradient(180deg, $primary, $primary-light);
  border-radius: 3rpx;
}
.section-title {
  font-size: 26rpx;
  font-weight: 600;
  color: $text-secondary;
  letter-spacing: 2rpx;
  text-transform: uppercase;
}

/* 内容卡片 */
.content-card {
  background: $card;
  border-radius: 24rpx;
  box-shadow: $shadow-card;
  overflow: hidden;
}
.card-admin {
  border-top: 4rpx solid rgba($primary, 0.08);
}

/* ============================================
   菜单项
   ============================================ */
.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx 32rpx;
  transition: background 0.12s;
}
.menu-item:active {
  background: rgba(0,0,0,0.025);
}
.menu-divider {
  height: 1rpx;
  background: $border;
  margin: 0 32rpx 0 136rpx; /* 对齐: icon-box(72)+mr(24)+padding-left(32) */
}

.item-left {
  display: flex;
  align-items: center;
  gap: 24rpx;
}
.icon-box {
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.icon-char {
  font-size: 32rpx;
}
.item-texts {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.item-title {
  font-size: 29rpx;
  font-weight: 500;
  color: $text-primary;
}
.item-sub {
  font-size: 22rpx;
  color: $text-muted;
}
.sub-empty {
  color: rgba($primary, 0.5);
}

.item-right {
  display: flex;
  align-items: center;
  gap: 6rpx;
  flex-shrink: 0;
}
.arrow {
  font-size: 34rpx;
  color: $border;
}
.toggle {
  transform: scale(0.82);
}
.version-row {
  gap: 8rpx;
}
.version-num {
  font-size: 22rpx;
  color: $text-muted;
}

/* ============================================
   退出按钮
   ============================================ */
.logout-section {
  margin: 48rpx 28rpx 0;
}
.logout-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #fff;
  font-size: 30rpx;
  font-weight: 600;
  border-radius: 44rpx;
  border: none;
  box-shadow: $shadow-btn;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  letter-spacing: 2rpx;
}
.logout-btn::after { border: none; }
.logout-btn:active {
  opacity: 0.88;
  transform: scale(0.98);
}
.logout-icon {
  font-size: 32rpx;
}

/* ============================================
   底部
   ============================================ */
.bottom-space {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  margin-top: 60rpx;
  padding-bottom: 40rpx;
}
.brand-mark {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.brand-dot {
  width: 6rpx;
  height: 6rpx;
  border-radius: 50%;
  background: $text-muted;
}
.brand-text {
  font-size: 22rpx;
  color: $text-muted;
  letter-spacing: 2rpx;
}
.copyright-text {
  font-size: 20rpx;
  color: #d1cfc9;
  letter-spacing: 1rpx;
}
</style>
