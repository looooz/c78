<template>
  <div class="fishing-game">
    <div class="game-header">
      <div class="header-left">
        <span class="title">🎣 钓鱼</span>
        <el-tag type="info" size="small">
          今日剩余: {{ remainingCount }}/{{ fishingLimit }}
        </el-tag>
      </div>
      <div class="header-right">
        <span class="coins">💰 {{ userCoins }}</span>
        <el-tag type="warning" size="small">每次 {{ fishingCost }} 金币</el-tag>
      </div>
    </div>

    <div class="game-area">
      <div class="water-bg">
        <div class="water-waves"></div>
        <div class="fish-preview" v-if="showFishPreview">
          <span class="fish-emoji">{{ currentFish?.emoji || '🐟' }}</span>
        </div>
      </div>

      <div class="fishing-rod">
        <div class="rod-line"></div>
        <div class="rod-hook">🪝</div>
      </div>

      <div class="progress-container">
        <div class="progress-bar">
          <div class="bar-bg"></div>
          <div class="sweet-spot" :style="sweetSpotStyle"></div>
          <div class="indicator" :style="indicatorStyle"></div>
          <div class="markers">
            <span class="marker left">0%</span>
            <span class="marker center">完美</span>
            <span class="marker right">100%</span>
          </div>
        </div>
      </div>

      <div class="action-area">
        <div v-if="gameState === 'idle'" class="idle-screen">
          <p class="tip">💡 按下按钮时，指针越靠近绿色区域中心，钓到的鱼越好！</p>
          <el-button
            type="primary"
            size="large"
            :disabled="remainingCount <= 0 || userCoins < fishingCost"
            @click="startFishing"
          >
            {{ remainingCount <= 0 ? '今日次数已用完' : userCoins < fishingCost ? '金币不足' : '开始钓鱼' }}
          </el-button>
        </div>

        <div v-else-if="gameState === 'casting'" class="casting-screen">
          <p class="casting-text">🎣 抛竿中...</p>
          <div class="loading-dots">
            <span></span><span></span><span></span>
          </div>
        </div>

        <div v-else-if="gameState === 'waiting'" class="waiting-screen">
          <p class="waiting-text">🐟 鱼儿正在靠近...</p>
          <p class="hint-text">看准时机，按下「收杆」按钮！</p>
          <el-button
            type="success"
            size="large"
            class="catch-btn"
            @click="catchFish"
          >
            🎯 收杆！
          </el-button>
        </div>

        <div v-else-if="gameState === 'result'" class="result-screen">
          <div class="result-card" :class="resultRarityClass">
            <div class="result-emoji">{{ catchResult?.fish?.emoji }}</div>
            <div class="result-name">{{ catchResult?.fish?.name }}</div>
            <div class="result-rarity">
              <el-tag :type="rarityTagType" size="small">
                {{ catchResult?.fish?.rarityText }}
              </el-tag>
            </div>
            <div class="result-stats">
              <div class="stat">
                <span class="stat-label">重量</span>
                <span class="stat-value">{{ catchResult?.fish?.weight }}kg</span>
              </div>
              <div class="stat">
                <span class="stat-label">品质</span>
                <span class="stat-value">{{ catchResult?.fish?.quality }}</span>
              </div>
              <div class="stat">
                <span class="stat-label">售价</span>
                <span class="stat-value">💰 {{ catchResult?.fish?.sellPrice }}</span>
              </div>
              <div class="stat">
                <span class="stat-label">经验</span>
                <span class="stat-value">⭐ {{ catchResult?.fish?.expReward }}</span>
              </div>
            </div>
            <div class="accuracy-info">
              <span>精准度: {{ (accuracy * 100).toFixed(0) }}%</span>
              <div class="accuracy-bar">
                <div class="accuracy-fill" :style="{ width: (accuracy * 100) + '%' }"></div>
              </div>
            </div>
          </div>

          <div class="result-actions">
            <el-button type="primary" size="large" @click="resetGame">
              再钓一次
            </el-button>
            <el-button @click="$emit('back')">
              返回
            </el-button>
          </div>

          <div v-if="catchResult?.levelUp" class="level-up-notice">
            🎉 升级到 Lv.{{ catchResult.newLevel }}！奖励 {{ catchResult.coinReward }} 金币
          </div>
        </div>
      </div>
    </div>

    <div class="recent-catches" v-if="recentCatches.length > 0">
      <div class="section-title">最近收获</div>
      <div class="catch-list">
        <div v-for="c in recentCatches.slice(0, 5)" :key="c.id" class="catch-item">
          <span class="catch-emoji">{{ c.emoji }}</span>
          <span class="catch-name">{{ c.name }}</span>
          <el-tag :type="getRarityTagType(c.rarity)" size="mini">
            {{ getRarityText(c.rarity) }}
          </el-tag>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { getFishingStatus, catchFish as apiCatchFish } from '../api.js'

