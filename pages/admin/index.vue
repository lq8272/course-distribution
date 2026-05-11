<template>
  <view class="page">
    <view class="tabs">
      <view :class="['tab', tab === 'order' && 'active']" @click="switchTab('order')">订单管理</view>
      <view :class="['tab', tab === 'agent' && 'active']" @click="switchTab('agent')">分销审核</view>
      <view :class="['tab', tab === 'user' && 'active']" @click="switchTab('user')">用户管理</view>
    </view>

    <!-- 订单列表 -->
    <block v-if="tab === 'order'">
      <view v-if="loading" class="loading-wrap">
        <text class="loading-text">加载中...</text>
      </view>
      <view v-else-if="orders.length === 0" class="empty">暂无订单</view>
      <view v-else v-for="order in orders" :key="order.id" class="card">
        <view class="card-main">
          <image :src="order.course_cover || '/static/default-cover.png'" mode="aspectFill" class="cover" />
          <view class="card-info">
            <view class="course-title">{{ order.course_title || '课程' }}</view>
            <view class="meta">买家：{{ order.buyer_nickname || '—' }}</view>
            <view class="meta">金额：<text class="price">¥{{ order.amount || 0 }}</text></view>
          </view>
        </view>
        <view class="card-footer">
          <view :class="['status-tag', statusClass(order.status)]">{{ orderStatus[order.status] }}</view>
          <view v-if="order.status === 0" class="actions">
            <button size="mini" class="btn-reject" @click="openReject(order)">拒绝</button>
            <button size="mini" type="primary" class="btn-confirm" @click="confirmOrder(order.id)">确认</button>
          </view>
        </view>
      </view>
    </block>

    <!-- 分销审核列表 -->
    <block v-if="tab === 'agent'">
      <view v-if="loading" class="loading-wrap">
        <text class="loading-text">加载中...</text>
      </view>
      <view v-else-if="agents.length === 0" class="empty">暂无待审核申请</view>
      <view v-else v-for="a in agents" :key="a.id" class="card">
        <view class="card-main">
          <view class="agent-avatar">{{ (a.nickname || '?')[0] }}</view>
          <view class="card-info">
            <view class="course-title">{{ a.nickname || '匿名用户' }}</view>
            <view class="meta">申请等级：{{ a.level }}</view>
            <view class="meta">推荐人：{{ a.recommender_id || '无' }}</view>
            <view class="meta">申请时间：{{ formatTime(a.created_at) }}</view>
          </view>
        </view>
        <view class="card-footer agent-footer">
          <button size="mini" class="btn-reject" @click="openReject(a)">拒绝</button>
          <button size="mini" type="primary" class="btn-confirm" @click="approve(a.id)">通过</button>
        </view>
      </view>
    </block>

    <!-- 用户管理 -->
    <block v-if="tab === 'user'">
      <view v-if="loading" class="loading-wrap">
        <text class="loading-text">加载中...</text>
      </view>
      <view v-else-if="users.length === 0" class="empty">暂无用户</view>
      <view v-else v-for="u in users" :key="u.id" class="card">
        <view class="card-main">
          <view class="agent-avatar">{{ (u.nickname || '?')[0] }}</view>
          <view class="card-info">
            <view class="course-title">{{ u.nickname || u.openid }}</view>
            <view class="meta">ID：{{ u.id }}</view>
            <view class="meta">注册时间：{{ formatTime(u.created_at) }}</view>
            <view class="meta">分销商：{{ u.is_agent ? '是' : '否' }}</view>
          </view>
        </view>
      </view>
    </block>

    <!-- 拒绝弹窗 -->
    <view v-if="showRejectModal" class="modal-mask" @click="closeReject">
      <view class="modal" @click.stop>
        <view class="modal-title">拒绝申请</view>
        <textarea
          v-model="rejectReason"
          class="reason-input"
          placeholder="请输入拒绝理由（选填）"
          maxlength="200"
        />
        <view class="modal-actions">
          <button class="btn-cancel" @click="closeReject">取消</button>
          <button class="btn-confirm" @click="confirmReject">确认拒绝</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onShow } from 'vue';
import { useUserStore } from '../../store/user';
import { orderApi } from '../../api/order';
import { api } from '../../api/index';

const userStore = useUserStore();
const tab = ref('order');
const loading = ref(false);
const orders = ref([]);
const agents = ref([]);
const users = ref([]);
const orderStatus = ['待确认', '已确认', '已完成', '已退款', '已取消'];

// 拒绝弹窗
const showRejectModal = ref(false);
const rejectReason = ref('');
const rejectTarget = ref(null); // 当前要拒绝的记录

onShow(async () => {
  if (!userStore.isLoggedIn) {
    uni.showToast({ title: '请先登录', icon: 'none' });
    return;
  }
  if (!userStore.isAdmin) {
    uni.showToast({ title: '需要管理员权限', icon: 'none' });
    return;
  }
  await loadCurrentTab();
});

async function switchTab(t) {
  if (t === tab.value) return;
  tab.value = t;
  await loadCurrentTab();
}

