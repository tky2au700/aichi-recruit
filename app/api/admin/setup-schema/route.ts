import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

// データセット管理テーブル（公表日・ソース・URLなどのメタ情報）
const CREATE_DATASETS = `
CREATE TABLE IF NOT EXISTS datasets (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(255) NOT NULL COMMENT 'データベース名（例：令和7年賃金構造基本統計調査 職種別）',
  category     VARCHAR(100) NOT NULL COMMENT 'カテゴリ（例：occupation / industry / prefecture）',
  survey_year  INT          NOT NULL COMMENT '調査年（例：2025）',
  published_at DATE         COMMENT '公表日',
  source_name  VARCHAR(255) COMMENT 'データソース名（例：厚生労働省）',
  source_url   TEXT         COMMENT '元ファイルURL',
  record_count INT DEFAULT 0 COMMENT '取込レコード数',
  imported_at  DATETIME     COMMENT '最終取込日時',
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='統計データセット管理'
`

// 職種別賃金データ本体テーブル
const CREATE_OCCUPATION_WAGES = `
CREATE TABLE IF NOT EXISTS occupation_wages (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  dataset_id           INT          NOT NULL COMMENT 'datasetsテーブルの外部キー',
  occupation_name      VARCHAR(255) NOT NULL COMMENT '職種名',
  sex                  ENUM('計','男','女') NOT NULL DEFAULT '計' COMMENT '性別',
  enterprise_size      ENUM('企業規模計','1000人以上','100～999人','10～99人') NOT NULL DEFAULT '企業規模計' COMMENT '企業規模',
  age                  DECIMAL(5,1) COMMENT '年齢（歳）',
  tenure_years         DECIMAL(5,1) COMMENT '勤続年数（年）',
  scheduled_hours      DECIMAL(6,1) COMMENT '所定内実労働時間数（時間）',
  overtime_hours       DECIMAL(6,1) COMMENT '超過実労働時間数（時間）',
  monthly_wage         DECIMAL(10,1) COMMENT 'きまって支給する現金給与額（千円）',
  scheduled_wage       DECIMAL(10,1) COMMENT '所定内給与額（千円）',
  annual_bonus         DECIMAL(10,1) COMMENT '年間賞与その他特別給与額（千円）',
  workers              INT          COMMENT '労働者数（十人）',
  annual_income        DECIMAL(10,1) COMMENT '推計年収（千円）= monthly_wage*12 + annual_bonus',
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dataset (dataset_id),
  INDEX idx_occupation (occupation_name),
  INDEX idx_sex (sex),
  INDEX idx_enterprise_size (enterprise_size),
  FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='職種別賃金データ'
`

export async function POST() {
  try {
    await query(CREATE_DATASETS)
    await query(CREATE_OCCUPATION_WAGES)

    // テーブル一覧確認
    const tables = await query<{ table_name: string }>(
      "SELECT TABLE_NAME as table_name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('datasets','occupation_wages')"
    )

    return NextResponse.json({
      success: true,
      message: 'テーブル作成完了',
      tables: tables.map((t) => t.table_name),
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'テーブル作成失敗', error: error.message },
      { status: 500 }
    )
  }
}
