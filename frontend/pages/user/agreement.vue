<template>
  <view class="page">
    <!-- 导航 -->
    <view class="nav-bar">
      <view class="nav-back" @click="goBack">← 返回</view>
      <text class="nav-title">用户协议</text>
      <view class="nav-placeholder"></view>
    </view>

    <!-- Section Header -->
    <view class="section-header">
      <view class="section-bar"></view>
      <text class="section-label">服务条款</text>
    </view>

    <!-- 协议正文 -->
    <view class="content">
      <view class="last-updated">最后更新日期：2026年1月1日</view>

      <view class="chapter card">
        <view class="chapter-title">一、服务条款的确认和接纳</view>
        <view class="chapter-body">
          欢迎您使用视频课程分销平台（以下简称"本平台"）服务。本协议是您与本平台之间关于使用本平台服务的法律协议，具有合同效力。您在使用本平台提供的各项服务之前，应仔细阅读本协议。如您不同意本协议或本平台随时对其的修改，您可以主动取消本平台提供的服务；当您勾选"我已阅读并同意"并点击注册/登录，即表示您已充分阅读、理解并同意接受本协议的约束，包括本平台对协议随时所做的任何修改。
        </view>
      </view>

      <view class="chapter card">
        <view class="chapter-title">二、服务内容</view>
        <view class="chapter-body">
          本平台的具体服务内容由本平台根据实际情况提供，包括但不限于：在线视频课程观看、课程购买、佣金提现、推广分销、客服咨询等服务。本平台保留随时变更、中断或终止部分或全部服务的权利。
        </view>
      </view>

      <view class="chapter card">
        <view class="chapter-title">三、用户注册</view>
        <view class="chapter-body">
          3.1 您在使用本平台服务前需进行注册。您应按照注册提示填写真实、有效的个人信息，并承诺所提供的信息真实、准确、完整、有效。如信息发生变化，您应及时更新。因您提供的信息不真实、不准确、不完整或未及时更新而产生的任何法律责任，本平台有权依法追究您的责任。<br><br>
          3.2 您须对用户密码妥善保管，不得转让、出借或允许他人使用您的账号。因保管不善导致的账号被盗或财产损失，由您自行承担，本平台不承担任何责任。
        </view>
      </view>

      <view class="chapter card">
        <view class="chapter-title">四、分销商权益与义务</view>
        <view class="chapter-body">
          4.1 成为分销商：用户需通过本平台实名认证，并提交分销商申请，经本平台审核通过后方可获得分销资格。<br><br>
          4.2 佣金规则：分销商通过专属推广链接或推广码发展的用户购买课程后，分销商可获得相应佣金。佣金比例由本平台不时公布或与分销商另行约定。<br><br>
          4.3 佣金提现：分销商可在"我的钱包"页面申请佣金提现，本平台将在1-3个工作日内处理。提现最低额度为人民币100元。<br><br>
          4.4 推广行为规范：分销商推广时应遵守法律法规，不得进行虚假宣传、夸大收益承诺，不得损害本平台品牌形象，不得采用不正当竞争手段。一经发现，本平台有权取消分销商资格并追回违规所得。
        </view>
      </view>

      <view class="chapter card">
        <view class="chapter-title">五、课程购买与退款</view>
        <view class="chapter-body">
          5.1 课程价格以本平台实际展示为准，本平台保留调整课程价格的权利。<br><br>
          5.2 购买课程后，您可在有效期内（具体以课程详情页标注为准）反复观看学习。<br><br>
          5.3 <text class="highlight">虚拟商品一经购买，不支持退款。</text>因技术原因导致无法正常学习的除外，您可联系客服处理。
        </view>
      </view>

      <view class="chapter card">
        <view class="chapter-title">六、知识产权</view>
        <view class="chapter-body">
          本平台上所有内容，包括但不限于文字、图片、音频、视频、软件、程序、页面设计、数据编排等，均为本平台或相关权利人依法拥有，受中华人民共和国著作权法、商标法、专利法等法律的保护。未经本平台或相关权利人书面授权，任何人不得擅自使用、修改、复制、传播、发行或以其他方式从事侵犯本平台或相关权利人合法权益的行为。
        </view>
      </view>

      <view class="chapter card">
        <view class="chapter-title">七、隐私保护</view>
        <view class="chapter-body">
          本平台重视用户个人信息保护，将按照本平台《隐私政策》的规定收集、使用、存储和保护您的个人信息。您在勾选"我已阅读并同意"时，即表示您已充分知悉并同意本平台按照《隐私政策》处理您的个人信息。详细内容请参阅《隐私政策》。
        </view>
      </view>

      <view class="chapter card">
        <view class="chapter-title">八、免责声明</view>
        <view class="chapter-body">
          8.1 本平台会尽力维护服务的稳定性和安全性，但不对因不可抗力、政府行为、黑客攻击、网络病毒等导致的任何服务中断、数据丢失或财产损失承担责任。<br><br>
          8.2 您通过本平台获取的任何信息（包括但不限于课程内容、推广信息），本平台不对其真实性、准确性、完整性做任何明示或暗示的保证，您需自行判断并承担相关风险。<br><br>
          8.3 因您的原因导致本平台或第三方遭受损失的，您应依法承担赔偿责任。
        </view>
      </view>

      <view class="chapter card">
        <view class="chapter-title">九、协议修改</view>
        <view class="chapter-body">
          本平台有权随时修改本协议的任何条款，修改后的协议一经在本平台公布即生效。如果您不同意修改后的协议，有权停止使用本平台服务。如果您继续使用本平台服务，则视为您已接受修改后的协议。
        </view>
      </view>

      <view class="chapter card">
        <view class="chapter-title">十、争议解决</view>
        <view class="chapter-body">
          本协议的解释、执行及争议解决均适用中华人民共和国法律。如您与本平台发生任何争议，双方应首先友好协商解决；协商不成的，任何一方均可向本平台运营主体所在地有管辖权的人民法院提起诉讼。
        </view>
      </view>

      <view class="chapter card">
        <view class="chapter-title">十一、通知送达</view>
        <view class="chapter-body">
          本平台向您发送的通知，可采用在平台上公告、电子邮件、短信或常规信件等方式送达。以在平台公告方式发送的通知，自公告发布之日起视为送达。
        </view>
      </view>

      <view class="chapter card">
        <view class="chapter-title">十二、其他</view>
        <view class="chapter-body">
          本协议未尽事宜，由本平台与您另行协商解决。本协议部分条款无效的，不影响其他条款的效力。如本协议的任何规定被裁定为无效或不可执行，该规定应被撤销，但不影响其余条款的效力。
        </view>
      </view>

      <view class="contact-info">
        如您对本协议有任何疑问，请联系客服咨询。
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

.highlight { color: $primary-color; font-weight: 500; }

.contact-info {
  text-align: center;
  font-size: 26rpx;
  color: $text-gray;
  padding: 24rpx 0;
}
</style>