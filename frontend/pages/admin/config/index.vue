<template>
  <view class="page">

    <!-- 顶部品牌栏 -->
    <view class="top-bar">
      <view class="top-bar-left" @click="back">
        <text class="back-icon">‹</text>
      </view>
      <text class="top-title">系统配置</text>
      <view class="top-bar-right"></view>
    </view>

    <!-- 加载状态 -->
    <view v-if="loading" class="state-card">
      <view class="state-icon">⏳</view>
      <text class="state-text">加载中...</text>
    </view>

    <template v-else>

      <!-- 平台配置 -->
      <view class="section">
        <view class="section-title">平台配置</view>
        <view class="config-card">
          <view class="config-item">
            <view class="config-label">平台名称</view>
            <input class="config-input" v-model="form.platform_name" placeholder="请输入平台名称" />
          </view>
          <view class="config-item">
            <view class="config-label">平台根用户ID</view>
            <input class="config-input" v-model="form.platform_root_user_id" type="number" placeholder="固定值，不建议修改" disabled />
          </view>
        </view>
      </view>

      <!-- 分销配置 -->
      <view class="section">
        <view class="section-title">分销配置</view>
        <view class="config-card">
          <view class="config-item">
            <view class="config-label">最大分销层级</view>
            <input class="config-input" v-model="form.max_distribution_level" type="number" placeholder="如：3" />
          </view>
          <view class="config-item">
            <view class="config-label">一级返佣比例</view>
            <view class="input-row">
              <input class="config-input" v-model="form.level1_rebate_rate" type="digit" placeholder="0.30" />
              <text class="input-suffix">（如 0.30 = 30%）</text>
            </view>
          </view>
          <view class="config-item">
            <view class="config-label">二级返佣比例</view>
            <view class="input-row">
              <input class="config-input" v-model="form.level2_rebate_rate" type="digit" placeholder="0.05" />
              <text class="input-suffix">（如 0.05 = 5%）</text>
            </view>
          </view>
          <view class="config-item">
            <view class="config-label">三级返佣比例</view>
            <view class="input-row">
              <input class="config-input" v-model="form.level3_rebate_rate" type="digit" placeholder="0.03" />
              <text class="input-suffix">（如 0.03 = 3%）</text>
            </view>
          </view>
          <view class="config-item">
            <view class="config-label">推荐奖励金额</view>
            <view class="input-row">
              <input class="config-input" v-model="form.recommend_reward" type="digit" placeholder="10.00" />
              <text class="input-suffix">元</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 提现配置 -->
      <view class="section">
        <view class="section-title">提现配置</view>
        <view class="config-card">
          <view class="config-item">
            <view class="config-label">最低提现额度</view>
            <view class="input-row">
              <input class="config-input" v-model="form.min_withdraw_amount" type="digit" placeholder="100" />
              <text class="input-suffix">元</text>
            </view>
          </view>
          <view class="config-item">
            <view class="config-label">提现手续费率</view>
            <view class="input-row">
              <input class="config-input" v-model="form.withdraw_fee_rate" type="digit" placeholder="0" />
              <text class="input-suffix">（0 = 免手续费）</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 订单配置 -->
      <view class="section">
        <view class="section-title">订单配置</view>
        <view class="config-card">
          <view class="config-item">
            <view class="config-label">订单超时关闭</view>
            <view class="input-row">
              <input class="config-input" v-model="form.order_timeout_minutes" type="number" placeholder="30" />
              <text class="input-suffix">分钟</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 申请费配置 -->
      <view class="section">
        <view class="section-title">申请费配置</view>
        <view class="config-card">
          <view class="config-item">
            <view class="config-label">达人申请费</view>
            <view class="input-row">
              <input class="config-input" v-model="form.apply_fee_dr" type="digit" placeholder="4980" />
              <text class="input-suffix">元</text>
            </view>
          </view>
          <view class="config-item">
            <view class="config-label">梦想家申请费</view>
            <view class="input-row">
              <input class="config-input" v-model="form.apply_fee_mxj" type="digit" placeholder="29800" />
              <text class="input-suffix">元</text>
            </view>
          </view>
          <view class="config-item">
            <view class="config-label">超合伙人申请费</view>
            <view class="input-row">
              <input class="config-input" v-model="form.apply_fee_cjhh" type="digit" placeholder="99800" />
              <text class="input-suffix">元</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 拿货配置 -->
      <view class="section">
        <view class="section-title">拿货配置</view>
        <view class="config-card">
          <view class="config-item">
            <view class="config-label">达人拿货价</view>
            <view class="input-row">
              <input class="config-input" v-model="form.purchase_price_dr" type="digit" placeholder="200" />
              <text class="input-suffix">元/个</text>
            </view>
          </view>
          <view class="config-item">
            <view class="config-label">达人最低数量</view>
            <view class="input-row">
              <input class="config-input" v-model="form.min_purchase_qty_dr" type="number" placeholder="10" />
              <text class="input-suffix">个</text>
            </view>
          </view>
          <view class="config-item">
            <view class="config-label">梦想家拿货价</view>
            <view class="input-row">
              <input class="config-input" v-model="form.purchase_price_mxj" type="digit" placeholder="150" />
              <text class="input-suffix">元/个</text>
            </view>
          </view>
          <view class="config-item">
            <view class="config-label">梦想家最低数量</view>
            <view class="input-row">
              <input class="config-input" v-model="form.min_purchase_qty_mxj" type="number" placeholder="100" />
              <text class="input-suffix">个</text>
            </view>
          </view>
          <view class="config-item">
            <view class="config-label">超合伙拿货价</view>
            <view class="input-row">
              <input class="config-input" v-model="form.purchase_price_cjhh" type="digit" placeholder="100" />
              <text class="input-suffix">元/个</text>
            </view>
          </view>
          <view class="config-item">
            <view class="config-label">超合伙最低数量</view>
            <view class="input-row">
              <input class="config-input" v-model="form.min_purchase_qty_cjhh" type="number" placeholder="200" />
              <text class="input-suffix">个</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 保存按钮 -->
      <view class="save-bar">
        <view class="btn-save" :class="{ loading: saving }" @click="save">
          {{ saving ? '保存中...' : '保存配置' }}
        </view>
      </view>

    </template>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '@/api/index';

