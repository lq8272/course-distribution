-- ============================================================
-- 003_course_videos.sql
-- 课程视频表：支持一个课程关联多个视频
-- 执行方式：Navicat 或 mysql 命令行
--   mysql -h <host> -P <port> -u root -p course_distribute < 003_course_videos.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS course_videos (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  course_id    INT          NOT NULL COMMENT '课程ID',
  title        VARCHAR(200) NOT NULL DEFAULT '' COMMENT '视频标题（管理员填写）',
  description  VARCHAR(500) NOT NULL DEFAULT '' COMMENT '视频描述',
  video_key    VARCHAR(500) NOT NULL DEFAULT '' COMMENT '七牛存储key（原始mp4，上传前写入）',
  video_url    VARCHAR(1000) NOT NULL DEFAULT '' COMMENT '转码后m3u8地址（回调完成后写入）',
  video_status TINYINT NOT NULL DEFAULT 0 COMMENT '0=待上传 1=转码中 2=转码完成可用',
  duration     INT NOT NULL DEFAULT 0 COMMENT '视频时长（秒）',
  sort         INT NOT NULL DEFAULT 0 COMMENT '排序序号（小的在前）',
  is_preview   TINYINT NOT NULL DEFAULT 0 COMMENT '1=试看视频（未付费只能看这个）',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_course_id (course_id),
  INDEX idx_sort (sort)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='课程视频表';
