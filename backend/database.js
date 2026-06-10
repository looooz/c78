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
      created_at INTEGER NOT NULL,
      last_water_update INTEGER NOT NULL
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
      stage1 TEXT NOT NULL DEFAULT '🌱',
      stage2 TEXT NOT NULL DEFAULT '🌿',
      stage3 TEXT NOT NULL DEFAULT '🪴',
      description TEXT
    );
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS plots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      plot_index INTEGER NOT NULL,
      crop_id INTEGER,
      planted_at INTEGER,
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

  exec(`
    CREATE TABLE IF NOT EXISTS animals (
      id INTEGER PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      buy_price INTEGER NOT NULL,
      feed_cost INTEGER NOT NULL,
      feed_interval INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_interval INTEGER NOT NULL,
      product_amount INTEGER NOT NULL DEFAULT 1,
      emoji TEXT NOT NULL,
      baby_emoji TEXT NOT NULL,
      exp_reward INTEGER NOT NULL,
      description TEXT
    );
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS animal_products (
      id INTEGER PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      sell_price INTEGER NOT NULL,
      emoji TEXT NOT NULL,
      description TEXT
    );
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS animal_pens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 2,
      level INTEGER NOT NULL DEFAULT 1
    );
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS user_animals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      animal_id INTEGER NOT NULL,
      pen_slot INTEGER NOT NULL,
      bought_at INTEGER NOT NULL,
      last_fed_at INTEGER,
      last_product_at INTEGER,
      hunger INTEGER NOT NULL DEFAULT 0,
      is_sick INTEGER NOT NULL DEFAULT 0
    );
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS feeds (
      id INTEGER PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      price INTEGER NOT NULL,
      emoji TEXT NOT NULL,
      feed_value INTEGER NOT NULL DEFAULT 1,
      description TEXT
    );
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      output_product_id INTEGER NOT NULL,
      output_amount INTEGER NOT NULL DEFAULT 1,
      process_time INTEGER NOT NULL,
      emoji TEXT NOT NULL,
      description TEXT
    );
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL,
      ingredient_type TEXT NOT NULL,
      ingredient_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1
    );
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS processed_products (
      id INTEGER PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      sell_price INTEGER NOT NULL,
      emoji TEXT NOT NULL,
      description TEXT
    );
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS processing_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      recipe_id INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      finish_at INTEGER NOT NULL,
      is_completed INTEGER NOT NULL DEFAULT 0,
      is_collected INTEGER NOT NULL DEFAULT 0
    );
  `);

  save();

  const cropCount = get('SELECT COUNT(*) as count FROM crops').count;
  if (cropCount === 0) {
    console.log('🌱 插入初始作物数据...');
    const crops = [
      [1, '小麦', 20, 40, 45, 10, '🌾', '🌱', '🌿', '🪴', '生长迅速的基础作物，可制作面包'],
      [2, '玉米', 50, 120, 75, 30, '🌽', '🌱', '🌾', '🌿', '产量高的经济作物，可用作饲料'],
      [3, '番茄', 80, 200, 120, 60, '🍅', '🌱', '🌿', '🪴', '多汁美味的蔬果，制作蛋糕必备'],
      [4, '南瓜', 150, 400, 180, 120, '🎃', '🌱', '🌿', '🍈', '高价值的稀有作物'],
    ];
    transaction(() => {
      for (const c of crops) {
        run(
          'INSERT INTO crops (id, name, seed_price, sell_price, grow_time, exp_reward, emoji, stage1, stage2, stage3, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          c
        );
      }
    });
  }

  const animalProductCount = get('SELECT COUNT(*) as count FROM animal_products').count;
  if (animalProductCount === 0) {
    console.log('🥚 插入动物产品数据...');
    const products = [
      [1, '鸡蛋', 30, '🥚', '新鲜鸡蛋，早餐必备'],
      [2, '牛奶', 60, '🥛', '香浓牛奶，制作奶酪原料'],
      [3, '羊毛', 80, '🧶', '柔软羊毛，高级纺织原料'],
      [4, '松露', 300, '🍄', '珍贵松露，顶级食材'],
    ];
    transaction(() => {
      for (const p of products) {
        run(
          'INSERT INTO animal_products (id, name, sell_price, emoji, description) VALUES (?, ?, ?, ?, ?)',
          p
        );
      }
    });
  }

  const animalCount = get('SELECT COUNT(*) as count FROM animals').count;
  if (animalCount === 0) {
    console.log('🐔 插入动物数据...');
    const animals = [
      [1, '鸡', 100, 1, 60, 1, 90, 2, 20, '🐔', '🐣', '高产蛋禽，每天产出鸡蛋'],
      [2, '牛', 500, 3, 120, 2, 180, 1, 80, '🐮', '🐄', '优质奶牛，产出香浓牛奶'],
      [3, '羊', 350, 2, 90, 3, 240, 1, 50, '🐑', '🐏', '绵羊，定期产出珍贵羊毛'],
      [4, '猪', 800, 5, 180, 4, 360, 1, 150, '🐷', '🐽', '散养黑猪，偶尔能发现松露'],
    ];
    transaction(() => {
      for (const a of animals) {
        run(
          'INSERT INTO animals (id, name, buy_price, feed_cost, feed_interval, product_id, product_interval, product_amount, exp_reward, emoji, baby_emoji, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          a
        );
      }
    });
  }

  const feedCount = get('SELECT COUNT(*) as count FROM feeds').count;
  if (feedCount === 0) {
    console.log('🌾 插入饲料数据...');
    const feeds = [
      [1, '基础饲料', 10, '🌾', 1, '用小麦制作的基础饲料'],
      [2, '优质饲料', 25, '🌽', 2, '玉米制成，营养更丰富'],
      [3, '高级饲料', 60, '🥕', 3, '添加胡萝卜的高级饲料'],
    ];
    transaction(() => {
      for (const f of feeds) {
        run(
          'INSERT INTO feeds (id, name, price, emoji, feed_value, description) VALUES (?, ?, ?, ?, ?, ?)',
          f
        );
      }
    });
  }

  const processedCount = get('SELECT COUNT(*) as count FROM processed_products').count;
  if (processedCount === 0) {
    console.log('🍞 插入加工产品数据...');
    const products = [
      [1, '面包', 120, '🍞', '新鲜出炉的美味面包'],
      [2, '奶酪', 250, '🧀', '醇香浓郁的手工奶酪'],
      [3, '蛋糕', 500, '🍰', '精致可口的水果蛋糕'],
      [4, '松露炒蛋', 800, '🍳', '顶级食材烹制的奢华料理'],
    ];
    transaction(() => {
      for (const p of products) {
        run(
          'INSERT INTO processed_products (id, name, sell_price, emoji, description) VALUES (?, ?, ?, ?, ?)',
          p
        );
      }
    });
  }

  const recipeCount = get('SELECT COUNT(*) as count FROM recipes').count;
  if (recipeCount === 0) {
    console.log('📜 插入加工配方数据...');
    const recipes = [
      [1, '面包', 1, 1, 60, '🍞', '3小麦 + 1鸡蛋 = 1面包'],
      [2, '奶酪', 2, 1, 120, '🧀', '3牛奶 + 1鸡蛋 = 1奶酪'],
      [3, '蛋糕', 3, 1, 180, '🍰', '2鸡蛋 + 2牛奶 + 3番茄 = 1蛋糕'],
      [4, '松露炒蛋', 4, 1, 90, '🍳', '2松露 + 3鸡蛋 = 1松露炒蛋'],
    ];
    const ingredients = {
      1: [
        { type: 'crop', id: 1, qty: 3 },
        { type: 'animal_product', id: 1, qty: 1 },
      ],
      2: [
        { type: 'animal_product', id: 2, qty: 3 },
        { type: 'animal_product', id: 1, qty: 1 },
      ],
      3: [
        { type: 'animal_product', id: 1, qty: 2 },
        { type: 'animal_product', id: 2, qty: 2 },
        { type: 'crop', id: 3, qty: 3 },
      ],
      4: [
        { type: 'animal_product', id: 4, qty: 2 },
        { type: 'animal_product', id: 1, qty: 3 },
      ],
    };
    transaction(() => {
      for (const r of recipes) {
        run(
          'INSERT INTO recipes (id, name, output_product_id, output_amount, process_time, emoji, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
          r
        );
      }
      for (const [recipeId, ings] of Object.entries(ingredients)) {
        for (const ing of ings) {
          run(
            'INSERT INTO recipe_ingredients (recipe_id, ingredient_type, ingredient_id, quantity) VALUES (?, ?, ?, ?)',
            [parseInt(recipeId), ing.type, ing.id, ing.qty]
          );
        }
      }
    });
  }

  const userCount = get('SELECT COUNT(*) as count FROM users').count;
  if (userCount === 0) {
    console.log('👤 创建默认玩家...');
    const nowMs = Date.now();
    run(
      'INSERT INTO users (id, username, coins, level, exp, water, created_at, last_water_update) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [1, '农夫小明', 500, 1, 0, 20, nowMs, nowMs]
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
        'INSERT INTO animal_pens (user_id, capacity, level) VALUES (?, ?, ?)',
        [userId, 2, 1]
      );
      run(
        'INSERT INTO inventory (user_id, item_type, item_id, quantity) VALUES (?, ?, ?, ?)',
        [userId, 'seed', 1, 3]
      );
      run(
        'INSERT INTO inventory (user_id, item_type, item_id, quantity) VALUES (?, ?, ?, ?)',
        [userId, 'seed', 2, 2]
      );
      run(
        'INSERT INTO inventory (user_id, item_type, item_id, quantity) VALUES (?, ?, ?, ?)',
        [userId, 'feed', 1, 5]
      );
    });
  }

  const penCount = get('SELECT COUNT(*) as count FROM animal_pens WHERE user_id = ?', [1]).count;
  if (penCount === 0) {
    console.log('🏠 初始化动物栏...');
    run(
      'INSERT INTO animal_pens (user_id, capacity, level) VALUES (?, ?, ?)',
      [1, 2, 1]
    );
  }

  save();
  console.log('✅ 数据库初始化完成');
};

module.exports = { init, get, all, run, transaction };
