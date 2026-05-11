<template>
  <view class="page-container">
    <!-- 导航 -->
    <view class="nav-bar">
      <view class="nav-back" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <text class="nav-title">申请升级</text>
      <view class="nav-placeholder"></view>
    </view>

    <!-- 加载态 -->
    <view v-if="loading" class="loading-state">
      <view class="spinner"></view>
      <text class="loading-text">加载中...</text>
    </view>

    <view v-else class="main-content">

      <!-- ========== Hero 卡片 ========== -->
      <view class="hero-card">
        <!-- 装饰光晕 -->
        <view class="hero-glow"></view>

        <!-- 等级标签 -->
        <view class="level-badge-wrap">
          <view class="level-badge level-badge--current">
            <text class="badge-dot"></text>
            <text class="badge-text">{{ currentLevelName }}</text>
          </view>
          <view class="level-arrow">
            <text class="arrow-line"></text>
            <text class="arrow-head">›</text>
          </view>
          <view class="level-badge level-badge--next">
            <text class="badge-dot"></text>
            <text class="badge-text">{{ nextLevelName }}</text>
          </view>
        </view>

        <!-- 进度信息 -->
        <view class="progress-info">
          <view class="progress-numbers">
            <text class="progress-current">{{ currentCount }}</text>
            <text class="progress-sep">/</text>
            <text class="progress-required">{{ requiredCount }}</text>
            <text class="progress-unit">人</text>
          </view>
          <text class="progress-label">{{ progress.value.min_purchase_for_upgrade > 0 ? '推荐人数 + 拿货数量进度' : '推荐人数进度' }}</text>
        </view>

        <!-- 进度条 -->
        <view class="progress-track">
          <view
            class="progress-fill"
            :style="{ width: progressPercent + '%' }"
            :class="{ 'is-full': isConditionMet }"
          ></view>
          <view
            class="progress-dot"
            :style="{ left: progressPercent + '%' }"
            v-if="progressPercent > 0"
          ></view>
        </view>

        <!-- 状态提示 -->
        <view class="hero-tip" :class="isConditionMet ? 'tip--ready' : 'tip--waiting'">
          <text class="tip-icon">{{ isConditionMet ? '✓' : '⏳' }}</text>
          <text class="tip-text">{{ isConditionMet ? '已满足升级条件，可提交申请' : `还需${!isReferralMet ? `推荐 ${requiredCount - currentCount} 人` : ''}${!isPurchaseMet ? `${!isReferralMet ? '，且' : ''}拿货 ${minPurchase - (progress.current_purchase||0)} 个` : ''}即可升级` }}</text>
        </view>
      </view>

      <!-- ========== 升级条件卡片 ========== -->
      <view class="card section-card">
        <view class="section-head">
          <view class="head-line"></view>
          <text class="head-title">升级条件</text>
        </view>

        <view class="condition-list">
          <view class="condition-item" v-for="(item, index) in conditionItems" :key="index">
            <view class="condition-left">
              <view class="condition-icon" :class="item.met ? 'icon--success' : 'icon--pending'">
                <text>{{ item.met ? '✓' : (index + 1) }}</text>
              </view>
              <view class="condition-text">
                <text class="condition-name">{{ item.label }}</text>
                <text class="condition-desc">{{ item.desc }}</text>
              </view>
            </view>
            <view class="condition-status">
              <text class="status-tag" :class="item.met ? 'tag--success' : 'tag--warning'">
                {{ item.met ? '已达成' : '进行中' }}
              </text>
            </view>
          </view>
        </view>

        <!-- 无待审申请提示 -->
        <view v-if="!hasPending && isConditionMet" class="ready-banner">
          <view class="ready-icon">
            <text>🎉</text>
          </view>
          <view class="ready-info">
            <text class="ready-title">条件已满足</text>
            <text class="ready-desc">快来提交升级申请吧</text>
          </view>
        </view>
      </view>

      <!-- ========== 申请按钮 ========== -->
      <view class="action-area">
        <view v-if="hasPending" class="pending-card">
          <view class="pending-icon">
            <text>⏳</text>
          </view>
          <view class="pending-info">
            <text class="pending-title">申请审核中</text>
            <text class="pending-desc">您的升级申请正在审核，请耐心等待</text>
          </view>
        </view>

        <button
          v-else
          class="btn-primary apply-btn"
          :class="{ disabled: !isConditionMet || submitting }"
          :disabled="!isConditionMet || submitting"
          @click="handleSubmit"
        >
          <text v-if="submitting" class="btn-loading">提交中...</text>
          <text v-else>立即申请升级</text>
        </button>
      </view>

      <!-- ========== 历史记录 ========== -->
      <view class="card section-card">
        <view class="section-head">
          <view class="head-line"></view>
          <text class="head-title">申请记录</text>
        </view>

        <!-- 空状态 -->
        <view v-if="records.length === 0" class="empty-state">
          <view class="empty-icon">
            <text style="font-size: 48rpx;">📋</text>
          </view>
          <text class="empty-title">暂无申请记录</text>
          <text class="empty-desc">完成升级条件后即可提交申请</text>
        </view>

        <!-- 记录列表 -->
        <view v-else class="record-list">
          <view
            class="record-item animate-fade-in"
            v-for="(r, index) in records"
            :key="r.id"
            :style="{ animationDelay: (index * 0.05) + 's' }"
          >
            <view class="record-main">
              <view class="record-level">
                <text class="level-from">{{ r.from_level_name }}</text>
                <view class="level-arrow-icon">
                  <text>→</text>
                </view>
                <text class="level-to">{{ r.to_level_name }}</text>
              </view>
              <view class="record-time">{{ formatTime(r.created_at) }}</view>
              <view v-if="r.remark" class="record-remark">{{ r.remark }}</view>
            </view>
            <view class="record-badge">
              <text class="badge" :class="getStatusBadgeClass(r.status)">
                {{ getStatusText(r.status) }}
              </text>
            </view>
          </view>
        </view>
      </view>

    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { agentApi } from '@/api/agent';

