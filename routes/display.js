//総合待合室および各診察室前の表示画面の描画を行います。
const express = require('express');
const router = express.Router();

// 2. 総合待合画面（全診察室一覧）
router.get('/general', (req, res) => {
  res.render('general');
});

// 3. 診察室別表示画面 (例: /display/room?room=1)
router.get('/room', (req, res) => {
  const roomCode = req.query.room || 1;
  res.render('room', { roomCode });
});

module.exports = router;