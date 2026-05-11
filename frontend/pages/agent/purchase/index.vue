<template>
  <view class="page-container">
    <!-- 导航 -->
    <view class="nav-bar">
      <view class="nav-back" @click="goBack">
        <text class="back-icon">←</text>
        <text>返回</text>
      </view>
      <text class="nav-title">拿货申请</text>
      <view class="nav-placeholder"></view>
    </view>

    <!-- 加载态 -->
    <view v-if="loading" class="loading-state">
      <view class="spinner"></view>
      <text class="loading-text">加载中...</text>
    </view>

    <view v-else class="main-content">

      <!-- 配置卡片 - 渐变背景 -->
      <view class="config-card" v-if="cfg">
        <view class="config-header">
          <view class="config-icon">
            <text>📦</text>
          </view>
          <view class="config-info">
            <text class="product-name">{{ cfg.product_name }}</text>
            <text class="config-sub">拿货配置信息</text>
          </view>
        </view>
        <view class="config-divider"></view>
        <view class="config-grid">
          <view class="config-item">
            <text class="config-item-label">拿货单价</text>
            <view class="config-item-value price">
              <text class="price-unit">¥</text>
              <text class="price-num">{{ cfg.purchase_price }}</text>
              <text class="price-unit">/个</text>
            </view>
          </view>
          <view class="config-item">
            <text class="config-item-label">最低数量</text>
            <view class="config-item-value">
              <text class="qty-num">≥ {{ cfg.min_purchase_qty }}</text>
              <text class="qty-unit">个</text>
            </view>
          </view>
          <view class="config-item">
            <text class="config-item-label">我的等级</text>
            <view class="config-item-value level">
              <text class="level-name">{{ levelName }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 无权限提示 -->
      <view class="card no-permission" v-else>
        <view class="empty-state">
          <view class="empty-icon">🔒</view>
          <text class="empty-title">暂无拿货权限</text>
          <text class="empty-desc">您还不是正式分销商，暂不支持拿货申请</text>
        </view>
      </view>

      <!-- 申请表单 -->
      <view class="apply-card" v-if="cfg">
        <view class="apply-header">
          <view class="head-line"></view>
          <text class="head-title">填写拿货信息</text>
        </view>

        <view class="form-group">
          <view class="form-label">
            <text>拿货数量</text>
            <text class="label-hint">（最低 {{ cfg.min_purchase_qty }} 个）</text>
          </view>
          <input
            class="input-field"
            type="number"
            v-model="quantity"
            :placeholder="'请输入拿货数量，最低 ' + cfg.min_purchase_qty + ' 个'"
            @input="onQuantityInput"
          />
        </view>

        <!-- 总价展示 -->
        <view class="total-section" :class="{ active: isValidQuantity }">
          <view class="total-info">
            <text class="total-label">预计总额</text>
            <view class="total-amount" v-if="isValidQuantity">
              <text class="amount-yuan">¥</text>
              <text class="amount-num">{{ totalAmount }}</text>
            </view>
            <text class="total-hint" v-else>请输入有效的拿货数量</text>
          </view>
          <view class="total-breakdown" v-if="isValidQuantity">
            <text class="breakdown-text">{{ quantity }} 个 × ¥{{ cfg.purchase_price }}/个</text>
          </view>
        </view>

        <!-- 提交按钮 -->
        <view
          :class="['btn-primary', 'submit-btn', { disabled: !canSubmit || submitting }]"
          @click="handleSubmit"
        >
          <text v-if="submitting">提交中...</text>
          <text v-else>提交拿货申请</text>
        </view>

        <view class="submit-hint" v-if="canSubmit && !submitting">
          <text>点击提交后将扣除您的账户余额</text>
        </view>
      </view>

      <!-- 历史记录 -->
      <view class="records-section" v-if="records.length > 0">
        <view class="section-head">
          <view class="head-line"></view>
          <text class="head-title">拿货记录</text>
        </view>

        <view
          v-for="(r, index) in records"
          :key="r.id"
          class="record-card animate-fade-in"
          :style="{ animationDelay: index * 0.05 + 's' }"
        >
          <view class="record-header">
            <view class="record-left">
              <text class="record-amount amount amount--primary">¥{{ r.total_amount }}</text>
              <text class="record-qty">× {{ r.quantity }} 个 · 单价 ¥{{ r.purchase_price || cfg?.purchase_price }}</text>
            </view>
            <view :class="['badge', getStatusBadgeClass(r.status)]">
              <text>{{ getStatusText(r.status) }}</text>
            </view>
          </view>
          <view class="record-footer">
            <text class="record-time">{{ formatTime(r.created_at) }}</text>
            <text class="record-id">No. {{ r.id }}</text>
          </view>
        </view>
      </view>

      <!-- 空记录 -->
      <view class="empty-records" v-if="!loading && records.length === 0 && cfg">
        <view class="empty-state">
          <view class="empty-icon">📋</view>
          <text class="empty-title">暂无拿货记录</text>
          <text class="empty-desc">您还没有提交过拿货申请</text>
        </view>
      </view>

    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { purchaseApi } from '@/api/purchase';

const loading = ref(true);
const submitting = ref(false);
const cfg = ref(null);
const quantity = ref('');
const records = ref([]);

const levelMap = { DR: '达人', MXJ: '梦想家', CJHH: '超级合伙人' };

const statusMap = {
  0: { text: '待审核', class: 'badge--pending' },
  1: { text: '已通过', class: 'badge--success' },
  2: { text: '已拒绝', class: 'badge--rejected' },
};

onMounted(async () => {
  try {
    const [cfgData, recsData] = await Promise.all([
      purchaseApi.config().catch(() => null),
      purchaseApi.records().catch(() => ({ rows: [] })),
    ]);
    cfg.value = cfgData;
    records.value = recsData.rows || [];
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
});

const levelName = computed(() => {
  if (!cfg.value) return '—';
  return levelMap[cfg.value.level] || cfg.value.level || '普通用户';
});

const totalAmount = computed(() => {
  if (!cfg.value || !quantity.value) return '0.00';
  return (parseFloat(cfg.value.purchase_price) * parseInt(quantity.value || 0)).toFixed(2);
});

const isValidQuantity = computed(() => {
  if (!cfg.value) return false;
  return parseInt(quantity.value || 0) >= cfg.value.min_purchase_qty;
});

const canSubmit = computed(() => {
  if (!cfg.value) return false;
  return parseInt(quantity.value || 0) >= cfg.value.min_purchase_qty;
});

function onQuantityInput() {
  // trigger reactive update
}

function goBack() {
  uni.navigateBack();
}

function getStatusBadgeClass(status) {
  return statusMap[status]?.class || 'badge--pending';
}

function getStatusText(status) {
  return statusMap[status]?.text || '未知';
}

async function handleSubmit() {
  if (submitting.value || !canSubmit.value) return;
  submitting.value = true;
  try {
    await purchaseApi.apply({ quantity: parseInt(quantity.value) });
    uni.showToast({ title: '申请已提交', icon: 'success' });
    quantity.value = '';
    const recsData = await purchaseApi.records().catch(() => ({ rows: [] }));
    records.value = recsData.rows || [];
  } catch (e) {
    const msg = (e && e.message) || '提交失败，请重试';
    uni.showToast({ title: msg, icon: 'none' });
  } finally {
    submitting.value = false;
  }
}

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<script>
export default { options: { virtualHost: true } };
</script>

<style lang="scss" scoped>
@import "@/common/styles/base.scss";

.page-container {
  min-height: 100vh;
  background: $bg-base;
}

.main-content {
  padding: $space-lg;
  padding-bottom: $space-2xl;
}

// ========== 配置卡片（渐变背景） ==========
.config-card {
  background: linear-gradient(135deg, $primary 0%, $primary-light 100%);
  border-radius: $radius-xl;
  padding: $space-lg;
  margin-bottom: $space-lg;
  box-shadow: $shadow-primary;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -30%;
    width: 200rpx;
    height: 200rpx;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
  }

  &::after {
    content: '';
    position: absolute;
    bottom: -30%;
    left: -20%;
    width: 160rpx;
    height: 160rpx;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 50%;
  }
}

.config-header {
  display: flex;
  align-items: center;
  gap: $space-md;
  margin-bottom: $space-lg;
  position: relative;
  z-index: 1;
}

.config-icon {
  width: 88rpx;
  height: 88rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: $radius-lg;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 44rpx;
}

.config-info {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.product-name {
  font-size: $text-lg;
  font-weight: 600;
  color: #fff;
}

.config-sub {
  font-size: $text-sm;
  color: rgba(255, 255, 255, 0.75);
}

.config-divider {
  height: 1rpx;
  background: rgba(255, 255, 255, 0.2);
  margin-bottom: $space-lg;
  position: relative;
  z-index: 1;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: $space-md;
  position: relative;
  z-index: 1;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.config-item-label {
  font-size: $text-xs;
  color: rgba(255, 255, 255, 0.7);
}

.config-item-value {
  display: flex;
  align-items: baseline;
  gap: 2rpx;

  &.price .price-unit { font-size: $text-sm; color: rgba(255,255,255,0.9); }
  &.price .price-num { font-size: $text-xl; font-weight: 700; color: #fff; }

  .qty-num { font-size: $text-md; font-weight: 600; color: #fff; }
  .qty-unit { font-size: $text-xs; color: rgba(255,255,255,0.7); }

  .level-name {
    font-size: $text-md;
    font-weight: 600;
    color: #ffd700;
  }
}

// ========== 无权限卡片 ==========
.no-permission {
  .empty-icon {
    background: $bg-base;
    image { filter: grayscale(1); opacity: 0.5; }
  }
}

// ========== 申请表单 ==========
.apply-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $space-lg;
  margin-bottom: $space-lg;
  box-shadow: $shadow-card;
}

.apply-header {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-bottom: $space-lg;
}

.form-group {
  margin-bottom: $space-lg;
}

.form-label {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: $space-sm;
  font-size: $text-base;
  font-weight: 500;
  color: $text-primary;

  .label-hint {
    font-size: $text-sm;
    color: $text-muted;
    font-weight: 400;
  }
}

// ========== 总价区域 ==========
.total-section {
  background: $bg-base;
  border-radius: $radius-md;
  padding: $space-md;
  margin-bottom: $space-lg;
  transition: all 0.3s ease;

  &.active {
    background: $primary-alpha-10;
  }
}

.total-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.total-label {
  font-size: $text-base;
  color: $text-secondary;
}

.total-amount {
  display: flex;
  align-items: baseline;

  .amount-yuan {
    font-size: $text-md;
    font-weight: 600;
    color: $primary;
    margin-right: 2rpx;
  }

  .amount-num {
    font-size: $text-3xl;
    font-weight: 700;
    color: $primary;
    font-family: 'DIN Alternate', -apple-system, sans-serif;
    letter-spacing: -1rpx;
  }
}

.total-hint {
  font-size: $text-sm;
  color: $text-muted;
}

.total-breakdown {
  margin-top: 8rpx;

  .breakdown-text {
    font-size: $text-sm;
    color: $text-muted;
  }
}

// ========== 提交按钮 ==========
.submit-btn {
  margin-bottom: $space-sm;

  &.disabled {
    opacity: 0.45;
    pointer-events: none;
  }
}

.submit-hint {
  text-align: center;
  font-size: $text-xs;
  color: $text-muted;
}

// ========== 记录区域 ==========
.records-section {
  margin-top: $space-lg;
}

.record-card {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: $space-md;
  margin-bottom: $space-sm;
  box-shadow: $shadow-sm;
}

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: $space-sm;
}

.record-left {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.record-amount {
  font-size: $text-lg;
  font-weight: 700;
}

.record-qty {
  font-size: $text-sm;
  color: $text-muted;
}

.record-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: $space-sm;
  border-top: 1rpx solid $border;
}

.record-time {
  font-size: $text-xs;
  color: $text-muted;
}

.record-id {
  font-size: $text-xs;
  color: $text-disabled;
  font-family: monospace;
}

// ========== 空记录 ==========
.empty-records {
  margin-top: $space-lg;
}
</style>
