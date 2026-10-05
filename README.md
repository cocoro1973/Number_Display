# Number_Display
番号案内システム

管理画面  
http://localhost:3000/admin  
診察室毎管理画面（roomNo）  
http://localhost:3000/admin?room=1  
総合待合表示画面  
http://localhost:3000/display/general  
診察室毎表示画面  
http://localhost:3000/display/room?room=1  

CREATE DATABASE hospital_db;  
-- 1. 診察室マスター
CREATE TABLE 診察室マスター (
    診察室コード INT PRIMARY KEY,
    診察室名 VARCHAR(50) NOT NULL,
    表示順 INT DEFAULT 0,
    有効フラグ CHAR(1) DEFAULT '1',
    登録日時 TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 医師マスター
CREATE TABLE 医師マスター (
    医師コード VARCHAR(10) PRIMARY KEY,
    医師名 VARCHAR(50) NOT NULL,
    診療科 VARCHAR(50),
    有効フラグ CHAR(1) DEFAULT '1',
    登録日時 TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. 診察室毎医師マスター
CREATE TABLE 診察室毎医師マスター (
    診察室コード INT REFERENCES 診察室マスター(診察室コード),
    医師コード VARCHAR(10) REFERENCES 医師マスター(医師コード),
    有効フラグ CHAR(1) DEFAULT '1',
    更新日時 TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (診察室コード, 医師コード)
);

-- 4. 受付データ
CREATE TABLE 受付データ (
    受付日 CHAR(8) NOT NULL,                      -- 例: '20261005'
    受付番号 INT NOT NULL,                         -- 自動採番: 1, 2, 3...
    患者番号 VARCHAR(20) NOT NULL,                -- 患者ID
    受付診察室コード INT REFERENCES 診察室マスター(診察室コード),
    ステータス VARCHAR(20) DEFAULT 'WAITING' NOT NULL, -- WAITING / CALLING / EXAM / HOLD / COMPLETED
    検査戻りフラグ CHAR(1) DEFAULT '0',            -- 1: 検査から戻った患者
    削除フラグ CHAR(1) DEFAULT '0',               -- 0: 有効, 1: キャンセル等
    受付日時 TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    更新日時 TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (受付日, 受付番号)
);

CREATE INDEX idx_uketsuke_search ON 受付データ (受付日, 受付診察室コード, ステータス, 削除フラグ);

-- 5. 待ち行列データ
CREATE TABLE 待ち行列データ (
    受付日 CHAR(8) NOT NULL,
    受付番号 INT NOT NULL,
    患者番号 VARCHAR(20) NOT NULL,
    受付診察室コード INT REFERENCES 診察室マスター(診察室コード),
    表示順 DECIMAL(10, 4) NOT NULL,               -- 割り込み計算用中間値
    削除フラグ CHAR(1) DEFAULT '0',               -- 0: 行列内表示, 1: 除外
    登録日時 TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (受付日, 受付番号),
    FOREIGN KEY (受付日, 受付番号) REFERENCES 受付データ(受付日, 受付番号) ON DELETE CASCADE
);

CREATE INDEX idx_queue_order ON 待ち行列データ (受付日, 受付診察室コード, 削除フラグ, 表示順 ASC);