const props = defineProps({
  userCoins: { type: Number, default: 0 },
})

const emit = defineEmits(['back', 'caught', 'update:userCoins'])

const gameState = ref('idle')
const indicatorPosition = ref(0)
const direction = ref(1)
const speed = ref(1.5)
const sweetSpotStart = ref(35)
const sweetSpotWidth = ref(30)
const accuracy = ref(0)
const catchResult = ref(null)
const remainingCount = ref(10)
const fishingLimit = ref(10)
const fishingCost = ref(10)
const recentCatches = ref([])
const showFishPreview = ref(false)
const currentFish = ref(null)

let animationId = null
let waitTimer = null

const sweetSpotStyle = computed(() => ({
  left: sweetSpotStart.value + '%',
  width: sweetSpotWidth.value + '%',
}))

const indicatorStyle = computed(() => ({
  left: indicatorPosition.value + '%',
}))

const resultRarityClass = computed(() => {
  const rarity = catchResult.value?.fish?.rarity
  return {
    'rarity-common': rarity === 'common',
    'rarity-uncommon': rarity === 'uncommon',
    'rarity-rare': rarity === 'rare',
    'rarity-epic': rarity === 'epic',
  }
})

const rarityTagType = computed(() => {
  return getRarityTagType(catchResult.value?.fish?.rarity)
})

const getRarityTagType = (rarity) => {
  const types = {
    common: 'info',
    uncommon: 'success',
    rare: 'warning',
    epic: 'danger',
  }
  return types[rarity] || 'info'
}

const getRarityText = (rarity) => {
  const texts = {
    common: '普通',
    uncommon: '稀有',
    rare: '珍稀',
    epic: '传说',
  }
  return texts[rarity] || '普通'
}

const loadStatus = async () => {
  try {
    const res = await getFishingStatus()
    remainingCount.value = res.daily.remaining
    fishingLimit.value = res.daily.fishingLimit
    fishingCost.value = res.cost
    recentCatches.value = res.recentCatches || []
  } catch (e) {
    ElMessage.error(e.message)
  }
}

const startFishing = () => {
  if (remainingCount.value <= 0) {
    ElMessage.warning('今日钓鱼次数已用完，明天再来吧！')
    return
  }
  if (props.userCoins < fishingCost.value) {
    ElMessage.warning('金币不足！')
    return
  }

  gameState.value = 'casting'
  showFishPreview.value = false

  sweetSpotStart.value = 20 + Math.random() * 50
  sweetSpotWidth.value = 20 + Math.random() * 20
  speed.value = 1 + Math.random() * 1.5

  setTimeout(() => {
    gameState.value = 'waiting'
    startIndicator()
  }, 1000)
}

const startIndicator = () => {
  indicatorPosition.value = 0
  direction.value = 1

  const animate = () => {
    if (gameState.value !== 'waiting') return

    indicatorPosition.value += direction.value * speed.value

    if (indicatorPosition.value >= 100) {
      indicatorPosition.value = 100
      direction.value = -1
    } else if (indicatorPosition.value <= 0) {
      indicatorPosition.value = 0
      direction.value = 1
    }

    animationId = requestAnimationFrame(animate)
  }

  animationId = requestAnimationFrame(animate)
}

