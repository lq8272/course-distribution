<template>
  <view class="page">

    <!-- 顶部品牌栏 -->
    <view class="top-bar">
      <text class="top-title">管理后台</text>
      <text class="top-sub">视频课程分销</text>
    </view>

    <!-- Tab 导航 -->
    <view class="tabs">
      <view :class="tab === 'order' ? 'tab active' : 'tab'" @click="switchTab('order')">
        <text class="tab-icon">📋</text>
        <text class="tab-text">订单</text>
      </view>
      <view :class="tab === 'agent' ? 'tab active' : 'tab'" @click="switchTab('agent')">
        <text class="tab-icon">⚡</text>
        <text class="tab-text">分销</text>
      </view>
      <view :class="tab === 'user' ? 'tab active' : 'tab'" @click="switchTab('user')">
        <text class="tab-icon">👥</text>
        <text class="tab-text">用户</text>
      </view>
      <view :class="tab === 'course' ? 'tab active' : 'tab'" @click="switchTab('course')">
        <text class="tab-icon">🎓</text>
        <text class="tab-text">课程</text>
      </view>
      <view :class="tab === 'config' ? 'tab active' : 'tab'" @click="switchTab('config')">
        <text class="tab-icon">⚙️</text>
        <text class="tab-text">配置</text>
      </view>
      <view :class="tab === 'stats' ? 'tab active' : 'tab'" @click="switchTab('stats')">
        <text class="tab-icon">📊</text>
        <text class="tab-text">统计</text>
      </view>
    </view>

    <!-- ===== 订单列表 ===== -->
    <block v-if="tab === 'order'">
      <!-- 状态筛选 -->
      <view class="filter-bar">
        <view
          v-for="s in orderStatusFilter"
          :key="s.value"
          :class="orderStatus === s.value ? 'filter-tag active' : 'filter-tag'"
          @click="switchOrderStatus(s.value)"
        >{{ s.label }}</view>
      </view>

      <!-- 加载/空状态 -->
      <view v-if="loading" class="state-card">
        <view class="state-icon">⏳</view>
        <text class="state-text">加载中...</text>
      </view>
      <view v-else-if="orders.length === 0" class="state-card">
        <view class="state-icon">📦</view>
        <text class="state-text">暂无订单</text>
        <text class="state-hint">还没有任何订单记录</text>
      </view>
      <view v-else v-for="order in orders" :key="order.id" class="order-card">
        <view class="order-card-header">
          <view class="order-id">订单 #{{ order.id }}</view>
          <view :class="['status-badge', 'status-' + order.status]">{{ getStatusText(order.status) }}</view>
        </view>
        <view class="order-card-body">
          <image :src="order.cover_image || '/static/default-cover.png'" mode="aspectFill" class="order-cover" />
          <view class="order-info">
            <text class="order-title">{{ order.course_title || '课程' }}</text>
            <text class="order-meta">买家：{{ order.buyer_nickname || '—' }}</text>
            <text class="order-meta">时间：{{ formatTime(order.created_at) }}</text>
          </view>
        </view>
        <view class="order-card-footer">
          <view class="order-amount">
            <text class="amount-label">实付金额</text>
            <text class="amount-val">¥{{ order.total_amount || 0 }}</text>
          </view>
          <view v-if="order.status === 0" class="order-actions">
            <view class="btn-sm btn-outline" @click="openReject(order)">拒绝</view>
            <view class="btn-sm btn-filled" @click="confirmOrder(order.id)">确认</view>
          </view>
        </view>
      </view>
    </block>

    <!-- ===== 分销审核 ===== -->
    <block v-if="tab === 'agent'">
      <!-- 子 tab 切换 -->
      <view class="sub-tab-bar">
        <view :class="'sub-tab' + (agentSubTab === 'apply' ? ' active' : '')" @click="agentSubTab = 'apply'">
          新申请<view class="badge" v-if="agents.length">{{ agents.length }}</view>
        </view>
        <view :class="'sub-tab' + (agentSubTab === 'upgrade' ? ' active' : '')" @click="agentSubTab = 'upgrade'">
          升级申请<view class="badge" v-if="upgradeAgents.length">{{ upgradeAgents.length }}</view>
        </view>
      </view>

      <!-- 新申请列表 -->
      <block v-if="agentSubTab === 'apply'">
        <view v-if="loading" class="state-card">
          <view class="state-icon">⏳</view>
          <text class="state-text">加载中...</text>
        </view>
        <view v-else-if="agents.length === 0" class="state-card">
          <view class="state-icon">🎉</view>
          <text class="state-text">暂无待审核</text>
          <text class="state-hint">所有申请已处理完毕</text>
        </view>
        <view v-else v-for="a in agents" :key="a.id" class="agent-card">
          <view class="agent-card-body">
            <view class="agent-avatar-lg">{{ getAvatarText(a.nickname) }}</view>
            <view class="agent-info">
              <view class="agent-name-row">
                <text class="agent-name">{{ a.nickname || '匿名用户' }}</text>
                <text class="agent-level-tag">{{ levelName(a.level) || a.level }}</text>
              </view>
              <text class="agent-meta">推荐人：{{ a.recommender_id || '无' }}</text>
              <text class="agent-meta">申请时间：{{ formatTime(a.created_at) }}</text>
            </view>
          </view>
          <view class="agent-card-footer">
            <view class="btn-sm btn-outline" @click="openReject(a)">拒绝</view>
            <view class="btn-sm btn-filled" @click="approve(a.id)">通过审核</view>
          </view>
        </view>
      </block>

      <!-- 升级申请列表 -->
      <block v-if="agentSubTab === 'upgrade'">
        <view v-if="loading" class="state-card">
          <view class="state-icon">⏳</view>
          <text class="state-text">加载中...</text>
        </view>
        <view v-else-if="upgradeAgents.length === 0" class="state-card">
          <view class="state-icon">🎉</view>
          <text class="state-text">暂无升级申请</text>
          <text class="state-hint">所有升级申请已处理完毕</text>
        </view>
        <view v-else v-for="a in upgradeAgents" :key="a.id" class="agent-card">
          <view class="agent-card-body">
            <view class="agent-avatar-lg">{{ getAvatarText(a.nickname) }}</view>
            <view class="agent-info">
              <view class="agent-name-row">
                <text class="agent-name">{{ a.nickname || '匿名用户' }}</text>
                <text class="agent-level-tag">{{ levelName(a.from_level) || a.from_level }} → {{ levelName(a.to_level) || a.to_level }}</text>
              </view>
              <text class="agent-meta">推荐人数：{{ a.referral_count || 0 }}</text>
              <text class="agent-meta">申请时间：{{ formatTime(a.created_at) }}</text>
              <text class="agent-meta" v-if="a.apply_fee > 0">补缴费用：¥{{ a.apply_fee }}</text>
            </view>
          </view>
          <view class="agent-card-footer">
            <view class="btn-sm btn-outline" @click="openUpgradeReject(a)">拒绝</view>
            <view class="btn-sm btn-filled" @click="approveUpgrade(a.id)">通过升级</view>
          </view>
        </view>
      </block>
    </block>

    <!-- ===== 用户管理 ===== -->
    <block v-if="tab === 'user'">
      <!-- 统计栏 -->
      <view class="stats-bar" v-if="userStats">
        <view class="stat-item" @click="filterAgentType='all'; loadUsers()">
          <text class="stat-n">{{ userStats.total || 0 }}</text>
          <text class="stat-l">总用户</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item" @click="filterAgentType='distributor'; loadUsers()">
          <text class="stat-n stat-green">{{ userStats.distributor || 0 }}</text>
          <text class="stat-l">分销商</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item" @click="filterAgentType='regular'; loadUsers()">
          <text class="stat-n stat-orange">{{ userStats.regular || 0 }}</text>
          <text class="stat-l">普通用户</text>
        </view>
      </view>

      <!-- 筛选+搜索 -->
      <view class="filter-search-bar">
        <view class="filter-pills">
          <view :class="filterAgentType==='all'?'pill active':'pill'" @click="setAgentFilter('all')">全部</view>
          <view :class="filterAgentType==='distributor'?'pill active':'pill'" @click="setAgentFilter('distributor')">分销商</view>
          <view :class="filterAgentType==='regular'?'pill active':'pill'" @click="setAgentFilter('regular')">普通用户</view>
        </view>
        <view class="search-row">
          <view class="search-input-wrap">
            <text class="search-icon">🔍</text>
            <input class="search-input" v-model="userKeyword" placeholder="手机号/昵称" @confirm="loadUsers" />
          </view>
          <view class="btn-search" @click="loadUsers">搜索</view>
        </view>
      </view>

      <view v-if="loading" class="state-card">
        <view class="state-icon">⏳</view>
        <text class="state-text">加载中...</text>
      </view>
      <view v-else-if="users.length === 0" class="state-card">
        <view class="state-icon">👤</view>
        <text class="state-text">暂无用户</text>
      </view>
      <view v-else v-for="u in users" :key="u.id" class="user-card">
        <view class="user-card-body">
          <image v-if="u.avatar" :src="u.avatar" mode="aspectFill" class="user-avatar-lg" />
          <view v-else class="user-avatar-placeholder">{{ getAvatarText(u.nickname) }}</view>
          <view class="user-info">
            <view class="user-name-row">
              <text class="user-name">{{ u.nickname || '未设置昵称' }}</text>
              <text :class="u.agent_status === 1 ? 'badge-green' : 'badge-orange'">
                {{ u.agent_status === 1 ? (levelName(u.agent_level) || '分销商') : '普通用户' }}
              </text>
            </view>
            <text class="user-meta">ID：{{ u.id }}</text>
            <text class="user-meta" v-if="u.phone">手机：{{ u.phone }}</text>
            <text class="user-meta">注册：{{ formatTime(u.created_at) }}</text>
          </view>
        </view>
      </view>

      <!-- 分页 -->
      <view class="pagination" v-if="userTotal > userPageSize">
        <view class="page-btn" :class="{disabled: userPage <= 1}" @click="userPage--; loadUsers()">← 上一页</view>
        <text class="page-info">{{ userPage }} / {{ Math.ceil(userTotal / userPageSize) }}</text>
        <view class="page-btn" :class="{disabled: userPage >= Math.ceil(userTotal / userPageSize)}" @click="userPage++; loadUsers()">下一页 →</view>
      </view>
    </block>

    <!-- ===== 课程管理 ===== -->
    <block v-if="tab === 'course'">
      <!-- 顶部操作栏 -->
      <view class="op-bar">
        <view class="search-input-wrap">
          <text class="search-icon">🔍</text>
          <input class="search-input" v-model="courseKeyword" placeholder="搜索课程标题" @confirm="loadCourses" />
        </view>
        <view class="btn-add" @click="openCourseForm(null)">+ 新建</view>
        <view class="btn-add" @click="openCategoryModal">分类管理</view>
      </view>

      <view v-if="loading" class="state-card">
        <view class="state-icon">⏳</view>
        <text class="state-text">加载中...</text>
      </view>
      <view v-else-if="courseList.length === 0" class="state-card">
        <view class="state-icon">🎓</view>
        <text class="state-text">暂无课程</text>
        <text class="state-hint">点击右上角新建课程</text>
      </view>
      <view v-else v-for="c in courseList" :key="c.id" class="course-admin-card">
        <view class="course-admin-header">
          <image :src="c.cover_image_signed_url || c.cover_image || '/static/default-cover.png'" mode="aspectFill" class="course-admin-cover" />
          <view class="course-admin-info">
            <text class="course-admin-title">{{ c.title }}</text>
            <view class="course-admin-meta">
              <text class="meta-tag">{{ c.category_name || '未分类' }}</text>
              <text class="meta-tag">排序：{{ c.sort }}</text>
            </view>
            <view class="course-admin-tags">
              <text :class="['tag-pill', c.is_distribution ? 'tag-on' : 'tag-off']">{{ c.is_distribution ? '✅ 分销' : '❌ 普通' }}</text>
              <text :class="['tag-pill', c.is_show ? 'tag-show' : 'tag-hide']">{{ c.is_show ? '🔎 显示' : '🔒 隐藏' }}</text>
            </view>
          </view>
        </view>
        <view class="course-admin-price">
          <text class="price-big">¥{{ c.price }}</text>
          <text class="price-unit">元</text>
        </view>
        <view class="course-admin-actions">
          <view class="btn-sm btn-outline" @click="openCourseForm(c)">编辑</view>
          <view class="btn-sm" :class="c.is_show ? 'btn-warning' : 'btn-primary'" @click="toggleShow(c)">
            {{ c.is_show ? '下架' : '上架' }}
          </view>
          <view class="btn-sm btn-danger" @click="deleteCourse(c.id)">删除</view>
        </view>
      </view>

      <!-- 分页 -->
      <view class="pagination" v-if="courseTotal > coursePageSize">
        <view class="page-btn" :class="{disabled: coursePage <= 1}" @click="coursePage--; loadCourses()">← 上一页</view>
        <text class="page-info">{{ coursePage }} / {{ Math.ceil(courseTotal / coursePageSize) }}</text>
        <view class="page-btn" :class="{disabled: coursePage >= Math.ceil(courseTotal / coursePageSize)}" @click="coursePage++; loadCourses()">下一页 →</view>
      </view>
    </block>

    <!-- ===== 系统配置 ===== -->
    <block v-if="tab === 'config'">
      <view class="state-card">
        <view class="state-icon">⚙️</view>
        <text class="state-text">系统配置</text>
        <text class="state-hint">点击下方按钮进入配置页面</text>
        <view class="btn-primary mt-32" @click="goConfig">打开配置页面</view>
      </view>
    </block>

    <!-- ===== 数据统计 ===== -->
    <block v-if="tab === 'stats'">
      <view class="state-card">
        <view class="state-icon">📊</view>
        <text class="state-text">数据统计</text>
        <text class="state-hint">查看销售、佣金、返利汇总</text>
        <view class="btn-primary mt-32" @click="goStats">打开统计页面</view>
      </view>
    </block>

    <!-- ===== 拒绝弹窗 ===== -->
    <view v-if="showRejectModal" class="modal-mask" @click="closeReject">
      <view class="modal" @click.stop>
        <view class="modal-header">
          <text class="modal-title">拒绝申请</text>
        </view>
        <textarea v-model="formData.rejectReason" class="reason-input" placeholder="请输入拒绝理由（选填）" maxlength="200" />
        <view class="modal-actions">
          <view class="btn-cancel" @click="closeReject">取消</view>
          <view class="btn-confirm-red" @click="confirmReject">确认拒绝</view>
        </view>
      </view>
    </view>

    <!-- ===== 课程编辑弹窗 ===== -->
    <view v-if="showCourseForm" class="modal-mask" @click="closeCourseForm">
      <view class="modal modal-wide" @click.stop>
        <view class="modal-header">
          <text class="modal-title">{{ editingCourse.id ? '编辑课程' : '新建课程' }}</text>
        </view>

        <!-- 封面 -->
        <view class="form-item">
          <view class="form-label">课程封面</view>
          <view class="cover-picker" @click="pickCover">
            <image v-if="formData.cover_image_display || formData.cover_image" :src="formData.cover_image_display || formData.cover_image" mode="aspectFill" class="cover-thumb" />
            <text v-else class="cover-placeholder">+ 点击上传</text>
          </view>
          <text v-if="formData.cover_image" class="cover-tip">点击可更换</text>
        </view>

        <!-- 标题 -->
        <view class="form-item">
          <view class="form-label">课程标题 <text class="required">*</text></view>
          <view class="form-field">
            <input class="form-input" v-model="formData.title" placeholder="输入课程标题" maxlength="100" />
          </view>
        </view>

        <!-- 分类 -->
        <view class="form-item">
          <view class="form-label">分类</view>
          <view class="form-field">
            <picker :value="categoryIndex" :range="categories" range-key="name" @change="onCategoryChange">
              <view class="form-input picker-value">{{ categories[categoryIndex]?.name || '请选择分类' }}</view>
            </picker>
          </view>
        </view>

        <!-- 价格 -->
        <view class="form-item">
          <view class="form-label">价格（元）</view>
          <view class="form-field">
            <input class="form-input" v-model="formData.price" type="digit" placeholder="0.00" />
          </view>
        </view>

        <!-- 免费 -->
        <view class="form-item form-item--row">
          <view class="form-label">免费课程</view>
          <switch :checked="formData.is_free === 1" @change="formData.is_free = formData.is_free ? 0 : 1" />
        </view>

        <!-- 分销 -->
        <view class="form-item form-item--row">
          <view class="form-label">开启分销</view>
          <switch :checked="formData.is_distribution === 1" @change="formData.is_distribution = formData.is_distribution ? 0 : 1" />
        </view>

        <!-- 佣金比例 -->
        <view class="form-item" v-if="formData.is_distribution">
          <view class="form-label">一级佣金比例</view>
          <view class="form-field">
            <input class="form-input" v-model="formData.commission_ratio" type="digit" placeholder="如：30" />
          </view>
        </view>

        <!-- 排序 -->
        <view class="form-item">
          <view class="form-label">排序值</view>
          <view class="form-field">
            <input class="form-input" v-model="formData.sort" type="number" placeholder="数字越大越靠前" />
          </view>
        </view>

        <!-- 视频上传 -->
        <view class="form-item">
          <view class="form-label">课程视频</view>
          <view class="form-field">
            <video-uploader
              v-model="formData.video_key"
              :course-id="formData.id || 0"
              :poster="formData.cover_image"
              label="上传视频"
              @upload-start="formUploading = true"
              @upload-end="formUploading = false"
              @error="(e) => toast({ title: e.message || '上传失败', icon: 'none' })"
            />
          </view>
        </view>

        <!-- 简介 -->
        <view class="form-item">
          <view class="form-label">课程简介</view>
          <view class="form-field">
            <textarea class="form-textarea" v-model="formData.description" placeholder="输入课程简介" maxlength="2000" />
          </view>
        </view>

        <!-- 按钮 -->
        <view class="modal-actions">
          <view class="btn-cancel" @click="closeCourseForm">取消</view>
          <view class="btn-confirm" :class="{loading: formSaving}" @click="saveCourse">{{ formSaving ? '保存中...' : '保存' }}</view>
        </view>
      </view>
    </view>

    <!-- ===== 分类管理弹窗 ===== -->
    <view v-if="showCategoryModal" class="modal-mask" @click="closeCategoryModal">
      <view class="modal" @click.stop>
        <view class="modal-header">
          <text class="modal-title">分类管理</text>
          <view class="modal-close" @click="closeCategoryModal">×</view>
        </view>

        <!-- 新建分类 -->
        <view class="cat-add-row">
          <input class="form-input" v-model="catForm.name" placeholder="输入分类名称" maxlength="32" />
          <view class="btn-sm btn-primary" @click="saveCategory">新增</view>
        </view>

        <!-- 分类列表 -->
        <view class="cat-list">
          <view v-for="cat in categories" :key="cat.id" class="cat-item">
            <view class="cat-info">
              <input
                class="form-input cat-name-input"
                :value="cat.name"
                @blur="updateCategoryName(cat.id, $event.detail.value)"
                maxlength="32"
              />
              <input
                class="form-input cat-sort-input"
                :value="cat.sort"
                type="number"
                @blur="updateCategorySort(cat.id, $event.detail.value)"
                placeholder="排序"
              />
            </view>
            <view class="cat-actions">
              <view class="btn-sm btn-danger" @click="deleteCategory(cat.id)">删除</view>
            </view>
          </view>
          <view v-if="categories.length === 0" class="state-hint" style="text-align:center;padding:20rpx;">暂无分类</view>
        </view>
      </view>
    </view>

  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useUserStore } from '@/store/user';
