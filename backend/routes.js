const express = require('express');
const router = express.Router();
const db = require('./database');

const DEFAULT_USER_ID = 1;
const EXP_PER_LEVEL = 100;
const DRY_PENALTY = 0.5;
const WATER_MAX = 20;
const WATER_REGEN_INTERVAL = 60000;

const expToLevel = (exp) => Math.floor(exp / EXP_PER_LEVEL) + 1;

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

  const newExp = req.user.exp + expEarned;
  const newLevel = expToLevel(newExp);
  const levelUp = newLevel > req.user.level;

  let rewardMsg = '';
  if (levelUp) rewardMsg = `🎉 恭喜升级到 Lv.${newLevel}！`;

  db.transaction(() => {
    db.run(
      'UPDATE users SET coins = coins + ?, exp = ?, level = ? WHERE id = ?',
      [coinsEarned, newExp, newLevel, DEFAULT_USER_ID]
    );
    db.run(
      'UPDATE plots SET is_harvested = 1 WHERE user_id = ? AND plot_index = ?',
      [DEFAULT_USER_ID, plotIndex]
    );
  });

  res.json({
    success: true,
    message: `收获成功！获得 ${coinsEarned} 金币，${expEarned} 经验。${rewardMsg}`,
    coins: coinsEarned,
    exp: expEarned,
    yieldBonus,
    levelUp,
    newLevel,
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
    SELECT i.*, c.name as item_name, c.emoji, c.seed_price, c.sell_price, c.grow_time, c.exp_reward, c.description
    FROM inventory i
    LEFT JOIN crops c ON i.item_id = c.id AND i.item_type = 'seed'
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
  })));
});

router.get('/shop', checkUser, (req, res) => {
  const items = db.all('SELECT * FROM crops ORDER BY id');
  res.json(items.map(c => ({
    id: c.id,
    type: 'seed',
    name: c.name,
    emoji: c.emoji,
    price: c.seed_price,
    growTime: c.grow_time,
    sellPrice: c.sell_price,
    expReward: c.exp_reward,
    description: c.description,
  })));
});

router.post('/shop/buy', checkUser, (req, res) => {
  const { cropId, quantity = 1 } = req.body;
  if (!cropId || quantity < 1) return res.status(400).json({ error: '参数错误' });

  const crop = db.get('SELECT * FROM crops WHERE id = ?', [cropId]);
  if (!crop) return res.status(404).json({ error: '商品不存在' });

  const totalCost = crop.seed_price * quantity;
  if (req.user.coins < totalCost) return res.status(400).json({ error: '金币不足' });

  db.transaction(() => {
    db.run('UPDATE users SET coins = coins - ? WHERE id = ?', [totalCost, DEFAULT_USER_ID]);
    const existing = db.get(
      'SELECT id FROM inventory WHERE user_id = ? AND item_type = ? AND item_id = ?',
      [DEFAULT_USER_ID, 'seed', cropId]
    );
    if (existing) {
      db.run(
        'UPDATE inventory SET quantity = quantity + ? WHERE id = ?',
        [quantity, existing.id]
      );
    } else {
      db.run(
        'INSERT INTO inventory (user_id, item_type, item_id, quantity) VALUES (?, ?, ?, ?)',
        [DEFAULT_USER_ID, 'seed', cropId, quantity]
      );
    }
  });

  const user = db.get('SELECT coins FROM users WHERE id = ?', [DEFAULT_USER_ID]);
  res.json({
    success: true,
    message: `购买成功！获得 ${quantity} 个${crop.name}种子`,
    coins: user.coins,
    quantity,
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

  const newExp = req.user.exp + exp;
  const newLevel = expToLevel(newExp);
  const levelUp = newLevel > req.user.level;
  const totalCoins = coins + bonusCoins;

  let msgParts = [];
  msgParts.push(`基础奖励：${coins} 金币，${exp} 经验`);
  if (bonusCoins > 0) msgParts.push(`💰 额外金币 +${bonusCoins}`);

  try {
    db.transaction(() => {
      db.run(
        'UPDATE users SET coins = coins + ?, exp = ?, level = ? WHERE id = ?',
        [totalCoins, newExp, newLevel, DEFAULT_USER_ID]
      );
      for (const bi of bonusItems) {
        const existing = db.get(
          'SELECT id FROM inventory WHERE user_id = ? AND item_type = ? AND item_id = ?',
          [DEFAULT_USER_ID, 'seed', bi.id]
        );
        if (existing) {
          db.run('UPDATE inventory SET quantity = quantity + ? WHERE id = ?', [bi.qty, existing.id]);
        } else {
          db.run(
            'INSERT INTO inventory (user_id, item_type, item_id, quantity) VALUES (?, ?, ?, ?)',
            [DEFAULT_USER_ID, 'seed', bi.id, bi.qty]
          );
        }
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
  if (levelUp) msgParts.push(`🎉 升级到 Lv.${newLevel}！`);

  const user = db.get('SELECT coins FROM users WHERE id = ?', [DEFAULT_USER_ID]);
  res.json({
    success: true,
    message: msgParts.join('；'),
    coins: totalCoins,
    baseCoins: coins,
    bonusCoins,
    exp,
    levelUp,
    newLevel,
    bonusItems: bonusItems.map(b => {
      const crop = db.get('SELECT emoji, name FROM crops WHERE id = ?', [b.id]);
      return crop ? { ...b, emoji: crop.emoji, name: crop.name } : b;
    }),
    userCoins: user.coins,
  });
});

module.exports = router;
