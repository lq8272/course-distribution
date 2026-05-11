<template>
  <view class="page">

    <!-- 团队统计 -->
    <view class="stats-hero">
      <view class="hero-bg">
        <view class="bg-circle bg-1"></view>
        <view class="bg-circle bg-2"></view>
      </view>
      <view class="stats-row">
        <view class="stat-card">
          <text class="stat-n">{{ teamStats.total || 0 }}</text>
          <text class="stat-l">团队总人数</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-card">
          <text class="stat-n">{{ teamStats.monthNew || 0 }}</text>
          <text class="stat-l">本月新增</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-card">
          <text class="stat-n">{{ teamStats.totalPerformance || 0 }}</text>
          <text class="stat-l">团队业绩</text>
        </view>
      </view>
    </view>

    <!-- 团队架构 -->
    <view class="section">
      <view class="section-head">
        <view class="head-line"></view>
        <text class="head-title">团队架构</text>
      </view>
      <view class="tree-card">

        <!-- 非分销商提示 -->
        <view v-if="!loading && !teamData.is_agent" class="not-agent">
          <view class="not-agent-icon">👥</view>
          <text class="not-agent-text">您还未成为分销商</text>
          <text class="not-agent-sub">无法查看团队信息</text>
        </view>

        <!-- 根节点 -->
        <view v-if="teamData.is_agent" class="root-node">
          <view class="root-left">
            <view class="avatar-wrap">
              <image
                class="avatar"
                :src="userInfo.avatar || '/static/default-avatar.png'"
                mode="aspectFill"
              />
              <view class="avatar-ring ring-gold"></view>
            </view>
            <view class="root-info">
              <text class="root-name">{{ userInfo.nickname || '我' }}</text>
              <view class="root-tags">
                <text class="root-level">{{ teamData.agent?.level_name || '分销商' }}</text>
                <text class="root-count">下线 {{ teamStats.total || 0 }} 人</text>
              </view>
            </view>
          </view>
          <view class="expand-btn" @click="toggleTree">
            <text class="expand-text">{{ isTreeExpanded ? '收起' : '展开' }}</text>
            <text class="expand-arrow">{{ isTreeExpanded ? '↑' : '↓' }}</text>
          </view>
        </view>

        <!-- 下级列表 -->
        <view v-if="isTreeExpanded && teamData.is_agent" class="sub-tree">
          <view class="tree-line"></view>
          <view
            v-for="(member, index) in teamTree"
            :key="member.user_id || index"
            class="member-node"
          >
            <view class="member-connector"></view>
            <view class="member-avatar">
              <image
                :src="member.avatar || '/static/default-avatar.png'"
                mode="aspectFill"
              />
            </view>
            <view class="member-info">
              <text class="member-name">{{ member.nickname || '用户' + member.user_id }}</text>
              <text class="member-tag">直属下级</text>
            </view>
          </view>

          <view
            class="load-more"
            v-if="teamTree.length < total && !is_truncated && !loadingMore"
            @click="loadMore"
          >
            加载更多下线（{{ teamTree.length }}/{{ total }}）
          </view>
          <view class="load-more" v-if="loadingMore">
            <text class="loading-text">加载中...</text>
          </view>
          <view class="empty-members" v-if="teamTree.length === 0 && !loading">
            <text class="empty-hint">暂无下级成员</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 分销规则 -->
    <view class="section">
      <view class="section-head">
        <view class="head-line gold-line"></view>
        <text class="head-title gold-title">分销规则</text>
      </view>
      <view class="rules-card">
        <view class="rule-item">
          <view class="rule-num" style="background: linear-gradient(145deg, #667eea 0%, #764ba2 100%);">
            <text class="num-text">1</text>
          </view>
          <view class="rule-texts">
            <text class="rule-title">直接推广佣金</text>
            <text class="rule-desc">下线购买课程，您获得 {{ rules.level1Ratio }}% 佣金</text>
          </view>
        </view>
        <view class="rule-item">
          <view class="rule-num" style="background: linear-gradient(145deg, #11998e 0%, #38ef7d 100%);">
            <text class="num-text">2</text>
          </view>
          <view class="rule-texts">
            <text class="rule-title">二级管理奖</text>
            <text class="rule-desc">下线的下线购买，您获得 {{ rules.level2Ratio }}% 管理奖</text>
          </view>
        </view>
        <view class="rule-item">
          <view class="rule-num" style="background: linear-gradient(145deg, #f093fb 0%, #f5576c 100%);">
            <text class="num-text">3</text>
          </view>
          <view class="rule-texts">
            <text class="rule-title">三级管理奖</text>
            <text class="rule-desc">三级下线购买，您获得 {{ rules.level3Ratio }}% 管理奖</text>
          </view>
        </view>
      </view>
    </view>

  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { teamApi } from '@/api/team';
