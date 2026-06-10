const express = require('express');
const router = express.Router();
const db = require('./database');

const DEFAULT_USER_ID = 1;
const EXP_PER_LEVEL = 100;
const DRY_PENALTY = 0.5;
const WATER_MAX = 20;
const WATER_REGEN_INTERVAL = 60000;
const MAX_PROCESSING_QUEUE = 3;
const PEN_EXPAND_COST = (currentCap) => currentCap * 200;
const DAILY_FISHING_LIMIT = 10;
const FISHING_COST = 10;

const expToLevel = (exp) => Math.floor(exp / EXP_PER_LEVEL) + 1;

const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const checkDailyReset = (userId) => {
  const today = getTodayStr();
  const existing = db.get('SELECT * FROM daily_stats WHERE user_id = ? AND date = ?', [userId, today]);
  if (!existing) {
    db.run('INSERT INTO daily_stats (user_id, date, fishing_count, tasks_completed) VALUES (?, ?, 0, 0)', [userId, today]);
  }
  return today;
};

const addExp = (userId, expAmount) => {
  const user = db.get('SELECT * FROM users WHERE id = ?', [userId]);
  const newExp = user.exp + expAmount;
  const newLevel = expToLevel(newExp);
  const levelUp = newLevel > user.level;
  let coinReward = 0;
  let rewardDesc = '';

  if (levelUp) {
    for (let lvl = user.level + 1; lvl <= newLevel; lvl++) {
      const reward = db.get('SELECT * FROM level_rewards WHERE level = ?', [lvl]);
      if (reward) {
        coinReward += reward.coin_reward;
        rewardDesc = reward.description;
      } else {
        coinReward += lvl * 50;
      }
    }
    if (coinReward > 0) {
      db.run('UPDATE users SET coins = coins + ? WHERE id = ?', [coinReward, userId]);
    }
  }

  db.run('UPDATE users SET exp = ?, level = ? WHERE id = ?', [newExp, newLevel, userId]);
  return { newExp, newLevel, levelUp, oldLevel: user.level, coinReward, rewardDesc };
};

const addInventory = (userId, itemType, itemId, quantity) => {
  const existing = db.get(
    'SELECT id FROM inventory WHERE user_id = ? AND item_type = ? AND item_id = ?',
    [userId, itemType, itemId]
  );
  if (existing) {
    db.run('UPDATE inventory SET quantity = quantity + ? WHERE id = ?', [quantity, existing.id]);
  } else {
    db.run(
      'INSERT INTO inventory (user_id, item_type, item_id, quantity) VALUES (?, ?, ?, ?)',
      [userId, itemType, itemId, quantity]
    );
  }
};

const removeInventory = (userId, itemType, itemId, quantity) => {
  const existing = db.get(
    'SELECT id, quantity FROM inventory WHERE user_id = ? AND item_type = ? AND item_id = ?',
    [userId, itemType, itemId]
  );
  if (!existing || existing.quantity < quantity) return false;
  if (existing.quantity === quantity) {
    db.run('DELETE FROM inventory WHERE id = ?', [existing.id]);
  } else {
    db.run('UPDATE inventory SET quantity = quantity - ? WHERE id = ?', [quantity, existing.id]);
  }
  return true;
};

const getInventoryQty = (userId, itemType, itemId) => {
  const row = db.get(
    'SELECT quantity FROM inventory WHERE user_id = ? AND item_type = ? AND item_id = ?',
    [userId, itemType, itemId]
  );
  return row ? row.quantity : 0;
};

const checkUser = (req, res, next) => {
  const user = db.get('SELECT * FROM users WHERE id = ?', [DEFAULT_USER_ID]);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  req.user = user;
  next();
};

router.get('/user', checkUser, (req, res) => {
  const now = Date.now();
  const lastUpdate = req.user.last_water_update || req.user.created_at || now;
  const elapsed = Math.floor((now - lastUpdate) / WATER_REGEN_INTERVAL);
  let water = Math.min(WATER_MAX, req.user.water + elapsed);
  if (elapsed > 0 && water !== req.user.water) {
    db.run(
      'UPDATE users SET water = ?, last_water_update = ? WHERE id = ?',
      [water, now, DEFAULT_USER_ID]
    );
  }

  checkDailyReset(DEFAULT_USER_ID);
  const today = getTodayStr();
  const daily = db.get('SELECT * FROM daily_stats WHERE user_id = ? AND date = ?', [DEFAULT_USER_ID, today]);

  const user = db.get('SELECT * FROM users WHERE id = ?', [DEFAULT_USER_ID]);
  res.json({
    id: user.id,
    username: user.username,
    coins: user.coins,
    level: user.level,
    exp: user.exp,
    expNextLevel: user.level * EXP_PER_LEVEL,
    water: user.water,
    waterMax: WATER_MAX,
    daily: {
      fishingCount: daily ? daily.fishing_count : 0,
      fishingLimit: DAILY_FISHING_LIMIT,
      tasksCompleted: daily ? daily.tasks_completed : 0,
      date: today,
    },
  });
});

router.get('/crops', (req, res) => {
  const crops = db.all('SELECT * FROM crops');
  res.json(crops);
});

router.get('/plots', checkUser, (req, res) => {
  const plots = db.all(`
    SELECT p.*,
           c.name as crop_name,
           c.sell_price,
           c.grow_time,
           c.exp_reward,
           c.emoji,
           c.stage1, c.stage2, c.stage3
    FROM plots p
    LEFT JOIN crops c ON p.crop_id = c.id
    WHERE p.user_id = ?
    ORDER BY p.plot_index
  `, [DEFAULT_USER_ID]);

  const now = Date.now();
  const plotsWithStatus = plots.map(p => {
    let status = 'empty';
    let progress = 0;
    let remaining = 0;
    let yieldBonus = 1;

    if (p.crop_id && !p.is_harvested) {
      const planted = p.planted_at || Date.now();
      const growMs = p.grow_time * 1000;
      const elapsed = now - planted;
      progress = Math.min(100, (elapsed / growMs) * 100);
      remaining = Math.max(0, Math.ceil((growMs - elapsed) / 1000));

      if (!p.watered && p.water_count === 0) {
        yieldBonus = DRY_PENALTY;
      }

      if (progress >= 100) {
        status = 'ready';
      } else {
        status = p.watered ? 'growing_watered' : 'growing_dry';
      }
    } else if (p.is_harvested) {
      status = 'harvested';
    }

    return {
      id: p.id,
      index: p.plot_index,
      cropId: p.crop_id,
      cropName: p.crop_name,
      emoji: p.emoji,
      stage1: p.stage1,
      stage2: p.stage2,
      stage3: p.stage3,
      growTime: p.grow_time,
      status,
      progress,
      remaining,
      watered: !!p.watered,
      waterCount: p.water_count,
      yieldBonus,
      isHarvested: !!p.is_harvested,
      sellPrice: p.sell_price,
      expReward: p.exp_reward,
    };
  });

  res.json(plotsWithStatus);
});

router.post('/plant', checkUser, (req, res) => {
  const { plotIndex, cropId } = req.body;
  if (plotIndex == null || !cropId) {
    return res.status(400).json({ error: '缺少参数' });
  }

  const plot = db.get('SELECT * FROM plots WHERE user_id = ? AND plot_index = ?', [DEFAULT_USER_ID, plotIndex]);
  if (!plot) return res.status(404).json({ error: '土地不存在' });
  if (plot.crop_id) return res.status(400).json({ error: '该土地已有作物' });

  const inv = db.get(
    'SELECT quantity FROM inventory WHERE user_id = ? AND item_type = ? AND item_id = ?',
    [DEFAULT_USER_ID, 'seed', cropId]
  );
  if (!inv || inv.quantity <= 0) return res.status(400).json({ error: '种子不足' });

  const crop = db.get('SELECT * FROM crops WHERE id = ?', [cropId]);
  if (!crop) return res.status(404).json({ error: '作物不存在' });

  const nowMs = Date.now();
  db.transaction(() => {
    db.run(
      'UPDATE inventory SET quantity = quantity - 1 WHERE user_id = ? AND item_type = ? AND item_id = ?',
      [DEFAULT_USER_ID, 'seed', cropId]
    );
    db.run(
      'UPDATE plots SET crop_id = ?, planted_at = ?, watered = 0, water_count = 0, is_harvested = 0 WHERE user_id = ? AND plot_index = ?',
      [cropId, nowMs, DEFAULT_USER_ID, plotIndex]
    );
  });

  res.json({ success: true, message: `已在${plotIndex + 1}号地种植${crop.name}！`, growTime: crop.grow_time });
});

