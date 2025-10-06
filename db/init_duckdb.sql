-- ============================================
-- AWS Rift Rewind Hackathon
-- DuckDB 初始化脚本 for DataGrid Console
-- ============================================

-- 1️⃣ 创建基本 schema 层次
CREATE SCHEMA IF NOT EXISTS bronze;
CREATE SCHEMA IF NOT EXISTS silver;
CREATE SCHEMA IF NOT EXISTS gold;
CREATE SCHEMA IF NOT EXISTS insights;

-- 2️⃣ 连接 identifier.db (召唤师映射库)
-- 注意路径需与 duck.db 同级，如不在同级，请修改路径
ATTACH 'identifier.db' AS iddb;

-- 3️⃣ 从 JSON 文件导入原始数据
-- 假设目录结构为：
-- D:/AWS Rift/AWS-Rift-Rewind-Hackathon/data_grid/data/bronze/matches/
-- D:/AWS Rift/AWS-Rift-Rewind-Hackathon/data_grid/data/bronze/timelines/

CREATE OR REPLACE TABLE bronze.matches AS
SELECT * FROM read_json_auto('data/bronze/matches/*.json');

CREATE OR REPLACE TABLE bronze.timelines AS
SELECT * FROM read_json_auto('data/bronze/timelines/*.json');

-- 4️⃣ 快速验证数据是否加载成功
SELECT
    COUNT(*) AS match_count,
    MIN(info.gameCreation) AS earliest_game,
    MAX(info.gameCreation) AS latest_game
FROM bronze.matches;

SELECT
    COUNT(*) AS timeline_count
FROM bronze.timelines;

-- 5️⃣ 输出确认
SELECT '✅ DuckDB 初始化完成！已成功加载 JSON 数据。' AS status;