import { orderApi } from '@/api/order';
import { api, BASE_URL } from '@/api/index';
import { courseApi } from '@/api/course';
import VideoUploader from '@/components/video-uploader.vue';

const { showToast: toast, showModal: modal, showLoading: showLoadingToast, hideLoading: hideLoading$ } = uni;

const userStore = useUserStore();
const tab = ref('order');
const loading = ref(false);
const orders = ref([]);
const agents = ref([]);
const users = ref([]);
const orderStatus = ref(-1); // 筛选值：-1=全部, 0=待确认, 1=已确认, 2=已完成, 3=已退款, 4=已取消
const orderStatusFilter = [
  { label: '全部', value: -1 },
  { label: '待确认', value: 0 },
  { label: '已确认', value: 1 },
  { label: '已完成', value: 2 },
  { label: '已退款', value: 3 },
];

// 分销子 tab：apply=新申请, upgrade=升级申请
const agentSubTab = ref('apply');
const upgradeAgents = ref([]);

// 用户管理 state
const userStats = ref(null);
const userPage = ref(1);
const userPageSize = 20;
const userTotal = ref(0);
const userKeyword = ref('');
const filterAgentType = ref('all');

// ===== 课程管理 state =====
const courseList = ref([]);
const courseTotal = ref(0);
const coursePage = ref(1);
const coursePageSize = 20;
const courseKeyword = ref('');
const categories = ref([]);
const categoryIndex = ref(0);
const showCourseForm = ref(false);
const showCategoryModal = ref(false);
const catForm = ref({ name: '' });
const formSaving = ref(false);
const formUploading = ref(false);
const editingCourse = ref({});
const formData = ref({
  id: null, title: '', description: '', cover_image: '', video_key: '',
  price: '0.00', is_free: 0, is_distribution: 0, commission_ratio: '30',
  category_id: null, sort: 0, rejectReason: '',
});

