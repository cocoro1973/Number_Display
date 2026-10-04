//受付およびステータスコントロール画面の描画を行います
const express = require('express');
const router = express.Router();
const pool = require('../db');

// 1 & 4. 受付および状態コントロール画面
router.get('/', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  /// ex.) admin?room=1 診察室を指定することもできる
  const selectedRoom = req.query.room || ''; // クエリパラメータから診察室コードを取得（指定がなければ空文字）

  try {
    const rooms = await pool.query('SELECT * FROM 診察室マスター WHERE 有効フラグ = \'1\' ORDER BY 診察室コード');

    // 診察室コードの絞り込み条件
    let roomFilter = '';
    const params = [today];
    if (selectedRoom) {
      roomFilter = ' AND u.受付診察室コード = $2';
      params.push(selectedRoom);
    }

    // ★ 絞り込み条件と表示順（昇順）ソートを反映
    const uketsuke = await pool.query(`
      SELECT u.*, m.表示順 
      FROM 受付データ u
      LEFT JOIN 待ち行列データ m ON u.受付日 = m.受付日 AND u.受付番号 = m.受付番号
      WHERE u.受付日 = $1 AND u.削除フラグ = '0' ${roomFilter}
      ORDER BY COALESCE(m.表示順, 999999) ASC, u.受付番号 ASC
    `, params);

    // 本日の最大受付番号を取得して +1 する
    const nextNumRes = await pool.query(`
      SELECT COALESCE(MAX(受付番号), 0) + 1 AS next_num 
      FROM 受付データ 
      WHERE 受付日 = $1
    `, [today]);
    const nextUketsukeNumber = nextNumRes.rows[0].next_num;

    res.render('admin', {
      rooms: rooms.rows,
      list: uketsuke.rows,
      nextUketsukeNumber: nextUketsukeNumber,
      selectedRoom: selectedRoom // EJS側でフィルタ保持・選択状態に使用
    });
  } catch (err) {
    res.status(500).send('エラーが発生しました: ' + err.message);
  }
});

module.exports = router;