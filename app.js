//受付登録、状態更新（中待合3枠保護＋4番目割り込みロジック含む）、
//および画面更新用データ取得APIです。
const express = require('express');
const path = require('path');

// ルーターの読み込み
const adminRouter = require('./routes/admin');
const displayRouter = require('./routes/display');
const apiRouter = require('./routes/api');

const app = express();

// ミドルウェア設定
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// テンプレートエンジン設定 (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 静的ファイルの提供 (CSS/JS等が必要な場合)
app.use(express.static(path.join(__dirname, 'public')));

// ルーティングのマウント
app.use('/admin', adminRouter);      // 管理画面 (/admin) admin.js
app.use('/display', displayRouter);  // 表示画面 (/display/general, /display/room) display.js
app.use('/api', apiRouter);          // API (/api/uketsuke, /api/status-change, など) api.js

// ルートパスへのアクセスを管理画面へリダイレクト
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});