router.post('/water', checkUser, (req, res) => {
  const { plotIndex } = req.body;
  if (plotIndex == null) return res.status(400).json({ error: '缺少参数' });

  const plot = db.get('SELECT * FROM plots WHERE user_id = ? AND plot_index = ?', [DEFAULT_USER_ID, plotIndex]);
  if (!plot) return res.status(404).json({ error: '土地不存在' });
  if (!plot.crop_id) return res.status(400).json({ error: '空地无需浇水' });
  if (plot.is_harvested) return res.status(400).json({ error: '已收获无需浇水' });

  const now = Date.now();
  const planted = plot.planted_at || now;
  const growMs = (db.get('SELECT grow_time FROM crops WHERE id = ?', [plot.crop_id])).grow_time * 1000;
  if (now - planted >= growMs) return res.status(400).json({ error: '作物已成熟，无需浇水' });
  if (plot.watered) return res.status(400).json({ error: '当前生长阶段已浇过水' });

  if (req.user.water <= 0) return res.status(400).json({ error: '水源不足，请等待水源自动恢复' });

  db.transaction(() => {
    db.run('UPDATE users SET water = water - 1, last_water_update = ? WHERE id = ?', [now, DEFAULT_USER_ID]);
    db.run(
      'UPDATE plots SET watered = 1, water_count = water_count + 1 WHERE user_id = ? AND plot_index = ?',
      [DEFAULT_USER_ID, plotIndex]
    );
  });

  const user = db.get('SELECT water FROM users WHERE id = ?', [DEFAULT_USER_ID]);
  res.json({ success: true, message: '浇水成功！产量加成将生效', water: user.water });
});

router.post('/harvest', checkUser, (req, res) => {
  const { plotIndex } = req.body;
  if (plotIndex == null) return res.status(400).json({ error: '缺少参数' });

  const plot = db.get(`
    SELECT p.*, c.sell_price, c.grow_time, c.exp_reward, c.name
    FROM plots p JOIN crops c ON p.crop_id = c.id
    WHERE p.user_id = ? AND p.plot_index = ?
  `, [DEFAULT_USER_ID, plotIndex]);

  if (!plot) return res.status(404).json({ error: '土地不存在' });
  if (!plot.crop_id) return res.status(400).json({ error: '空地无作物' });
  if (plot.is_harvested) return res.status(400).json({ error: '已收获' });

  const now = Date.now();
  const planted = plot.planted_at || now;
  const growMs = plot.grow_time * 1000;
  if (now - planted < growMs) return res.status(400).json({ error: `作物尚未成熟，还需${Math.ceil((growMs - (now - planted))/1000)}秒` });

  let yieldBonus = 1;
  if (plot.water_count === 0) yieldBonus = DRY_PENALTY;
  const coinsEarned = Math.floor(plot.sell_price * yieldBonus);
  const expEarned = plot.exp_reward;
  const cropAmount = yieldBonus >= 1 ? 1 : 1;

  let levelUpInfo = null;
  let rewardMsg = '';

  db.transaction(() => {
    db.run('UPDATE users SET coins = coins + ? WHERE id = ?', [coinsEarned, DEFAULT_USER_ID]);
    levelUpInfo = addExp(DEFAULT_USER_ID, expEarned);
    addInventory(DEFAULT_USER_ID, 'crop', plot.crop_id, cropAmount);
    db.run(
      'UPDATE plots SET is_harvested = 1 WHERE user_id = ? AND plot_index = ?',
      [DEFAULT_USER_ID, plotIndex]
    );
  });

  if (levelUpInfo.levelUp) rewardMsg = `🎉 恭喜升级到 Lv.${levelUpInfo.newLevel}！奖励 ${levelUpInfo.coinReward} 金币`;

  res.json({
    success: true,
    message: `收获成功！获得 ${coinsEarned} 金币，${expEarned} 经验，${plot.name}x${cropAmount}。${rewardMsg}`,
    coins: coinsEarned,
    exp: expEarned,
    yieldBonus,
    levelUp: levelUpInfo.levelUp,
    newLevel: levelUpInfo.newLevel,
    coinReward: levelUpInfo.coinReward,
  });
});

router.post('/clear', checkUser, (req, res) => {
  const { plotIndex } = req.body;
  if (plotIndex == null) return res.status(400).json({ error: '缺少参数' });

  const plot = db.get('SELECT * FROM plots WHERE user_id = ? AND plot_index = ?', [DEFAULT_USER_ID, plotIndex]);
  if (!plot) return res.status(404).json({ error: '土地不存在' });
  if (!plot.is_harvested && plot.crop_id) return res.status(400).json({ error: '请先收获作物' });

  db.run(
    'UPDATE plots SET crop_id = NULL, planted_at = NULL, watered = 0, water_count = 0, is_harvested = 0 WHERE user_id = ? AND plot_index = ?',
    [DEFAULT_USER_ID, plotIndex]
  );

  res.json({ success: true, message: '土地已清理，可重新种植' });
});

router.get('/inventory', checkUser, (req, res) => {
  const items = db.all(`
    SELECT i.*,
      CASE i.item_type
        WHEN 'seed' THEN c.name
        WHEN 'crop' THEN c.name
        WHEN 'feed' THEN f.name
        WHEN 'animal_product' THEN ap.name
        WHEN 'processed_product' THEN pp.name
        WHEN 'fish' THEN fi.name
        ELSE '未知'
      END as item_name,
      CASE i.item_type
        WHEN 'seed' THEN c.emoji
        WHEN 'crop' THEN c.emoji
        WHEN 'feed' THEN f.emoji
        WHEN 'animal_product' THEN ap.emoji
        WHEN 'processed_product' THEN pp.emoji
        WHEN 'fish' THEN fi.emoji
        ELSE '📦'
      END as emoji,
      CASE i.item_type
        WHEN 'seed' THEN c.seed_price
        ELSE NULL
      END as seed_price,
      CASE i.item_type
        WHEN 'seed' THEN c.sell_price
        WHEN 'crop' THEN c.sell_price
        WHEN 'animal_product' THEN ap.sell_price
        WHEN 'processed_product' THEN pp.sell_price
        WHEN 'feed' THEN f.price
        WHEN 'fish' THEN fi.sell_price
        ELSE NULL
      END as sell_price,
      CASE i.item_type
        WHEN 'seed' THEN c.grow_time
        ELSE NULL
      END as grow_time,
      CASE i.item_type
        WHEN 'seed' THEN c.exp_reward
        WHEN 'fish' THEN fi.exp_reward
        ELSE NULL
      END as exp_reward,
      CASE i.item_type
        WHEN 'seed' THEN c.description
        WHEN 'crop' THEN c.description
        WHEN 'feed' THEN f.description
        WHEN 'animal_product' THEN ap.description
        WHEN 'processed_product' THEN pp.description
        WHEN 'fish' THEN fi.description
        ELSE NULL
      END as description,
      CASE i.item_type
        WHEN 'fish' THEN fi.rarity
        ELSE NULL
      END as rarity
    FROM inventory i
    LEFT JOIN crops c ON ((i.item_type = 'seed' OR i.item_type = 'crop') AND i.item_id = c.id)
    LEFT JOIN feeds f ON (i.item_type = 'feed' AND i.item_id = f.id)
    LEFT JOIN animal_products ap ON (i.item_type = 'animal_product' AND i.item_id = ap.id)
    LEFT JOIN processed_products pp ON (i.item_type = 'processed_product' AND i.item_id = pp.id)
    LEFT JOIN fish fi ON (i.item_type = 'fish' AND i.item_id = fi.id)
    WHERE i.user_id = ? AND i.quantity > 0
  `, [DEFAULT_USER_ID]);

  res.json(items.map(item => ({
    id: item.id,
    type: item.item_type,
    itemId: item.item_id,
    name: item.item_name,
    emoji: item.emoji,
    quantity: item.quantity,
    seedPrice: item.seed_price,
    sellPrice: item.sell_price,
    growTime: item.grow_time,
    expReward: item.exp_reward,
    description: item.description,
    rarity: item.rarity,
  })));
});

