<!--
  视频上传组件
  用于管理员在课程管理页面上传视频到七牛云

  使用方式：
  <video-uploader
    v-model="course.video_key"
    :course-id="course.id"
    @change="onVideoChange"
  />
-->
<template>
  <view class="video-uploader">
    <!-- 已上传状态 -->
    <view class="uploaded" v-if="videoKey && !uploading">
      <video class="preview" :src="previewUrl" :poster="poster" controls />
      <view class="uploaded__info">
        <text class="uploaded__name">{{ fileName || '视频文件' }}</text>
        <text class="uploaded__status">已上传</text>
      </view>
      <view class="uploaded__actions">
        <text class="btn-replace" @click="chooseFile">替换视频</text>
        <text class="btn-delete" @click="deleteVideo">删除</text>
      </view>
    </view>

    <!-- 上传中状态 -->
    <view class="uploading" v-if="uploading">
      <view class="progress-circle">
        <view class="progress-circle__inner" :style="{ '--p': progress + '%' }">
          <text class="progress-text">{{ progress }}%</text>
        </view>
      </view>
      <view class="uploading__info">
        <text class="uploading__name">{{ fileName }}</text>
        <text class="uploading__status">{{ uploadStatusText }}</text>
      </view>
    </view>

    <!-- 未上传 / 选择文件 -->
    <view class="select-video" v-if="!videoKey && !uploading" @click="chooseFile">
      <text class="icon">📹</text>
      <text class="label">{{ label || '选择视频' }}</text>
      <text class="tip">支持 mp4/mov，最大 2GB</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { api } from '@/api/index';

