<template>
  <view class="page">
    <!-- 导航 -->
    <view class="nav-bar">
      <view class="nav-back" @click="goBack">← 返回</view>
      <text class="nav-title">我的钱包</text>
      <view class="nav-placeholder"></view>
    </view>

    <!-- 余额卡片 -->
    <view class="balance-card">
      <view class="balance-card__label">账户余额（元）</view>
      <view class="balance-card__amount">{{ balance }}</view>
      <view class="balance-card__actions">
        <view class="action-btn action-btn--recharge" @click="goToRecharge">充值</view>
        <view class="action-btn" @click="goToWithdraw">提现</view>
      </view>
    </view>

    <!-- 账户信息 -->
    <view class="info-section card">
      <view class="section-header">
        <view class="section-bar"></view>
        <text class="section-label">账户概览</text>
      </view>
      <view class="info-item">
        <text class="label">累计佣金</text>
        <text class="value primary">¥{{ totalCommission }}</text>
      </view>
      <view class="info-item">
        <text class="label">已提现</text>
        <text class="value">¥{{ withdrawn }}</text>
      </view>
      <view class="info-item">
        <text class="label">待结算</text>
        <text class="value warning">¥{{ pending }}</text>
      </view>
    </view>

    <!-- 操作菜单 -->
    <view class="menu-section card">
      <view class="section-header">
        <view class="section-bar"></view>
        <text class="section-label">功能服务</text>
      </view>
      <view class="menu-item" @click="goToWithdrawRecord">
        <view class="menu-icon">📋</view>
        <text class="label">提现记录</text>
        <text class="arrow">›</text>
      </view>
      <view class="menu-item" @click="goToBankCard">
        <view class="menu-icon">💳</view>
        <text class="label">银行卡</text>
        <text class="arrow">›</text>
      </view>
      <view class="menu-item" @click="goToAlipay">
        <view class="menu-icon">🔔</view>
        <text class="label">支付宝</text>
        <text class="arrow">›</text>
      </view>
    </view>

    <!-- 充值弹窗 -->
    <view class="modal" v-if="showRecharge" @click="showRecharge = false">
      <view class="modal-content" @click.stop>
        <view class="modal-title">充值金额</view>
        <view class="amount-input">
          <text class="yuan">¥</text>
          <input type="digit" v-model="rechargeAmount" placeholder="请输入金额" />
        </view>
        <view class="amount-presets">
          <view
            v-for="amt in [50, 100, 200, 500]"
            :key="amt"
            :class="'preset ' + (rechargeAmount === String(amt) ? 'preset--selected' : '')"
            @click="rechargeAmount = String(amt)"
          >{{ amt }}</view>
        </view>
        <view class="modal-btn" @click="confirmRecharge">确认充值</view>
      </view>
    </view>

    <!-- 提现弹窗 -->
    <view class="modal" v-if="showWithdraw" @click="showWithdraw = false">
      <view class="modal-content" @click.stop>
        <view class="modal-title">提现到银行卡</view>
        <view class="withdraw-tip">当前可提现余额：¥{{ balance }}</view>
        <view class="amount-input">
          <text class="yuan">¥</text>
          <input type="digit" v-model="withdrawAmount" placeholder="请输入提现金额" />
        </view>
        <view class="modal-btn" @click="confirmWithdraw">确认提现</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { commissionApi } from '@/api/commission';

const balance = ref('0.00');
const totalCommission = ref('0.00');
const withdrawn = ref('0.00');
const pending = ref('0.00');
const showRecharge = ref(false);
const showWithdraw = ref(false);
const rechargeAmount = ref('');
const withdrawAmount = ref('');

async function loadData() {
  try {
    const stats = await commissionApi.stats();
    totalCommission.value = (stats.total_commission || 0).toFixed(2);
    withdrawn.value = (stats.withdrawn || 0).toFixed(2);
    pending.value = (stats.pending || 0).toFixed(2);
    balance.value = (stats.balance || 0).toFixed(2);
  } catch (e) {
    console.error('loadData error', e);
    totalCommission.value = '0.00';
    withdrawn.value = '0.00';
    pending.value = '0.00';
    balance.value = '0.00';
  }
}

function goToRecharge() {
  showRecharge.value = true;
  rechargeAmount.value = '';
}

function goToWithdraw() {
  if (parseFloat(balance.value) <= 0) {
    uni.showToast({ title: '余额不足', icon: 'none' });
    return;
  }
  showWithdraw.value = true;
  withdrawAmount.value = '';
}

async function confirmRecharge() {
  const amt = parseFloat(rechargeAmount.value);
  if (!amt || amt <= 0) {
    uni.showToast({ title: '请输入正确金额', icon: 'none' });
    return;
  }
  uni.showToast({ title: '充值功能开发中', icon: 'none' });
  showRecharge.value = false;
}

async function confirmWithdraw() {
  const amt = parseFloat(withdrawAmount.value);
  if (!amt || amt <= 0) {
    uni.showToast({ title: '请输入正确金额', icon: 'none' });
    return;
  }
  if (amt > parseFloat(balance.value)) {
    uni.showToast({ title: '超过可提现余额', icon: 'none' });
    return;
  }
  try {
    await commissionApi.withdraw(amt);
    uni.showToast({ title: '提现申请已提交', icon: 'success' });
    showWithdraw.value = false;
    loadData();
  } catch (e) {
    uni.showToast({ title: '提现失败', icon: 'none' });
  }
}