router.get('/shop', checkUser, (req, res) => {
  const seeds = db.all('SELECT * FROM crops ORDER BY id').map(c => ({
    id: c.id,
    type: 'seed',
    name: c.name,
    emoji: c.emoji,
    price: c.seed_price,
    growTime: c.grow_time,
    sellPrice: c.sell_price,
    expReward: c.exp_reward,
    description: c.description,
    category: '种子',
    unlockLevel: c.unlock_level || 1,
    unlocked: req.user.level >= (c.unlock_level || 1),
  }));

  const feeds = db.all('SELECT * FROM feeds ORDER BY id').map(f => ({
    id: f.id,
    type: 'feed',
    name: f.name,
    emoji: f.emoji,
    price: f.price,
    feedValue: f.feed_value,
    description: f.description,
    category: '饲料',
    unlockLevel: 1,
    unlocked: true,
  }));

  const animals = db.all('SELECT * FROM animals ORDER BY id').map(a => ({
    id: a.id,
    type: 'animal',
    name: a.name,
    emoji: a.emoji,
    price: a.buy_price,
    feedInterval: a.feed_interval,
    productInterval: a.product_interval,
    productAmount: a.product_amount,
    expReward: a.exp_reward,
    description: a.description,
    category: '动物',
    unlockLevel: 1,
    unlocked: true,
  }));

  res.json([...seeds, ...feeds, ...animals]);
});

router.post('/shop/buy', checkUser, (req, res) => {
  const { itemType, itemId, quantity = 1 } = req.body;
  if (!itemType || !itemId || quantity < 1) return res.status(400).json({ error: '参数错误' });

  let item = null;
  if (itemType === 'seed') {
    item = db.get('SELECT * FROM crops WHERE id = ?', [itemId]);
    if (!item) return res.status(404).json({ error: '商品不存在' });
    item.price = item.seed_price;
  } else if (itemType === 'feed') {
    item = db.get('SELECT * FROM feeds WHERE id = ?', [itemId]);
    if (!item) return res.status(404).json({ error: '商品不存在' });
  } else if (itemType === 'animal') {
    item = db.get('SELECT * FROM animals WHERE id = ?', [itemId]);
    if (!item) return res.status(404).json({ error: '商品不存在' });
    item.price = item.buy_price;
  } else {
    return res.status(400).json({ error: '未知商品类型' });
  }

  const totalCost = item.price * quantity;
  if (req.user.coins < totalCost) return res.status(400).json({ error: '金币不足' });

  if (itemType === 'animal') {
    const pen = db.get('SELECT * FROM animal_pens WHERE user_id = ?', [DEFAULT_USER_ID]);
    const count = db.get('SELECT COUNT(*) as c FROM user_animals WHERE user_id = ?', [DEFAULT_USER_ID]).c;
    if (count + quantity > pen.capacity) {
      return res.status(400).json({ error: `动物栏容量不足！当前${count}/${pen.capacity}，请扩建动物栏` });
    }

    const nowMs = Date.now();
    db.transaction(() => {
      db.run('UPDATE users SET coins = coins - ? WHERE id = ?', [totalCost, DEFAULT_USER_ID]);
      for (let i = 0; i < quantity; i++) {
        const usedSlots = db.all('SELECT pen_slot FROM user_animals WHERE user_id = ?', [DEFAULT_USER_ID]).map(r => r.pen_slot);
        let slot = 0;
        while (usedSlots.includes(slot)) slot++;
        db.run(
          'INSERT INTO user_animals (user_id, animal_id, pen_slot, bought_at, last_fed_at, last_product_at, hunger, is_sick) VALUES (?, ?, ?, ?, ?, ?, 0, 0)',
          [DEFAULT_USER_ID, itemId, slot, nowMs, nowMs, nowMs]
        );
      }
    });
  } else {
    db.transaction(() => {
      db.run('UPDATE users SET coins = coins - ? WHERE id = ?', [totalCost, DEFAULT_USER_ID]);
      addInventory(DEFAULT_USER_ID, itemType, itemId, quantity);
    });
  }

  const user = db.get('SELECT coins FROM users WHERE id = ?', [DEFAULT_USER_ID]);
  res.json({
    success: true,
    message: `购买成功！获得 ${quantity} 个${item.name}${itemType === 'animal' ? '，已放入动物栏' : ''}`,
    coins: user.coins,
    quantity,
  });
});

router.get('/animals', checkUser, (req, res) => {
  const pen = db.get('SELECT * FROM animal_pens WHERE user_id = ?', [DEFAULT_USER_ID]);
  const animals = db.all(`
    SELECT ua.*, a.name, a.emoji, a.baby_emoji, a.feed_interval, a.product_interval, a.product_amount,
           a.product_id, a.exp_reward, a.description, ap.name as product_name, ap.emoji as product_emoji, ap.sell_price as product_price
    FROM user_animals ua
    JOIN animals a ON ua.animal_id = a.id
    LEFT JOIN animal_products ap ON a.product_id = ap.id
    WHERE ua.user_id = ?
    ORDER BY ua.pen_slot
  `, [DEFAULT_USER_ID]);

  const now = Date.now();
  const result = animals.map(a => {
    const boughtAt = a.bought_at || now;
    const ageHours = (now - boughtAt) / (1000 * 60 * 60);
    const isBaby = ageHours < 0.5;

    const lastFed = a.last_fed_at || now;
    const feedIntervalMs = a.feed_interval * 1000;
    const feedElapsed = now - lastFed;
    const needFeed = feedElapsed >= feedIntervalMs;
    const feedRemaining = Math.max(0, Math.ceil((feedIntervalMs - feedElapsed) / 1000));
    const hungerLevel = Math.min(100, Math.floor((feedElapsed / feedIntervalMs) * 100));

    const lastProd = a.last_product_at || now;
    const prodIntervalMs = a.product_interval * 1000;
    const prodElapsed = now - lastProd;
    const canCollect = prodElapsed >= prodIntervalMs && hungerLevel < 100;
    const prodRemaining = Math.max(0, Math.ceil((prodIntervalMs - prodElapsed) / 1000));
    const prodProgress = Math.min(100, Math.floor((prodElapsed / prodIntervalMs) * 100));

    const displayEmoji = isBaby ? a.baby_emoji : a.emoji;
    const efficiency = hungerLevel >= 100 ? 0 : hungerLevel >= 60 ? 0.5 : 1;

    return {
      id: ua => ua.id(a),
      instanceId: a.id,
      animalId: a.animal_id,
      name: a.name,
      emoji: displayEmoji,
      slot: a.pen_slot,
      isBaby,
      needFeed,
      feedRemaining,
      hungerLevel,
      canCollect: canCollect && !isBaby,
      prodRemaining,
      prodProgress,
      productId: a.product_id,
      productName: a.product_name,
      productEmoji: a.product_emoji,
      productPrice: a.product_price,
      productAmount: a.product_amount,
      efficiency,
      isSick: !!a.is_sick,
      expReward: a.exp_reward,
      description: a.description,
    };
  });

  res.json({
    pen: {
      capacity: pen.capacity,
      level: pen.level,
      currentCount: animals.length,
      expandCost: PEN_EXPAND_COST(pen.capacity),
    },
    animals: result,
  });
});

