<template>
  <view class="page">
    <!-- 用户信息卡片 -->
    <view class="user-card">
      <view class="user-info">
        <image class="avatar" :src="userInfo.avatar || 'https://img.yzcdn.cn/vant/cat.jpeg'" />
        <view class="info">
          <view class="name">{{ userInfo.name }}</view>
          <view class="id" v-if="userInfo.id">ID: {{ userInfo.id }}</view>
        </view>
        <view class="edit-btn" @click="editProfile">编辑</view>
      </view>
      <view class="user-stats">
        <view class="stat-item" @click="goToMyCourses">
          <text class="value">{{ userInfo.courseCount }}</text>
          <text class="label">我的课程</text>
        </view>
        <view class="stat-item">
          <text class="value">{{ userInfo.followCount }}</text>
          <text class="label">关注</text>
        </view>
        <view class="stat-item">
          <text class="value">{{ userInfo.fansCount }}</text>
          <text class="label">粉丝</text>
        </view>
      </view>
    </view>

    <!-- 订单入口 -->
    <view class="order-section card">
      <view class="section-header">
        <text class="title">我的订单</text>
        <text class="more" @click="goToOrders">全部订单 ></text>
      </view>
      <view class="order-icons">
        <view class="icon-item" @click="goToOrders('pending')">
          <text class="icon">⏳</text>
          <text class="label">待支付</text>
          <view v-if="orderCount.pending" class="badge">{{ orderCount.pending }}</view>
        </view>
        <view class="icon-item" @click="goToOrders('shipped')">
          <text class="icon">🚚</text>
          <text class="label">待收货</text>
          <view v-if="orderCount.shipped" class="badge">{{ orderCount.shipped }}</view>
        </view>
        <view class="icon-item" @click="goToOrders('complete')">
          <text class="icon">✅</text>
          <text class="label">已完成</text>
        </view>
        <view class="icon-item" @click="goToOrders('refund')">
          <text class="icon">💰</text>
          <text class="label">退款/售后</text>
        </view>
      </view>
    </view>

    <!-- 分销入口引导 -->
    <view v-if="!userInfo.isDistributor" class="become-distributor" @click="goToDistribute">
      <text class="bd-icon">💎</text>
      <view class="bd-info">
        <view class="bd-title">成为分销商</view>
        <view class="bd-desc">推广课程赚佣金，开启副业之旅</view>
      </view>
      <button class="bd-btn" @click.stop="goToDistribute">立即加入</button>
    </view>

    <!-- 功能列表 -->
    <view class="menu-section card">
      <view class="menu-item" @click="goToWallet">
        <text class="icon">👛</text>
        <text class="label">我的钱包</text>
        <text class="arrow">></text>
      </view>
      <view class="menu-item" @click="goToAddress">
        <text class="icon">📍</text>
        <text class="label">收货地址</text>
        <text class="arrow">></text>
      </view>
      <view class="menu-item" @click="goToCoupon">
        <text class="icon">🎫</text>
        <text class="label">优惠券</text>
        <text class="arrow">></text>
      </view>
      <view class="menu-item" @click="goToCollection">
        <text class="icon">❤️</text>
        <text class="label">我的收藏</text>
        <text class="arrow">></text>
      </view>
      <view class="menu-item" @click="goToHistory">
        <text class="icon">🕐</text>
        <text class="label">浏览历史</text>
        <text class="arrow">></text>
      </view>
    </view>

    <!-- 分销功能 -->
    <view class="distribute-section card" v-if="userInfo.isDistributor">
      <view class="section-header">
        <text class="title">分销中心</text>
      </view>
      <view class="menu-item" @click="goToDistribute">
        <text class="icon">💵</text>
        <text class="label">佣金明细</text>
        <text class="value primary">¥{{ userInfo.totalCommission }}</text>
        <text class="arrow">></text>
      </view>
      <view class="menu-item" @click="goToTeam">
        <text class="icon">👥</text>
        <text class="label">我的团队</text>
        <text class="arrow">></text>
      </view>
      <view class="menu-item" @click="goToPromo">
        <text class="icon">🔗</text>
        <text class="label">推广码</text>
        <text class="arrow">></text>
      </view>
    </view>

    <!-- 其他设置 -->
    <view class="settings-section card">
      <view class="menu-item" @click="goToSettings">
        <text class="icon">⚙️</text>
        <text class="label">设置</text>
        <text class="arrow">></text>
      </view>
      <view class="menu-item" @click="goToHelp">
        <text class="icon">❓</text>
        <text class="label">帮助与反馈</text>
        <text class="arrow">></text>
      </view>
      <view class="menu-item" @click="contactService">
        <text class="icon">📞</text>
        <text class="label">联系客服</text>
        <text class="arrow">></text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { useUserStore } from '../../store/user';
