<template>
  <el-dialog
    v-model="visible"
    title="🎮 小游戏中心"
    width="600px"
    :close-on-click-modal="false"
    center
    destroy-on-close
  >
    <div v-if="currentGame === 'select'" class="game-select">
      <p class="select-tip">选择一个小游戏来玩吧！</p>
      <div class="game-list">
        <div class="game-card" @click="selectGame('fruit')">
          <div class="game-icon">🍎</div>
          <div class="game-info">
            <div class="game-name">抓水果</div>
            <div class="game-desc">点击水果得分，小心炸弹！</div>
            <el-tag size="small" type="success">经典玩法</el-tag>
          </div>
        </div>

        <div class="game-card" @click="selectGame('fishing')">
          <div class="game-icon">🎣</div>
          <div class="game-info">
            <div class="game-name">钓鱼</div>
            <div class="game-desc">看准时机收杆，越准鱼越好！</div>
            <el-tag size="small" type="warning">每日限{{ dailyFishingLimit }}次</el-tag>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="currentGame === 'fruit'" class="game-wrapper">
      <div class="game-header-bar">
        <el-button text @click="backToSelect">
          <el-icon><ArrowLeft /></el-icon> 返回
        </el-button>
        <span class="game-title">🍎 抓水果小游戏</span>
        <span></span>
      </div>

      <div class="game-container">
        <div class="game-header">
          <div class="score-box">
            <span>得分: <b>{{ score }}</b></span>
            <span>⏱ {{ timeLeft }}s</span>
            <span>难度:
              <b :class="difficultyClass">{{ difficultyText }}</b>
            </span>
          </div>
          <div class="rule-box" v-if="!playing && !gameOver">
            <el-alert type="info" :closable="false" show-icon>
              <div class="rule-content">
                <span>点击<span style="color:#67c23a;"><b>水果</b></span>得{{ difficulty === 'easy' ? 8 : difficulty === 'hard' ? 12 : 10 }}分</span>
                <span>点到<span style="color:#f56c6c;"><b>炸弹</b></span>扣5分</span>
                <span>高分可解锁物资奖励！</span>
              </div>
            </el-alert>
            <div class="difficulty-row" v-if="!playing && !gameOver">
              <span class="diff-label">选择难度：</span>
              <el-radio-group v-model="difficulty" size="default">
                <el-radio-button value="easy">😊 简单</el-radio-button>
                <el-radio-button value="normal">🙂 普通</el-radio-button>
                <el-radio-button value="hard">😤 困难</el-radio-button>
              </el-radio-group>
            </div>
            <div class="reward-table" v-if="!playing && !gameOver">
              <div class="row row-header">
                <span>分数段</span><span>奖励倍率</span><span>额外掉落</span>
              </div>
              <div class="row"><span>≥ 30分</span><span>简单×0.8 / 普通×1 / 困难×1.5</span><span>45%概率种子/金币</span></div>
              <div class="row"><span>≥ 80分</span><span>同上</span><span>65%概率高级种子/金币</span></div>
              <div class="row"><span>≥ 150分</span><span>同上</span><span>85%概率稀有种子/大量金币</span></div>
            </div>
          </div>
        </div>

        <div class="game-area" @click="onAreaClick">
          <div v-if="!playing && !gameOver" class="start-screen">
            <div class="title">🎯</div>
            <el-button type="primary" size="large" @click="startGame">
              开始游戏
            </el-button>
          </div>
          <div v-else-if="gameOver" class="end-screen">
            <div class="big-score">最终得分</div>
            <div class="score-num">{{ score }}</div>
            <div class="reward-info" v-if="rewardData">
              <div class="line base">💰 金币奖励: <b>+{{ rewardData.coins }}</b> (基础 {{ rewardData.baseCoins }}<span v-if="rewardData.bonusCoins"> + 额外{{ rewardData.bonusCoins }}</span>)</div>
              <div class="line base">⭐ 经验奖励: <b>+{{ rewardData.exp }}</b></div>
              <div class="line bonus" v-if="rewardData.bonusItems && rewardData.bonusItems.length">
                🎁 物资奖励：
                <span v-for="b in rewardData.bonusItems" :key="b.id" class="bonus-item">
                  {{ b.emoji || '🎁' }}{{ b.name }} ×{{ b.qty }}
                </span>
              </div>
              <div class="line lvl" v-if="rewardData.levelUp">🎉 恭喜升级至 <b>Lv.{{ rewardData.newLevel }}</b></div>
            </div>
            <div class="end-btns">
              <el-button type="success" size="large" @click="claimReward" v-if="!rewardClaimed">
                领取奖励
              </el-button>
              <el-button type="primary" size="large" @click="restartGame">
                {{ rewardClaimed ? '再来一局' : '放弃奖励，重新开始' }}
              </el-button>
            </div>
          </div>
          <div v-else class="playing-screen">
            <transition-group name="pop" tag="div" class="targets">
              <div
                v-for="t in targets"
                :key="t.id"
                class="target"
                :style="{
                  left: t.x + '%', top: t.y + '%',
                  fontSize: t.size + 'px'
                }"
                :class="{ bomb: t.bomb }"
                @click.stop="onTargetClick(t)"
              >
                {{ t.bomb ? '💣' : t.emoji }}
              </div>
            </transition-group>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="currentGame === 'fishing'" class="game-wrapper">
      <div class="game-header-bar">
        <el-button text @click="backToSelect">
          <el-icon><ArrowLeft /></el-icon> 返回
        </el-button>
        <span class="game-title">🎣 钓鱼小游戏</span>
        <span></span>
      </div>
      <FishingGame
        :user-coins="userCoins"
        @back="backToSelect"
        @caught="handleFishingCaught"
        @update:user-coins="val => userCoins = val"
      />
    </div>

    <template #footer>
      <el-button @click="close">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { claimMiniGameReward } from '../api.js'
