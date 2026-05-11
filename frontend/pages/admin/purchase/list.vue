<template>
  <view class="page">
    <!-- 导航 -->
    <view class="nav-bar">
      <view class="nav-back" @click="goBack">
        <text class="back-icon">←</text>
        <text>返回</text>
      </view>
      <text class="nav-title">拿货记录</text>
      <view class="nav-placeholder"></view>
    </view>

    <!-- 状态筛选 -->
    <view class="filter-bar">
      <view
        v-for="s in statusFilter"
        :key="s.value"
        :class="filterStatus === s.value ? 'filter-tag active' : 'filter-tag'"
        @click="switchStatus(s.value)"
      >{{ s.label }}</view>
    </view>

    <!-- 统计卡片 -->
    <view class="stats-bar" v-if="stats">
      <view class="stat-item">
        <text class="stat-n">{{ stats.total || 0 }}</text>
        <text class="stat-l">总记录</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-n stat-orange">{{ stats.pending || 0 }}</text>
        <text class="stat-l">待审核</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-n stat-green">{{ stats.approved || 0 }}</text>
        <text class="stat-l">已确认</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-n stat-red">{{ stats.rejected || 0 }}</text>
        <text class="stat-l">已拒绝</text>
      </view>
    </view>

    <!-- 加载态 -->
    <view v-if="loading" class="state-card">
      <view class="state-icon">⏳</view>
      <text class="state-text">加载中...</text>
    </view>

    <!-- 空状态 -->
    <view v-else-if="records.length === 0" class="state-card">
      <view class="state-icon">📦</view>
      <text class="state-text">暂无拿货记录</text>
    </view>

    <!-- 记录列表 -->
    <view v-else v-for="r in records" :key="r.id" class="record-card">
      <view class="record-header">
        <view class="record-left">
          <text class="record-id">#{{ r.id }}</text>
          <text class="record-nickname">{{ r.buyer_nickname || '未知用户' }}</text>
        </view>
        <view :class="['badge', getStatusBadgeClass(r.status)]">
          <text>{{ getStatusText(r.status) }}</text>
        </view>
      </view>

      <view class="record-body">
        <view class="record-row">
          <text class="record-label">分销等级</text>
          <text class="record-value">{{ levelName(r.buyer_level) || r.buyer_level || '—' }}</text>
        </view>
        <view class="record-row">
          <text class="record-label">拿货数量</text>
          <text class="record-value primary">× {{ r.quantity }} 个</text>
        </view>
        <view class="record-row">
          <text class="record-label">拿货单价</text>
          <text class="record-value">¥{{ r.purchase_price }}</text>
        </view>
        <view class="record-row">
          <text class="record-label">总金额</text>
          <text class="record-value primary">¥{{ r.total_amount }}</text>
        </view>
        <view class="record-row">
          <text class="record-label">申请时间</text>
          <text class="record-value">{{ formatTime(r.created_at) }}</text>
        </view>
        <view class="record-row" v-if="r.reviewed_at">
          <text class="record-label">处理时间</text>
          <text class="record-value">{{ formatTime(r.reviewed_at) }}</text>
        </view>
      </view>

      <!-- 操作按钮（仅待审核显示） -->
      <view class="record-actions" v-if="r.status === 0">
        <view class="btn-sm btn-outline" @click="openReject(r)">拒绝</view>
        <view class="btn-sm btn-filled" @click="approve(r.id)">确认通过</view>
      </view>
    </view>

    <!-- 分页 -->
    <view class="pagination" v-if="total > pageSize">
      <view class="page-btn" :class="{disabled: page <= 1}" @click="page--; loadData()">← 上一页</view>
      <text class="page-info">{{ page }} / {{ Math.ceil(total / pageSize) }}</text>
      <view class="page-btn" :class="{disabled: page >= Math.ceil(total / pageSize)}" @click="page++; loadData()">下一页 →</view>
    </view>

    <!-- 拒绝原因弹窗 -->
    <view v-if="showRejectModal" class="modal-mask" @click="closeReject">
      <view class="modal" @click.stop>
        <view class="modal-header">
          <text class="modal-title">拒绝申请</text>
        </view>
        <textarea v-model="rejectReason" class="reason-input" placeholder="请输入拒绝理由（选填）" maxlength="200" />
        <view class="modal-actions">
          <view class="btn-cancel" @click="closeReject">取消</view>
          <view class="btn-confirm-red" @click="confirmReject">确认拒绝</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api, BASE_URL } from '@/api/index';