const stopIndicator = () => {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
}

const calculateAccuracy = () => {
  const pos = indicatorPosition.value
  const spotCenter = sweetSpotStart.value + sweetSpotWidth.value / 2
  const spotHalfWidth = sweetSpotWidth.value / 2

  const distance = Math.abs(pos - spotCenter)

  if (distance <= spotHalfWidth) {
    const ratio = distance / spotHalfWidth
    return Math.max(0.4, 1 - 0.6 * ratio * ratio)
  } else {
    const outDistance = distance - spotHalfWidth
    const outMax = Math.max(spotHalfWidth * 2, 30)
    const outRatio = Math.min(1, outDistance / outMax)
    return Math.max(0.05, 0.4 * (1 - outRatio * outRatio))
  }
}

const catchFish = async () => {
  stopIndicator()

  accuracy.value = calculateAccuracy()

  gameState.value = 'casting'
  showFishPreview.value = true

  try {
    const res = await apiCatchFish(accuracy.value)
    catchResult.value = res
    remainingCount.value = res.remaining
    currentFish.value = res.fish

    emit('caught', res)
    emit('update:userCoins', props.userCoins - fishingCost.value + res.fish.sellPrice)

    recentCatches.value.unshift({
      id: Date.now(),
      emoji: res.fish.emoji,
      name: res.fish.name,
      rarity: res.fish.rarity,
    })

    gameState.value = 'result'

    if (res.levelUp) {
      ElMessage({
        type: 'success',
        message: `🎉 升级到 Lv.${res.newLevel}！奖励 ${res.coinReward} 金币`,
        duration: 3000,
      })
    }
  } catch (e) {
    ElMessage.error(e.message)
    gameState.value = 'idle'
    showFishPreview.value = false
  }
}

const resetGame = () => {
  catchResult.value = null
  currentFish.value = null
  showFishPreview.value = false
  accuracy.value = 0
  gameState.value = 'idle'
}

onMounted(() => {
  loadStatus()
})

onBeforeUnmount(() => {
  stopIndicator()
  if (waitTimer) clearTimeout(waitTimer)
})
</script>

<style scoped>
.fishing-game {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #e3f2fd, #bbdefb);
  border-radius: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title {
  font-size: 20px;
  font-weight: bold;
  color: #1565c0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.coins {
  font-weight: bold;
  color: #f57c00;
  font-size: 16px;
}

.game-area {
  background: linear-gradient(180deg, #87CEEB 0%, #4FC3F7 50%, #0288D1 100%);
  border-radius: 16px;
  padding: 20px;
  position: relative;
  min-height: 380px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.water-bg {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 50%;
  background: linear-gradient(180deg, transparent, rgba(2, 136, 209, 0.3));
  border-radius: 0 0 16px 16px;
  overflow: hidden;
}

.water-waves {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 20px;
  background: repeating-linear-gradient(
    90deg,
    transparent,
    transparent 20px,
    rgba(255, 255, 255, 0.3) 20px,
    rgba(255, 255, 255, 0.3) 40px
  );
  animation: wave 2s linear infinite;
}

@keyframes wave {
  from { transform: translateX(0); }
  to { transform: translateX(40px); }
}

.fish-preview {
  position: absolute;
  bottom: 30%;
  left: 50%;
  transform: translateX(-50%);
  font-size: 60px;
  animation: swim 1s ease-in-out infinite;
}

@keyframes swim {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50% { transform: translateX(-50%) translateY(-10px); }
}

.fishing-rod {
  position: absolute;
  top: 20px;
  right: 30px;
}

.rod-line {
  width: 2px;
  height: 80px;
  background: #333;
  margin-left: 20px;
}

.rod-hook {
  font-size: 20px;
  margin-left: 12px;
  margin-top: -5px;
}

.progress-container {
  margin-top: 10px;
  z-index: 5;
}

.progress-bar {
  position: relative;
  height: 40px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 20px;
  border: 3px solid rgba(255, 255, 255, 0.5);
  overflow: hidden;
}

.bar-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, #ffcdd2, #fff9c4, #c8e6c9, #fff9c4, #ffcdd2);
  opacity: 0.6;
}

.sweet-spot {
  position: absolute;
  top: 0;
  height: 100%;
  background: linear-gradient(180deg, #4caf50, #2e7d32);
  border-radius: 4px;
  z-index: 1;
  box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
}

.sweet-spot::before,
.sweet-spot::after {
  content: '';
  position: absolute;
  top: 0;
  width: 2px;
  height: 100%;
  background: rgba(255, 255, 255, 0.5);
}

.sweet-spot::before { left: 33%; }
.sweet-spot::after { right: 33%; }

.indicator {
  position: absolute;
  top: -4px;
  width: 6px;
  height: calc(100% + 8px);
  background: #f44336;
  border-radius: 3px;
  z-index: 2;
  transform: translateX(-50%);
  box-shadow: 0 0 8px rgba(244, 67, 54, 0.6);
  transition: none;
}

.markers {
  position: absolute;
  bottom: -20px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 0 4px;
}

.marker {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.8);
}

.marker.center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  color: #fff;
  font-weight: bold;
}

.action-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
}

