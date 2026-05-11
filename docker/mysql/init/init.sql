-- ============================================================
-- 视频课程分销系统 - MySQL 初始化脚本
-- 数据库: course_distribute
-- 字符集: utf8mb4
-- ============================================================

CREATE DATABASE IF NOT EXISTS course_distribute
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE course_distribute;

SET FOREIGN_KEY_CHECKS=0;

-- ============================================================
-- 1. users（用户表）
-- ============================================================
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  openid         VARCHAR(64)  NOT NULL UNIQUE COMMENT '微信 openid',
  nickname       VARCHAR(64)   DEFAULT NULL COMMENT '昵称',
  avatar         VARCHAR(255)  DEFAULT NULL COMMENT '头像URL',
  phone          VARCHAR(20)   DEFAULT NULL COMMENT '手机号',
  admin_password VARCHAR(255)   DEFAULT NULL COMMENT '管理员密码（bcrypt，NULL=非管理员）',
  is_admin       TINYINT(1)    DEFAULT 0 COMMENT '是否管理员（冗余字段，可快速判断）',
  status         TINYINT(1)    DEFAULT 1 COMMENT '状态：1正常 0禁用',
  created_at     DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_openid (openid),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- ============================================================
-- 2. courses（课程表）
-- ============================================================
DROP TABLE IF EXISTS courses;
CREATE TABLE courses (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id     BIGINT UNSIGNED DEFAULT NULL COMMENT '分类ID',
  title           VARCHAR(255)   NOT NULL COMMENT '课程标题',
  description     TEXT            DEFAULT NULL COMMENT '课程描述',
  cover_image     VARCHAR(255)    DEFAULT NULL COMMENT '封面图URL',
  video_url       VARCHAR(500)   DEFAULT NULL COMMENT '视频URL（未授权用户不返回）',
  video_key       VARCHAR(255)   DEFAULT NULL COMMENT '七牛云存储key（videos/course_xxx.m3u8）',
  price           DECIMAL(10,2)  DEFAULT 0.00 COMMENT '价格',
  is_free         TINYINT(1)     DEFAULT 0 COMMENT '是否免费',
  is_show         TINYINT(1)    DEFAULT 1 COMMENT '是否上架',
  is_distribution  TINYINT(1)    DEFAULT 0 COMMENT '是否开启分销',
  commission_ratio DECIMAL(5,2)  DEFAULT 0.00 COMMENT '一级佣金比例（%）',
  sort            INT             DEFAULT 0 COMMENT '排序（越大越靠前）',
  created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category_id),
  INDEX idx_is_show (is_show),
  INDEX idx_sort (sort)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='课程表';

