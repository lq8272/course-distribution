<template>
  <view class="page">
    <view v-if="!userStore.isLoggedIn" class="not-login">
      <button @click="goLogin">请先登录</button>
    </view>

    <view v-else-if="!agentInfo?.is_agent" class="no-agent">
      <view class="hero-area">
        <view class="hero-icon">🎁</view>
        <view class="hero-title">成为分销商</view>
        <view class="hero-desc">推广课程，赚取佣金，开启你的副业之旅</view>
      </view>

      <!-- 等级说明 -->
      <view class="levels-section">
        <view class="levels-title">选择你的分销等级</view>
        <view v-for="lv in levels" :key="lv.level" class="level-card" :class="{ selected: form.level === lv.level }" @click="form.level = lv.level">
          <view class="level-left">
            <view class="level-name">{{ lv.name }}</view>
            <view class="level-desc">返佣比例 {{ (lv.rebate_rate * 100).toFixed(1) }}%</view>
          </view>
          <view class="level-check">
            <text v-if="form.level === lv.level" class="check-icon">✓</text>
          </view>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="cta-area">
        <button class="apply-btn" @click="openApply">申请加入</button>
        <view class="tips">审核通过后即可开始推广</view>
      </view>

      <!-- 申请弹窗 -->
      <view v-if="showApply" class="modal-mask" @click="showApply = false">
        <view class="modal apply-modal" @click.stop>
          <view class="modal-header">
            <text class="modal-title">申请成为分销商</text>
            <text class="modal-close" @click="showApply = false">✕</text>
          </view>
          <view class="selected-level">
            <text class="sl-label">申请等级：</text>
            <text class="sl-name">{{ levels.find(l => l.level === form.level)?.name || form.level }}</text>
          </view>
          <view class="selected-rate">
            预计返佣比例：<text class="rate-val">{{ ((levels.find(l => l.level === form.level)?.rebate_rate || 0) * 100).toFixed(1) }}%</text>
          </view>
          <view class="agree-row">
            <checkbox-group @change="e => agreed = e.detail.value.length > 0">
              <label class="agree-label">
                <checkbox value="1" :checked="agreed" color="var(--brand-primary)" />
                <text class="agree-text">我已阅读并同意</text>
                <text class="agree-link" @click.stop="showDistributeRule">《分销商协议》</text>
              </label>
            </checkbox-group>
          </view>
          <button class="btn-submit" :disabled="!agreed" @click="submitApply">提交申请</button>
        </view>
      </view>
    </view>

    <view v-else class="agent-dashboard">
      <!-- 佣金统计卡片 -->
      <view class="stats-row">
        <view class="stat-card">
          <view class="val">¥{{ stats.total || 0 }}</view>
          <view class="label">累计佣金</view>
        </view>
        <view class="stat-card">
          <view class="val">¥{{ stats.available || 0 }}</view>
          <view class="label">可提现</view>
        </view>
        <view class="stat-card">
          <view class="val">¥{{ stats.withdrawn || 0 }}</view>
          <view class="label">已提现</view>
        </view>
      </view>

      <!-- 推广码 -->
      <view class="section">
        <view class="section-title">我的推广码</view>
        <view class="code-box">{{ userInfo.promoCode || agentInfo?.agent?.level || '—' }}</view>
        <button size="mini" @click="copyCode">复制推广链接</button>
      </view>

      <!-- 佣金记录 -->
      <view class="section">
        <view class="section-title">佣金记录</view>
        <view v-for="item in commissions" :key="item.id" class="comm-item">
          <view>订单#{{ item.order_id }}</view>
          <view class="amount">+¥{{ item.amount }}</view>
        </view>
        <view v-if="!commissions.length" class="empty">暂无记录</view>
      </view>

      <!-- 提现 -->
      <view class="section">
        <button @click="openWithdraw">申请提现</button>
      </view>

      <!-- 提现弹窗 -->
      <view v-if="showWithdraw" class="modal-mask" @click="showWithdraw = false">
        <view class="modal withdraw-modal" @click.stop>
          <view class="modal-header">
            <text class="modal-title">申请提现</text>
            <text class="modal-close" @click="showWithdraw = false">✕</text>
          </view>
          <view class="balance-info">
            <text class="balance-label">可提现余额</text>
            <text class="balance-val">¥{{ stats.available || 0 }}</text>
          </view>
          <input class="amount-input" type="digit" v-model="withdrawAmount" placeholder="请输入提现金额" />
          <view class="withdraw-tip">最低提现1元，最高不超过可提现余额</view>
          <button class="btn-submit" @click="submitWithdraw">确认提现</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onShow } from 'vue';