.idle-screen,
.casting-screen,
.waiting-screen,
.result-screen {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.tip {
  color: #fff;
  font-size: 14px;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
  max-width: 300px;
}

.casting-text,
.waiting-text {
  color: #fff;
  font-size: 18px;
  font-weight: bold;
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.3);
}

.hint-text {
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
}

.catch-btn {
  font-size: 20px !important;
  padding: 16px 48px !important;
  animation: pulse 0.8s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.loading-dots {
  display: flex;
  gap: 6px;
}

.loading-dots span {
  width: 10px;
  height: 10px;
  background: #fff;
  border-radius: 50%;
  animation: bounce 1.4s ease-in-out infinite;
}

.loading-dots span:nth-child(2) { animation-delay: 0.2s; }
.loading-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-10px); }
}

.result-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 20px 30px;
  min-width: 280px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.result-card.rarity-common { border: 3px solid #90caf9; }
.result-card.rarity-uncommon { border: 3px solid #81c784; }
.result-card.rarity-rare { border: 3px solid #ffb74d; box-shadow: 0 0 20px rgba(255, 183, 77, 0.4); }
.result-card.rarity-epic {
  border: 3px solid #e57373;
  box-shadow: 0 0 30px rgba(229, 115, 115, 0.5);
  animation: epic-glow 2s ease-in-out infinite;
}

@keyframes epic-glow {
  0%, 100% { box-shadow: 0 0 20px rgba(229, 115, 115, 0.4); }
  50% { box-shadow: 0 0 40px rgba(229, 115, 115, 0.7); }
}

.result-emoji {
  font-size: 64px;
  margin-bottom: 8px;
}

.result-name {
  font-size: 24px;
  font-weight: bold;
  color: #333;
  margin-bottom: 8px;
}

.result-rarity {
  margin-bottom: 12px;
}

.result-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  background: #f5f5f5;
  border-radius: 8px;
}

.stat-label {
  font-size: 12px;
  color: #999;
}

.stat-value {
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.accuracy-info {
  margin-top: 8px;
}

.accuracy-info > span {
  font-size: 12px;
  color: #666;
  display: block;
  margin-bottom: 4px;
}

.accuracy-bar {
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.accuracy-fill {
  height: 100%;
  background: linear-gradient(90deg, #f44336, #ffeb3b, #4caf50);
  border-radius: 4px;
  transition: width 0.3s;
}

.result-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.level-up-notice {
  background: linear-gradient(135deg, #ffd54f, #ff8f00);
  color: #fff;
  padding: 10px 20px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 14px;
  animation: bounce-in 0.5s ease-out;
}

@keyframes bounce-in {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}

.recent-catches {
  background: #f5f5f5;
  border-radius: 12px;
  padding: 12px 16px;
}

.section-title {
  font-weight: bold;
  color: #666;
  margin-bottom: 8px;
  font-size: 14px;
}

.catch-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.catch-item {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #fff;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
}

.catch-emoji {
  font-size: 18px;
}
</style>