const uaId = (a) => a.id;

router.get('/animals/list-fix', checkUser, (req, res) => {
  const pen = db.get('SELECT * FROM animal_pens WHERE user_id = ?', [DEFAULT_USER_ID]);
  const animalRows = db.all(`
    SELECT ua.*, a.name, a.emoji, a.baby_emoji, a.feed_interval, a.product_interval, a.product_amount,
           a.product_id, a.exp_reward, a.description, ap.name as product_name, ap.emoji as product_emoji, ap.sell_price as product_price
    FROM user_animals ua
    JOIN animals a ON ua.animal_id = a.id
    LEFT JOIN animal_products ap ON a.product_id = ap.id
    WHERE ua.user_id = ?
    ORDER BY ua.pen_slot
  `, [DEFAULT_USER_ID]);

  const now = Date.now();
  const result = animalRows.map(a => {
    const boughtAt = a.bought_at || now;
    const ageHours = (now - boughtAt) / (1000 * 60 * 60);
    const isBaby = ageHours < 0.5;

    const lastFed = a.last_fed_at || now;
    const feedIntervalMs = a.feed_interval * 1000;
    const feedElapsed = now - lastFed;
    const needFeed = feedElapsed >= feedIntervalMs;
    const feedRemaining = Math.max(0, Math.ceil((feedIntervalMs - feedElapsed) / 1000));
    const hungerLevel = Math.min(100, Math.floor((feedElapsed / feedIntervalMs) * 100));

    const lastProd = a.last_product_at || now;
    const prodIntervalMs = a.product_interval * 1000;
    const prodElapsed = now - lastProd;
    const canCollect = prodElapsed >= prodIntervalMs && hungerLevel < 100;
    const prodRemaining = Math.max(0, Math.ceil((prodIntervalMs - prodElapsed) / 1000));
    const prodProgress = Math.min(100, Math.floor((prodElapsed / prodIntervalMs) * 100));

    const displayEmoji = isBaby ? a.baby_emoji : a.emoji;
    const efficiency = hungerLevel >= 100 ? 0 : hungerLevel >= 60 ? 0.5 : 1;

    return {
      instanceId: a.id,
      animalId: a.animal_id,
      name: a.name,
      emoji: displayEmoji,
      slot: a.pen_slot,
      isBaby,
      needFeed,
      feedRemaining,
      hungerLevel,
      canCollect: canCollect && !isBaby,
      prodRemaining,
      prodProgress,
      productId: a.product_id,
      productName: a.product_name,
      productEmoji: a.product_emoji,
      productPrice: a.product_price,
      productAmount: a.product_amount,
      efficiency,
      isSick: !!a.is_sick,
      expReward: a.exp_reward,
      description: a.description,
    };
  });

  res.json({
    pen: {
      capacity: pen.capacity,
      level: pen.level,
      currentCount: animalRows.length,
      expandCost: PEN_EXPAND_COST(pen.capacity),
    },
    animals: result,
  });
});

router.post('/animal/feed', checkUser, (req, res) => {
  const { instanceId, feedId = 1 } = req.body;
  if (!instanceId) return res.status(400).json({ error: '缺少参数' });

  const ua = db.get('SELECT * FROM user_animals WHERE id = ? AND user_id = ?', [instanceId, DEFAULT_USER_ID]);
  if (!ua) return res.status(404).json({ error: '动物不存在' });

  const animal = db.get('SELECT * FROM animals WHERE id = ?', [ua.animal_id]);
  if (!animal) return res.status(404).json({ error: '动物种类不存在' });

  const feed = db.get('SELECT * FROM feeds WHERE id = ?', [feedId]);
  if (!feed) return res.status(404).json({ error: '饲料不存在' });

  const feedQty = getInventoryQty(DEFAULT_USER_ID, 'feed', feedId);
  const needQty = animal.feed_cost;
  if (feedQty < needQty) return res.status(400).json({ error: `${feed.name}不足，需要${needQty}个` });

  const now = Date.now();
  db.transaction(() => {
    removeInventory(DEFAULT_USER_ID, 'feed', feedId, needQty);
    db.run(
      'UPDATE user_animals SET last_fed_at = ?, hunger = 0 WHERE id = ?',
      [now, instanceId]
    );
  });

  res.json({
    success: true,
    message: `已用${feed.name}喂食${animal.name}！动物状态良好`,
    feedUsed: needQty,
  });
});

router.post('/animal/collect', checkUser, (req, res) => {
  const { instanceId } = req.body;
  if (!instanceId) return res.status(400).json({ error: '缺少参数' });

  const ua = db.get('SELECT * FROM user_animals WHERE id = ? AND user_id = ?', [instanceId, DEFAULT_USER_ID]);
  if (!ua) return res.status(404).json({ error: '动物不存在' });

  const now = Date.now();
  const animal = db.get(`
    SELECT a.*, ap.name as product_name, ap.emoji as product_emoji, ap.sell_price as product_price
    FROM animals a
    LEFT JOIN animal_products ap ON a.product_id = ap.id
    WHERE a.id = ?
  `, [ua.animal_id]);

  const lastProd = ua.last_product_at || ua.bought_at || now;
  const prodIntervalMs = animal.product_interval * 1000;
  if (now - lastProd < prodIntervalMs) {
    return res.status(400).json({
      error: `产品尚未就绪，还需${Math.ceil((prodIntervalMs - (now - lastProd)) / 1000)}秒`,
    });
  }

  const lastFed = ua.last_fed_at || ua.bought_at || now;
  const feedIntervalMs = animal.feed_interval * 1000;
  const hungerLevel = Math.min(100, Math.floor(((now - lastFed) / feedIntervalMs) * 100));
  if (hungerLevel >= 100) {
    return res.status(400).json({ error: '动物饥饿，请先喂食再收集产品' });
  }

  const efficiency = hungerLevel >= 60 ? 0.5 : 1;
  const amount = Math.max(1, Math.floor(animal.product_amount * efficiency));
  const expEarned = animal.exp_reward;

  let levelUpInfo = null;
  db.transaction(() => {
    addInventory(DEFAULT_USER_ID, 'animal_product', animal.product_id, amount);
    levelUpInfo = addExp(DEFAULT_USER_ID, expEarned);
    db.run(
      'UPDATE user_animals SET last_product_at = ? WHERE id = ?',
      [now, instanceId]
    );
  });

  let msg = `收集成功！获得 ${animal.product_emoji}${animal.product_name} x${amount}，${expEarned} 经验`;
  if (levelUpInfo.levelUp) msg += ` 🎉 升级到 Lv.${levelUpInfo.newLevel}！奖励 ${levelUpInfo.coinReward} 金币`;

  res.json({
    success: true,
    message: msg,
    product: {
      id: animal.product_id,
      name: animal.product_name,
      emoji: animal.product_emoji,
      amount,
    },
    exp: expEarned,
    levelUp: levelUpInfo.levelUp,
    newLevel: levelUpInfo.newLevel,
    coinReward: levelUpInfo.coinReward,
  });
});

router.post('/animal/pen-expand', checkUser, (req, res) => {
  const pen = db.get('SELECT * FROM animal_pens WHERE user_id = ?', [DEFAULT_USER_ID]);
  const cost = PEN_EXPAND_COST(pen.capacity);

  if (req.user.coins < cost) return res.status(400).json({ error: `金币不足，需要${cost}金币` });

  db.transaction(() => {
    db.run('UPDATE users SET coins = coins - ? WHERE id = ?', [cost, DEFAULT_USER_ID]);
    db.run(
      'UPDATE animal_pens SET capacity = capacity + 1, level = level + 1 WHERE user_id = ?',
      [DEFAULT_USER_ID]
    );
  });

  const newPen = db.get('SELECT * FROM animal_pens WHERE user_id = ?', [DEFAULT_USER_ID]);
  const user = db.get('SELECT coins FROM users WHERE id = ?', [DEFAULT_USER_ID]);
  res.json({
    success: true,
    message: `动物栏扩建成功！容量提升到 ${newPen.capacity}`,
    capacity: newPen.capacity,
    level: newPen.level,
    nextExpandCost: PEN_EXPAND_COST(newPen.capacity),
    coins: user.coins,
  });
});