const { showToast: toast } = uni;

const loading = ref(false);
const records = ref([]);
const stats = ref(null);
const page = ref(1);
const pageSize = 20;
const total = ref(0);
const filterStatus = ref(-1); // -1=全部
const showRejectModal = ref(false);
const rejectReason = ref('');
const currentRecord = ref(null);

const statusFilter = [
  { label: '全部', value: -1 },
  { label: '待审核', value: 0 },
  { label: '已确认', value: 1 },
  { label: '已拒绝', value: 2 },
];

const levelMap = { DR: '达人', MXJ: '梦想家', CJHH: '超级合伙人' };

const statusMap = {
  0: { text: '待审核', class: 'badge--pending' },
  1: { text: '已确认', class: 'badge--success' },
  2: { text: '已拒绝', class: 'badge--rejected' },
};

function levelName(lvl) { return levelMap[lvl] || lvl || '—'; }

function getStatusBadgeClass(status) {
  return statusMap[status]?.class || 'badge--pending';
}

function getStatusText(status) {
  return statusMap[status]?.text || '未知';
}

function formatTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

async function loadData() {
  loading.value = true;
  try {
    const params = { page: page.value, page_size: pageSize };
    if (filterStatus.value !== -1) params.status = filterStatus.value;
    const res = await api.get('/admin/purchase/list', params);
    records.value = res.rows || [];
    total.value = res.total || 0;
  } catch (e) {
    console.error(e);
    toast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

async function loadStats() {
  try {
    // 从 records 统计或单独查
    const [pendingRes, approvedRes, rejectedRes, allRes] = await Promise.all([
      api.get('/admin/purchase/list', { status: 0, page: 1, page_size: 1 }),
      api.get('/admin/purchase/list', { status: 1, page: 1, page_size: 1 }),
      api.get('/admin/purchase/list', { status: 2, page: 1, page_size: 1 }),
      api.get('/admin/purchase/list', { page: 1, page_size: 1 }),
    ]);
    stats.value = {
      pending: pendingRes.total || 0,
      approved: approvedRes.total || 0,
      rejected: rejectedRes.total || 0,
      total: allRes.total || 0,
    };
  } catch (e) {
    console.error(e);
  }
}

function switchStatus(val) {
  filterStatus.value = val;
  page.value = 1;
  loadData();
}

function openReject(r) {
  currentRecord.value = r;
  rejectReason.value = '';
  showRejectModal.value = true;
}

function closeReject() {
  showRejectModal.value = false;
}

async function confirmReject() {
  try {
    await api.post(`/admin/purchase/${currentRecord.value.id}/reject`, { reason: rejectReason.value });
    toast({ title: '已拒绝', icon: 'success' });
    closeReject();
    loadData();
    loadStats();
  } catch (e) {
    toast({ title: '操作失败', icon: 'none' });
  }
}

async function approve(id) {
  try {
    await api.post(`/admin/purchase/${id}/approve`);
    toast({ title: '已确认', icon: 'success' });
    loadData();
    loadStats();
  } catch (e) {
    toast({ title: '操作失败', icon: 'none' });
  }
}

function goBack() { uni.navigateBack(); }

onMounted(() => {
  loadData();
  loadStats();
});
</script>

<style lang="scss" scoped>
@import "@/common/styles/base.scss";

.page { min-height: 100vh; background: $bg-light; }

.nav-bar {
  display: flex; align-items: center; justify-content: space-between;
  height: 88rpx; padding: 0 $space-lg; background: $bg-white;
  border-bottom: 1rpx solid $border-color; position: sticky; top: 0; z-index: 10;
}
.nav-back { display: flex; align-items: center; gap: 4rpx; font-size: 28rpx; color: $primary-color; }
.nav-title { font-size: 32rpx; font-weight: 500; color: $text-primary; }
.nav-placeholder { width: 80rpx; }

.filter-bar {
  display: flex; gap: $space-sm; padding: $space-md $space-lg;
  background: $bg-white; overflow-x: auto;
}
.filter-tag {
  flex-shrink: 0; padding: 8rpx 24rpx; border-radius: 999rpx;
  font-size: $text-sm; background: $bg-base; color: $text-secondary;
  &.active { background: $primary; color: #fff; }
}

.stats-bar {
  display: flex; align-items: center; padding: $space-lg;
  background: $bg-white; margin-bottom: $space-sm;
}
.stat-item { flex: 1; text-align: center; }
.stat-n { display: block; font-size: $text-xl; font-weight: 700; color: $text-primary; }
.stat-l { font-size: $text-xs; color: $text-muted; }
.stat-green .stat-n { color: $success; }
.stat-orange .stat-n { color: $warning; }
.stat-red .stat-n { color: $danger; }
.stat-divider { width: 1rpx; height: 60rpx; background: $border-color; }

.state-card {
  display: flex; flex-direction: column; align-items: center;
  padding: 120rpx $space-xl; gap: $space-md;
}
.state-icon { font-size: 80rpx; }
.state-text { font-size: $text-lg; color: $text-secondary; }

.record-card {
  margin: $space-sm $space-lg; background: $bg-card;
  border-radius: $radius-xl; padding: $space-lg; box-shadow: $shadow-card;
}
.record-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: $space-md;
}
.record-left { display: flex; flex-direction: column; gap: 4rpx; }
.record-id { font-size: $text-sm; color: $text-muted; }
.record-nickname { font-size: $text-base; font-weight: 600; color: $text-primary; }

.badge {
  padding: 4rpx 16rpx; border-radius: 999rpx; font-size: $text-xs;
  &--pending { background: #FFF3E0; color: #FF9800; }
  &--success { background: #E8F5E9; color: #4CAF50; }
  &--rejected { background: #FFEBEE; color: #F44336; }
}

.record-body { display: flex; flex-direction: column; gap: 8rpx; }
.record-row {
  display: flex; justify-content: space-between; align-items: center;
  font-size: $text-sm;
}
.record-label { color: $text-muted; }
.record-value { color: $text-primary; font-weight: 500; }
.record-value.primary { color: $primary; font-weight: 700; }

.record-actions {
  display: flex; justify-content: flex-end; gap: $space-md;
  margin-top: $space-md; padding-top: $space-md;
  border-top: 1rpx solid $border-color;
}

.btn-sm {
  padding: 12rpx 32rpx; border-radius: $radius-md; font-size: $text-sm;
  &.btn-outline { border: 1rpx solid $border-color; color: $text-secondary; background: transparent; }
  &.btn-filled { background: $primary; color: #fff; }
  &.btn-confirm { background: $primary; color: #fff; }
}

.pagination {
  display: flex; justify-content: center; align-items: center;
  gap: $space-lg; padding: $space-xl;
}
.page-btn {
  padding: 12rpx 32rpx; border-radius: $radius-md;
  background: $primary; color: #fff; font-size: $text-sm;
  &.disabled { opacity: 0.4; pointer-events: none; }
}
.page-info { font-size: $text-sm; color: $text-muted; }

.modal-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  z-index: 100; display: flex; align-items: center; justify-content: center;
}
.modal {
  width: 600rpx; background: $bg-white; border-radius: $radius-xl;
  padding: $space-xl;
}
.modal-header { text-align: center; margin-bottom: $space-lg; }
.modal-title { font-size: $text-lg; font-weight: 600; color: $text-primary; }
.reason-input {
  width: 100%; height: 200rpx; border: 1rpx solid $border-color;
  border-radius: $radius-md; padding: $space-md; font-size: $text-sm;
  box-sizing: border-box; margin-bottom: $space-lg;
}
.modal-actions { display: flex; gap: $space-md; }
.btn-cancel {
  flex: 1; text-align: center; padding: 20rpx; border-radius: $radius-md;
  border: 1rpx solid $border-color; color: $text-secondary; font-size: $text-base;
}
.btn-confirm-red {
  flex: 1; text-align: center; padding: 20rpx; border-radius: $radius-md;
  background: $danger; color: #fff; font-size: $text-base;
}
</style>
