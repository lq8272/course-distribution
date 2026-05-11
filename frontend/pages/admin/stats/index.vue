<template>
  <view class="page">

    <!-- 顶部品牌栏 -->
    <view class="top-bar">
      <view class="top-bar-left" @click="back">
        <text class="back-icon">‹</text>
      </view>
      <text class="top-title">数据统计</text>
      <view class="top-bar-right"></view>
    </view>

    <!-- 加载状态 -->
    <view v-if="loading" class="state-card">
      <view class="state-icon">⏳</view>
      <text class="state-text">加载中...</text>
    </view>

    <template v-else>

      <!-- ===== 概览 ===== -->
      <view class="section">
        <view class="section-title">核心概览</view>
        <view class="overview-grid">
          <view class="overview-card">
            <text class="overview-val">{{ fmt(overview.orders.total) }}</text>
            <text class="overview-label">总订单</text>
          </view>
          <view class="overview-card">
            <text class="overview-val orange">{{ fmtYuan(overview.orders.confirmedAmount) }}</text>
            <text class="overview-label">订单收入</text>
          </view>
          <view class="overview-card">
            <text class="overview-val green">{{ fmtYuan(overview.commissions.settled) }}</text>
            <text class="overview-label">已结佣金</text>
          </view>
          <view class="overview-card">
            <text class="overview-val gold">{{ fmtYuan(overview.commissions.pending) }}</text>
            <text class="overview-label">待结佣金</text>
          </view>
          <view class="overview-card">
            <text class="overview-val">{{ overview.users.total }}</text>
            <text class="overview-label">总用户</text>
          </view>
          <view class="overview-card">
            <text class="overview-val blue">{{ overview.users.agents }}</text>
            <text class="overview-label">分销商</text>
          </view>
          <view class="overview-card">
            <text class="overview-val">{{ overview.purchase.total }}</text>
            <text class="overview-label">拿货申请</text>
          </view>
          <view class="overview-card">
            <text class="overview-val">{{ overview.withdraw.total }}</text>
            <text class="overview-label">提现申请</text>
          </view>
        </view>
      </view>

      <!-- ===== 提现 & 拿货 明细 ===== -->
      <view class="section">
        <view class="section-title">提现与拿货</view>
        <view class="detail-card">
          <view class="detail-row">
            <text class="detail-label">提现已批准</text>
            <text class="detail-val green">{{ fmtYuan(overview.withdraw.approved) }} 元</text>
          </view>
          <view class="detail-row">
            <text class="detail-label">提现待处理</text>
            <text class="detail-val gold">{{ fmtYuan(overview.withdraw.pending) }} 元</text>
          </view>
          <view class="detail-divider"></view>
          <view class="detail-row">
            <text class="detail-label">拿货已确认</text>
            <text class="detail-val green">{{ fmtYuan(overview.purchase.approved) }} 元</text>
          </view>
          <view class="detail-row">
            <text class="detail-label">拿货待审核</text>
            <text class="detail-val gold">{{ fmtYuan(overview.purchase.pending) }} 元</text>
          </view>
        </view>
      </view>

      <!-- ===== 时间筛选 ===== -->
      <view class="section">
        <view class="section-title">销售趋势</view>
        <view class="filter-bar">
          <view
            v-for="p in periodOptions"
            :key="p.value"
            :class="period === p.value ? 'filter-tag active' : 'filter-tag'"
            @click="period = p.value; loadSales()"
          >{{ p.label }}</view>
        </view>

        <!-- 返佣汇总 -->
        <view class="rebate-summary">
          <view class="rebate-item">
            <text class="rebate-label">已结返佣</text>
            <text class="rebate-val green">{{ fmtYuan(sales.rebate.total) }} 元</text>
          </view>
          <view class="rebate-item">
            <text class="rebate-label">待结返佣</text>
            <text class="rebate-val gold">{{ fmtYuan(sales.rebate.pending) }} 元</text>
          </view>
        </view>

        <!-- 按日趋势 -->
        <view class="trend-title">每日订单趋势</view>
        <view v-if="sales.daily.length === 0" class="state-card compact">
          <text class="state-text">暂无数据</text>
        </view>
        <view v-else class="chart-placeholder">
          <view v-for="day in sales.daily.slice(0, 14)" :key="day.date" class="bar-row">
            <text class="bar-label">{{ day.date.substring(5) }}</text>
            <view class="bar-track">
              <view class="bar-fill" :style="{ width: barWidth(day.amount) + '%' }"></view>
            </view>
            <text class="bar-val">{{ fmtYuan(day.amount) }}</text>
          </view>
        </view>
      </view>

      <!-- ===== 按课程 ===== -->
      <view class="section" v-if="sales.byCourse.length">
        <view class="section-title">课程销售排行</view>
        <view class="rank-list">
          <view v-for="(c, i) in sales.byCourse" :key="c.id" class="rank-row">
            <view class="rank-num" :class="'rank-' + (i < 3 ? i + 1 : 0)">{{ i + 1 }}</view>
            <text class="rank-title">{{ c.title || '未知课程' }}</text>
            <text class="rank-count">{{ c.order_count }} 单</text>
            <text class="rank-amount">{{ fmtYuan(c.amount) }}</text>
          </view>
        </view>
      </view>

      <!-- ===== 按等级 ===== -->
      <view class="section" v-if="sales.byLevel.length">
        <view class="section-title">分销等级销售</view>
        <view class="rank-list">
          <view v-for="lv in sales.byLevel" :key="lv.level" class="rank-row">
            <view class="rank-tag">{{ levelName(lv.level) || lv.level }}</view>
            <text class="rank-count">{{ lv.order_count || 0 }} 单</text>
            <text class="rank-amount">{{ fmtYuan(lv.amount) }}</text>
          </view>
        </view>
      </view>

    </template>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '@/api/index';