router.get('/recipes', checkUser, (req, res) => {
  const recipes = db.all('SELECT * FROM recipes ORDER BY id');
  const result = recipes.map(r => {
    const ingredients = db.all(`
      SELECT ri.*,
        CASE ri.ingredient_type
          WHEN 'crop' THEN c.name
          WHEN 'animal_product' THEN ap.name
          ELSE '未知'
        END as ing_name,
        CASE ri.ingredient_type
          WHEN 'crop' THEN c.emoji
          WHEN 'animal_product' THEN ap.emoji
          ELSE '📦'
        END as ing_emoji
      FROM recipe_ingredients ri
      LEFT JOIN crops c ON (ri.ingredient_type = 'crop' AND ri.ingredient_id = c.id)
      LEFT JOIN animal_products ap ON (ri.ingredient_type = 'animal_product' AND ri.ingredient_id = ap.id)
      WHERE ri.recipe_id = ?
    `, [r.id]);

    const output = db.get('SELECT * FROM processed_products WHERE id = ?', [r.output_product_id]);

    const ingWithAvail = ingredients.map(ing => {
      const qty = getInventoryQty(DEFAULT_USER_ID, ing.ingredient_type, ing.ingredient_id);
      return {
        type: ing.ingredient_type,
        id: ing.ingredient_id,
        name: ing.ing_name,
        emoji: ing.ing_emoji,
        required: ing.quantity,
        available: qty,
        enough: qty >= ing.quantity,
      };
    });

    const canMake = ingWithAvail.every(i => i.enough);

    return {
      id: r.id,
      name: r.name,
      emoji: r.emoji,
      processTime: r.process_time,
      description: r.description,
      output: {
        id: r.output_product_id,
        name: output.name,
        emoji: output.emoji,
        sellPrice: output.sell_price,
        amount: r.output_amount,
        description: output.description,
      },
      ingredients: ingWithAvail,
      canMake,
    };
  });

  const queueCount = db.get(
    'SELECT COUNT(*) as c FROM processing_queue WHERE user_id = ? AND is_collected = 0',
    [DEFAULT_USER_ID]
  ).c;

  res.json({
    recipes: result,
    queueCount,
    maxQueue: MAX_PROCESSING_QUEUE,
    queueFull: queueCount >= MAX_PROCESSING_QUEUE,
  });
});

router.get('/processing-queue', checkUser, (req, res) => {
  const rows = db.all(`
    SELECT pq.*, r.name as recipe_name, r.emoji, r.process_time,
           pp.name as output_name, pp.emoji as output_emoji, pp.sell_price, r.output_amount
    FROM processing_queue pq
    JOIN recipes r ON pq.recipe_id = r.id
    JOIN processed_products pp ON r.output_product_id = pp.id
    WHERE pq.user_id = ? AND pq.is_collected = 0
    ORDER BY pq.started_at
  `, [DEFAULT_USER_ID]);

  const now = Date.now();
  const result = rows.map(q => {
    const totalMs = q.process_time * 1000;
    const elapsed = now - q.started_at;
    const progress = Math.min(100, Math.floor((elapsed / totalMs) * 100));
    const remaining = Math.max(0, Math.ceil((q.finish_at - now) / 1000));
    const isCompleted = now >= q.finish_at || q.is_completed;

    return {
      id: q.id,
      recipeId: q.recipe_id,
      recipeName: q.recipe_name,
      emoji: q.emoji,
      progress,
      remaining,
      isCompleted,
      output: {
        name: q.output_name,
        emoji: q.output_emoji,
        amount: q.output_amount,
        sellPrice: q.sell_price,
      },
    };
  });

  res.json({
    queue: result,
    count: result.length,
    maxQueue: MAX_PROCESSING_QUEUE,
    canAdd: result.length < MAX_PROCESSING_QUEUE,
  });
});

router.post('/process/start', checkUser, (req, res) => {
  const { recipeId } = req.body;
  if (!recipeId) return res.status(400).json({ error: '缺少参数' });

  const queueCount = db.get(
    'SELECT COUNT(*) as c FROM processing_queue WHERE user_id = ? AND is_collected = 0',
    [DEFAULT_USER_ID]
  ).c;
  if (queueCount >= MAX_PROCESSING_QUEUE) {
    return res.status(400).json({ error: `生产队列已满（${queueCount}/${MAX_PROCESSING_QUEUE}），请等待完成` });
  }

  const recipe = db.get('SELECT * FROM recipes WHERE id = ?', [recipeId]);
  if (!recipe) return res.status(404).json({ error: '配方不存在' });

  const ingredients = db.all('SELECT * FROM recipe_ingredients WHERE recipe_id = ?', [recipeId]);
  for (const ing of ingredients) {
    const qty = getInventoryQty(DEFAULT_USER_ID, ing.ingredient_type, ing.ingredient_id);
    if (qty < ing.quantity) {
      return res.status(400).json({ error: `原料不足` });
    }
  }

  const now = Date.now();
  const finishAt = now + recipe.process_time * 1000;
  db.transaction(() => {
    for (const ing of ingredients) {
      removeInventory(DEFAULT_USER_ID, ing.ingredient_type, ing.ingredient_id, ing.quantity);
    }
    db.run(
      'INSERT INTO processing_queue (user_id, recipe_id, started_at, finish_at, is_completed, is_collected) VALUES (?, ?, ?, ?, 0, 0)',
      [DEFAULT_USER_ID, recipeId, now, finishAt]
    );
  });

  const newQueueCount = db.get(
    'SELECT COUNT(*) as c FROM processing_queue WHERE user_id = ? AND is_collected = 0',
    [DEFAULT_USER_ID]
  ).c;

  res.json({
    success: true,
    message: `开始加工 ${recipe.name}！预计${recipe.process_time}秒后完成`,
    recipe: {
      id: recipe.id,
      name: recipe.name,
      processTime: recipe.process_time,
      finishAt,
    },
    queueCount: newQueueCount,
    maxQueue: MAX_PROCESSING_QUEUE,
  });
});

router.post('/process/collect', checkUser, (req, res) => {
  const { queueId } = req.body;
  if (!queueId) return res.status(400).json({ error: '缺少参数' });

  const q = db.get(`
    SELECT pq.*, r.name as recipe_name, r.output_product_id, r.output_amount, r.process_time,
           pp.name as product_name, pp.emoji as product_emoji, pp.sell_price
    FROM processing_queue pq
    JOIN recipes r ON pq.recipe_id = r.id
    JOIN processed_products pp ON r.output_product_id = pp.id
    WHERE pq.id = ? AND pq.user_id = ?
  `, [queueId, DEFAULT_USER_ID]);

  if (!q) return res.status(404).json({ error: '加工任务不存在' });
  if (q.is_collected) return res.status(400).json({ error: '已收取过成品' });

  const now = Date.now();
  if (now < q.finish_at && !q.is_completed) {
    return res.status(400).json({
      error: `加工尚未完成，还需${Math.ceil((q.finish_at - now) / 1000)}秒`,
    });
  }

  db.transaction(() => {
    addInventory(DEFAULT_USER_ID, 'processed_product', q.output_product_id, q.output_amount);
    db.run(
      'UPDATE processing_queue SET is_completed = 1, is_collected = 1 WHERE id = ?',
      [queueId]
    );
  });

  res.json({
    success: true,
    message: `收取成功！获得 ${q.product_emoji}${q.product_name} x${q.output_amount}`,
    product: {
      id: q.output_product_id,
      name: q.product_name,
      emoji: q.product_emoji,
      amount: q.output_amount,
      sellPrice: q.sell_price,
    },
  });
});