import FishingGame from './FishingGame.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  userCoins: { type: Number, default: 0 },
  dailyFishingLimit: { type: Number, default: 10 },
})
const emit = defineEmits(['update:visible', 'reward', 'update:userCoins'])

const visible = computed({
  get: () => props.visible,
  set: v => emit('update:visible', v),
})

const currentGame = ref('select')

const selectGame = (game) => {
  currentGame.value = game
}

const backToSelect = () => {
  currentGame.value = 'select'
}

const FRUITS = ['🍎', '🍊', '🍋', '🍉', '🍇', '🍓', '🍑', '🥝', '🍒', '🍌', '🥭', '🍍']

const score = ref(0)
const timeLeft = ref(30)
const playing = ref(false)
const gameOver = ref(false)
const targets = ref([])
const difficulty = ref('normal')
const rewardData = ref(null)
const rewardClaimed = ref(false)

const difficultyText = computed(() => ({ easy: '简单', normal: '普通', hard: '困难' }[difficulty.value] || '普通'))
const difficultyClass = computed(() => ({ easy: 'diff-easy', normal: 'diff-normal', hard: 'diff-hard' }[difficulty.value]))
const diffConfig = computed(() => ({
  easy:   { spawn: 1100, life: 2400, bombRate: 0.14, scorePerHit: 8,  size: [40, 54] },
  normal: { spawn: 780,  life: 1800, bombRate: 0.20, scorePerHit: 10, size: [38, 52] },
  hard:   { spawn: 520,  life: 1300, bombRate: 0.28, scorePerHit: 12, size: [34, 48] },
}[difficulty.value]))

let timeTimer = null
let spawnTimer = null
let targetId = 0

const startGame = () => {
  score.value = 0
  timeLeft.value = 30
  playing.value = true
  gameOver.value = false
  targets.value = []
  rewardData.value = null
  rewardClaimed.value = false

  clearTimers()

  timeTimer = setInterval(() => {
    timeLeft.value--
    if (timeLeft.value <= 0) endGame()
  }, 1000)

  const spawn = () => {
    if (!playing.value) return
    const cfg = diffConfig.value
    const isBomb = Math.random() < cfg.bombRate
    const [minS, maxS] = cfg.size
    targets.value.push({
      id: ++targetId,
      x: 8 + Math.random() * 80,
      y: 8 + Math.random() * 75,
      emoji: FRUITS[Math.floor(Math.random() * FRUITS.length)],
      bomb: isBomb,
      size: Math.floor(minS + Math.random() * (maxS - minS)),
    })
    const curId = targetId
    setTimeout(() => {
      targets.value = targets.value.filter(t => t.id !== curId)
    }, cfg.life)
  }
  spawn()
  spawnTimer = setInterval(spawn, diffConfig.value.spawn)
}

const onTargetClick = (t) => {
  if (t.bomb) {
    score.value = Math.max(0, score.value - 5)
  } else {
    score.value += diffConfig.value.scorePerHit
  }
  targets.value = targets.value.filter(x => x.id !== t.id)
}
const onAreaClick = () => {}

const endGame = () => {
  playing.value = false
  gameOver.value = true
  clearTimers()
  targets.value = []
}
const clearTimers = () => {
  if (timeTimer) clearInterval(timeTimer)
  if (spawnTimer) clearInterval(spawnTimer)
  timeTimer = spawnTimer = null
}
const claimReward = async () => {
  try {
    const res = await claimMiniGameReward(score.value, difficulty.value)
    rewardData.value = res
    rewardClaimed.value = true
    ElMessage.success(res.message)
    emit('reward', { score: score.value, data: res })
  } catch (e) {
    ElMessage.error(e.message)
  }
}
const restartGame = () => {
  rewardData.value = null
  rewardClaimed.value = false
  startGame()
}