const loading = ref(true);
const submitting = ref(false);
const records = ref([]);
const progress = ref({});

const levelNames = { DR: '达人', MXJ: '梦想家', CJHH: '超级合伙人' };
const levelPriorities = { DR: 1, MXJ: 2, CJHH: 3 };

// 当前等级名称
const currentLevelName = computed(() => {
  const lvl = progress.value.current_level || progress.value.from_level || '';
  return levelNames[lvl] || '—';
});

// 目标等级名称
const nextLevelName = computed(() => {
  const lvl = progress.value.next_level || progress.value.to_level || '';
  return levelNames[lvl] || '—';
});

const requiredCount = computed(() => progress.value.required_count || progress.value.required || 0);
const currentCount = computed(() => progress.value.current_count || progress.value.current || 0);

const progressPercent = computed(() => {
  if (!requiredCount.value) return 0;
  return Math.min(100, Math.round((currentCount.value / requiredCount.value) * 100));
});

const isReferralMet = computed(() => currentCount.value >= requiredCount.value && requiredCount.value > 0);
const minPurchase = computed(() => progress.value.min_purchase_for_upgrade || 0);
const isPurchaseMet = computed(() => {
  const mp = minPurchase.value;
  return mp === 0 || (progress.value.current_purchase || 0) >= mp;
});

const isConditionMet = computed(() => {
  const referralOk = currentCount.value >= requiredCount.value && requiredCount.value > 0;
  const minPurchase = progress.value.min_purchase_for_upgrade || 0;
  const purchaseOk = minPurchase === 0 || (progress.value.current_purchase || 0) >= minPurchase;
  return referralOk && purchaseOk;
});

// 升级条件列表
const conditionItems = computed(() => {
  const fromLevel = progress.value.current_level || progress.value.from_level || '';
  const unit = fromLevel === 'DR' ? '达人' : fromLevel === 'MXJ' ? '梦想家' : '人';

  const items = [{
    label: '推荐人数',
    desc: `成功推荐至少 ${requiredCount.value} 位${unit}`,
    met: currentCount.value >= requiredCount.value && requiredCount.value > 0,
  }];

  // 如果目标等级有最低拿货要求
  const minPurchase = progress.value.min_purchase_for_upgrade || 0;
  if (minPurchase > 0) {
    items.push({
      label: '拿货数量',
      desc: `累计拿货至少 ${minPurchase} 个（当前 ${progress.value.current_purchase || 0} 个）`,
      met: (progress.value.current_purchase || 0) >= minPurchase,
    });
  }

  return items;
});

// 是否有待审申请
const hasPending = computed(() => records.value.some(r => r.status === 0));

onMounted(async () => {
  try {
    const [progressData, recs] = await Promise.all([
      agentApi.upgradeProgress().catch(() => ({})),
      agentApi.upgradeRecords().catch(() => []),
    ]);
    progress.value = progressData;
    records.value = (recs || []).map(r => ({
      ...r,
      from_level_name: levelNames[r.from_level] || r.from_level || '—',
      to_level_name: levelNames[r.to_level] || r.to_level || '—',
    }));
  } catch (e) {
    console.error('加载失败', e);
  } finally {
    loading.value = false;
  }
});