router.post('/inventory/sell', checkUser, (req, res) => {
  const { itemType, itemId, quantity = 1 } = req.body;
  if (!itemType || !itemId || quantity < 1) return res.status(400).json({ error: '参数错误' });

  let sellPrice = 0;
  let itemName = '';

  if (itemType === 'crop') {
    const crop = db.get('SELECT * FROM crops WHERE id = ?', [itemId]);
    if (!crop) return res.status(404).json({ error: '物品不存在' });
    sellPrice = crop.sell_price;
    itemName = crop.name;
  } else if (itemType === 'animal_product') {
    const ap = db.get('SELECT * FROM animal_products WHERE id = ?', [itemId]);
    if (!ap) return res.status(404).json({ error: '物品不存在' });
    sellPrice = ap.sell_price;
    itemName = ap.name;
  } else if (itemType === 'processed_product') {
    const pp = db.get('SELECT * FROM processed_products WHERE id = ?', [itemId]);
    if (!pp) return res.status(404).json({ error: '物品不存在' });
    sellPrice = pp.sell_price;
    itemName = pp.name;
  } else if (itemType === 'fish') {
    const fish = db.get('SELECT * FROM fish WHERE id = ?', [itemId]);
    if (!fish) return res.status(404).json({ error: '物品不存在' });
    sellPrice = fish.sell_price;
    itemName = fish.name;
  } else {
    return res.status(400).json({ error: '该物品类型不可出售' });
  }

  const curQty = getInventoryQty(DEFAULT_USER_ID, itemType, itemId);
  const sellQty = Math.min(quantity, curQty);
  if (sellQty <= 0) return res.status(400).json({ error: '库存不足' });

  const totalCoins = sellPrice * sellQty;

  db.transaction(() => {
    removeInventory(DEFAULT_USER_ID, itemType, itemId, sellQty);
    db.run('UPDATE users SET coins = coins + ? WHERE id = ?', [totalCoins, DEFAULT_USER_ID]);
  });

  const user = db.get('SELECT coins FROM users WHERE id = ?', [DEFAULT_USER_ID]);
  res.json({
    success: true,
    message: `出售成功！${itemName} x${sellQty}，获得 ${totalCoins} 金币`,
    coins: totalCoins,
    totalCoins: user.coins,
    soldQty: sellQty,
  });
});

const RARE_ITEMS = [
  { id: 5, emoji: '🥕', name: '胡萝卜种子', rarity: 'rare' },
  { id: 6, emoji: '🍓', name: '草莓种子', rarity: 'epic' },
  { id: 7, emoji: '🌽', name: '金币x50', rarity: 'rare', isCoin: true, coinAmount: 50 },
];

router.post('/mini-game/reward', checkUser, (req, res) => {
  const { score, difficulty = 'normal' } = req.body;
  const s = Math.max(0, Math.min(500, parseInt(score) || 0));

  const diffMult = difficulty === 'easy' ? 0.8 : difficulty === 'hard' ? 1.5 : 1;
  const coins = Math.floor(s * 2 * diffMult);
  const exp = Math.floor(s * diffMult);

  let bonusItems = [];
  let bonusCoins = 0;

  const tiers = [
    { min: 30, chance: 0.45, pool: [ { type: 'seed', id: 1, qty: 1 }, { type: 'seed', id: 2, qty: 1 }, { type: 'coin', amt: 20 } ] },
    { min: 80, chance: 0.65, pool: [ { type: 'seed', id: 3, qty: 1 }, { type: 'seed', id: 2, qty: 2 }, { type: 'coin', amt: 50 } ] },
    { min: 150, chance: 0.85, pool: [ { type: 'seed', id: 4, qty: 1 }, { type: 'seed', id: 3, qty: 2 }, { type: 'coin', amt: 120 } ] },
  ];

  for (const tier of tiers) {
    if (s >= tier.min && Math.random() < tier.chance) {
      const pick = tier.pool[Math.floor(Math.random() * tier.pool.length)];
      if (pick.type === 'seed') {
        bonusItems.push(pick);
      } else if (pick.type === 'coin') {
        bonusCoins += pick.amt;
      }
    }
  }

  const levelUpInfo = addExp(DEFAULT_USER_ID, exp);
  const totalCoins = coins + bonusCoins;

  let msgParts = [];
  msgParts.push(`基础奖励：${coins} 金币，${exp} 经验`);
  if (bonusCoins > 0) msgParts.push(`💰 额外金币 +${bonusCoins}`);

  try {
    db.transaction(() => {
      db.run('UPDATE users SET coins = coins + ? WHERE id = ?', [totalCoins, DEFAULT_USER_ID]);
      for (const bi of bonusItems) {
        addInventory(DEFAULT_USER_ID, 'seed', bi.id, bi.qty);
      }
    });
  } catch (e) {
    return res.status(500).json({ error: '奖励发放失败: ' + e.message });
  }

  const bonusText = bonusItems.map(b => {
    const crop = db.get('SELECT emoji, name FROM crops WHERE id = ?', [b.id]);
    return crop ? `${crop.emoji}${crop.name}种子 x${b.qty}` : '';
  }).filter(Boolean).join('、');
  if (bonusText) msgParts.push(`🎁 奖励物资：${bonusText}`);
  if (levelUpInfo.levelUp) msgParts.push(`🎉 升级到 Lv.${levelUpInfo.newLevel}！奖励 ${levelUpInfo.coinReward} 金币`);

  const user = db.get('SELECT coins FROM users WHERE id = ?', [DEFAULT_USER_ID]);
  res.json({
    success: true,
    message: msgParts.join('；'),
    coins: totalCoins,
    baseCoins: coins,
    bonusCoins,
    exp,
    levelUp: levelUpInfo.levelUp,
    newLevel: levelUpInfo.newLevel,
    coinReward: levelUpInfo.coinReward,
    bonusItems: bonusItems.map(b => {
      const crop = db.get('SELECT emoji, name FROM crops WHERE id = ?', [b.id]);
      return crop ? { ...b, emoji: crop.emoji, name: crop.name } : b;
    }),
    userCoins: user.coins,
  });
});

router.get('/animals-corrected', checkUser, (req, res) => {
  const pen = db.get('SELECT * FROM animal_pens WHERE user_id = ?', [DEFAULT_USER_ID]);
  const animalRows = db.all(`
    SELECT ua.id as instance_id, ua.animal_id, ua.pen_slot, ua.bought_at, ua.last_fed_at, ua.last_product_at, ua.hunger, ua.is_sick,
           a.name, a.emoji, a.baby_emoji, a.feed_interval, a.product_interval, a.product_amount,
           a.product_id, a.exp_reward, a.description,
           ap.name as product_name, ap.emoji as product_emoji, ap.sell_price as product_price
    FROM user_animals ua
    JOIN animals a ON ua.animal_id = a.id
    LEFT JOIN animal_products ap ON a.product_id = ap.id
    WHERE ua.user_id = ?
    ORDER BY ua.pen_slot
  `, [DEFAULT_USER_ID]);

  const now = Date.now();
  const animals = animalRows.map(a => {
    const boughtAt = a.bought_at || now;
    const ageMinutes = (now - boughtAt) / (1000 * 60);
    const isBaby = ageMinutes < 2;

    const lastFed = a.last_fed_at || now;
    const feedIntervalMs = a.feed_interval * 1000;
    const feedElapsed = now - lastFed;
    const needFeed = feedElapsed >= feedIntervalMs;
    const feedRemaining = Math.max(0, Math.ceil((feedIntervalMs - feedElapsed) / 1000));
    const hungerLevel = Math.min(100, Math.floor((feedElapsed / feedIntervalMs) * 100));

    const lastProd = a.last_product_at || now;
    const prodIntervalMs = a.product_interval * 1000;
    const prodElapsed = now - lastProd;
    const canCollect = prodElapsed >= prodIntervalMs && hungerLevel < 100 && !isBaby;
    const prodRemaining = Math.max(0, Math.ceil((prodIntervalMs - prodElapsed) / 1000));
    const prodProgress = Math.min(100, Math.floor((prodElapsed / prodIntervalMs) * 100));

    const displayEmoji = isBaby ? a.baby_emoji : a.emoji;
    const efficiency = hungerLevel >= 100 ? 0 : hungerLevel >= 60 ? 0.5 : 1;

    return {
      instanceId: a.instance_id,
      animalId: a.animal_id,
      name: a.name,
      emoji: displayEmoji,
      slot: a.pen_slot,
      isBaby,
      needFeed,
      feedRemaining,
      hungerLevel,
      canCollect,
      prodRemaining,
      prodProgress,
      productId: a.product_id,
      productName: a.product_name,
      productEmoji: a.product_emoji,
      productPrice: a.product_price,
      productAmount: a.product_amount,
      efficiency,
      isSick: !!a.is_sick,
      expReward: a.exp_reward,
      description: a.description,
    };
  });

  res.json({
    pen: {
      capacity: pen.capacity,
      level: pen.level,
      currentCount: animalRows.length,
      expandCost: PEN_EXPAND_COST(pen.capacity),
    },
    animals,
  });
});