import { authApi } from '../../api/auth';
import { orderApi } from '../../api/order';
import { agentApi } from '../../api/agent';

const userStore = useUserStore();

const userInfo = ref({
  name: '未登录',
  id: '',
  avatar: 'https://img.yzcdn.cn/vant/cat.jpeg',
  courseCount: 0,
  followCount: 0,
  fansCount: 0,
  isDistributor: false,
  totalCommission: 0,
});

const orderCount = ref({
  pending: 0,
  shipped: 0,
  complete: 0,
  refund: 0,
});

// 每次显示页面时刷新数据
uni.$on('user:refresh', loadAll);
import { onShow } from '@dcloudio/uni-app';
onShow(() => {
  if (userStore.isLoggedIn) {
    loadAll();
  }
});

async function loadAll() {
  await Promise.all([loadUserInfo(), loadOrderCount(), checkDistributor()]);
}

async function loadUserInfo() {
  try {
    const info = await authApi.userinfo();
    userInfo.value.name = info.nickname || '用户';
    userInfo.value.id = info.id || '';
    if (info.avatar) userInfo.value.avatar = info.avatar;
  } catch (e) {
    console.error('loadUserInfo error', e);
  }
}

async function loadOrderCount() {
  try {
    const res = await orderApi.list({ page: 1, page_size: 100 });
    const orders = res.rows || [];
    userInfo.value.courseCount = orders.filter(o => o.status === 1 || o.status === 2).length;
    orderCount.value = {
      pending: orders.filter(o => o.status === 0).length,
      shipped: orders.filter(o => o.status === 2).length,
      complete: orders.filter(o => o.status === 1).length,
      refund: orders.filter(o => o.status === 3).length,
    };
  } catch (e) {
    console.error('loadOrderCount error', e);
  }
}

async function checkDistributor() {
  try {
    const info = await agentApi.my();
    userInfo.value.isDistributor = !!(info && info.id);
    userInfo.value.totalCommission = info.total_commission || 0;
  } catch {
    userInfo.value.isDistributor = false;
  }
}

function editProfile() {
  uni.showToast({ title: '编辑资料', icon: 'none' });
}
function goToMyCourses() {
  uni.showToast({ title: '我的课程', icon: 'none' });
}
function goToOrders(status) {
  const url = '/pages/order/list' + (status !== undefined ? `?status=${status}` : '');
  uni.navigateTo({ url });
}
function stub(name) {
  uni.showToast({ title: name + '功能开发中', icon: 'none' });
}
function goToWallet() { stub('我的钱包'); }
function goToAddress() { stub('收货地址'); }
function goToCoupon() { stub('优惠券'); }
function goToCollection() { stub('我的收藏'); }
function goToHistory() { stub('浏览历史'); }
function goToDistribute() {
  uni.switchTab({ url: '/pages/distribute/index' });
}
function goToTeam() {
  uni.switchTab({ url: '/pages/team/index' });
}
function goToPromo() {
  uni.switchTab({ url: '/pages/distribute/index' });
}
function goToSettings() {
  uni.navigateTo({ url: '/pages/user/settings' });
}
function goToHelp() {
  uni.navigateTo({ url: '/pages/service/conversations' });
}
function contactService() {
  uni.navigateTo({ url: '/pages/service/conversations' });
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg-light);
  padding: 0 0 120rpx;
}

