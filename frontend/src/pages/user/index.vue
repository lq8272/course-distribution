<template>
  <view class="page">

    <!-- ========== 顶部用户档案区 ========== -->
    <view class="profile-zone">

      <!-- 装饰性渐变背景 -->
      <view class="zone-bg">
        <view class="bg-circle bg-1"></view>
        <view class="bg-circle bg-2"></view>
        <view class="bg-circle bg-3"></view>
      </view>

      <!-- 未登录状态 -->
      <view v-if="!uni.getStorageSync('token')" class="login-card" @click="goToLogin">
        <view class="login-avatar-wrap">
          <image class="login-avatar" src="/static/default-avatar.png" mode="aspectFill" />
        </view>
        <view class="login-texts">
          <text class="login-title">点击登录</text>
          <text class="login-sub">登录后享受更多专属服务</text>
        </view>
        <view class="login-arrow">›</view>
      </view>

      <!-- 已登录状态 -->
      <view v-else class="user-hero">
        <!-- 头像 -->
        <view class="avatar-wrap">
          <image
            class="avatar"
            :src="userInfo.avatar || '/static/default-avatar.png'"
            mode="aspectFill"
          />
          <view class="avatar-ring" :class="agentData.is_agent ? 'ring-gold' : 'ring-silver'"></view>
          <!-- 角色角标 -->
          <view class="role-chip" :class="agentData.is_agent ? 'chip-agent' : 'chip-user'">
            <text class="chip-icon">{{ agentData.is_agent ? '⚡' : '◇' }}</text>
            <text class="chip-text">{{ agentData.is_agent ? (agentData.agent?.level_name || '分销商') : '普通用户' }}</text>
          </view>
        </view>

        <!-- 用户信息 -->
        <view class="hero-info">
          <text class="hero-name">{{ userInfo.nickname || '用户' }}</text>
          <text class="hero-id">ID {{ userInfo.id || '——' }}</text>
          <text class="hero-phone" v-if="userInfo.phone">{{ formatPhone(userInfo.phone) }}</text>
        </view>

        <!-- 编辑按钮 -->
        <view class="edit-pill" @click.stop="goToSettings">
          <text class="edit-label">设置</text>
        </view>
      </view>

      <!-- 数据统计条 -->
      <view class="stats-strip">
        <view class="stat-unit">
          <text class="stat-n">{{ stats.courses || 0 }}</text>
          <text class="stat-l">我的课程</text>
        </view>
        <view class="strip-divider"></view>
        <view class="stat-unit">
          <text class="stat-n">{{ stats.commission || '0.00' }}</text>
          <text class="stat-l">累计佣金</text>
        </view>
        <view class="strip-divider"></view>
        <view class="stat-unit">
          <text class="stat-n">{{ agentData.is_agent ? (agentData.agent?.team_count || 0) : stats.follows || 0 }}</text>
          <text class="stat-l">{{ agentData.is_agent ? '团队成员' : '关注' }}</text>
        </view>
      </view>
    </view>

    <!-- ========== 订单区 ========== -->
    <view class="section">
      <view class="section-head">
        <view class="head-line"></view>
        <text class="head-title">我的订单</text>
      </view>
      <view class="order-card">
        <view class="order-tabs">
          <view class="tab-item" @click="goToOrders('pending')">
            <view class="tab-icon" style="background: linear-gradient(145deg, #667eea 0%, #764ba2 100%);">
              <text class="tab-glyph">⏳</text>
            </view>
            <text class="tab-label">待支付</text>
            <view class="tab-badge" v-if="orderCount.pending">{{ orderCount.pending }}</view>
          </view>
          <view class="tab-item" @click="goToOrders('paid')">
            <view class="tab-icon" style="background: linear-gradient(145deg, #11998e 0%, #38ef7d 100%);">
              <text class="tab-glyph">📦</text>
            </view>
            <text class="tab-label">已支付</text>
          </view>
          <view class="tab-item" @click="goToOrders('complete')">
            <view class="tab-icon" style="background: linear-gradient(145deg, #f093fb 0%, #f5576c 100%);">
              <text class="tab-glyph">✅</text>
            </view>
            <text class="tab-label">已完成</text>
          </view>
          <view class="tab-item" @click="goToOrders('refund')">
            <view class="tab-icon" style="background: linear-gradient(145deg, #4facfe 0%, #00f2fe 100%);">
              <text class="tab-glyph">💰</text>
            </view>
            <text class="tab-label">退款/售后</text>
          </view>
        </view>
        <!-- 全部订单入口 -->
        <view class="all-order-row" @click="goToOrders()">
          <text class="all-order-text">全部订单</text>
          <text class="all-order-arrow">›</text>
        </view>
      </view>
    </view>

    <!-- ========== 功能网格 ========== -->
    <view class="section">
      <view class="section-head">
        <view class="head-line"></view>
        <text class="head-title">我的服务</text>
      </view>
      <view class="grid-card">
        <view class="grid-row">
          <view class="grid-item" @click="goToMyCourses">
            <view class="grid-icon" style="background: linear-gradient(145deg, #ff9a56 0%, #FF6B00 100%);">
              <text class="grid-glyph">📚</text>
            </view>
            <text class="grid-label">我的课程</text>
          </view>
          <view class="grid-item" @click="goToCoupon">
            <view class="grid-icon" style="background: linear-gradient(145deg, #f093fb 0%, #f5576c 100%);">
              <text class="grid-glyph">🎫</text>
            </view>
            <text class="grid-label">优惠券</text>
          </view>
          <view class="grid-item" @click="goToCollection">
            <view class="grid-icon" style="background: linear-gradient(145deg, #e0c3fc 0%, #8ec5fc 100%);">
              <text class="grid-glyph">❤️</text>
            </view>
            <text class="grid-label">我的收藏</text>
          </view>
          <view class="grid-item" @click="goToHistory">
            <view class="grid-icon" style="background: linear-gradient(145deg, #a8edea 0%, #fed6e3 100%);">
              <text class="grid-glyph">🕐</text>
            </view>
            <text class="grid-label">浏览历史</text>
          </view>
        </view>
        <view class="grid-divider"></view>
        <view class="grid-row">
          <view class="grid-item" @click="goToWallet">
            <view class="grid-icon" style="background: linear-gradient(145deg, #4facfe 0%, #00f2fe 100%);">
              <text class="grid-glyph">👛</text>
            </view>
            <text class="grid-label">我的钱包</text>
          </view>
          <view class="grid-item" @click="goToAddress">
            <view class="grid-icon" style="background: linear-gradient(145deg, #d299c2 0%, #fef9d7 100%);">
              <text class="grid-glyph">📍</text>
            </view>
            <text class="grid-label">收货地址</text>
          </view>
          <view class="grid-item" @click="goToHelp">
            <view class="grid-icon" style="background: linear-gradient(145deg, #89f7fe 0%, #66a6ff 100%);">
              <text class="grid-glyph">❓</text>
            </view>
            <text class="grid-label">帮助反馈</text>
          </view>
          <view class="grid-item" @click="contactService">
            <view class="grid-icon" style="background: linear-gradient(145deg, #667eea 0%, #764ba2 100%);">
              <text class="grid-glyph">📞</text>
            </view>
            <text class="grid-label">联系客服</text>
          </view>
        </view>
      </view>
    </view>

    <!-- ========== 分销中心（仅分销商） ========== -->
    <view class="section" v-if="agentData.is_agent">
      <view class="section-head">
        <view class="head-line gold-line"></view>
        <text class="head-title gold-title">分销中心</text>
      </view>
      <view class="dist-card">
        <!-- 佣金概览 -->
        <view class="commission-banner">
          <view class="banner-left">
            <text class="banner-label">累计佣金（元）</text>
            <text class="banner-amount">{{ userInfo.totalCommission || '0.00' }}</text>
          </view>
          <view class="banner-right">
            <text class="banner-label">可提现（元）</text>
            <text class="banner-withdraw">{{ agentData.agent?.withdrawable || '0.00' }}</text>
          </view>
        </view>

        <!-- 分销菜单 -->
        <view class="dist-menu">
          <view class="dist-item" @click="goToCommissionList">
            <view class="dist-icon-wrap" style="background: rgba(212,168,67,0.12);">
              <text class="dist-icon">💵</text>
            </view>
            <view class="dist-texts">
              <text class="dist-title">佣金明细</text>
              <text class="dist-sub">查看收支记录</text>
            </view>
            <text class="dist-arrow">›</text>
          </view>
          <view class="dist-divider"></view>
          <view class="dist-item" @click="goToTeam">
            <view class="dist-icon-wrap" style="background: rgba(212,168,67,0.12);">
              <text class="dist-icon">👥</text>
            </view>
            <view class="dist-texts">
              <text class="dist-title">我的团队</text>
              <text class="dist-sub">团队成员 {{ agentData.agent?.team_count || 0 }} 人</text>
            </view>
            <text class="dist-arrow">›</text>
          </view>
          <view class="dist-divider"></view>
          <view class="dist-item" @click="goToPromo">
            <view class="dist-icon-wrap" style="background: rgba(212,168,67,0.12);">
              <text class="dist-icon">🔗</text>
            </view>
            <view class="dist-texts">
              <text class="dist-title">推广码</text>
              <text class="dist-sub">分享获取佣金</text>
            </view>
            <text class="dist-arrow">›</text>
          </view>
        </view>
      </view>
    </view>

    <!-- ========== 通知入口 ========== -->
    <view class="section">
      <view class="settings-row" @click="goToNotification">
        <view class="settings-left">
          <view class="settings-icon" style="background: linear-gradient(145deg, #FF6B00 0%, #FF8533 100%);">
            <text class="settings-glyph">🔔</text>
          </view>
          <text class="settings-label">通知中心</text>
        </view>
        <view class="settings-right">
          <view class="unread-badge" v-if="unreadNotifCount > 0">{{ unreadNotifCount > 99 ? '99+' : unreadNotifCount }}</view>
          <text class="settings-arrow">›</text>
        </view>
      </view>
    </view>

    <!-- ========== 设置入口 ========== -->
    <view class="section">
      <view class="settings-row" @click="goToSettings">
        <view class="settings-left">
          <view class="settings-icon" style="background: linear-gradient(145deg, #e0c3fc 0%, #8ec5fc 100%);">
            <text class="settings-glyph">⚙</text>
          </view>
          <text class="settings-label">设置</text>
        </view>
        <text class="settings-arrow">›</text>
      </view>
    </view>

    <!-- 底部安全区 -->
    <view class="safe-bottom"></view>

  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useUserStore } from '@/store/user';