function goBack() {
  uni.navigateBack();
}

async function handleSubmit() {
  if (submitting.value || hasPending.value) return;
  if (!isConditionMet.value) {
    uni.showToast({ title: '条件不满足，无法申请', icon: 'none' });
    return;
  }
  submitting.value = true;
  try {
    await agentApi.applyUpgrade();
    uni.showToast({ title: '申请已提交', icon: 'success' });
    const recs = await agentApi.upgradeRecords().catch(() => []);
    records.value = (recs || []).map(r => ({
      ...r,
      from_level_name: levelNames[r.from_level] || r.from_level || '—',
      to_level_name: levelNames[r.to_level] || r.to_level || '—',
    }));
  } catch (e) {
    const msg = (e && e.message) || '提交失败，请重试';
    uni.showToast({ title: msg, icon: 'none' });
  } finally {
    submitting.value = false;
  }
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = n => n < 10 ? '0' + n : n;
  return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getStatusText(status) {
  const map = { 0: '审批中', 1: '已通过', 2: '已拒绝' };
  return map[status] || '未知';
}

function getStatusBadgeClass(status) {
  const map = { 0: 'badge--pending', 1: 'badge--success', 2: 'badge--rejected' };
  return map[status] || 'badge--gray';
}
</script>

<script>
export default { options: { virtualHost: true } };
</script>

<style lang="scss" scoped>
@import "@/common/styles/base.scss";

// ========== Hero 卡片 ==========
.hero-card {
  position: relative;
  margin: $space-lg;
  padding: $space-xl $space-lg;
  background: linear-gradient(135deg, $primary 0%, $primary-light 100%);
  border-radius: $radius-xl;
  overflow: hidden;
  box-shadow: $shadow-primary;

  .hero-glow {
    position: absolute;
    top: -60rpx;
    right: -60rpx;
    width: 240rpx;
    height: 240rpx;
    background: radial-gradient(circle, rgba(255,255,255,0.25) 0%, transparent 70%);
    pointer-events: none;
  }
}

.level-badge-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $space-md;
  margin-bottom: $space-lg;
}

.level-badge {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 10rpx 20rpx;
  border-radius: $radius-pill;
  background: rgba(255,255,255,0.25);
  backdrop-filter: blur(10rpx);

  .badge-dot {
    width: 8rpx;
    height: 8rpx;
    border-radius: 50%;
    background: rgba(255,255,255,0.8);
  }

  .badge-text {
    font-size: $text-md;
    font-weight: 600;
    color: #fff;
  }

  &--current .badge-dot {
    animation: pulse 1.5s ease infinite;
  }
}

.level-arrow {
  display: flex;
  align-items: center;
  gap: 2rpx;
  color: rgba(255,255,255,0.8);

  .arrow-line {
    display: block;
    width: 24rpx;
    height: 2rpx;
    background: rgba(255,255,255,0.7);
  }

  .arrow-head {
    font-size: $text-xl;
    font-weight: 300;
  }
}

.progress-info {
  text-align: center;
  margin-bottom: $space-md;

  .progress-numbers {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 4rpx;
  }

  .progress-current {
    font-size: 56rpx;
    font-weight: 800;
    color: #fff;
    line-height: 1;
    font-family: 'DIN Alternate', -apple-system, sans-serif;
  }

  .progress-sep {
    font-size: $text-xl;
    color: rgba(255,255,255,0.6);
    margin: 0 2rpx;
  }

  .progress-required {
    font-size: $text-xl;
    font-weight: 600;
    color: rgba(255,255,255,0.8);
  }

  .progress-unit {
    font-size: $text-sm;
    color: rgba(255,255,255,0.7);
    margin-left: 4rpx;
  }

  .progress-label {
    display: block;
    font-size: $text-sm;
    color: rgba(255,255,255,0.7);
    margin-top: 4rpx;
  }
}

.progress-track {
  position: relative;
  height: 10rpx;
  background: rgba(255,255,255,0.3);
  border-radius: 5rpx;
  margin-bottom: $space-md;
  overflow: visible;

  .progress-fill {
    height: 100%;
    background: rgba(255,255,255,0.9);
    border-radius: 5rpx;
    transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;

    &.is-full {
      background: #FFD700;
      box-shadow: 0 0 12rpx rgba(#FFD700, 0.6);
    }
  }

  .progress-dot {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 18rpx;
    height: 18rpx;
    background: #fff;
    border-radius: 50%;
    box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.2);
    margin-left: -1rpx;
  }
}