router.get('/fish', (req, res) => {
  const fishes = db.all('SELECT * FROM fish ORDER BY id');
  res.json(fishes.map(f => ({
    id: f.id,
    name: f.name,
    emoji: f.emoji,
    rarity: f.rarity,
    sellPrice: f.sell_price,
    expReward: f.exp_reward,
    weightMin: f.weight_min,
    weightMax: f.weight_max,
    difficulty: f.difficulty,
    description: f.description,
  })));
});

router.get('/fishing/status', checkUser, (req, res) => {
  checkDailyReset(DEFAULT_USER_ID);
  const today = getTodayStr();
  const daily = db.get('SELECT * FROM daily_stats WHERE user_id = ? AND date = ?', [DEFAULT_USER_ID, today]);

  const recent = db.all(`
    SELECT uf.*, f.name, f.emoji, f.rarity, f.sell_price
    FROM user_fishing uf
    JOIN fish f ON uf.fish_id = f.id
    WHERE uf.user_id = ?
    ORDER BY uf.caught_at DESC
    LIMIT 10
  `, [DEFAULT_USER_ID]);

  res.json({
    daily: {
      fishingCount: daily ? daily.fishing_count : 0,
      fishingLimit: DAILY_FISHING_LIMIT,
      remaining: daily ? DAILY_FISHING_LIMIT - daily.fishing_count : DAILY_FISHING_LIMIT,
    },
    cost: FISHING_COST,
    recentCatches: recent.map(r => ({
      id: r.id,
      fishId: r.fish_id,
      name: r.name,
      emoji: r.emoji,
      rarity: r.rarity,
      weight: r.weight,
      sellPrice: r.sell_price,
      caughtAt: r.caught_at,
    })),
  });
});

const pickFishByAccuracy = (accuracy) => {
  const allFish = db.all('SELECT * FROM fish');
  const acc = Math.max(0, Math.min(1, accuracy));

  const weighted = allFish.map(f => {
    const diffFactor = 1 - Math.abs(f.difficulty - acc);
    const weight = Math.max(0.1, diffFactor) * (f.rarity === 'common' ? 3 : f.rarity === 'uncommon' ? 2 : f.rarity === 'rare' ? 1 : 0.5);
    return { fish: f, weight };
  });

  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  let random = Math.random() * totalWeight;

  for (const w of weighted) {
    random -= w.weight;
    if (random <= 0) return w.fish;
  }
  return weighted[0].fish;
};

router.post('/fishing/catch', checkUser, (req, res) => {
  const { accuracy } = req.body;
  const acc = accuracy == null ? 0.5 : Math.max(0, Math.min(1, parseFloat(accuracy)));

  checkDailyReset(DEFAULT_USER_ID);
  const today = getTodayStr();
  const daily = db.get('SELECT * FROM daily_stats WHERE user_id = ? AND date = ?', [DEFAULT_USER_ID, today]);

  if (daily && daily.fishing_count >= DAILY_FISHING_LIMIT) {
    return res.status(400).json({ error: `今日钓鱼次数已用完（${DAILY_FISHING_LIMIT}/${DAILY_FISHING_LIMIT}），明天再来吧！` });
  }

  if (req.user.coins < FISHING_COST) {
    return res.status(400).json({ error: `金币不足，钓鱼需要 ${FISHING_COST} 金币` });
  }

  const fish = pickFishByAccuracy(acc);
  const weight = +(fish.weight_min + Math.random() * (fish.weight_max - fish.weight_min)).toFixed(2);
  const now = Date.now();

  const qualityBonus = acc > 0.8 ? 1.5 : acc > 0.6 ? 1.2 : acc > 0.4 ? 1 : 0.8;
  const sellPrice = Math.floor(fish.sell_price * qualityBonus);
  const expReward = Math.floor(fish.exp_reward * qualityBonus);

  let levelUpInfo = null;

  db.transaction(() => {
    db.run('UPDATE users SET coins = coins - ? WHERE id = ?', [FISHING_COST, DEFAULT_USER_ID]);
    db.run('INSERT INTO user_fishing (user_id, fish_id, weight, caught_at) VALUES (?, ?, ?, ?)',
      [DEFAULT_USER_ID, fish.id, weight, now]);
    db.run('UPDATE daily_stats SET fishing_count = fishing_count + 1 WHERE user_id = ? AND date = ?',
      [DEFAULT_USER_ID, today]);
    addInventory(DEFAULT_USER_ID, 'fish', fish.id, 1);
    levelUpInfo = addExp(DEFAULT_USER_ID, expReward);
  });

  const quality = acc > 0.8 ? '完美' : acc > 0.6 ? '优秀' : acc > 0.4 ? '普通' : '勉强';
  const rarityText = { common: '普通', uncommon: '稀有', rare: '珍稀', epic: '传说' }[fish.rarity] || '普通';

  let msg = `🎣 钓到了 ${fish.emoji}${fish.name}（${rarityText}）！重量 ${weight}kg，品质：${quality}`;
  if (levelUpInfo.levelUp) msg += ` 🎉 升级到 Lv.${levelUpInfo.newLevel}！奖励 ${levelUpInfo.coinReward} 金币`;

  res.json({
    success: true,
    message: msg,
    fish: {
      id: fish.id,
      name: fish.name,
      emoji: fish.emoji,
      rarity: fish.rarity,
      rarityText,
      weight,
      sellPrice,
      expReward,
      quality,
      qualityBonus,
    },
    cost: FISHING_COST,
    exp: expReward,
    levelUp: levelUpInfo.levelUp,
    newLevel: levelUpInfo.newLevel,
    coinReward: levelUpInfo.coinReward,
    remaining: daily ? DAILY_FISHING_LIMIT - daily.fishing_count - 1 : DAILY_FISHING_LIMIT - 1,
  });
});