import { authApi } from '@/api/auth';
import { agentApi } from '@/api/agent';
import { notificationApi } from '@/api/notification';

const userStore = useUserStore();
const userInfo = ref({});
const agentData = ref({ is_agent: false });
const orderCount = ref({ pending: 0, complete: 0, refund: 0 });
const stats = ref({ courses: 0, commission: '0.00', follows: 0 });
const unreadNotifCount = ref(0);

async function loadUserData() {
  const raw = uni.getStorageSync('userInfo') || {};
  userInfo.value = raw;

  if (uni.getStorageSync('token')) {
    try {
      const [userData, myAgent, notifCount] = await Promise.all([
        authApi.userinfo().catch(() => ({})),
        agentApi.my().catch(() => ({ is_agent: false })),
        notificationApi.unreadCount().catch(() => ({ count: 0 })),
      ]);
      userInfo.value = { ...userInfo.value, ...userData };
      agentData.value = myAgent || { is_agent: false };
      unreadNotifCount.value = notifCount.count || 0;
    } catch (e) {
      console.error('loadUserData error', e);
    }
  }
}

function formatPhone(p) {
  return p.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

function goToIndex() {
  uni.reLaunch({ url: '/pages/index/index' });
}

function goToMyCourses() {
  uni.navigateTo({ url: '/pages/course/list' });
}
function goToLogin() { uni.navigateTo({ url: '/pages/login/index' }); }
function goToSettings() { uni.navigateTo({ url: '/pages/user/settings' }); }

function goToOrders(status) {
  const url = '/pages/order/list' + (status !== undefined ? `?status=${status}` : '');
  uni.navigateTo({ url });
}
function goToWallet() { uni.navigateTo({ url: '/pages/user/wallet' }); }
function goToAddress() { uni.navigateTo({ url: '/pages/user/address' }); }
function goToCoupon() { uni.navigateTo({ url: '/pages/user/coupon' }); }
function goToCollection() { uni.navigateTo({ url: '/pages/user/collection' }); }
function goToHistory() { uni.navigateTo({ url: '/pages/user/history' }); }
function goToDistribute() { uni.switchTab({ url: '/pages/distribute/index' }); }
function goToCommissionList() { uni.navigateTo({ url: '/pages/distribute/commission-list' }); }
function goToTeam() { uni.switchTab({ url: '/pages/team/index' }); }
function goToPromo() { uni.switchTab({ url: '/pages/distribute/index' }); }
function goToHelp() { uni.navigateTo({ url: '/pages/user/help' }); }
function goToNotification() { uni.navigateTo({ url: '/pages/user/notification' }); }
function contactService() { uni.navigateTo({ url: '/pages/service/conversations' }); }

onShow(() => { loadUserData(); });
</script>

<style scoped lang="scss">
/* ============================================
   色彩系统（与设置页面一致）
   ============================================ */
$bg:            #f5f3ee;
$card:          #ffffff;
$primary:       #FF6B00;
$primary-light: #FF8533;
$gold:          #d4a843;
$gold-light:    #f0d078;
$text-primary:  #1c1917;
$text-secondary:#57534e;
$text-muted:    #a8a29e;
$border:        #ece8e1;
$shadow-card:   0 2rpx 16rpx rgba(0,0,0,0.06), 0 8rpx 32rpx rgba(0,0,0,0.04);

/* ============================================
   页面容器
   ============================================ */
.page {
  min-height: 100vh;
  background: $bg;
  padding-bottom: 24rpx;
}

/* ============================================
   顶部档案区
   ============================================ */
.profile-zone {
  position: relative;
  overflow: hidden;
}

/* 装饰背景 */
.zone-bg {
  position: absolute;
  inset: 0;
  height: 380rpx;
  overflow: hidden;
  pointer-events: none;
}
.bg-circle {
  position: absolute;
  border-radius: 50%;
  opacity: 0.1;
}
.bg-1 {
  width: 500rpx; height: 500rpx;
  background: $primary;
  top: -200rpx; right: -120rpx;
}
.bg-2 {
  width: 320rpx; height: 320rpx;
  background: $gold;
  top: -100rpx; left: -80rpx;
}
.bg-3 {
  width: 200rpx; height: 200rpx;
  background: $primary-light;
  bottom: -80rpx; left: 35%;
}

/* 未登录卡片 */
.login-card {
  position: relative;
  margin: 24rpx 28rpx 0;
  background: $card;
  border-radius: 28rpx;
  box-shadow: $shadow-card;
  padding: 36rpx 32rpx;
  display: flex;
  align-items: center;
  gap: 24rpx;
}
.login-avatar-wrap {
  flex-shrink: 0;
}
.login-avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: #ece8e1;
}
.login-texts {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.login-title {
  font-size: 34rpx;
  font-weight: 700;
  color: $text-primary;
}
.login-sub {
  font-size: 24rpx;
  color: $text-muted;
}
.login-arrow {
  font-size: 40rpx;
  color: $text-muted;
}

/* 已登录英雄区 */
.user-hero {
  position: relative;
  margin: 24rpx 28rpx 0;
  background: $card;
  border-radius: 28rpx;
  box-shadow: $shadow-card;
  padding: 40rpx 36rpx 28rpx;
  display: flex;
  align-items: flex-start;
  gap: 24rpx;
}

/* 头像 */
.avatar-wrap {
  position: relative;
  flex-shrink: 0;
}
.avatar {
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  background: #ece8e1;
  display: block;
}
.avatar-ring {
  position: absolute;
  inset: -5rpx;
  border-radius: 50%;
  border: 2rpx solid transparent;
}
.ring-gold {
  border-color: $gold;
  box-shadow: 0 0 16rpx rgba($gold, 0.35);
}
.ring-silver {
  border-color: $border;
}

/* 角色胶囊 */
.role-chip {
  position: absolute;
  bottom: -10rpx; left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 4rpx;
  padding: 4rpx 12rpx;
  border-radius: 20rpx;
  white-space: nowrap;
}
.chip-agent {
  background: linear-gradient(135deg, $gold, $gold-light);
  box-shadow: 0 4rpx 12rpx rgba($gold, 0.35);
}
.chip-user {
  background: rgba($primary, 0.08);
}
.chip-icon {
  font-size: 16rpx;
}
.chip-text {
  font-size: 18rpx;
  font-weight: 600;
  color: #7d4a00;
}
.chip-user .chip-text {
  color: $primary;
}

/* 用户信息 */
.hero-info {
  flex: 1;
  padding-top: 4rpx;
  padding-bottom: 20rpx;
}
.hero-name {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: $text-primary;
  letter-spacing: 1rpx;
  margin-bottom: 6rpx;
}
.hero-id {
  display: block;
  font-size: 22rpx;
  color: $text-muted;
  margin-bottom: 4rpx;
}
.hero-phone {
  display: block;
  font-size: 22rpx;
  color: $text-secondary;
}

/* 编辑胶囊 */
.edit-pill {
  flex-shrink: 0;
  padding: 10rpx 22rpx;
  background: rgba($primary, 0.06);
  border-radius: 20rpx;
  align-self: flex-start;
  margin-top: 4rpx;
}
.edit-label {
  font-size: 22rpx;
  color: $primary;
  font-weight: 500;
}

/* 统计条 */
.stats-strip {
  position: relative;
  z-index: -1;
  transform: translateY(-1rpx);
  margin: 0 28rpx;
  background: $card;
  border-radius: 0 0 28rpx 28rpx;
  box-shadow: $shadow-card;
  padding: 28rpx 0;
  display: flex;
  align-items: center;
}
.stat-unit {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}
.stat-n {
  font-size: 36rpx;
  font-weight: 700;
  color: $text-primary;
  letter-spacing: -1rpx;
}
.stat-l {
  font-size: 20rpx;
  color: $text-muted;
}
.strip-divider {
  width: 1rpx;
  height: 40rpx;
  background: $border;
}

/* ============================================
   内容区
   ============================================ */
.section {
  margin-top: 32rpx;
  padding: 0 28rpx;
}

.section-head {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-bottom: 16rpx;
  padding-left: 4rpx;
}
.head-line {
  width: 6rpx;
  height: 28rpx;
  background: linear-gradient(180deg, $primary, $primary-light);
  border-radius: 3rpx;
}
.gold-line {
  background: linear-gradient(180deg, $gold, $gold-light);
}
.head-title {
  font-size: 26rpx;
  font-weight: 600;
  color: $text-secondary;
  letter-spacing: 2rpx;
  text-transform: uppercase;
}
.gold-title {
  color: $gold;
}

/* ============================================
   订单卡片
   ============================================ */
.order-card {
  background: $card;
  border-radius: 24rpx;
  box-shadow: $shadow-card;
  overflow: hidden;
}
.order-tabs {
  display: flex;
  align-items: center;
  padding: 32rpx 16rpx 24rpx;
}
.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  position: relative;
}
.tab-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tab-glyph {
  font-size: 32rpx;
}
.tab-label {
  font-size: 22rpx;
  color: $text-secondary;
}
.tab-badge {
  position: absolute;
  top: -4rpx;
  right: calc(50% - 36rpx);
  background: $primary;
  color: #fff;
  font-size: 18rpx;
  padding: 2rpx 10rpx;
  border-radius: 20rpx;
  min-width: 32rpx;
  text-align: center;
}