function goToWithdrawRecord() { uni.navigateTo({ url: '/pages/user/withdraw-record' }); }
function goToBankCard() { uni.showToast({ title: '功能开发中', icon: 'none' }); }
function goToAlipay() { uni.showToast({ title: '功能开发中', icon: 'none' }); }
function goBack() { uni.navigateBack(); }

onShow(() => { loadData(); });
</script>

<style lang="scss">
@import "@/common/styles/base.scss";

.page { min-height: 100vh; background: $bg-light; }

.nav-bar {
  display: flex; align-items: center; justify-content: space-between;
  height: 88rpx; padding: 0 24rpx; background: $bg-white;
  border-bottom: 1rpx solid $border-color; position: sticky; top: 0; z-index: 10;
}
.nav-back { font-size: 28rpx; color: $primary-color; min-width: 80rpx; }
.nav-title { font-size: 32rpx; font-weight: 500; color: $text-primary; }
.nav-placeholder { min-width: 80rpx; }

.section-header {
  display: flex;
  align-items: center;
  padding-bottom: 20rpx;
  margin-bottom: 8rpx;
  .section-bar {
    width: 6rpx;
    height: 28rpx;
    background: linear-gradient(180deg, $primary-color 0%, $secondary-color 100%);
    border-radius: 3rpx;
    margin-right: 12rpx;
  }
  .section-label {
    font-size: 24rpx;
    font-weight: 600;
    color: $text-secondary;
    text-transform: uppercase;
    letter-spacing: 2rpx;
  }
}

.balance-card {
  margin: 24rpx;
  padding: 40rpx 32rpx;
  background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
  border-radius: 24rpx;
  color: #fff;
  box-shadow: 0 8rpx 32rpx rgba(255, 107, 0, 0.25);
}
.balance-card__label { font-size: 26rpx; opacity: 0.85; margin-bottom: 12rpx; }
.balance-card__amount { font-size: 64rpx; font-weight: bold; line-height: 1; margin-bottom: 32rpx; }
.balance-card__actions { display: flex; gap: 24rpx; }
.balance-card .action-btn {
  flex: 1; text-align: center; padding: 20rpx 0; border-radius: 44rpx; font-size: 30rpx; font-weight: 500;
  background: rgba(255,255,255,0.2); border: 2rpx solid rgba(255,255,255,0.4);
}
.balance-card .action-btn--recharge { background: rgba(255,255,255,0.95); color: $primary-color; }

.card {
  background: $bg-white;
  border-radius: 24rpx;
  overflow: hidden;
  box-shadow: $shadow-sm;
  margin: 0 24rpx 24rpx;
  padding: 32rpx;
}

.info-section {
  .info-item {
    display: flex; justify-content: space-between; align-items: center;
    padding: 28rpx 0;
    border-bottom: 1rpx solid $border-color;
  }
  .info-item:last-child { border-bottom: none; }
  .info-item .label { font-size: 28rpx; color: $text-secondary; }
  .info-item .value { font-size: 30rpx; font-weight: 500; color: $text-primary; }
  .info-item .value.primary { color: $primary-color; }
  .info-item .value.warning { color: #ff9600; }
}

.menu-section {
  .menu-item {
    display: flex; align-items: center; padding: 28rpx 0; border-bottom: 1rpx solid $border-color;
  }
  .menu-item:last-child { border-bottom: none; }
  .menu-icon { font-size: 40rpx; margin-right: 16rpx; width: 48rpx; text-align: center; }
  .menu-item .label { flex: 1; font-size: 28rpx; color: $text-primary; }
  .menu-item .arrow { font-size: 28rpx; color: $text-gray; }
}

.modal {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5); display: flex; align-items: flex-end; justify-content: center; z-index: 999;
}
.modal .modal-content { width: 100%; background: #fff; border-radius: 24rpx 24rpx 0 0; padding: 40rpx 32rpx; }
.modal .modal-title { font-size: 34rpx; font-weight: 500; text-align: center; margin-bottom: 32rpx; color: $text-primary; }
.modal .withdraw-tip { font-size: 26rpx; color: $text-gray; margin-bottom: 20rpx; text-align: center; }
.modal .amount-input {
  display: flex; align-items: center; border-bottom: 2rpx solid $border-color; padding-bottom: 16rpx; margin-bottom: 24rpx;
}
.modal .amount-input .yuan { font-size: 48rpx; font-weight: bold; color: $text-primary; margin-right: 12rpx; }
.modal .amount-input input { flex: 1; font-size: 40rpx; color: $text-primary; }
.modal .amount-presets { display: flex; gap: 16rpx; margin-bottom: 32rpx; }
.modal .preset {
  flex: 1; text-align: center; padding: 16rpx 0; background: $bg-light; border-radius: 12rpx; font-size: 28rpx; color: $text-secondary;
}
.modal .preset--selected { background: rgba($primary-color, 0.1); color: $primary-color; font-weight: 500; }
.modal .modal-btn {
  width: 100%; padding: 28rpx 0; background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
  color: #fff; border-radius: 44rpx; text-align: center; font-size: 32rpx; font-weight: 500;
}
</style>