onShow(async () => {
  if (!uni.getStorageSync('token')) {
    toast({ title: '请先登录', icon: 'none' });
    return;
  }
  if (!userStore.isAdmin.value) {
    toast({ title: '需要管理员权限', icon: 'none' });
    return;
  }
  await loadCurrentTab();
  if (tab.value === 'course') {
    await loadCategories();
  }
});

// ===== Tab 切换 =====
async function switchTab(t) {
  if (t === tab.value) return;
  tab.value = t;
  coursePage.value = 1;
  await loadCurrentTab();
  if (t === 'course') loadCategories();
}

// ===== 订单状态筛选 =====
async function switchOrderStatus(val) {
  if (val === orderStatus.value) return;
  orderStatus.value = val;
  await loadCurrentTab();
}

async function loadCurrentTab() {
  loading.value = true;
  try {
    if (tab.value === 'order') {
      const params = { page: 1, page_size: 50 };
      if (orderStatus.value !== -1) params.status = orderStatus.value;
      const list = await api.get('/admin/order/list', params);
      orders.value = list.rows || [];
    } else if (tab.value === 'agent') {
      const [applyRes, upgradeRes] = await Promise.all([
        api.get('/admin/agent/pending'),
        api.get('/admin/agent/upgrade/pending'),
      ]);
      agents.value = applyRes.rows || [];
      upgradeAgents.value = upgradeRes.rows || [];
    } else if (tab.value === 'user') {
      await Promise.all([
        loadUsers(),
        loadUserStats(),
      ]);
    } else if (tab.value === 'course') {
      await loadCourses();
    }
  } catch (e) {
    console.error('load tab error', e);
    toast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

// ===== 订单 =====
async function confirmOrder(id) {
  try {
    await orderApi.confirm(id);
    toast({ title: '已确认', icon: 'success' });
    orders.value = orders.value.map(o => o.id === id ? { ...o, status: 1 } : o);
  } catch {
    toast({ title: '操作失败', icon: 'none' });
  }
}

// ===== 分销 =====
async function approve(id) {
  try {
    await api.post(`/admin/agent/${id}/approve`, {});
    toast({ title: '已通过', icon: 'success' });
    agents.value = agents.value.filter(a => a.id !== id);
  } catch {
    toast({ title: '操作失败', icon: 'none' });
  }
}

function openReject(item) {
  editingCourse.value = item;
  formData.value.rejectReason = '';
  showRejectModal.value = true;
}
function closeReject() {
  showRejectModal.value = false;
  editingCourse.value = null;
}

async function confirmReject() {
  if (!editingCourse.value) return;
  const id = editingCourse.value.id;
  try {
    if (agentSubTab.value === 'upgrade') {
      await api.post(`/admin/agent/upgrade/${id}/reject`, { reason: formData.value.rejectReason || '' });
      upgradeAgents.value = upgradeAgents.value.filter(a => a.id !== id);
    } else {
      await api.post(`/admin/agent/${id}/reject`, { reason: formData.value.rejectReason || '' });
      agents.value = agents.value.filter(a => a.id !== id);
    }
    toast({ title: '已拒绝', icon: 'success' });
    closeReject();
  } catch {
    toast({ title: '操作失败', icon: 'none' });
  }
}

// ===== 升级审核 =====
async function approveUpgrade(id) {
  try {
    await api.post(`/admin/agent/upgrade/${id}/approve`, {});
    toast({ title: '已通过', icon: 'success' });
    upgradeAgents.value = upgradeAgents.value.filter(a => a.id !== id);
  } catch {
    toast({ title: '操作失败', icon: 'none' });
  }
}

function openUpgradeReject(item) {
  editingCourse.value = item;
  formData.value.rejectReason = '';
  showRejectModal.value = true;
}

async function confirmUpgradeReject() {
  if (!editingCourse.value) return;
  try {
    const id = editingCourse.value.id;
    await api.post(`/admin/agent/upgrade/${id}/reject`, { reason: formData.value.rejectReason || '' });
    toast({ title: '已拒绝', icon: 'success' });
    upgradeAgents.value = upgradeAgents.value.filter(a => a.id !== id);
    closeReject();
  } catch {
    toast({ title: '操作失败', icon: 'none' });
  }
}

// ===== 课程管理 =====
async function loadCategories() {
  try {
    const cats = await courseApi.categoryList();
    categories.value = cats || [];
  } catch (e) {
    console.error('loadCategories error', e);
  }
}

async function loadCourses() {
  loading.value = true;
  try {
    const params = { page: coursePage.value, page_size: coursePageSize };
    if (courseKeyword.value) params.keyword = courseKeyword.value;
    const res = await api.get('/admin/course/list', params);
    courseList.value = res.rows || [];
    courseTotal.value = res.total || 0;
  } catch (e) {
    console.error('loadCourses error', e);
    toast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function openCourseForm(c) {
  if (c) {
    editingCourse.value = c;
    formData.value = {
      id: c.id,
      title: c.title || '',
      description: c.description || '',
      cover_image: c.cover_image || '',   // 存 key，提交时用
      cover_image_display: c.cover_image_signed_url || c.cover_image || '', // 存签名 URL用于显示
      video_key: c.video_key || '',
      price: c.price || '0.00',
      is_free: c.is_free ? 1 : 0,
      is_distribution: c.is_distribution ? 1 : 0,
      commission_ratio: c.commission_ratio || '30',
      category_id: c.category_id,
      sort: c.sort || 0,
    };
    // 匹配分类
    const idx = categories.value.findIndex(cat => cat.id === c.category_id);
    categoryIndex.value = idx >= 0 ? idx : 0;
  } else {
    editingCourse.value = {};
    formData.value = {
      id: null, title: '', description: '', cover_image: '', cover_image_display: '',
      video_key: '',
      price: '0.00', is_free: 0, is_distribution: 0, commission_ratio: '30',
      category_id: null, sort: 0,
    };
    categoryIndex.value = 0;
    // 新建时默认选第一个分类（避免用户没动 picker 时 category_id 为 null）
    formData.value.category_id = categories.value[0]?.id ?? null;
  }
  showCourseForm.value = true;
}

function closeCourseForm() {
  showCourseForm.value = false;
  editingCourse.value = null;
}

function onCategoryChange(e) {
  categoryIndex.value = e.detail.value;
  formData.value.category_id = categories.value[categoryIndex.value]?.id || null;
}

async function pickCover() {
  try {
    const res = await new Promise((resolve, reject) => {
      uni.chooseImage({
        count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'],
        success: resolve, fail: reject,
      });
    });
    const file = res.tempFiles[0];
    if (!file) return;

    showLoadingToast({ title: '上传中...' });
    try {
      // 编辑时用已有课程ID；新建时先创建空白课程再上传封面
      let courseId = editingCourse.value?.id;
      if (!courseId) {
        const result = await api.post('/admin/course/create', {
          title: formData.value.title || '未命名课程',
          price: parseFloat(formData.value.price) || 0,
        });
        courseId = result?.data?.id ?? result?.id;
        editingCourse.value = { id: courseId };
        formData.value.id = courseId;
      }

      // 1. 获取上传凭证
      const { token, key } = await api.post('/video/image-token', {
        course_id: courseId,
        filename: file.name || 'cover.jpg',
      });

      // 2. 七牛直传
      const uploadRes = await new Promise((resolve, reject) => {
        uni.uploadFile({
          url: 'https://up-z2.qiniup.com',
          filePath: file.path,
          fileType: 'image',
          name: 'file',
          formData: { token, key },
          success: resolve,
          fail: reject,
        });
      });

      const data = JSON.parse(uploadRes.data);
      if (!data.key) throw new Error(data.error || '上传失败');

      // 3. 存 key（不是签名 URL），签名 URL 用于即时预览
      formData.value.cover_image = key;
      const signedUrlRes = await api.get(`/video/cdn-url/${encodeURIComponent(key)}`);
      formData.value.cover_image_display = signedUrlRes?.data?.url || signedUrlRes?.url || signedUrlRes || '';
      toast({ title: '封面上传成功', icon: 'success' });
    } finally {
      hideLoading$();
    }
  } catch (e) {
    if (e.errMsg !== 'chooseImage:fail cancel') {
      console.error('pickCover error', e);
      toast({ title: '封面上传失败', icon: 'none' });
    }
  }
}

async function saveCourse() {
  if (!formData.value.title) {
    toast({ title: '请输入课程标题', icon: 'none' });
    return;
  }
  formSaving.value = true;
  try {
    const payload = {
      title: formData.value.title,
      description: formData.value.description,
      cover_image: formData.value.cover_image,
      video_key: formData.value.video_key,
      price: parseFloat(formData.value.price) || 0,
      is_free: formData.value.is_free,
      is_distribution: formData.value.is_distribution,
      commission_ratio: parseFloat(formData.value.commission_ratio) || 0,
      category_id: formData.value.category_id,
      sort: parseInt(formData.value.sort) || 0,
    };
    if (formData.value.id) {
      // 编辑已有课程
      await api.put(`/admin/course/${formData.value.id}`, payload);
      toast({ title: '更新成功', icon: 'success' });
    } else {
      // 新建课程
      const result = await api.post('/admin/course/create', payload);
      formData.value.id = result?.data?.id ?? result?.id;
      editingCourse.value = { id: formData.value.id };
      // 刷新列表
      courseList.value = courseList.value || [];
      toast({ title: '创建成功', icon: 'success' });
    }
    closeCourseForm();
    await loadCourses();
  } catch (e) {
    console.error('saveCourse error', e);
    toast({ title: e?.message || '保存失败', icon: 'none' });
  } finally {
    formSaving.value = false;
  }
}

// ===== 分类管理 =====
function openCategoryModal() {
  showCategoryModal.value = true;
  catForm.value.name = '';
  loadCategories();
}
function closeCategoryModal() {
  showCategoryModal.value = false;
}
async function saveCategory() {
  const name = catForm.value.name.trim();
  if (!name) { toast({ title: '请输入分类名称', icon: 'none' }); return; }
  try {
    await courseApi.categoryCreate({ name, sort: 0 });
    catForm.value.name = '';
    toast({ title: '创建成功', icon: 'success' });
    await loadCategories();
  } catch (e) {
    toast({ title: '创建失败', icon: 'none' });
  }
}
async function updateCategoryName(id, name) {
  if (!name.trim()) return;
  try {
    await courseApi.categoryUpdate(id, { name: name.trim() });
    await loadCategories();
  } catch (e) {
    toast({ title: '更新失败', icon: 'none' });
  }
}
async function updateCategorySort(id, sort) {
  try {
    await courseApi.categoryUpdate(id, { sort: parseInt(sort) || 0 });
    await loadCategories();
  } catch (e) {
    toast({ title: '更新失败', icon: 'none' });
  }
}
async function deleteCategory(id) {
  try {
    await modal({ title: '确认删除', content: '删除后不可恢复，确定删除该分类？' });
    await courseApi.categoryDelete(id);
    toast({ title: '已删除', icon: 'success' });
    await loadCategories();
  } catch (e) {
    toast({ title: '删除失败', icon: 'none' });
  }
}

async function toggleShow(c) {
  try {
    await api.put(`/admin/course/${c.id}`, { is_show: c.is_show ? 0 : 1 });
    toast({ title: c.is_show ? '已下架' : '已上架', icon: 'success' });
    c.is_show = c.is_show ? 0 : 1;
  } catch {
    toast({ title: '操作失败', icon: 'none' });
  }
}

async function deleteCourse(id) {
  modal({
    title: '确认删除',
    content: '删除后不可恢复，确定要删除该课程吗？',
    success: async (res) => {
      if (!res.confirm) return;
      try {
        await api.delete(`/admin/course/${id}`);
        toast({ title: '已删除', icon: 'success' });
        courseList.value = courseList.value.filter(c => c.id !== id);
      } catch {
        toast({ title: '删除失败', icon: 'none' });
      }
    },
  });
}

// ===== 拒绝弹窗（共用）=====
const showRejectModal = ref(false);

// ===== 用户管理 =====
async function loadUserStats() {
  try {
    const res = await api.get('/admin/user/stats');
    userStats.value = res;
  } catch (e) {
    console.error('loadUserStats error', e);
  }
}

async function loadUsers() {
  loading.value = true;
  try {
    const params = { page: userPage.value, page_size: userPageSize };
    if (userKeyword.value) params.keyword = userKeyword.value;
    if (filterAgentType.value !== 'all') params.agent_type = filterAgentType.value;
    const res = await api.get('/admin/user/list', params);
    users.value = res.rows || [];
    userTotal.value = res.total || 0;
  } catch (e) {
    console.error('loadUsers error', e);
    toast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function setAgentFilter(type) {
  filterAgentType.value = type;
  userPage.value = 1;
  loadUsers();
}

function levelName(level) {
  if (!level) return '';
  const map = {
    DISTRIBUTORDR: '达人',
    DISTRIBUTORMXJ: '梦想家',
    DISTRIBUTORCJHH: '超级合伙人',
  };
  return map[level] || level;
}

// ===== 工具函数 =====
function statusColor(s) {
  return ['#ff9600','#007aff','#00b43c','#999','#999'][s] || '#999';
}
function statusBg(s) {
  return ['rgba(255,150,0,0.1)','rgba(0,122,255,0.1)','rgba(0,180,60,0.1)','rgba(153,153,153,0.1)','rgba(153,153,153,0.1)'][s] || 'rgba(153,153,153,0.1)';
}
function getStatusText(status) {
  return ['待确认', '已确认', '已完成', '已取消', '已退款'][status] || '未知';
}
function formatTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function getAvatarText(nickname) {
  return (nickname || '?')[0];
}

// ===== 系统配置 =====
function goConfig() {
  uni.navigateTo({ url: '/pages/admin/config/index' });
}

function goStats() {
  uni.navigateTo({ url: '/pages/admin/stats/index' });
}

function goPurchase() {
  uni.navigateTo({ url: '/pages/admin/purchase/list' });
}
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
$border-color:  #ece8e1;
$bg-white:      #ffffff;
$shadow-card:   0 2rpx 16rpx rgba(0,0,0,0.06), 0 8rpx 32rpx rgba(0,0,0,0.04);

.page { padding: 0; min-height: 100vh; background: $bg; }

/* 顶部品牌栏 */
.top-bar {
  background: linear-gradient(135deg, $primary 0%, $primary-light 100%);
  padding: 24rpx 28rpx 32rpx;
  display: flex;
  align-items: baseline;
  gap: 12rpx;
}
.top-title { font-size: 36rpx; font-weight: 800; color: #fff; }
.top-sub { font-size: 22rpx; color: rgba(255,255,255,0.7); }

/* Tab 导航 */
.tabs {
  display: flex;
  background: $card;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05);
  position: sticky;
  top: 0;
  z-index: 100;
}
.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
  padding: 20rpx 0 16rpx;
  border-bottom: 4rpx solid transparent;
  transition: all 0.2s;
}
.tab-icon { font-size: 36rpx; }
.tab-text { font-size: 22rpx; color: $text-muted; margin-top: 2rpx; }
.tab.active { border-bottom-color: $primary; }
.tab.active .tab-text { color: $primary; font-weight: 600; }

/* 筛选栏 */
.filter-bar {
  display: flex;
  gap: 12rpx;
  padding: 20rpx 24rpx;
  flex-wrap: wrap;
}
.filter-tag {
  padding: 10rpx 28rpx;
  border-radius: 40rpx;
  font-size: 24rpx;
  background: $card;
  color: $text-secondary;
  border: 1rpx solid $border;
  transition: all 0.15s;
}
.filter-tag.active {
  background: linear-gradient(135deg, $primary, $primary-light);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 4rpx 16rpx rgba($primary, 0.2);
}

/* 分销子 tab */
.sub-tab-bar {
  display: flex;
  background: $bg-white;
  border-bottom: 1rpx solid $border-color;
}
.sub-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 24rpx 0;
  font-size: 28rpx;
  color: $text-secondary;
  border-bottom: 4rpx solid transparent;
  &.active {
    color: $primary;
    border-bottom-color: $primary;
    font-weight: 600;
  }
}
.badge {
  background: $primary;
  color: #fff;
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 20rpx;
  min-width: 36rpx;
  text-align: center;
}

/* 空/加载状态卡片 */
.state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0;
  gap: 12rpx;
}
.state-icon { font-size: 80rpx; }
.state-text { font-size: 28rpx; font-weight: 600; color: $text-secondary; }
.state-hint { font-size: 24rpx; color: $text-muted; }

/* ===== 订单卡片 ===== */
.order-card {
  background: $card;
  border-radius: 24rpx;
  box-shadow: $shadow-card;
  margin: 0 24rpx 16rpx;
  overflow: hidden;
}
.order-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 24rpx 0;
}
.order-id { font-size: 22rpx; color: $text-muted; }
.status-badge {
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
  font-weight: 500;
}
.status-0 { color: #ff9600; background: rgba(255,150,0,0.1); }
.status-1 { color: #007aff; background: rgba(0,122,255,0.1); }
.status-2 { color: $primary; background: rgba($primary,0.1); }
.status-3, .status-4 { color: $text-muted; background: rgba($text-muted,0.1); }

.order-card-body {
  display: flex;
  gap: 20rpx;
  padding: 16rpx 24rpx;
}
.order-cover {
  width: 120rpx;
  height: 90rpx;
  border-radius: 12rpx;
  flex-shrink: 0;
  background: #ece8e1;
}
.order-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  justify-content: center;
}
.order-title { font-size: 26rpx; font-weight: 600; color: $text-primary; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.order-meta { font-size: 22rpx; color: $text-muted; }
.order-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 24rpx;
  border-top: 1rpx solid $border;
}
.order-amount { display: flex; flex-direction: column; gap: 2rpx; }
.amount-label { font-size: 20rpx; color: $text-muted; }
.amount-val { font-size: 30rpx; font-weight: 700; color: $primary; }
.order-actions { display: flex; gap: 12rpx; }

/* ===== 分销审核卡片 ===== */
.agent-card {
  background: $card;
  border-radius: 24rpx;
  box-shadow: $shadow-card;
  margin: 0 24rpx 16rpx;
  overflow: hidden;
}
.agent-card-body {
  display: flex;
  gap: 20rpx;
  padding: 24rpx;
  align-items: center;
}
.agent-avatar-lg {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, $primary, $primary-light);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  font-weight: 700;
  flex-shrink: 0;
}
.agent-info { flex: 1; display: flex; flex-direction: column; gap: 8rpx; }
.agent-name-row { display: flex; align-items: center; gap: 12rpx; }
.agent-name { font-size: 30rpx; font-weight: 700; color: $text-primary; }
.agent-level-tag { font-size: 20rpx; color: $gold; background: rgba($gold,0.1); padding: 2rpx 12rpx; border-radius: 10rpx; }
.agent-meta { font-size: 22rpx; color: $text-muted; }
.agent-card-footer {
  display: flex;
  gap: 12rpx;
  padding: 16rpx 24rpx;
  border-top: 1rpx solid $border;
  justify-content: flex-end;
}

/* ===== 用户管理 ===== */
.stats-bar {
  display: flex;
  background: $card;
  border-radius: 24rpx;
  box-shadow: $shadow-card;
  margin: 20rpx 24rpx 12rpx;
  overflow: hidden;
}
.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24rpx 0;
  gap: 4rpx;
  transition: background 0.12s;
}
.stat-item:active { background: rgba(0,0,0,0.025); }
.stat-n { font-size: 40rpx; font-weight: 800; color: $text-primary; }
.stat-green { color: #00b43c; }
.stat-orange { color: $primary; }
.stat-l { font-size: 20rpx; color: $text-muted; }
.stat-divider { width: 1rpx; background: $border; margin: 16rpx 0; }

.filter-search-bar {
  background: $card;
  border-radius: 24rpx;
  box-shadow: $shadow-card;
  margin: 0 24rpx 16rpx;
  padding: 16rpx;
}
.filter-pills { display: flex; gap: 12rpx; margin-bottom: 16rpx; }
.pill {
  flex: 1;
  text-align: center;
  padding: 10rpx 0;
  font-size: 24rpx;
  color: $text-secondary;
  background: $bg;
  border-radius: 32rpx;
  transition: all 0.15s;
}
.pill.active {
  background: linear-gradient(135deg, $primary, $primary-light);
  color: #fff;
  font-weight: 600;
}
.search-row { display: flex; gap: 12rpx; }
.search-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10rpx;
  background: $bg;
  border-radius: 40rpx;
  padding: 0 20rpx;
  height: 72rpx;
}
.search-icon { font-size: 26rpx; flex-shrink: 0; }
.search-input { flex: 1; font-size: 26rpx; color: $text-primary; }
.btn-search {
  background: linear-gradient(135deg, $primary, $primary-light);
  color: #fff;
  padding: 0 28rpx;
  border-radius: 40rpx;
  font-size: 24rpx;
  display: flex;
  align-items: center;
  height: 72rpx;
}

.user-card {
  background: $card;
  border-radius: 24rpx;
  box-shadow: $shadow-card;
  margin: 0 24rpx 12rpx;
  overflow: hidden;
}
.user-card-body { display: flex; gap: 20rpx; padding: 24rpx; align-items: center; }
.user-avatar-lg { width: 96rpx; height: 96rpx; border-radius: 50%; flex-shrink: 0; background: #ece8e1; }
.user-avatar-placeholder {
  width: 96rpx; height: 96rpx; border-radius: 50%;
  background: linear-gradient(135deg, $primary, $primary-light);
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-size: 40rpx; font-weight: 700; flex-shrink: 0;
}
.user-info { flex: 1; display: flex; flex-direction: column; gap: 8rpx; }
.user-name-row { display: flex; align-items: center; gap: 12rpx; }
.user-name { font-size: 30rpx; font-weight: 700; color: $text-primary; }
.badge-green { font-size: 20rpx; color: #fff; background: #00b43c; padding: 2rpx 12rpx; border-radius: 10rpx; }
.badge-orange { font-size: 20rpx; color: #fff; background: $primary; padding: 2rpx 12rpx; border-radius: 10rpx; }
.user-meta { font-size: 22rpx; color: $text-muted; }

/* ===== 课程管理卡片 ===== */
.course-admin-card {
  background: $card;
  border-radius: 24rpx;
  box-shadow: $shadow-card;
  margin: 0 24rpx 16rpx;
  overflow: hidden;
}
.course-admin-header { display: flex; gap: 20rpx; padding: 24rpx 24rpx 0; }
.course-admin-cover {
  width: 160rpx;
  height: 120rpx;
  border-radius: 16rpx;
  flex-shrink: 0;
  background: #ece8e1;
}
.course-admin-info { flex: 1; display: flex; flex-direction: column; gap: 10rpx; }
.course-admin-title { font-size: 28rpx; font-weight: 600; color: $text-primary; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.course-admin-meta { display: flex; gap: 10rpx; }
.meta-tag { font-size: 20rpx; color: $text-muted; background: $bg; padding: 2rpx 10rpx; border-radius: 6rpx; }
.course-admin-tags { display: flex; gap: 10rpx; flex-wrap: wrap; }
.tag-pill { font-size: 20rpx; padding: 4rpx 12rpx; border-radius: 8rpx; }
.tag-on   { color: #00b43c; background: rgba(0,180,60,0.1); }
.tag-off  { color: $text-muted; background: rgba($text-muted,0.1); }
.tag-show { color: #007aff; background: rgba(0,122,255,0.1); }
.tag-hide { color: $text-muted; background: rgba($text-muted,0.1); }
.course-admin-price {
  display: flex;
  align-items: baseline;
  gap: 4rpx;
  padding: 12rpx 24rpx 0;
}
.price-big { font-size: 36rpx; font-weight: 800; color: $primary; }
.price-unit { font-size: 22rpx; color: $text-muted; }
.course-admin-actions {
  display: flex;
  gap: 12rpx;
  padding: 16rpx 24rpx;
  border-top: 1rpx solid $border;
  justify-content: flex-end;
}

/* 通用按钮 */
.btn-sm {
  padding: 10rpx 28rpx;
  border-radius: 32rpx;
  font-size: 24rpx;
  font-weight: 500;
  transition: opacity 0.12s;
}
.btn-sm:active { opacity: 0.85; }
.btn-outline { background: $bg; color: $text-secondary; border: 1rpx solid $border; }
.btn-filled  { background: linear-gradient(135deg, $primary, $primary-light); color: #fff; }
.btn-primary { background: linear-gradient(135deg, $primary, $primary-light); color: #fff; }
.btn-warning { background: rgba(255,150,0,0.1); color: #ff9600; }
.btn-danger  { background: rgba(255,77,79,0.1); color: #ff4d4f; }

/* 分页 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 24rpx;
  padding: 24rpx;
}
.page-btn {
  font-size: 26rpx;
  color: $primary;
  padding: 8rpx 20rpx;
  border-radius: 32rpx;
  background: $card;
  box-shadow: $shadow-card;
}
.page-btn.disabled { color: $text-muted; }
.page-info { font-size: 24rpx; color: $text-muted; }

/* 操作栏 */
.op-bar {
  display: flex;
  gap: 12rpx;
  padding: 16rpx 24rpx;
  align-items: center;
}
.op-bar .search-input-wrap { flex: 1; }
.btn-add {
  background: linear-gradient(135deg, $primary, $primary-light);
  color: #fff;
  padding: 0 28rpx;
  border-radius: 40rpx;
  font-size: 24rpx;
  font-weight: 600;
  height: 72rpx;
  display: flex;
  align-items: center;
  white-space: nowrap;
}

/* 弹窗 */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}
.modal {
  background: $card;
  border-radius: 24rpx;
  padding: 40rpx;
  width: 600rpx;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 20rpx 60rpx rgba(0,0,0,0.2);
}
.modal-wide { width: 680rpx; }
.modal-header {
  margin-bottom: 28rpx;
}
.modal-title { font-size: 32rpx; font-weight: 800; color: $text-primary; }
.reason-input {
  width: 100%;
  height: 200rpx;
  border: 1rpx solid $border;
  border-radius: 16rpx;
  padding: 16rpx;
  font-size: 28rpx;
  box-sizing: border-box;
  margin-bottom: 24rpx;
  background: $bg;
  color: $text-primary;
  resize: none;
}
.modal-actions { display: flex; gap: 16rpx; }
.btn-cancel {
  flex: 1;
  height: 88rpx;
  background: $bg;
  color: $text-secondary;
  border-radius: 44rpx;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-confirm {
  flex: 1;
  height: 88rpx;
  background: linear-gradient(135deg, $primary, $primary-light);
  color: #fff;
  border-radius: 44rpx;
  font-size: 28rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 20rpx rgba($primary, 0.25);
}
.btn-confirm.loading { opacity: 0.7; }
.btn-confirm-red {
  flex: 1;
  height: 88rpx;
  background: #ff4d4f;
  color: #fff;
  border-radius: 44rpx;
  font-size: 28rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 表单 */
.form-item {
  margin-bottom: 24rpx;
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
}
.form-item--row {
  justify-content: space-between;
  align-items: center;
}
.form-label {
  font-size: 26rpx;
  color: $text-secondary;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
  width: 168rpx;
  min-width: 168rpx;
  box-sizing: border-box;
  padding-top: 4rpx;
}
.form-label .required { color: #ff4d4f; }
.form-field { flex: 1; min-width: 0; }
.form-input {
  width: 100%;
  box-sizing: border-box;
  border: 1rpx solid $border;
  border-radius: 12rpx;
  padding: 16rpx;
  font-size: 28rpx;
  background: $bg;
  color: $text-primary;
  min-height: 72rpx;
  line-height: 1.6;
}
.form-textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1rpx solid $border;
  border-radius: 12rpx;
  padding: 16rpx;
  font-size: 28rpx;
  height: 160rpx;
  background: $bg;
  color: $text-primary;
  resize: none;
}
.picker-value {
  color: $text-muted;
  border: 1rpx solid $border;
  border-radius: 12rpx;
  padding: 16rpx;
  font-size: 28rpx;
  background: $bg;
  min-height: 72rpx;
  line-height: 1.6;
}
.cover-picker {
  width: 200rpx;
  height: 150rpx;
  border: 2rpx dashed $border;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  background: $bg;
}
.cover-thumb { width: 100%; height: 100%; }
.cover-placeholder { font-size: 26rpx; color: $text-muted; text-align: center; }
.cover-tip { font-size: 22rpx; color: $text-muted; padding-top: 8rpx; white-space: nowrap; }

/* 分类管理弹窗 */
.cat-add-row {
  display: flex;
  gap: 16rpx;
  align-items: center;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid $border;
  margin-bottom: 16rpx;
}
.cat-add-row .form-input { flex: 1; }
.cat-list { max-height: 600rpx; overflow-y: auto; }
.cat-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 0;
  border-bottom: 1rpx solid $border;
}
.cat-item:last-child { border-bottom: none; }
.cat-info { flex: 1; display: flex; gap: 12rpx; }
.cat-name-input { flex: 2; }
.cat-sort-input { flex: 1; }
.modal-close {
  width: 48rpx; height: 48rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 36rpx; color: $text-muted; line-height: 1;
  background: none; border: none;
}

/* 全局按钮 & 工具类 */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 72rpx;
  padding: 0 32rpx;
  background: $primary;
  color: #fff;
  font-size: 28rpx;
  border-radius: 36rpx;
  line-height: 1;
}
.mt-32 { margin-top: 32rpx; }
</style>