async function loadCurrentTab() {
  loading.value = true;
  try {
    if (tab.value === 'order') {
      const list = await orderApi.list({ page: 1, page_size: 50 });
      orders.value = list.rows || [];
    } else if (tab.value === 'agent') {
      const res = await api.get('/api/admin/agent/pending');
      agents.value = res.rows || [];
    } else if (tab.value === 'user') {
      const res = await api.get('/api/admin/user/list?page=1&page_size=50');
      users.value = res.rows || [];
    }
  } catch (e) {
    console.error('load tab error', e);
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

async function confirmOrder(id) {
  try {
    await orderApi.confirm(id);
    uni.showToast({ title: '已确认', icon: 'success' });
    orders.value = orders.value.map(o => o.id === id ? { ...o, status: 1 } : o);
  } catch {
    uni.showToast({ title: '操作失败', icon: 'none' });
  }
}

async function approve(id) {
  try {
    await api.post(`/api/admin/agent/${id}/approve`, {});
    uni.showToast({ title: '已通过', icon: 'success' });
    agents.value = agents.value.filter(a => a.id !== id);
  } catch {
    uni.showToast({ title: '操作失败', icon: 'none' });
  }
}

function openReject(item) {
  rejectTarget.value = item;
  rejectReason.value = '';
  showRejectModal.value = true;
}

function closeReject() {
  showRejectModal.value = false;
  rejectTarget.value = null;
  rejectReason.value = '';
}

async function confirmReject() {
  if (!rejectTarget.value) return;
  try {
    const id = rejectTarget.value.id;
    await api.post(`/api/admin/agent/${id}/reject`, { reason: rejectReason.value });
    uni.showToast({ title: '已拒绝', icon: 'success' });
    agents.value = agents.value.filter(a => a.id !== id);
    closeReject();
  } catch {
    uni.showToast({ title: '操作失败', icon: 'none' });
  }
}

function formatTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function statusClass(status) {
  const map = ['orange', 'blue', 'green', 'gray', 'gray'];
  return map[status] || '';
}
</script>

<style scoped>
.page { padding: 16rpx; min-height: 100vh; background: var(--bg-light); }

.tabs { display: flex; background: var(--bg-white); margin-bottom: 16rpx; }
.tab { flex: 1; text-align: center; padding: 24rpx; font-size: 28rpx; color: var(--text-gray); transition: color 0.2s; }
.tab.active { color: var(--accent-blue); font-weight: bold; border-bottom: 4rpx solid var(--accent-blue); }

.loading-wrap { display: flex; justify-content: center; align-items: center; padding: 120rpx; }
.loading-text { color: var(--text-gray); font-size: 28rpx; }
.empty { text-align: center; color: var(--text-gray); padding: 120rpx; font-size: 28rpx; }

.card {
  background: var(--bg-white);
  border-radius: var(--border-radius);
  padding: 24rpx;
  margin-bottom: 16rpx;
}

.card-main { display: flex; gap: 20rpx; margin-bottom: 16rpx; }

.cover {
  width: 120rpx;
  height: 90rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
}

.agent-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  font-weight: bold;
  flex-shrink: 0;
}

.card-info { flex: 1; min-width: 0; }
.course-title { font-size: 28rpx; font-weight: 500; color: var(--text-primary); margin-bottom: 8rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta { font-size: 24rpx; color: var(--text-gray); margin-bottom: 4rpx; }
.price { color: var(--price-color); font-weight: 500; }

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1rpx solid var(--border-color);
  padding-top: 16rpx;
}
.agent-footer { border-top: none; padding-top: 0; justify-content: flex-end; gap: 16rpx; }

.status-tag {
  font-size: 24rpx;
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
}
.status-tag.orange { background: rgba(255, 150, 0, 0.1); color: #ff9600; }
.status-tag.blue { background: rgba(0, 122, 255, 0.1); color: var(--accent-blue); }
.status-tag.green { background: rgba(0, 180, 60, 0.1); color: #00b43c; }
.status-tag.gray { background: rgba(153, 153, 153, 0.1); color: var(--text-gray); }

.actions { display: flex; gap: 12rpx; }
.btn-confirm { background: var(--accent-blue); color: #fff; }
.btn-reject { background: var(--bg-light); color: var(--text-secondary); }

/* 拒绝弹窗 */
.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 999; }
.modal { background: var(--bg-white); border-radius: var(--border-radius); padding: 40rpx; width: 600rpx; }
.modal-title { font-size: 32rpx; font-weight: bold; margin-bottom: 24rpx; text-align: center; }
.reason-input {
  width: 100%;
  height: 200rpx;
  border: 1rpx solid var(--border-color);
  border-radius: 8rpx;
  padding: 16rpx;
  font-size: 28rpx;
  box-sizing: border-box;
  margin-bottom: 24rpx;
}
.modal-actions { display: flex; gap: 16rpx; }
.btn-cancel { flex: 1; background: var(--bg-light); color: var(--text-secondary); }
.btn-confirm { flex: 1; background: var(--danger-color); color: #fff; }
</style>