const props = defineProps({
  // 已存储的七牛 key（videos/course_1_123456.m3u8）
  modelValue: {
    type: String,
    default: '',
  },
  // 课程 ID（上传时需要）
  courseId: {
    type: [Number, String],
    required: true,
  },
  // 上传按钮文字
  label: {
    type: String,
    default: '',
  },
  // 预览用封面（可选）
  poster: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['update:modelValue', 'change', 'error', 'upload-start', 'upload-end']);

const videoKey = ref(props.modelValue || '');
const uploading = ref(false);
const progress = ref(0);
const uploadStatusText = ref('准备上传...');
const fileName = ref('');

// 当前预览 URL（带签名）
const previewUrl = ref('');

// 监听外部 modelValue 变化
watch(() => props.modelValue, (val) => {
  videoKey.value = val || '';
  if (val) {
    refreshPreviewUrl(val);
  }
});

// 获取带签名的播放地址
async function refreshPreviewUrl(key) {
  try {
    const res = await api.get(`/video/play-url/${encodeURIComponent(key)}`);
    previewUrl.value = res?.data?.url || res?.url || key;
  } catch {
    previewUrl.value = key;
  }
}

if (videoKey.value) {
  refreshPreviewUrl(videoKey.value);
}

// 选择视频文件（从相册选择）
function chooseFile() {
  console.log('[video-uploader] chooseFile called, courseId:', props.courseId);
  uni.chooseMedia({
    count: 1,
    mediaType: ['video'],
    sourceType: ['album'],
    success: (res) => {
      console.log('[video-uploader] chooseMedia success', res);
      const file = res.tempFiles[0];
      if (!file) return;

      // 大小检查 2GB
      if (file.size > 2 * 1024 * 1024 * 1024) {
        uni.showToast({ title: '视频不能超过 2GB', icon: 'none' });
        return;
      }

      fileName.value = file.name || file.tempFilePath?.split('/').pop() || 'video.mp4';
      // chooseMedia 返回的 tempFilePath 在 filePath 字段
      uploadVideo({ ...file, path: file.filePath || file.tempFilePath, name: file.name || 'video.mp4' });
    },
    fail: (err) => {
      console.log('[video-uploader] chooseMedia fail', err);
      if (err.errMsg && !err.errMsg.includes('cancel')) {
        uni.showToast({ title: '选择失败: ' + (err.errMsg || ''), icon: 'none' });
      }
    },
  });
}

// 上传视频到七牛
async function uploadVideo(file) {
  uploading.value = true;
  progress.value = 0;
  uploadStatusText.value = '获取上传凭证...';
  emit('upload-start', file);

  try {
    // 1. 向后端请求上传凭证
    const courseId = Number(props.courseId) || 0;
    console.log('[video-uploader] uploadVideo courseId:', courseId, 'raw props.courseId:', props.courseId, 'file:', file?.name);
    if (!courseId || courseId <= 0) {
      throw Object.assign(new Error('请先保存课程后再上传视频'), { code: 40001 });
    }
    const { token, key } = await api.post('/video/upload-token', {
      course_id: courseId,
      filename: file.name,
    });

    videoKey.value = key;
    uploadStatusText.value = '上传中...';

    // 2. 估算进度（因为七牛直传不走我们这里，所以这里先显示进度条，后端回调更新DB）
    // 实际上传由七牛 SDK 直传，这里用模拟进度
    simulateProgress();

    // 3. 七牛直传（使用 qiniu-js SDK）
    await doQiniuUpload(file, token, key);

    progress.value = 100;
    uploadStatusText.value = '上传完成';

    // 4. 更新父组件
    emit('update:modelValue', key);
    emit('change', { key, file });

    // 5. 刷新预览
    await refreshPreviewUrl(key);

    uni.showToast({ title: '上传成功', icon: 'none' });
  } catch (err) {
    console.error('upload error', err);
    uploadStatusText.value = '上传失败';
    uni.showToast({ title: err.message || '上传失败', icon: 'none' });
    emit('error', err);
  } finally {
    uploading.value = false;
    emit('upload-end');
  }
}

// 七牛直传（前端 SDK）
function doQiniuUpload(file, token, key) {
  return new Promise((resolve, reject) => {
    // 动态加载 qiniu-js SDK
    if (!uni.canIUse('chooseMessageFile')) {
      reject(new Error('当前环境不支持视频选择'));
      return;
    }

    // 使用微信的 chooseMessageFile 已经选好了文件
    // 这里直接用 fetch PUT 到七牛上传地址
    // 七牛上传域名（华北 z1）
    const uploadHost = 'https://up-z1.qiniup.com';

    uni.uploadFile({
      url: uploadHost,
      filePath: file.path || file.url,
      fileType: 'video',
      name: 'file',
      formData: {
        token,
        key,
      },
      success: (res) => {
        const data = JSON.parse(res.data);
        if (data.key) {
          resolve(data);
        } else {
          reject(new Error(data.error || '上传失败'));
        }
      },
      fail: (err) => {
        reject(err);
      },
    });
  });
}

// 模拟上传进度（真实进度由七牛直传回馈，这里只是 UX）
function simulateProgress() {
  const interval = setInterval(() => {
    if (!uploading.value) {
      clearInterval(interval);
      return;
    }
    if (progress.value < 90) {
      progress.value += Math.random() * 15;
    }
  }, 800);
}

// 删除视频
async function deleteVideo() {
  if (!videoKey.value) return;

  uni.showModal({
    title: '确认删除',
    content: '确定要删除该视频吗？',
    success: async (res) => {
      if (!res.confirm) return;
      try {
        await api.delete(`/video/${videoKey.value}`);
        videoKey.value = '';
        previewUrl.value = '';
        fileName.value = '';
        emit('update:modelValue', '');
        emit('change', { key: '', file: null });
        uni.showToast({ title: '已删除', icon: 'none' });
      } catch (err) {
        console.error('delete error', err);
        uni.showToast({ title: '删除失败', icon: 'none' });
      }
    },
  });
}
</script>

<style lang="scss" scoped>
@import '@/common/styles/base.scss';

.video-uploader {
  width: 100%;
}

.select-video {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: $bg-light;
  border: 2rpx dashed $border-color;
  border-radius: $border-radius;
  padding: 60rpx 24rpx;
  cursor: pointer;

  .icon {
    font-size: 80rpx;
    margin-bottom: 16rpx;
  }

  .label {
    font-size: 28rpx;
    color: $primary-color;
    margin-bottom: 8rpx;
  }

  .tip {
    font-size: 22rpx;
    color: $text-gray;
  }
}

.uploading {
  display: flex;
  align-items: center;
  background: $bg-light;
  border-radius: $border-radius;
  padding: 24rpx;

  .progress-circle {
    width: 100rpx;
    height: 100rpx;
    border-radius: 50%;
    border: 6rpx solid $border-color;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 24rpx;
    flex-shrink: 0;

    &__inner {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: conic-gradient($primary-color var(--p), transparent var(--p));
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .progress-text {
      font-size: 20rpx;
      color: $primary-color;
      font-weight: bold;
      background: $bg-white;
      border-radius: 50%;
      width: 72rpx;
      height: 72rpx;
      text-align: center;
      line-height: 72rpx;
    }
  }

  &__info {
    flex: 1;
  }

  &__name {
    display: block;
    font-size: 26rpx;
    color: $text-primary;
    margin-bottom: 8rpx;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__status {
    font-size: 22rpx;
    color: $text-gray;
  }
}

.uploaded {
  .preview {
    width: 100%;
    height: 360rpx;
    border-radius: $border-radius;
    background: #000;
    margin-bottom: 16rpx;
  }

  &__info {
    display: flex;
    justify-content: space-between;
    margin-bottom: 16rpx;
  }

  &__name {
    font-size: 26rpx;
    color: $text-primary;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  &__status {
    font-size: 22rpx;
    color: $primary-color;
    margin-left: 16rpx;
    flex-shrink: 0;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 32rpx;
  }

  .btn-replace {
    font-size: 26rpx;
    color: $primary-color;
  }

  .btn-delete {
    font-size: 26rpx;
    color: $text-gray;
  }
}
</style>