const { showToast: toast } = uni;

const loading = ref(true);
const saving = ref(false);

// 表单数据，按 key 索引
const form = ref({});

onMounted(async () => {
  try {
    const res = await api.get('/admin/config');
    const configs = res.data || [];
    const map = {};
    configs.forEach(c => { map[c.key] = c.value; });
    form.value = map;
  } catch (e) {
    toast({ title: '加载配置失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
});

async function save() {
  if (saving.value) return;
  saving.value = true;
  try {
    // 构造 items 数组，只提交当前表单中有的 key
    const items = Object.entries(form.value).map(([key, value]) => ({ key, value: String(value) }));
    await api.post('/admin/config', { items });
    toast({ title: '保存成功', icon: 'success' });
  } catch (e) {
    toast({ title: '保存失败', icon: 'none' });
  } finally {
    saving.value = false;
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
  padding-bottom: 120rpx;
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
.top-bar-left, .top-bar-right {
  width: 80rpx;
}
.back-icon {
  font-size: 48rpx;
  color: #333;
  line-height: 88rpx;
}
.top-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #333;
}

/* 加载/空状态 */
.state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
}
.state-icon {
  font-size: 80rpx;
  margin-bottom: 24rpx;
}
.state-text {
  font-size: 28rpx;
  color: #999;
}

/* 分区 */
.section {
  margin-top: 24rpx;
  padding: 0 24rpx;
}
.section-title {
  font-size: 28rpx;
  color: #999;
  margin-bottom: 16rpx;
  padding-left: 8rpx;
}

/* 配置卡片 */
.config-card {
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}
.config-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid #f0f0f0;
  min-height: 96rpx;
}
.config-item:last-child {
  border-bottom: none;
}
.config-label {
  font-size: 30rpx;
  color: #333;
  flex-shrink: 0;
  margin-right: 24rpx;
  min-width: 200rpx;
}
.config-input {
  flex: 1;
  text-align: right;
  font-size: 30rpx;
  color: #333;
  background: transparent;
  outline: none;
}
.config-input:disabled {
  color: #999;
}
.input-row {
  display: flex;
  align-items: center;
  flex: 1;
  justify-content: flex-end;
}
.input-suffix {
  font-size: 26rpx;
  color: #999;
  margin-left: 8rpx;
  white-space: nowrap;
}

/* 保存按钮 */
.save-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 32rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1rpx solid #eee;
  z-index: 100;
}
.btn-save {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  background: #FF6B00;
  color: #fff;
  font-size: 32rpx;
  font-weight: 600;
  border-radius: 44rpx;
}
.btn-save.loading {
  opacity: 0.6;
}
</style>