import { useUserStore } from '../../store/user';
import { agentApi } from '../../api/agent';
import { commissionApi } from '../../api/commission';
import { courseApi } from '../../api/course';

const userStore = useUserStore();
const agentInfo = ref(null);
const userInfo = ref({
  name: '',
  levelName: '',
  promoCode: '',
});
const stats = ref({});
const commissions = ref([]);
const levels = ref([]);
const showApply = ref(false);
const showWithdraw = ref(false);
const form = ref({ level: 'DISTRIBUTORDR' });
const withdrawAmount = ref('');
const agreed = ref(false);

onShow(async () => {
  if (!userStore.isLoggedIn) return;
  try {
    const [info, st, list] = await Promise.all([
      agentApi.my(),
      commissionApi.stats(),
      commissionApi.list({ page: 1, page_size: 20 }),
    ]);
    agentInfo.value = info;
    stats.value = st;
    commissions.value = list.rows || [];

    // 填充用户信息
    userInfo.value.name = info.nickname || userStore.userInfo?.nickname || '用户';
    userInfo.value.levelName = info.level_name || '普通分销商';
    userInfo.value.promoCode = info.promo_code || '';
  } catch (e) {
    console.error('load agent info error', e);
  }
});

async function openApply() {
  showApply.value = true;
  // 加载等级列表（如果尚未加载）
  if (!levels.value.length) {
    try {
      const res = await agentApi.levels();
      levels.value = res || [];
      if (levels.value.length && !form.value.level) {
        form.value.level = levels.value[0].level;
      }
    } catch (e) {
      console.error('load levels error', e);
      // 提供默认选项
      levels.value = [
        { level: 'DISTRIBUTOR', name: '普通分销商', rebate_rate: 0.1 },
        { level: 'DISTRIBUTORDR', name: '高级分销商', rebate_rate: 0.2 },
      ];
    }
  }
}

async function submitApply() {
  try {
    await agentApi.apply(form.value);
    uni.showToast({ title: '申请已提交', icon: 'success' });
    showApply.value = false;
    // 刷新状态
    onShow();
  } catch (e) {
    uni.showToast({ title: '申请失败', icon: 'none' });
  }
}

async function openWithdraw() {
  showWithdraw.value = true;
  withdrawAmount.value = '';
}

function showDistributeRule() {
  uni.showModal({
    title: '分销商协议',
    content: '1. 分销商需遵守平台相关规定\n2. 佣金按实际成交金额计算\n3. 佣金结算周期为每月一次\n4. 提现需满足最低金额要求\n5. 平台保留调整佣金比例的权利',
    showCancel: false,
  });
}

async function submitWithdraw() {
  if (!withdrawAmount.value) {
    uni.showToast({ title: '请输入金额', icon: 'none' });
    return;
  }
  const amount = parseFloat(withdrawAmount.value);
  if (isNaN(amount) || amount <= 0) {
    uni.showToast({ title: '金额不合法', icon: 'none' });
    return;
  }
  if (amount > (stats.value.available || 0)) {
    uni.showToast({ title: '超过可提现额度', icon: 'none' });
    return;
  }
  try {
    await commissionApi.withdraw(amount);
    uni.showToast({ title: '提现申请已提交', icon: 'success' });
    showWithdraw.value = false;
    // 刷新数据
    onShow();
  } catch (e) {
    uni.showToast({ title: '提现失败', icon: 'none' });
  }
}

function goLogin() { uni.switchTab({ url: '/pages/login/index' }); }

function copyCode() {
  const code = userInfo.value.promoCode || agentInfo.value?.agent?.level || '';
  uni.setClipboardData({ data: code });
  uni.showToast({ title: '已复制', icon: 'success' });
}
</script>

