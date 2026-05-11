<template>
  <view class="page">
    <!-- 导航 -->
    <view class="nav-bar">
      <view class="nav-back" @click="goBack">← 返回</view>
      <text class="nav-title">隐私政策</text>
      <view class="nav-placeholder"></view>
    </view>

    <!-- Section Header -->
    <view class="section-header">
      <view class="section-bar"></view>
      <text class="section-label">隐私保护</text>
    </view>

    <!-- 政策正文 -->
    <view class="content">
      <view class="last-updated">最后更新日期：2026年1月1日</view>

      <view class="chapter card">
        <view class="chapter-title">引言</view>
        <view class="chapter-body">
          视频课程分销平台（以下简称"我们"）非常重视用户的个人信息和隐私保护。本隐私政策旨在向您说明我们在您使用本平台服务时如何收集、使用、存储和保护您的个人信息，以及您享有的相关权利。请您在使用本平台服务前，仔细阅读并了解本隐私政策。如您不同意本隐私政策的任何内容，您应立即停止使用本平台服务。当您勾选"我已阅读并同意"并点击注册/登录，即表示您同意我们按照本隐私政策处理您的个人信息。
        </view>
      </view>

      <view class="chapter card">
        <view class="chapter-title">一、信息收集</view>
        <view class="chapter-body">
          <text class="sub-title">1.1 您主动提供的信息：</text>包括但不限于您在注册账户时填写的姓名、手机号码、身份证信息、头像、昵称等；您在申请成为分销商时提交的资质证明材料；您在购买课程或申请提现时提供的支付账户信息等。<br><br>
          <text class="sub-title">1.2 您在使用服务过程中自动收集的信息：</text>包括您的设备信息（设备型号、操作系统、设备标识符等）、日志信息（访问时间、浏览记录、点击行为等）、位置信息（您开启定位功能时）、通讯录信息（您主动选择同步时）以及Cookies和同类技术收集的信息。<br><br>
          <text class="sub-title">1.3 第三方共享的信息：</text>在法律允许的范围内，我们可能从第三方合作伙伴（包括微信、支付机构等）获取与您相关的共享信息。
        </view>
      </view>

      <view class="chapter card">
        <view class="chapter-title">二、信息使用</view>
        <view class="chapter-body">
          我们收集您的个人信息的目的在于向您提供安全、高效、优质的服务体验，具体用途包括：<br><br>
          (1) 提供本平台各项核心功能和服务，包括用户注册、身份验证、课程购买、订单管理、佣金结算与提现等；<br><br>
          (2) 进行用户画像分析，向您推荐您可能感兴趣的课程或分销活动；<br><br>
          (3) 用于客户服务，解决您在使用过程中遇到的问题，响应您的意见反馈和投诉；<br><br>
          (4) 用于安全风控，包括身份验证、安全监测、安全预警等，以保护您和本平台的合法权益；<br><br>
          (5) 发送与服务相关的通知，包括系统维护公告、账户安全提醒、业务规则变更等；<br><br>
          (6) 在法律法规允许的范围内，进行数据统计与分析，改进我们的产品和服务；<br><br>
          (7) 其他与提供服务相关的合理用途。<br><br>
          我们不会将您的个人信息用于与上述目的无关的其他用途。
        </view>
      </view>

      <view class="chapter card">
        <view class="chapter-title">三、信息共享</view>
        <view class="chapter-body">
          3.1 <text class="sub-title">共享</text>：除以下情况外，我们不会与本平台以外的任何第三方共享您的个人信息：<br>
          (a) 获得您的明确同意后；<br>
          (b) 为实现本隐私政策第二条所述的用途，与我们的关联公司（指现在或将来与本平台存在控制关系或重大影响关系的公司）共享，但仅限必要范围；<br>
          (c) 为履行法定义务或配合有权机关的执法、监管要求，必须提供时；<br>
          (d) 与我们的合作伙伴（如支付机构、物流服务商）共享，但仅限为您提供服务所必要的范围，且我们要求合作方按照不低于本隐私政策的标准保护您的个人信息。<br><br>
          3.2 <text class="sub-title">转让</text>：我们不会将您的个人信息转让给任何第三方。如因合并、收购、破产清算等原因需要转移您的个人信息的，我们会要求新的控制者继续受本隐私政策的约束，否则我们将要求新的控制者重新取得您的授权同意。<br><br>
          3.3 <text class="sub-title">公开披露</text>：除法律法规或监管要求另有规定外，我们不会公开披露您的个人信息。如确需公开披露，我们会提前告知您并取得您的单独同意。
        </view>
      </view>

      <view class="chapter card">
        <view class="chapter-title">四、信息存储</view>
        <view class="chapter-body">
          4.1 <text class="sub-title">存储地点</text>：您的个人信息将存储在中华人民共和国境内。如因业务需要确需向境外传输的，我们会按照法律法规的要求进行安全评估，并采取必要的安全保护措施。<br><br>
          4.2 <text class="sub-title">存储期限</text>：我们仅在为您提供服务所必需的期间内保留您的个人信息。当您注销账户后，我们将在合理期限内删除或匿名化处理您的个人信息，法律法规另有规定的除外。<br><br>
          4.3 <text class="sub-title">安全保护</text>：我们已采用符合行业标准的安全防护措施，包括加密存储、访问控制、安全审计等措施，保护您的个人信息安全，防止数据遭到未经授权的访问、泄露、篡改、损毁或丢失。
        </view>
      </view>

      <view class="chapter card">
        <view class="chapter-title">五、信息安全</view>
        <view class="chapter-body">
          5.1 我们非常重视信息安全，成立了专门的安全团队，采取了行业领先的技术措施和管理措施来保护您的个人信息安全，包括但不限于：数据加密传输（HTTPS）、数据加密存储（AES256）、严格的访问控制、多因素身份验证、安全审计、员工安全意识培训等。<br><br>
          5.2 请您理解，由于技术的限制以及可能存在的各种恶意手段，任何安全措施都无法做到100%安全。尽管如此，我们将尽全力保护您的个人信息安全。如果您发现您的个人信息已被泄露或存在安全隐患，请立即联系我们，以便我们采取相应措施。
        </view>
      </view>

      <view class="chapter card">
        <view class="chapter-title">六、您的权利</view>
        <view class="chapter-body">
          依据中国相关法律法规，您对您的个人信息享有以下权利：<br><br>
          <text class="sub-title">6.1 访问您的个人信息</text>：您有权访问您的账户信息、订单记录、佣金记录等。您可以通过登录本平台客户端，在"我的"页面中查看您的个人信息。<br><br>
          <text class="sub-title">6.2 更正您的个人信息</text>：当您发现我们处理的关于您的个人信息存在错误时，您有权要求我们作出更正。<br><br>
          <text class="sub-title">6.3 删除您的个人信息</text>：在以下情形下，您有权要求我们删除您的个人信息：①处理目的已实现、无法实现或不再需要；②我们停止提供服务，或保存期限已届满；③您撤回同意；④我们违反法律、法规的规定或与您的约定收集、使用、存储您的个人信息；⑤法律、法规规定的其他情形。<br><br>
          <text class="sub-title">6.4 撤回同意</text>：您可以通过修改账户设置等方式撤回部分授权。请注意，某些功能（如核心购课功能）可能需要基于必要的个人信息才能提供，如您撤回同意，可能影响我们继续为您提供该部分服务。<br><br>
          <text class="sub-title">6.5 注销账户</text>：您有权申请注销您的账户。账户注销后，我们将按照法律法规的要求删除或匿名化处理您的个人信息，但法律法规要求我们保留的数据除外。<br><br>
          如您希望行使上述任何权利，请通过本平台客服渠道联系我们，我们将在15个工作日内予以回复。
        </view>
      </view>

      <view class="chapter card">
        <view class="chapter-title">七、未成年人信息保护</view>
        <view class="chapter-body">
          我们非常重视对未成年人个人信息的保护。若您是未满18周岁的未成年人，请在您的监护人的陪同和指导下阅读本隐私政策，并在取得监护人的同意后，方可使用本平台服务。我们只会在法律允许、监护人明确同意或保护未成年人所必要的范围内处理未成年人的个人信息。
        </view>
      </view>

      <view class="chapter card">
        <view class="chapter-title">八、隐私政策更新</view>
        <view class="chapter-body">
          我们可能会不时更新本隐私政策。未经您明确同意，我们不会削减您按照本隐私政策所享有的权利。更新后的隐私政策自公布之日起生效，并取代此前版本。请您定期查阅本页面，以获取最新版本。如更新涉及个人信息的处理目的、处理方式、个人信息种类、个人信息保护措施等内容重大变更的，我们将在变更生效前通过在平台公告、弹窗提示或向您发送电子邮件等方式通知您。
        </view>
      </view>

      <view class="chapter card">
        <view class="chapter-title">九、联系我们</view>
        <view class="chapter-body">
          如您对本隐私政策有任何疑问、意见或建议，请通过以下方式与我们联系：<br><br>
          客服热线：400-XXX-XXXX<br>
          客服时间：工作日 9:00-18:00<br>
          在线客服：通过本平台"客服中心"在线沟通<br><br>
          我们将尽快在合理期限内予以回复。如您对我们的回复不满意，特别是认为我们的个人信息处理行为损害了您的合法权益，您可以依法向有管辖权的人民法院提起诉讼。
        </view>
      </view>

      <view class="contact-info">
        感谢您阅读本隐私政策，我们将持续保护您的个人信息安全。
      </view>
    </view>
  </view>
</template>

<script setup>
function goBack() { uni.navigateBack(); }
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
  padding: 32rpx 24rpx 16rpx;
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

.content {
  padding: 0 24rpx 32rpx;
  font-size: 28rpx;
  line-height: 1.9;
  color: $text-secondary;
}

.last-updated {
  font-size: 24rpx;
  color: $text-gray;
  margin-bottom: 24rpx;
  text-align: right;
}

.card {
  background: $bg-white;
  border-radius: 24rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 16rpx rgba(0,0,0,0.06), 0 8rpx 32rpx rgba(0,0,0,0.04);
}

.chapter-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: 16rpx;
}

.chapter-body {
  font-size: 26rpx;
  color: $text-secondary;
  line-height: 1.9;
  text-align: justify;
}

.sub-title { color: $primary-color; font-weight: 500; }

.contact-info {
  text-align: center;
  font-size: 26rpx;
  color: $text-gray;
  padding: 24rpx 0;
}
</style>