.hero-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 14rpx 20rpx;
  border-radius: $radius-pill;
  font-size: $text-sm;
  font-weight: 500;

  .tip-icon { font-size: $text-base; }
  .tip-text { color: #fff; }

  &.tip--ready {
    background: rgba(#FFD700, 0.25);
    border: 1rpx solid rgba(#FFD700, 0.5);
  }

  &.tip--waiting {
    background: rgba(255,255,255,0.15);
    border: 1rpx solid rgba(255,255,255,0.25);
  }
}

// ========== 主内容区 ==========
.main-content {
  padding-bottom: $space-2xl;
}

.section-card {
  margin: 0 $space-lg $space-lg;
}

// ========== 升级条件 ==========
.condition-list {
  display: flex;
  flex-direction: column;
  gap: $space-md;
}

.condition-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $space-md 0;
  border-bottom: 1rpx solid $border-light;

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
}

.condition-left {
  display: flex;
  align-items: center;
  gap: $space-md;
}

.condition-icon {
  width: 56rpx;
  height: 56rpx;
  border-radius: $radius-md;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $text-sm;
  font-weight: 700;
  flex-shrink: 0;

  &.icon--success {
    @include gradient-primary;
    color: #fff;
    box-shadow: $shadow-primary;
  }

  &.icon--pending {
    background: $warning-alpha-10;
    color: $warning;
  }
}

.condition-text {
  display: flex;
  flex-direction: column;
  gap: 4rpx;

  .condition-name {
    font-size: $text-base;
    font-weight: 600;
    color: $text-primary;
  }

  .condition-desc {
    font-size: $text-sm;
    color: $text-muted;
  }
}

.status-tag {
  font-size: $text-xs;
  padding: 4rpx 14rpx;
  border-radius: $radius-pill;
  font-weight: 600;
}

// ========== 准备就绪 Banner ==========
.ready-banner {
  display: flex;
  align-items: center;
  gap: $space-md;
  margin-top: $space-lg;
  padding: $space-md $space-lg;
  background: $success-alpha-10;
  border: 1rpx solid rgba($success, 0.2);
  border-radius: $radius-lg;

  .ready-icon {
    font-size: 40rpx;
  }

  .ready-title {
    display: block;
    font-size: $text-base;
    font-weight: 600;
    color: $success;
  }

  .ready-desc {
    display: block;
    font-size: $text-sm;
    color: $text-secondary;
    margin-top: 2rpx;
  }
}

// ========== 申请按钮区 ==========
.action-area {
  padding: 0 $space-lg;
  margin-bottom: $space-lg;
}

.apply-btn {
  width: 100%;
  padding: 28rpx 0;
  font-size: $text-lg;
  letter-spacing: 2rpx;

  .btn-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: $space-sm;
  }
}

// ========== 待审卡片 ==========
.pending-card {
  display: flex;
  align-items: center;
  gap: $space-md;
  padding: $space-lg;
  background: $warning-alpha-10;
  border: 1rpx solid rgba($warning, 0.2);
  border-radius: $radius-lg;

  .pending-icon {
    font-size: 40rpx;
  }

  .pending-title {
    display: block;
    font-size: $text-base;
    font-weight: 600;
    color: $warning;
  }

  .pending-desc {
    display: block;
    font-size: $text-sm;
    color: $text-secondary;
    margin-top: 4rpx;
  }
}

// ========== 历史记录 ==========
.record-list {
  display: flex;
  flex-direction: column;
  gap: $space-md;
}

.record-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: $space-lg;
  background: $bg-base;
  border-radius: $radius-lg;
  border: 1rpx solid $border-light;

  &.animate-fade-in {
    animation: fadeIn 0.35s ease both;
  }
}

.record-main {
  flex: 1;
}

.record-level {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 6rpx;

  .level-from {
    font-size: $text-base;
    font-weight: 600;
    color: $text-primary;
  }

  .level-arrow-icon {
    font-size: $text-sm;
    color: $text-muted;
  }

  .level-to {
    font-size: $text-base;
    font-weight: 600;
    color: $primary;
  }
}

.record-time {
  font-size: $text-sm;
  color: $text-muted;
}

.record-remark {
  font-size: $text-sm;
  color: $text-secondary;
  margin-top: 6rpx;
  padding: 8rpx 12rpx;
  background: rgba($primary, 0.06);
  border-radius: $radius-sm;
  display: inline-block;
}

.record-badge {
  flex-shrink: 0;
  margin-left: $space-md;
}

// ========== 动画 ==========
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8rpx); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
}
</style>