<style scoped>
.page { padding: 16rpx; min-height: 100vh; background: var(--bg-light); }
.stats-row { display: flex; gap: 16rpx; margin-bottom: 16rpx; }
.stat-card { flex: 1; background: var(--bg-white); border-radius: var(--border-radius); padding: 24rpx; text-align: center; box-shadow: var(--shadow-sm); }
.stat-card .val { font-size: 36rpx; font-weight: bold; color: var(--price-color); }
.stat-card .label { font-size: 24rpx; color: var(--text-gray); margin-top: 8rpx; }
.section { background: var(--bg-white); border-radius: var(--border-radius); padding: 24rpx; margin-bottom: 16rpx; box-shadow: var(--shadow-sm); }
.section-title { font-size: 30rpx; font-weight: bold; color: var(--text-primary); margin-bottom: 16rpx; }
.code-box { background: var(--bg-light); padding: 16rpx; border-radius: 8rpx; font-family: monospace; margin-bottom: 16rpx; word-break: break-all; color: var(--text-primary); }
.comm-item { display: flex; justify-content: space-between; padding: 16rpx 0; border-bottom: 1rpx solid var(--border-color); }
.comm-item .amount { color: var(--price-color); font-weight: bold; }
/* 未申请状态 */
.hero-area {
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
  border-radius: var(--border-radius);
  padding: 48rpx 32rpx;
  text-align: center;
  margin-bottom: 24rpx;
}
.hero-icon { font-size: 80rpx; margin-bottom: 20rpx; }
.hero-title { font-size: 44rpx; font-weight: bold; color: #fff; margin-bottom: 12rpx; }
.hero-desc { font-size: 26rpx; color: rgba(255,255,255,0.8); }

.levels-section { background: var(--bg-white); border-radius: var(--border-radius); padding: 24rpx; margin-bottom: 16rpx; box-shadow: var(--shadow-sm); }
.levels-title { font-size: 28rpx; font-weight: bold; color: var(--text-primary); margin-bottom: 20rpx; }
.level-card { display: flex; align-items: center; justify-content: space-between; padding: 24rpx; border: 2rpx solid var(--border-color); border-radius: 12rpx; margin-bottom: 16rpx; transition: all 0.2s; }
.level-card:last-child { margin-bottom: 0; }
.level-card.selected { border-color: var(--brand-primary); background: rgba(102,126,234,0.06); }
.level-left .level-name { font-size: 30rpx; font-weight: 600; color: var(--text-primary); margin-bottom: 8rpx; }
.level-left .level-desc { font-size: 24rpx; color: var(--price-color); }
.level-check { width: 44rpx; height: 44rpx; border-radius: 50%; border: 2rpx solid var(--border-color); display: flex; align-items: center; justify-content: center; }
.level-card.selected .level-check { background: var(--brand-primary); border-color: var(--brand-primary); }
.check-icon { color: #fff; font-size: 24rpx; font-weight: bold; }

.cta-area { padding: 0 24rpx; }
.apply-btn { background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary)); color: #fff; border-radius: 44rpx; font-size: 32rpx; height: 96rpx; line-height: 96rpx; border: none; }
.tips { text-align: center; font-size: 24rpx; color: var(--text-gray); margin-top: 20rpx; }

.no-agent { padding: 24rpx; }

.apply-modal .selected-level { font-size: 28rpx; color: var(--text-secondary); margin-bottom: 12rpx; }
.apply-modal .sl-name { color: var(--brand-primary); font-weight: 600; }
.apply-modal .selected-rate { font-size: 28rpx; color: var(--text-secondary); margin-bottom: 24rpx; }
.apply-modal .rate-val { color: var(--price-color); font-weight: bold; }
.agree-row { margin-bottom: 32rpx; }
.agree-label { display: flex; align-items: center; flex-wrap: wrap; gap: 8rpx; }
.agree-text { font-size: 26rpx; color: var(--text-secondary); }
.agree-link { font-size: 26rpx; color: var(--accent-blue); }
.btn-submit { background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary)); color: #fff; border-radius: 44rpx; font-size: 32rpx; border: none; height: 88rpx; line-height: 88rpx; }
.btn-submit[disabled] { background: var(--text-gray); opacity: 0.6; }

.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32rpx; }
.modal-title { font-size: 32rpx; font-weight: bold; color: var(--text-primary); }
.modal-close { width: 48rpx; height: 48rpx; border-radius: 50%; background: var(--bg-light); display: flex; align-items: center; justify-content: center; font-size: 24rpx; color: var(--text-gray); }

.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 999; padding: 24rpx; }
.modal { background: var(--bg-white); border-radius: 24rpx; padding: 48rpx 40rpx; width: 100%; max-width: 640rpx; box-sizing: border-box; }
.withdraw-modal .balance-info { display: flex; justify-content: space-between; align-items: center; background: var(--bg-light); padding: 20rpx 24rpx; border-radius: 12rpx; margin-bottom: 24rpx; }
.withdraw-modal .balance-label { font-size: 26rpx; color: var(--text-secondary); }
.withdraw-modal .balance-val { font-size: 32rpx; font-weight: bold; color: var(--price-color); }
.amount-input { border: 2rpx solid var(--border-color); border-radius: 12rpx; padding: 20rpx 24rpx; font-size: 36rpx; margin-bottom: 12rpx; color: var(--text-primary); }
.withdraw-tip { font-size: 22rpx; color: var(--text-gray); margin-bottom: 32rpx; }

.no-agent { text-align: center; }
.not-login button { background: var(--accent-blue); color: #fff; border-radius: 44rpx; }
</style>
