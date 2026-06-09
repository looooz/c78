const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'farm.db');

let db = null;
let inTransaction = false;

const save = () => {
  if (inTransaction) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
};

const query = (sql, params = []) => {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
};

const exec = (sql) => {
  db.run(sql);
};

const run = (sql, params = []) => {
  const stmt = db.prepare(sql);
  stmt.run(params);
  stmt.free();
  if (!inTransaction) save();
  return {
    lastInsertRowid: db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0],
    changes: db.getRowsModified(),
  };
};

const get = (sql, params = []) => query(sql, params)[0] || null;
const all = (sql, params = []) => query(sql, params);
const transaction = (fn) => {
  inTransaction = true;
  exec('BEGIN TRANSACTION');
  try {
    const result = fn();
    exec('COMMIT');
    inTransaction = false;
    save();
    return result;
  } catch (e) {
    exec('ROLLBACK');
    inTransaction = false;
    throw e;
  }
};

const init = async () => {
  console.log('📦 初始化数据库 (sql.js WASM)...');
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    console.log('📂 从现有文件加载数据库');
  } else {
    db = new SQL.Database();
    console.log('🆕 创建新数据库');
  }

  exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      coins INTEGER NOT NULL DEFAULT 500,
      level INTEGER NOT NULL DEFAULT 1,
      exp INTEGER NOT NULL DEFAULT 0,
      water INTEGER NOT NULL DEFAULT 10,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS crops (
      id INTEGER PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      seed_price INTEGER NOT NULL,
      sell_price INTEGER NOT NULL,
      grow_time INTEGER NOT NULL,
      exp_reward INTEGER NOT NULL,
      emoji TEXT NOT NULL,
      description TEXT
    );
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS plots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      plot_index INTEGER NOT NULL,
      crop_id INTEGER,
      planted_at DATETIME,
      watered INTEGER NOT NULL DEFAULT 0,
      water_count INTEGER NOT NULL DEFAULT 0,
      is_harvested INTEGER NOT NULL DEFAULT 0
    );
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      item_type TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0
    );
  `);
  save();

  const cropCount = get('SELECT COUNT(*) as count FROM crops').count;
  if (cropCount === 0) {
    console.log('🌱 插入初始作物数据...');
    const crops = [
      [1, '小麦', 20, 40, 30, 10, '🌾', '生长迅速的基础作物'],
      [2, '玉米', 50, 120, 60, 30, '🌽', '产量高的经济作物'],
      [3, '番茄', 80, 200, 90, 60, '🍅', '多汁美味的蔬果'],
      [4, '南瓜', 150, 400, 150, 120, '🎃', '高价值的稀有作物'],
    ];
    transaction(() => {
      for (const c of crops) {
        run(
          'INSERT INTO crops (id, name, seed_price, sell_price, grow_time, exp_reward, emoji, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          c
        );
      }
    });
  }

  const userCount = get('SELECT COUNT(*) as count FROM users').count;
  if (userCount === 0) {
    console.log('👤 创建默认玩家...');
    run(
      'INSERT INTO users (id, username, coins, level, exp, water) VALUES (?, ?, ?, ?, ?, ?)',
      [1, '农夫小明', 500, 1, 0, 10]
    );
    const userId = 1;

    transaction(() => {
      for (let i = 0; i < 6; i++) {
        run(
          'INSERT INTO plots (user_id, plot_index, watered) VALUES (?, ?, 0)',
          [userId, i]
        );
      }
      run(
        'INSERT INTO inventory (user_id, item_type, item_id, quantity) VALUES (?, ?, ?, ?)',
        [userId, 'seed', 1, 3]
      );
      run(
        'INSERT INTO inventory (user_id, item_type, item_id, quantity) VALUES (?, ?, ?, ?)',
        [userId, 'seed', 2, 2]
      );
    });
  }

  save();
  console.log('✅ 数据库初始化完成');
};

module.exports = { init, get, all, run, transaction };
