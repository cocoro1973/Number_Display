const express = require('express');
const router = express.Router();
const pool = require('../db');

// 機能1: 新規受付処理 (行列の末尾に追加)
router.post('/uketsuke', async (req, res) => {
  const { uketsukeNumber, patientId, roomCode } = req.body;
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 受付データ作成
    await client.query(`
      INSERT INTO 受付データ (受付日, 受付番号, 患者番号, 受付診察室コード, ステータス)
      VALUES ($1, $2, $3, $4, 'WAITING')
    `, [today, uketsukeNumber, patientId, roomCode]);

    // 最大表示順の取得
    const maxOrderRes = await client.query(`
      SELECT COALESCE(MAX(表示順), 0) as max_order 
      FROM 待ち行列データ WHERE 受付日 = $1 AND 受付診察室コード = $2 AND 削除フラグ = '0'
    `, [today, roomCode]);
    const newOrder = parseFloat(maxOrderRes.rows[0].max_order) + 1.0;

    // 待ち行列データ挿入
    await client.query(`
      INSERT INTO 待ち行列データ (受付日, 受付番号, 患者番号, 受付診察室コード, 表示順)
      VALUES ($1, $2, $3, $4, $5)
    `, [today, uketsukeNumber, patientId, roomCode, newOrder]);

    await client.query('COMMIT');
    
    // ★ ここを修正: JSONを返すのではなく管理画面へリダイレクト
    res.redirect('/admin');

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 機能4: ステータス変更コントロール (割り込みロジック含む)
router.post('/status-change', async (req, res) => {
  const { uketsukeNumber, newStatus } = req.body;
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 現在の受付情報取得
    const uRes = await client.query(`
      SELECT * FROM 受付データ WHERE 受付日 = $1 AND 受付番号 = $2
    `, [today, uketsukeNumber]);
    if (uRes.rows.length === 0) throw new Error('データが見つかりません');
    const uData = uRes.rows[0];
    const roomCode = uData.受付診察室コード;

    // ステータス更新
    await client.query(`
      UPDATE 受付データ SET ステータス = $1 WHERE 受付日 = $2 AND 受付番号 = $3
    `, [newStatus, today, uketsukeNumber]);

    if (['CALLING', 'EXAM', 'HOLD', 'COMPLETED'].includes(newStatus)) {
      // 待ち行列から一旦除外 (削除フラグ '1')
      await client.query(`
        UPDATE 待ち行列データ SET 削除フラグ = '1' WHERE 受付日 = $1 AND 受付番号 = $2
      `, [today, uketsukeNumber]);
    } else if (newStatus === 'WAITING') {
      // 【検査・保留から復帰】中待合3枠を保護し、4番目に割り込ませるロジック
      const qRes = await client.query(`
        SELECT 表示順 FROM 待ち行列データ 
        WHERE 受付日 = $1 AND 受付診察室コード = $2 AND 削除フラグ = '0'
        ORDER BY 表示順 ASC
      `, [today, roomCode]);

      const queue = qRes.rows;
      let newOrder = 1.0;

      if (queue.length === 0) {
        newOrder = 1.0;
      } else if (queue.length < 4) {
        // 待機者が3人以下の場合は末尾に追加
        newOrder = parseFloat(queue[queue.length - 1].表示順) + 1.0;
      } else {
        // 3番目と4番目の表示順の中間値を計算（4番目へ割り込み）
        const order3 = parseFloat(queue[2].表示順);
        const order4 = parseFloat(queue[3].表示順);
        newOrder = (order3 + order4) / 2.0;
      }

      // 待ち行列へ再追加 (または削除フラグ解除)
      await client.query(`
        INSERT INTO 待ち行列データ (受付日, 受付番号, 患者番号, 受付診察室コード, 表示順, 削除フラグ)
        VALUES ($1, $2, $3, $4, $5, '0')
        ON CONFLICT (受付日, 受付番号) DO UPDATE 
        SET 表示順 = EXCLUDED.表示順, 削除フラグ = '0'
      `, [today, uketsukeNumber, uData.患者番号, roomCode, newOrder]);
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 画面表示用データ取得API（総合・個別待合共通）
router.get('/display-data', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const targetRoom = req.query.room;

  let roomFilter = '';
  const params = [today];
  if (targetRoom) {
    roomFilter = 'AND rm.診察室コード = $2';
    params.push(targetRoom);
  }

  const query = `
    SELECT 
      rm.診察室コード,
      rm.診察室名,
      COALESCE(doc.医師名, '') AS 担当医師名,
      (
        SELECT LPAD(受付番号::text, 3, '0')
        FROM 受付データ 
        WHERE 受付日 = $1 AND 受付診察室コード = rm.診察室コード AND ステータス = 'CALLING' AND 削除フラグ = '0'
        LIMIT 1
      ) AS 呼出番号,
      ARRAY(
        SELECT LPAD(m.受付番号::text, 3, '0')
        FROM 待ち行列データ m
        JOIN 受付データ u ON m.受付日 = u.受付日 AND m.受付番号 = u.受付番号
        WHERE m.受付日 = $1 AND m.受付診察室コード = rm.診察室コード 
          AND m.削除フラグ = '0' AND u.ステータス = 'WAITING'
        ORDER BY m.表示順 ASC
        LIMIT 8
      ) AS 待ちリスト
    FROM 診察室マスター rm
    LEFT JOIN 診察室毎医師マスター r_doc ON rm.診察室コード = r_doc.診察室コード AND r_doc.有効フラグ = '1'
    LEFT JOIN 医師マスター doc ON r_doc.医師コード = doc.医師コード AND doc.有効フラグ = '1'
    WHERE rm.有効フラグ = '1' ${roomFilter}
    ORDER BY rm.診察室コード ASC
  `;

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;