.all-order-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 32rpx;
  border-top: 1rpx solid $border;
}
.all-order-text {
  font-size: 26rpx;
  color: $text-secondary;
}
.all-order-arrow {
  font-size: 34rpx;
  color: $border;
}

/* ============================================
   功能网格
   ============================================ */
.grid-card {
  background: $card;
  border-radius: 24rpx;
  box-shadow: $shadow-card;
  overflow: hidden;
  padding: 8rpx 0;
}
.grid-row {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
}
.grid-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 0;
}
.grid-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.grid-glyph {
  font-size: 32rpx;
}
.grid-label {
  font-size: 22rpx;
  color: $text-secondary;
}
.grid-divider {
  height: 1rpx;
  background: $border;
  margin: 0 32rpx;
}

/* ============================================
   分销卡片
   ============================================ */
.dist-card {
  background: $card;
  border-radius: 24rpx;
  box-shadow: $shadow-card;
  overflow: hidden;
}

.commission-banner {
  display: flex;
  align-items: center;
  padding: 32rpx;
  background: linear-gradient(135deg, #d4a843 0%, #f0d078 40%, #d4a843 100%);
  gap: 0;
}
.banner-left, .banner-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.banner-right {
  align-items: flex-end;
}
.banner-label {
  font-size: 22rpx;
  color: rgba(255,255,255,0.8);
}
.banner-amount {
  font-size: 48rpx;
  font-weight: 800;
  color: #fff;
  letter-spacing: -2rpx;
  line-height: 1;
}
.banner-withdraw {
  font-size: 36rpx;
  font-weight: 700;
  color: #fff;
  letter-spacing: -1rpx;
  line-height: 1;
}

.dist-menu {
  padding-bottom: 8rpx;
}
.dist-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 28rpx 32rpx;
  transition: background 0.12s;
}
.dist-item:active {
  background: rgba(0,0,0,0.025);
}
.dist-divider {
  height: 1rpx;
  background: $border;
  margin: 0 32rpx 0 124rpx;
}
.dist-icon-wrap {
  width: 64rpx;
  height: 64rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.dist-icon {
  font-size: 28rpx;
}
.dist-texts {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.dist-title {
  font-size: 28rpx;
  font-weight: 500;
  color: $text-primary;
}
.dist-sub {
  font-size: 22rpx;
  color: $text-muted;
}
.dist-arrow {
  font-size: 34rpx;
  color: $border;
}

/* ============================================
   设置入口行
   ============================================ */
.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: $card;
  border-radius: 24rpx;
  box-shadow: $shadow-card;
  padding: 28rpx 32rpx;
  transition: background 0.12s;
}
.settings-row:active {
  background: rgba(0,0,0,0.025);
}
.settings-left {
  display: flex;
  align-items: center;
  gap: 20rpx;
}
.settings-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.settings-glyph {
  font-size: 28rpx;
}
.settings-label {
  font-size: 28rpx;
  font-weight: 500;
  color: $text-primary;
}
.settings-arrow {
  font-size: 34rpx;
  color: $border;
}
.settings-right {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.unread-badge {
  background: #FF3B30;
  color: #fff;
  font-size: 20rpx;
  font-weight: 700;
  padding: 2rpx 10rpx;
  border-radius: 20rpx;
  min-width: 32rpx;
  text-align: center;
  line-height: 1.6;
}

/* ============================================
   底部安全区
   ============================================ */
.safe-bottom {
  height: 40rpx;
}
</style>