const handleFishingCaught = (res) => {
  emit('reward', { type: 'fishing', data: res })
}

const close = () => {
  clearTimers()
  playing.value = false
  gameOver.value = false
  currentGame.value = 'select'
  visible.value = false
}

watch(visible, v => {
  if (v) {
    currentGame.value = 'select'
    score.value = 0
    gameOver.value = false
    playing.value = false
    targets.value = []
    rewardData.value = null
    rewardClaimed.value = false
  } else {
    clearTimers()
  }
})

onBeforeUnmount(() => clearTimers())
</script>

<style scoped>
.game-select {
  padding: 10px 0;
}

.select-tip {
  text-align: center;
  color: #666;
  margin-bottom: 20px;
  font-size: 15px;
}

.game-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.game-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: linear-gradient(135deg, #f5f7fa, #e8ecf1);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s;
  border: 2px solid transparent;
}

.game-card:hover {
  transform: translateY(-2px);
  border-color: #409eff;
  box-shadow: 0 8px 24px rgba(64, 158, 255, 0.2);
}

.game-icon {
  font-size: 56px;
  line-height: 1;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.15));
}

.game-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.game-name {
  font-size: 20px;
  font-weight: bold;
  color: #333;
}

.game-desc {
  font-size: 14px;
  color: #888;
}

.game-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.game-header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 4px;
}

.game-title {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.game-container { padding: 4px; }
.game-header { margin-bottom: 14px; }
.score-box {
  display: flex;
  justify-content: space-around;
  align-items: center;
  font-size: 16px;
  padding: 10px;
  background: linear-gradient(135deg, #fff3e0, #ffe0b2);
  border-radius: 12px;
  margin-bottom: 12px;
}
.score-box b { color: #e65100; font-size: 20px; }
.score-box .diff-easy { color: #43a047; }
.score-box .diff-normal { color: #1e88e5; }
.score-box .diff-hard { color: #e53935; }
.rule-box { margin: 0 6px; }
.rule-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  line-height: 1.6;
}
.difficulty-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 12px 0 8px;
  flex-wrap: wrap;
}
.diff-label { font-size: 14px; font-weight: bold; }
.reward-table {
  margin-top: 10px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  font-size: 12px;
}
.reward-table .row {
  display: grid;
  grid-template-columns: 90px 1fr 1fr;
  padding: 6px 10px;
  background: #fafafa;
  border-bottom: 1px solid #e5e7eb;
}
.reward-table .row:last-child { border-bottom: none; }
.reward-table .row-header {
  background: linear-gradient(135deg, #1976d2, #2196f3);
  color: #fff;
  font-weight: bold;
}
.game-area {
  position: relative;
  height: 360px;
  background: linear-gradient(180deg, #e8f5e9 0%, #c8e6c9 100%);
  border-radius: 16px;
  border: 3px solid #a5d6a7;
  overflow: hidden;
  user-select: none;
}
.start-screen, .end-screen {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 20px;
}
.start-screen .title { font-size: 80px; }
.big-score { font-size: 20px; color: #666; }
.score-num {
  font-size: 64px;
  font-weight: bold;
  color: #f57c00;
  line-height: 1;
}
.reward-info {
  background: #fff;
  padding: 14px 20px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 2;
  text-align: center;
  width: 90%;
  max-width: 420px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}
.reward-info .line { text-align: left; }
.reward-info .line.base b { color: #f57c00; }
.reward-info .line.bonus { color: #2e7d32; background: #e8f5e9; padding: 4px 10px; border-radius: 6px; }
.reward-info .line.bonus b { color: #1b5e20; }
.reward-info .line.lvl { color: #c62828; font-weight: bold; background: #ffebee; padding: 4px 10px; border-radius: 6px; text-align: center; }
.bonus-item {
  display: inline-block;
  margin: 0 6px;
  background: #fff3e0;
  padding: 2px 8px;
  border-radius: 6px;
}
.end-btns { display: flex; gap: 12px; }
.playing-screen { position: relative; width: 100%; height: 100%; }
.targets { position: absolute; inset: 0; }
.target {
  position: absolute;
  cursor: pointer;
  transform: translate(-50%, -50%);
  animation: appear 0.25s ease-out;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
}
.target:hover { transform: translate(-50%, -50%) scale(1.15); }
.target.bomb { animation: appear 0.25s ease-out, shake 0.5s infinite; }

@keyframes appear {
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
@keyframes shake {
  0%, 100% { transform: translate(-50%, -50%) rotate(-3deg); }
  50% { transform: translate(-50%, -50%) rotate(3deg); }
}
.pop-enter-active { transition: all 0.2s ease-out; }
.pop-leave-active { transition: all 0.15s ease-in; }
.pop-leave-to { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
</style>