-- ============================================================
-- 3. course_categories（课程分类表）
-- ============================================================
DROP TABLE IF EXISTS course_categories;
CREATE TABLE course_categories (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(64)      NOT NULL COMMENT '分类名称',
  parent_id   BIGINT UNSIGNED  DEFAULT NULL COMMENT '父分类ID',
  sort        INT              DEFAULT 0 COMMENT '排序',
  is_show     TINYINT(1)       DEFAULT 1 COMMENT '是否显示',
  created_at  DATETIME         DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='课程分类表';

-- ============================================================
-- 4. agent_levels（分销等级配置表）
-- ============================================================
DROP TABLE IF EXISTS agent_levels;
CREATE TABLE agent_levels (
  id                   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  level                VARCHAR(32)   NOT NULL UNIQUE COMMENT '等级标识 DR/MXJ/CJHH',
  name                 VARCHAR(64)   NOT NULL COMMENT '等级名称',
  rebate_rate          DECIMAL(5,4)  NOT NULL COMMENT '返佣比例（如 0.3000）',
  gift_accounts        INT           DEFAULT 0 COMMENT '拿货名额',
  upgrade_referral_min INT           DEFAULT 0 COMMENT '升级所需推荐下限人数',
  upgrade_gift_min     INT           DEFAULT 0 COMMENT '升级所需拿货下限',
  sort                 INT           DEFAULT 0 COMMENT '排序',
  created_at           DATETIME     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_level (level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分销等级配置表';

-- ============================================================
-- 5. agents（分销商申请表/状态表）
-- ============================================================
DROP TABLE IF EXISTS agents;
CREATE TABLE agents (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id          BIGINT UNSIGNED NOT NULL UNIQUE COMMENT '用户ID',
  level            VARCHAR(32)     NOT NULL COMMENT '分销等级',
  gift_quantity    INT             DEFAULT 0 COMMENT '拿货数量（申请时填）',
  gift_accounts_dr INT             DEFAULT 0 COMMENT '剩余拿货名额（审核通过后初始化）',
  recommender_id   BIGINT UNSIGNED DEFAULT NULL COMMENT '推荐人用户ID',
  referral_count   INT             DEFAULT 0 COMMENT '推荐人数（审核通过后更新）',
  total_purchase   INT             DEFAULT 0 COMMENT '累计拿货数量',
  status           TINYINT(1)      DEFAULT 0 COMMENT '状态：0待审核 1通过 2拒绝',
  confirmed_by     BIGINT UNSIGNED DEFAULT NULL COMMENT '审核管理员ID（confirmed_by）',
  confirm_time     DATETIME        DEFAULT NULL COMMENT '管理员确认时间（confirm_time）',
  reject_reason    VARCHAR(255)    DEFAULT NULL COMMENT '拒绝原因',
  created_at       DATETIME        DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_recommender (recommender_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分销商申请表';

-- ============================================================
-- 5b. agent_upgrades（分销商升级申请表）
-- ============================================================
DROP TABLE IF EXISTS agent_upgrades;
CREATE TABLE agent_upgrades (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  from_level    VARCHAR(32)     NOT NULL COMMENT '原等级',
  to_level      VARCHAR(32)     NOT NULL COMMENT '目标等级',
  status        TINYINT(1)      DEFAULT 0 COMMENT '状态：0待审核 1通过 2拒绝',
  apply_fee     DECIMAL(10,2)   DEFAULT 0.00 COMMENT '本次申请需补缴费用',
  remark        VARCHAR(255)    DEFAULT NULL COMMENT '用户备注',
  confirmed_by  BIGINT UNSIGNED DEFAULT NULL COMMENT '审核管理员ID',
  confirm_time  DATETIME        DEFAULT NULL COMMENT '审核时间',
  reject_reason VARCHAR(255)    DEFAULT NULL COMMENT '拒绝原因',
  created_at    DATETIME        DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分销商升级申请表';

-- ============================================================
-- 6. teams（树形上下级关系表）
-- ============================================================
DROP TABLE IF EXISTS teams;
CREATE TABLE teams (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL UNIQUE COMMENT '用户ID',
  parent_id  BIGINT UNSIGNED DEFAULT NULL COMMENT '直接上级用户ID（NULL=顶级）',
  root_id    BIGINT UNSIGNED NOT NULL COMMENT '顶级分销商用户ID（递归根）',
  created_at DATETIME       DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_parent_id (parent_id),
  INDEX idx_root_id (root_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='树形上下级关系表';

-- ============================================================
-- 7. orders（订单表）
-- ============================================================
DROP TABLE IF EXISTS orders;
CREATE TABLE orders (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id            BIGINT UNSIGNED NOT NULL COMMENT '购买用户ID',
  course_id          BIGINT UNSIGNED NOT NULL COMMENT '课程ID',
  direct_agent_id    BIGINT UNSIGNED DEFAULT NULL COMMENT '下单时的直接推广人user_id（NULL=平台引流无佣金）',
  agent_id           BIGINT UNSIGNED DEFAULT NULL COMMENT '对应分销商agents.id（冗余，下单时快照）',
  promotion_code_id  BIGINT UNSIGNED DEFAULT NULL COMMENT '推广码ID',
  type               VARCHAR(20)     DEFAULT 'course' COMMENT '类型：course/gift',
  status             TINYINT(1)      DEFAULT 0 COMMENT '0待确认 1已确认 2已完成 3已退款 4已取消',
  total_amount       DECIMAL(10,2)  DEFAULT 0.00 COMMENT '订单总额',
  paid_at            DATETIME        DEFAULT NULL COMMENT '支付时间',
  confirm_time       DATETIME        DEFAULT NULL COMMENT '管理员确认时间',
  commission_settled TINYINT(1)      DEFAULT 0 COMMENT '佣金是否已结算（0否 1是）',
  created_at         DATETIME        DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_course_id (course_id),
  INDEX idx_direct_agent_id (direct_agent_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (course_id) REFERENCES courses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';

-- ============================================================
-- 8. commissions（销售佣金表）
-- ============================================================
DROP TABLE IF EXISTS commissions;
CREATE TABLE commissions (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL COMMENT '收款用户ID',
  order_id    BIGINT UNSIGNED NOT NULL COMMENT '订单ID',
  level       TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '分销等级：1=L1达人 2=L2梦想家 3=L3超合伙',
  type        VARCHAR(20)      NOT NULL DEFAULT 'SALES' COMMENT '佣金类型：SALES销售 MANAGEMEN管理奖 REFERRAL推荐奖励',
  amount      DECIMAL(10,2)   NOT NULL COMMENT '佣金金额',
  status      TINYINT(1)      DEFAULT 0 COMMENT '0待入账(冻结) 1已入账(可提现) 2已提现 3已撤销',
  description VARCHAR(255)    DEFAULT '' COMMENT '描述/备注',
  created_at  DATETIME        DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_order_id (order_id),
  INDEX idx_status (status),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售佣金表';

-- ============================================================
-- 9. recommendation_rewards（推荐奖励表）
-- ============================================================
DROP TABLE IF EXISTS recommendation_rewards;
CREATE TABLE recommendation_rewards (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  inviter_id    BIGINT UNSIGNED NOT NULL COMMENT '邀请人用户ID',
  invitee_id    BIGINT UNSIGNED NOT NULL COMMENT '被邀请人用户ID',
  reward_amount DECIMAL(10,2)  NOT NULL COMMENT '奖励金额',
  status        TINYINT(1)    DEFAULT 0 COMMENT '0待入账 1已入账 2已撤销',
  created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_inviter (inviter_id),
  INDEX idx_invitee (invitee_id),
  INDEX idx_status (status),
  FOREIGN KEY (inviter_id) REFERENCES users(id),
  FOREIGN KEY (invitee_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='推荐奖励表';

-- ============================================================
-- 10. purchase_records（拿货记录表）
-- ============================================================
DROP TABLE IF EXISTS purchase_records;
CREATE TABLE purchase_records (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL COMMENT '拿货用户ID',
  course_id  BIGINT UNSIGNED DEFAULT NULL COMMENT '关联课程ID（可为NULL）',
  quantity   INT            NOT NULL DEFAULT 1 COMMENT '拿货数量',
  unit_price DECIMAL(10,2)  DEFAULT 0.00 COMMENT '单价（参考）',
  total_amount DECIMAL(10,2) DEFAULT 0.00 COMMENT '总额',
  status     TINYINT(1)     DEFAULT 0 COMMENT '0待审核 1已确认 2已取消',
  reviewed_by BIGINT UNSIGNED DEFAULT NULL COMMENT '审核管理员ID',
  reviewed_at DATETIME       DEFAULT NULL COMMENT '审核时间',
  created_at  DATETIME       DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='拿货记录表';

-- ============================================================
-- 11. promotion_codes（推广码表）
-- ============================================================
DROP TABLE IF EXISTS promotion_codes;
CREATE TABLE promotion_codes (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL COMMENT '分销商用户ID',
  level      VARCHAR(32)    NOT NULL COMMENT '推广码对应的分销等级',
  code       VARCHAR(32)    NOT NULL UNIQUE COMMENT '推广码（nanoid 12位）',
  url        VARCHAR(255)   NOT NULL COMMENT '完整推广URL',
  visit_count INT UNSIGNED  DEFAULT 0 COMMENT '访问次数',
  order_count INT UNSIGNED  DEFAULT 0 COMMENT '带来的订单数',
  created_at DATETIME       DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_code (code),
  UNIQUE KEY uk_user_id_level (user_id, level),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='推广码表';

-- ============================================================
-- 12. withdraw_records（提现记录表）
-- ============================================================
DROP TABLE IF EXISTS withdraw_records;
CREATE TABLE withdraw_records (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  amount     DECIMAL(10,2) NOT NULL COMMENT '提现金额',
  status     TINYINT(1)   DEFAULT 0 COMMENT '0=待处理 1=已转账(已确认) 2=已拒绝',
  handle_by  BIGINT UNSIGNED DEFAULT NULL COMMENT '处理管理员ID',
  handle_time DATETIME     DEFAULT NULL COMMENT '处理时间',
  remark     VARCHAR(255)  DEFAULT NULL COMMENT '备注',
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='提现记录表';

-- ============================================================
-- 13. notifications（站内通知表）
-- ============================================================
DROP TABLE IF EXISTS notifications;
CREATE TABLE notifications (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL COMMENT '通知用户ID',
  type       VARCHAR(32)    NOT NULL COMMENT '通知类型',
  title      VARCHAR(128)   NOT NULL COMMENT '通知标题',
  content    JSON           DEFAULT NULL COMMENT '内容（JSON结构）',
  is_read    TINYINT(1)     DEFAULT 0 COMMENT '是否已读',
  created_at DATETIME       DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='站内通知表';

-- ============================================================
-- 14. customer_services（客服会话表）
-- ============================================================
DROP TABLE IF EXISTS customer_services;
CREATE TABLE customer_services (
  id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id           BIGINT UNSIGNED NOT NULL COMMENT '发起用户ID',
  type              VARCHAR(32)    NOT NULL COMMENT '会话类型：consultation/complaint/refund/upgrade',
  subject           VARCHAR(255)   DEFAULT NULL COMMENT '主题',
  status            TINYINT(1)    DEFAULT 0 COMMENT '0进行中 1已解决 2已关闭',
  last_message_id   BIGINT UNSIGNED DEFAULT NULL COMMENT '最后一条消息ID',
  last_message_user_id BIGINT UNSIGNED DEFAULT NULL COMMENT '最后消息发送者ID',
  last_message_at   DATETIME       DEFAULT NULL COMMENT '最后消息时间',
  created_at        DATETIME       DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_type (type),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客服会话表';

-- ============================================================
-- 15. customer_messages（客服消息表）
-- ============================================================
DROP TABLE IF EXISTS customer_messages;
CREATE TABLE customer_messages (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversation_id  BIGINT UNSIGNED NOT NULL COMMENT '会话ID',
  sender_id        BIGINT UNSIGNED NOT NULL COMMENT '发送者ID（用户或管理员）',
  content          TEXT          NOT NULL COMMENT '消息内容',
  is_read          TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '是否已读',
  is_from_admin    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '是否管理员发送',
  admin_id         BIGINT UNSIGNED NULL COMMENT '管理员ID（仅管理员发送时填充）',
  created_at       DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_conversation (conversation_id),
  INDEX idx_is_read (is_read),
  FOREIGN KEY (conversation_id) REFERENCES customer_services(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客服消息表';

-- ============================================================
-- 16. configs（全局配置表）
-- ============================================================
DROP TABLE IF EXISTS configs;
CREATE TABLE configs (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `key`       VARCHAR(64)      NOT NULL UNIQUE COMMENT '配置键',
  value       TEXT             DEFAULT NULL COMMENT '配置值（TEXT，后端 Number() 转数字比较）',
  description VARCHAR(255)     DEFAULT NULL COMMENT '说明',
  created_at  DATETIME        DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_key (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='全局配置表';

-- ============================================================
-- 17. admin_roles（管理员角色表）
-- ============================================================
DROP TABLE IF EXISTS admin_roles;
CREATE TABLE admin_roles (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(64)  NOT NULL COMMENT '角色名称',
  permission  JSON         DEFAULT NULL COMMENT '权限列表（JSON数组）',
  description VARCHAR(255) DEFAULT NULL COMMENT '说明',
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员角色表';

-- ============================================================
-- 18. admin_user_roles（管理员-角色关联表）
-- ============================================================
DROP TABLE IF EXISTS admin_user_roles;
CREATE TABLE admin_user_roles (
  id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id  BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  role_id  BIGINT UNSIGNED NOT NULL COMMENT '角色ID',
  created_at DATETIME    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_role (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (role_id) REFERENCES admin_roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员-角色关联表';

-- ============================================================
-- 19. 推荐奖励配置（referral_reward_* keys in configs table）
--    key 格式: referral_reward_{inviter_level}_{invitee_level}
--    例: referral_reward_dr_mxj = 3000（达人推荐梦想家买，奖励3000元）
--    例: referral_reward_mxj_dr = 50（梦想家推荐达人买，奖励50元）
--    注：表 referral_reward_matrix 不再使用（代码已改用 configs 表）
-- ============================================================

-- ============================================================
-- 20. audit_logs（审计日志表）
-- ============================================================
DROP TABLE IF EXISTS audit_logs;
CREATE TABLE audit_logs (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id   BIGINT UNSIGNED NOT NULL COMMENT '操作管理员ID',
  action     VARCHAR(64)     NOT NULL COMMENT '操作类型',
  target_type VARCHAR(64)    DEFAULT NULL COMMENT '目标类型',
  target_id  BIGINT UNSIGNED DEFAULT NULL COMMENT '目标ID',
  before_value JSON          DEFAULT NULL COMMENT '变更前（JSON）',
  after_value  JSON          DEFAULT NULL COMMENT '变更后（JSON）',
  ip          VARCHAR(64)   DEFAULT NULL COMMENT '操作IP',
  created_at  DATETIME       DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_id (admin_id),
  INDEX idx_action (action),
  INDEX idx_target (target_type, target_id),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (admin_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审计日志表';

SET FOREIGN_KEY_CHECKS=1;