import { agentApi } from '@/api/agent';

const userInfo = ref({});
const teamData = ref({ is_agent: false, agent: null });
const teamStats = ref({});
const teamTree = ref([]);
const isTreeExpanded = ref(true);
const loading = ref(false);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const is_truncated = ref(false);
const loadingMore = ref(false);

const rules = ref({ level1Ratio: 0, level2Ratio: 0, level3Ratio: 0 });

async function loadTree(p = 1) {
  loadingMore.value = p > 1;
  try {
    const res = await teamApi.tree({ page: p, pageSize: pageSize.value, depth: 1 });
    if (res.code === 0) {
      const data = res.data;
      if (data.is_agent === false) {
        teamData.value = { is_agent: false, agent: null };
        return;
      }
      const list = data.list || [];
      if (p === 1) {
        teamTree.value = list;
      } else {
        teamTree.value = [...teamTree.value, ...list];
      }
      total.value = data.total ?? 0;
      is_truncated.value = data.is_truncated ?? false;
      page.value = p;
    }
  } catch (e) {
    console.error('loadTree error', e);
  }
}

async function loadAll() {
  const token = uni.getStorageSync('token');
  if (!token) {
    teamData.value = { is_agent: false, agent: null };
    teamStats.value = {};
    teamTree.value = [];
    loading.value = false;
    uni.reLaunch({ url: '/pages/login/index' });
    return;
  }
  loading.value = true;
  try {
    const raw = uni.getStorageSync('userInfo') || {};
    userInfo.value = raw;

    const [overview, levelRows] = await Promise.all([
      teamApi.overview().catch(() => ({ is_agent: false })),
      agentApi.levels().catch(() => []),
    ]);
    const levelsData = Array.isArray(levelRows) ? levelRows : (levelRows.rows || []);
    teamData.value = overview || { is_agent: false };
    teamStats.value = {
      total: (overview && overview.stats && overview.stats.total) || 0,
      monthNew: (overview && overview.stats && overview.stats.month_new) || 0,
      totalPerformance: (overview && overview.stats && overview.stats.total_performance) || 0,
    };
    await loadTree(1);
    if (levelsData.length) {
      const rates = {};
      levelsData.forEach(r => { rates[r.level] = parseFloat(r.rebate_rate) * 100; });
      rules.value = {
        level1Ratio: rates['DR'] || rates['DISTRIBUTORDR'] || 0,
        level2Ratio: rates['MXJ'] || rates['DISTRIBUTORMXJ'] || 0,
        level3Ratio: rates['CJHH'] || rates['DISTRIBUTORCJHH'] || 0,
      };
    }
  } catch (e) {
    console.error('loadAll error', e);
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

function toggleTree() {
  isTreeExpanded.value = !isTreeExpanded.value;
}

function loadMore() {
  if (loadingMore.value || is_truncated.value) return;
  loadTree(page.value + 1);
}

onShow(() => {
  if (!uni.getStorageSync('token')) {
    uni.showModal({
      title: '提示',
      content: '请先登录',
      showCancel: false,
      success: () => {
        uni.reLaunch({ url: '/pages/login/index' });
      },
    });
    return;
  }
  loadAll();
});
</script>

<style scoped lang="scss">
$bg:            #f5f3ee;
$card:          #ffffff;
$primary:       #FF6B00;
$primary-light: #FF8533;
$gold:          #d4a843;
$text-primary:  #1c1917;
$text-secondary:#57534e;
$text-muted:    #a8a29e;
$border:        #ece8e1;
$shadow-card:   0 2rpx 16rpx rgba(0,0,0,0.06), 0 8rpx 32rpx rgba(0,0,0,0.04);

.page {
  min-height: 100vh;
  background: $bg;
  padding-bottom: 40rpx;
}

/* ============================================
   统计英雄区
   ============================================ */
.stats-hero {
  position: relative;
  background: linear-gradient(135deg, $primary 0%, $primary-light 100%);
  padding: 24rpx 28rpx 0;
  overflow: hidden;
}
.hero-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.bg-circle {
  position: absolute;
  border-radius: 50%;
  opacity: 0.1;
}
.bg-1 {
  width: 400rpx; height: 400rpx;
  background: #fff;
  top: -160rpx; right: -100rpx;
}
.bg-2 {
  width: 250rpx; height: 250rpx;
  background: rgba(#fff, 0.4);
  bottom: -80rpx; left: -60rpx;
}
.stats-row {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  background: rgba(255,255,255,0.15);
  border-radius: 20rpx 20rpx 0 0;
  padding: 24rpx 0;
  backdrop-filter: blur(10rpx);
}
.stat-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}
.stat-n {
  font-size: 36rpx;
  font-weight: 800;
  color: #fff;
  letter-spacing: -1rpx;
}
.stat-l {
  font-size: 20rpx;
  color: rgba(255,255,255,0.8);
}
.stat-divider {
  width: 1rpx;
  height: 40rpx;
  background: rgba(255,255,255,0.25);
}

/* ============================================
   内容区
   ============================================ */
.section {
  margin-top: 28rpx;
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
  background: linear-gradient(180deg, $gold, #f0d078);
}
.head-title {
  font-size: 26rpx;
  font-weight: 600;
  color: $text-secondary;
  letter-spacing: 2rpx;
  text-transform: uppercase;
}
.gold-title { color: $gold; }

/* ============================================
   团队架构卡片
   ============================================ */
.tree-card {
  background: $card;
  border-radius: 24rpx;
  box-shadow: $shadow-card;
  overflow: hidden;
}

/* 未分销提示 */
.not-agent {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 0;
  gap: 12rpx;
}
.not-agent-icon { font-size: 72rpx; }
.not-agent-text {
  font-size: 28rpx;
  font-weight: 600;
  color: $text-secondary;
}
.not-agent-sub {
  font-size: 24rpx;
  color: $text-muted;
}

/* 根节点 */
.root-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx;
  border-bottom: 1rpx solid $border;
}
.root-left {
  display: flex;
  align-items: center;
  gap: 20rpx;
}
.avatar-wrap {
  position: relative;
  flex-shrink: 0;
}
.avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background: #ece8e1;
  display: block;
}
.avatar-ring {
  position: absolute;
  inset: -4rpx;
  border-radius: 50%;
  border: 2rpx solid transparent;
}
.ring-gold {
  border-color: $gold;
  box-shadow: 0 0 16rpx rgba($gold, 0.35);
}
.root-info {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.root-name {
  font-size: 32rpx;
  font-weight: 700;
  color: $text-primary;
}
.root-tags {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.root-level {
  font-size: 20rpx;
  color: $gold;
  background: rgba($gold, 0.1);
  padding: 2rpx 12rpx;
  border-radius: 10rpx;
}
.root-count {
  font-size: 20rpx;
  color: $text-muted;
}
.expand-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
  background: rgba($primary, 0.06);
  padding: 8rpx 18rpx;
  border-radius: 20rpx;
}
.expand-text {
  font-size: 22rpx;
  color: $primary;
}
.expand-arrow {
  font-size: 20rpx;
  color: $primary;
}

/* 下级树 */
.sub-tree {
  position: relative;
  padding: 16rpx 32rpx 24rpx;
}
.tree-line {
  position: absolute;
  left: 55rpx;
  top: 0;
  bottom: 0;
  width: 2rpx;
  background: $border;
}
.member-node {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 0;
  position: relative;
}
.member-connector {
  position: absolute;
  left: -21rpx;
  top: 50%;
  width: 16rpx;
  height: 2rpx;
  background: $border;
}
.member-avatar {
  flex-shrink: 0;
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  overflow: hidden;
  background: #ece8e1;
}
.member-avatar image {
  width: 100%;
  height: 100%;
  display: block;
}
.member-info {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.member-name {
  font-size: 26rpx;
  font-weight: 500;
  color: $text-primary;
}
.member-tag {
  font-size: 20rpx;
  color: $text-muted;
}

.load-more {
  text-align: center;
  padding: 20rpx 0 8rpx;
  font-size: 24rpx;
  color: $primary;
}
.empty-members {
  padding: 20rpx 0;
  text-align: center;
}
.empty-hint {
  font-size: 24rpx;
  color: $text-muted;
}

/* ============================================
   分销规则卡片
   ============================================ */
.rules-card {
  background: $card;
  border-radius: 24rpx;
  box-shadow: $shadow-card;
  overflow: hidden;
  padding: 8rpx 0;
}
.rule-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 28rpx 32rpx;
  transition: background 0.12s;
}
.rule-item:active {
  background: rgba(0,0,0,0.025);
}
.rule-num {
  width: 64rpx;
  height: 64rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.num-text {
  font-size: 28rpx;
  font-weight: 800;
  color: #fff;
}
.rule-texts {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.rule-title {
  font-size: 28rpx;
  font-weight: 600;
  color: $text-primary;
}
.rule-desc {
  font-size: 22rpx;
  color: $text-muted;
}
</style>
