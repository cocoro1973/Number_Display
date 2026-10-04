//各ルーターから共通で利用できるように 
//PostgreSQL の Connection Pool をエクスポートします。
const { Pool } = require('pg');
const dbConfig = require('./config/dbConfig.json');

const pool = new Pool(dbConfig);

module.exports = pool;