const loading = ref(true);
const period = ref('30d');
const periodOptions = [
  { label: '7天', value: '7d' },
  { label: '30天', value: '30d' },
  { label: '90天', value: '90d' },
  { label: '全部', value: 'all' },
];

const overview = ref({
  orders: { total: 0, confirmed: 0, confirmedAmount: 0, completedAmount: 0 },
  commissions: { total: 0, settled: 0, pending: 0, withdrawn: 0 },
  withdraw: { total: 0, approved: 0, pending: 0 },
  users: { total: 0, agents: 0 },
  purchase: { total: 0, approved: 0, pending: 0 },
});

const sales = ref({
  daily: [],
  byCourse: [],
  byLevel: [],
  rebate: { total: 0, pending: 0 },
});

let maxDailyAmount = 0;

function levelName(level) {
  const map = { DR: '达人', MXJ: '梦想家', CJHH: '超合伙人' };
  return map[level] || level;
}

function fmt(n) {
  return Number(n || 0).toLocaleString();
}

function fmtYuan(n) {
  return Number(n || 0).toFixed(2);
}

function barWidth(amount) {
  if (!maxDailyAmount) return 0;
  return Math.round((parseFloat(amount) / maxDailyAmount) * 100);
}

onMounted(async () => {
  loading.value = true;
  try {
    const [ov, sl] = await Promise.all([
      api.get('/admin/stats/overview'),
      api.get('/admin/stats/sales', { params: { period: period.value } }),
    ]);
    overview.value = ov.data || overview.value;
    sales.value = sl.data || sales.value;
    maxDailyAmount = Math.max(...(sales.value.daily.map(d => parseFloat(d.amount) || 0)), 1);
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
});

async function loadSales() {
  try {
    const res = await api.get('/admin/stats/sales', { params: { period: period.value } });
    sales.value = res.data || sales.value;
    maxDailyAmount = Math.max(...(sales.value.daily.map(d => parseFloat(d.amount) || 0)), 1);
  } catch (e) {
    console.error(e);
  }
}

function back() {
  uni.navigateBack();
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 40rpx;
}

/* 顶部导航 */
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  padding: 0 24rpx;
  background: #fff;
  border-bottom: 1rpx solid #eee;
  position: sticky;
  top: 0;
  z-index: 10;
}
.top-bar-left, .top-bar-right { width: 80rpx; }
.back-icon { font-size: 48rpx; color: #333; line-height: 88rpx; }
.top-title { font-size: 34rpx; font-weight: 600; color: #333; }

/* 状态 */
.state-card {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 120rpx 0;
}
.state-card.compact { padding: 60rpx 0; }
.state-icon { font-size: 80rpx; margin-bottom: 24rpx; }
.state-text { font-size: 28rpx; color: #999; }

/* 分区 */
.section { margin-top: 24rpx; padding: 0 24rpx; }
.section-title {
  font-size: 28rpx; color: #999; margin-bottom: 16rpx; padding-left: 8rpx;
}

/* 概览 */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
}
.overview-card {
  background: #fff; border-radius: 16rpx;
  padding: 28rpx 16rpx; text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 8rpx;
}
.overview-val { font-size: 36rpx; font-weight: 700; color: #333; }
.overview-val.orange { color: #FF6B00; }
.overview-val.green { color: #07c160; }
.overview-val.gold { color: #ffb800; }
.overview-val.blue { color: #1989fa; }
.overview-label { font-size: 22rpx; color: #999; margin-top: 4rpx; }

/* 明细卡 */
.detail-card {
  background: #fff; border-radius: 16rpx; padding: 24rpx 32rpx;
}
.detail-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16rpx 0;
}
.detail-label { font-size: 28rpx; color: #666; }
.detail-val { font-size: 30rpx; font-weight: 600; }
.detail-val.green { color: #07c160; }
.detail-val.gold { color: #ffb800; }
.detail-divider { height: 1rpx; background: #f0f0f0; margin: 8rpx 0; }

/* 返佣汇总 */
.rebate-summary {
  display: flex; gap: 24rpx; margin-bottom: 20rpx;
}
.rebate-item {
  flex: 1; background: #fff; border-radius: 12rpx;
  padding: 20rpx; display: flex; justify-content: space-between; align-items: center;
}
.rebate-label { font-size: 26rpx; color: #666; }
.rebate-val { font-size: 28rpx; font-weight: 600; }
.rebate-val.green { color: #07c160; }
.rebate-val.gold { color: #ffb800; }

/* 趋势 */
.trend-title { font-size: 26rpx; color: #666; margin-bottom: 12rpx; }
.chart-placeholder { background: #fff; border-radius: 16rpx; padding: 24rpx; }
.bar-row {
  display: flex; align-items: center; gap: 12rpx;
  margin-bottom: 12rpx;
}
.bar-label { font-size: 20rpx; color: #999; width: 80rpx; flex-shrink: 0; text-align: right; }
.bar-track { flex: 1; height: 24rpx; background: #f0f0f0; border-radius: 12rpx; overflow: hidden; }
.bar-fill { height: 100%; background: linear-gradient(90deg, #FF6B00, #ff9500); border-radius: 12rpx; transition: width 0.3s; }
.bar-val { font-size: 20rpx; color: #666; width: 100rpx; text-align: right; }

/* 排行 */
.rank-list { background: #fff; border-radius: 16rpx; overflow: hidden; }
.rank-row {
  display: flex; align-items: center; gap: 16rpx;
  padding: 24rpx 32rpx; border-bottom: 1rpx solid #f0f0f0;
}
.rank-row:last-child { border-bottom: none; }
.rank-num {
  width: 40rpx; height: 40rpx; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 22rpx; font-weight: 700; flex-shrink: 0;
  background: #f0f0f0; color: #999;
}
.rank-num.rank-1 { background: #ffd700; color: #7a5e00; }
.rank-num.rank-2 { background: #e0e0e0; color: #555; }
.rank-num.rank-3 { background: #ce8938; color: #fff; }
.rank-tag {
  padding: 4rpx 12rpx; border-radius: 8rpx; font-size: 22rpx;
  background: #FFF3E0; color: #FF6B00; flex-shrink: 0;
}
.rank-title { flex: 1; font-size: 28rpx; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-count { font-size: 24rpx; color: #999; flex-shrink: 0; }
.rank-amount { font-size: 28rpx; font-weight: 600; color: #FF6B00; flex-shrink: 0; }

/* 筛选 */
.filter-bar {
  display: flex; gap: 16rpx; margin-bottom: 20rpx; flex-wrap: wrap;
}
.filter-tag {
  padding: 8rpx 24rpx; border-radius: 32rpx;
  background: #fff; font-size: 26rpx; color: #666;
  border: 1rpx solid #eee;
}
.filter-tag.active {
  background: #FF6B00; color: #fff; border-color: #FF6B00;
}
</style>