.user-card {
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
  padding: 32rpx 24rpx 40rpx;
  color: #FFFFFF;
  border-radius: 0 0 32rpx 32rpx;
  margin-bottom: 24rpx;
}
.user-info {
  display: flex;
  align-items: center;
  margin-bottom: 36rpx;
}
.user-info .avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255,255,255,0.3);
  margin-right: 24rpx;
  flex-shrink: 0;
}
.user-info .info {
  flex: 1;
  min-width: 0;
}
.user-info .info .name {
  font-size: 36rpx;
  font-weight: 600;
  margin-bottom: 8rpx;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.user-info .info .id {
  font-size: 22rpx;
  color: rgba(255,255,255,0.65);
}
.user-info .edit-btn {
  font-size: 24rpx;
  padding: 8rpx 24rpx;
  background: rgba(255,255,255,0.2);
  border-radius: 20rpx;
  color: #fff;
  flex-shrink: 0;
}

.user-stats {
  display: flex;
  justify-content: space-around;
}
.user-stats .stat-item {
  text-align: center;
  flex: 1;
}
.user-stats .stat-item:not(:last-child) {
  border-right: 1rpx solid rgba(255,255,255,0.2);
}
.user-stats .stat-item .value {
  display: block;
  font-size: 40rpx;
  font-weight: bold;
  margin-bottom: 6rpx;
  color: #fff;
}
.user-stats .stat-item .label {
  font-size: 22rpx;
  color: rgba(255,255,255,0.75);
}

/* 卡片 */
.card {
  margin: 0 24rpx 20rpx;
  background: var(--bg-white);
  border-radius: var(--border-radius);
  padding: 24rpx;
  box-shadow: var(--shadow-sm);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}
.section-header .title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-primary);
}
.section-header .more {
  font-size: 24rpx;
  color: var(--text-gray);
}

.order-icons {
  display: flex;
  justify-content: space-around;
}
.order-icons .icon-item {
  position: relative;
  text-align: center;
  flex: 1;
}
.order-icons .icon-item .icon {
  display: block;
  font-size: 48rpx;
  margin-bottom: 12rpx;
}
.order-icons .icon-item .label {
  font-size: 24rpx;
  color: var(--text-secondary);
}
.order-icons .icon-item .badge {
  position: absolute;
  top: -8rpx;
  right: 16rpx;
  background: var(--price-color);
  color: #fff;
  font-size: 18rpx;
  padding: 2rpx 10rpx;
  border-radius: 20rpx;
  min-width: 32rpx;
  text-align: center;
  line-height: 1.4;
}

/* 分销入口引导（非分销商可见） */
.become-distributor {
  margin: 0 24rpx 20rpx;
  background: linear-gradient(135deg, rgba(102,126,234,0.08), rgba(118,75,162,0.08));
  border: 2rpx dashed var(--brand-primary);
  border-radius: var(--border-radius);
  padding: 28rpx 24rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
}
.become-distributor .bd-icon { font-size: 48rpx; }
.become-distributor .bd-info { flex: 1; }
.become-distributor .bd-title { font-size: 28rpx; font-weight: 600; color: var(--brand-primary); margin-bottom: 6rpx; }
.become-distributor .bd-desc { font-size: 22rpx; color: var(--text-gray); }
.become-distributor .bd-btn {
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
  color: #fff;
  font-size: 24rpx;
  padding: 10rpx 24rpx;
  border-radius: 24rpx;
  border: none;
  line-height: 1.5;
}

/* 菜单项 */
.menu-section, .distribute-section, .settings-section {
  margin: 0 24rpx 20rpx;
  background: var(--bg-white);
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.menu-item {
  display: flex;
  align-items: center;
  padding: 30rpx 24rpx;
  border-bottom: 1rpx solid var(--border-color);
}
.menu-item:last-child { border-bottom: none; }
.menu-item .icon {
  font-size: 40rpx;
  margin-right: 20rpx;
  width: 48rpx;
  text-align: center;
}
.menu-item .label {
  flex: 1;
  font-size: 28rpx;
  color: var(--text-primary);
}
.menu-item .value {
  font-size: 26rpx;
  color: var(--text-gray);
  margin-right: 12rpx;
}
.menu-item .value.primary {
  color: var(--price-color);
  font-weight: 600;
}
.menu-item .arrow {
  font-size: 24rpx;
  color: var(--text-gray);
}

.distribute-section .section-header { padding: 24rpx 24rpx 0; }
</style>