router.get('/offline-earnings', checkUser, (req, res) => {
  const now = Date.now();
  const lastLogin = req.user.last_login || req.user.created_at || now;
  const offlineSeconds = Math.floor((now - lastLogin) / 1000);

  const maxOfflineSeconds = 12 * 60 * 60;
  const effectiveSeconds = Math.min(offlineSeconds, maxOfflineSeconds);

  if (effectiveSeconds < 60) {
    return res.json({
      available: false,
      offlineSeconds,
      message: '离线时间太短，没有收益',
    });
  }

  let cropEarnings = 0;
  let cropExp = 0;
  let harvestedCrops = [];

  const plots = db.all(`
    SELECT p.*, c.sell_price, c.grow_time, c.exp_reward, c.name, c.emoji
    FROM plots p
    JOIN crops c ON p.crop_id = c.id
    WHERE p.user_id = ? AND p.crop_id IS NOT NULL AND p.is_harvested = 0
  `, [DEFAULT_USER_ID]);

  for (const plot of plots) {
    const planted = plot.planted_at || now;
    const growMs = plot.grow_time * 1000;
    const offlineElapsed = now - planted;

    if (offlineElapsed >= growMs) {
      const yieldBonus = plot.water_count > 0 ? 1 : DRY_PENALTY;
      const coins = Math.floor(plot.sell_price * yieldBonus);
      const exp = plot.exp_reward;
      cropEarnings += coins;
      cropExp += exp;
      harvestedCrops.push({
        plotIndex: plot.plot_index,
        cropId: plot.crop_id,
        name: plot.name,
        emoji: plot.emoji,
        coins,
        exp,
      });
    }
  }

  let productEarnings = 0;
  let productExp = 0;
  let collectedProducts = [];

  const animals = db.all(`
    SELECT ua.*, a.product_interval, a.product_amount, a.exp_reward,
           ap.name as product_name, ap.emoji as product_emoji, ap.sell_price as product_price
    FROM user_animals ua
    JOIN animals a ON ua.animal_id = a.id
    JOIN animal_products ap ON a.product_id = ap.id
    WHERE ua.user_id = ?
  `, [DEFAULT_USER_ID]);

  for (const animal of animals) {
    const lastProd = animal.last_product_at || animal.bought_at || now;
    const prodIntervalMs = animal.product_interval * 1000;
    const timeSinceLastProd = now - lastProd;

    if (timeSinceLastProd >= prodIntervalMs) {
      const cycles = Math.floor(timeSinceLastProd / prodIntervalMs);
      const maxCycles = Math.floor(effectiveSeconds * 1000 / prodIntervalMs);
      const actualCycles = Math.min(cycles, maxCycles, 10);

      if (actualCycles > 0) {
        const amount = actualCycles * animal.product_amount;
        const coins = amount * animal.product_price;
        const exp = actualCycles * animal.exp_reward;
        productEarnings += coins;
        productExp += exp;
        collectedProducts.push({
          instanceId: animal.id,
          productName: animal.product_name,
          productEmoji: animal.product_emoji,
          amount,
          coins,
          exp,
          cycles: actualCycles,
        });
      }
    }
  }

  const totalCoins = cropEarnings + productEarnings;
  const totalExp = cropExp + productExp;

  const waterRegen = Math.floor(effectiveSeconds / (WATER_REGEN_INTERVAL / 1000));
  const actualWaterRegen = Math.min(waterRegen, WATER_MAX - req.user.water);

  res.json({
    available: totalCoins > 0 || totalExp > 0 || actualWaterRegen > 0,
    offlineSeconds: effectiveSeconds,
    offlineText: formatDuration(effectiveSeconds),
    totalCoins,
    totalExp,
    waterRegen: actualWaterRegen,
    crops: {
      coins: cropEarnings,
      exp: cropExp,
      harvested: harvestedCrops,
    },
    products: {
      coins: productEarnings,
      exp: productExp,
      collected: collectedProducts,
    },
  });
});

const formatDuration = (seconds) => {
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
};

router.post('/offline-earnings/claim', checkUser, (req, res) => {
  const now = Date.now();
  const lastLogin = req.user.last_login || req.user.created_at || now;
  const offlineSeconds = Math.floor((now - lastLogin) / 1000);

  const maxOfflineSeconds = 12 * 60 * 60;
  const effectiveSeconds = Math.min(offlineSeconds, maxOfflineSeconds);

  if (effectiveSeconds < 60) {
    return res.status(400).json({ error: '离线时间太短，没有可领取的收益' });
  }

  let cropEarnings = 0;
  let cropExp = 0;
  let harvestedCount = 0;

  const plots = db.all(`
    SELECT p.*, c.sell_price, c.grow_time, c.exp_reward, c.name
    FROM plots p
    JOIN crops c ON p.crop_id = c.id
    WHERE p.user_id = ? AND p.crop_id IS NOT NULL AND p.is_harvested = 0
  `, [DEFAULT_USER_ID]);

  for (const plot of plots) {
    const planted = plot.planted_at || now;
    const growMs = plot.grow_time * 1000;
    const offlineElapsed = now - planted;

    if (offlineElapsed >= growMs) {
      const yieldBonus = plot.water_count > 0 ? 1 : DRY_PENALTY;
      const coins = Math.floor(plot.sell_price * yieldBonus);
      const exp = plot.exp_reward;
      cropEarnings += coins;
      cropExp += exp;
      harvestedCount++;
    }
  }

  let productEarnings = 0;
  let productExp = 0;
  let productAmounts = {};

  const animals = db.all(`
    SELECT ua.*, a.product_interval, a.product_amount, a.product_id, a.exp_reward,
           ap.sell_price as product_price
    FROM user_animals ua
    JOIN animals a ON ua.animal_id = a.id
    JOIN animal_products ap ON a.product_id = ap.id
    WHERE ua.user_id = ?
  `, [DEFAULT_USER_ID]);

  for (const animal of animals) {
    const lastProd = animal.last_product_at || animal.bought_at || now;
    const prodIntervalMs = animal.product_interval * 1000;
    const timeSinceLastProd = now - lastProd;

    if (timeSinceLastProd >= prodIntervalMs) {
      const cycles = Math.floor(timeSinceLastProd / prodIntervalMs);
      const maxCycles = Math.floor(effectiveSeconds / (animal.product_interval));
      const actualCycles = Math.min(cycles, maxCycles, 10);

      if (actualCycles > 0) {
        const amount = actualCycles * animal.product_amount;
        const coins = amount * animal.product_price;
        const exp = actualCycles * animal.exp_reward;
        productEarnings += coins;
        productExp += exp;

        if (!productAmounts[animal.product_id]) {
          productAmounts[animal.product_id] = 0;
        }
        productAmounts[animal.product_id] += amount;
      }
    }
  }

  const totalCoins = cropEarnings + productEarnings;
  const totalExp = cropExp + productExp;

  if (totalCoins <= 0 && totalExp <= 0) {
    return res.status(400).json({ error: '没有可领取的离线收益' });
  }

  let levelUpInfo = null;

  db.transaction(() => {
    db.run('UPDATE users SET coins = coins + ?, last_login = ? WHERE id = ?',
      [totalCoins, now, DEFAULT_USER_ID]);
    levelUpInfo = addExp(DEFAULT_USER_ID, totalExp);

    for (const plot of plots) {
      const planted = plot.planted_at || now;
      const growMs = plot.grow_time * 1000;
      if (now - planted >= growMs) {
        addInventory(DEFAULT_USER_ID, 'crop', plot.crop_id, 1);
        db.run('UPDATE plots SET is_harvested = 1 WHERE id = ?', [plot.id]);
      }
    }

    for (const animal of animals) {
      const lastProd = animal.last_product_at || animal.bought_at || now;
      const prodIntervalMs = animal.product_interval * 1000;
      if (now - lastProd >= prodIntervalMs) {
        db.run('UPDATE user_animals SET last_product_at = ? WHERE id = ?', [now, animal.id]);
      }
    }

    for (const [prodId, qty] of Object.entries(productAmounts)) {
      addInventory(DEFAULT_USER_ID, 'animal_product', parseInt(prodId), qty);
    }
  });

  let msg = `📦 离线收益已领取：${totalCoins} 金币，${totalExp} 经验`;
  if (harvestedCount > 0) msg += `，收获 ${harvestedCount} 块作物`;
  if (levelUpInfo.levelUp) msg += ` 🎉 升级到 Lv.${levelUpInfo.newLevel}！奖励 ${levelUpInfo.coinReward} 金币`;

  res.json({
    success: true,
    message: msg,
    totalCoins,
    totalExp,
    harvestedCount,
    levelUp: levelUpInfo.levelUp,
    newLevel: levelUpInfo.newLevel,
    coinReward: levelUpInfo.coinReward,
    offlineTime: formatDuration(effectiveSeconds),
  });
});

module.exports = router;
