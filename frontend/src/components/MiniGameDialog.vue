<template>
  <el-dialog
    v-model="visible"
    title="🎮 抓水果小游戏"
    width="520px"
    :close-on-click-modal="false"
    center
  >
    <div class="game-container">
      <div class="game-header">
        <div class="score-box">
          <span>得分: <b>{{ score }}</b></span>
          <span>⏱ {{ timeLeft }}s</span>
        </div>
        <p class="rule">
          <el-alert
            v-if="!playing && !gameOver"
            type="info"
            :closable="false"
            show-icon
          >
            <span style="font-size: 13px;">
              30秒内点击<span style="color:#67c23a;"><b>水果</b></span>得10分，
              点到<span style="color:#f56c6c;"><b>炸弹</b></span>扣5分！
            </span>
          </el-alert>
        </p>
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
          <div class="reward-info">
            <div>💰 金币奖励: <b>{{ score * 2 }}</b></div>
            <div>⭐ 经验奖励: <b>{{ score }}</b></div>
          </div>
          <el-button type="success" size="large" @click="claimReward">
            领取奖励
          </el-button>
        </div>
        <div v-else class="playing-screen">
          <transition-group name="pop" tag="div" class="targets">
            <div
              v-for="t in targets"
              :key="t.id"
              class="target"
              :style="{
                left: t.x + '%', top: t.y + '%' }"
              :class="{ bomb: t.bomb }"
              @click.stop="onTargetClick(t)"
            >
              {{ t.bomb ? '💣' : t.emoji }}
            </div>
          </transition-group>
        </div>
      </div>
    </div>
    <template #footer>
      <el-button @click="close">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
})
const emit = defineEmits(['update:visible', 'reward'])

const visible = computed({
  get: () => props.visible,
  set: v => emit('update:visible', v),
})

const FRUITS = ['🍎', '🍊', '🍋', '🍉', '🍇', '🍓', '🍑', '🥝', '🍒']

const score = ref(0)
const timeLeft = ref(30)
const playing = ref(false)
const gameOver = ref(false)
const targets = ref([])

let timeTimer = null
let spawnTimer = null
let targetId = 0

const startGame = () => {
  score.value = 0
  timeLeft.value = 30
  playing.value = true
  gameOver.value = false
  targets.value = []

  clearTimers()

  timeTimer = setInterval(() => {
    timeLeft.value--
    if (timeLeft.value <= 0) endGame()
  }, 1000)

  const spawn = () => {
    const isBomb = Math.random() < 0.22
    targets.value.push({
      id: ++targetId,
      x: 5 + Math.random() * 80,
      y: 5 + Math.random() * 75,
      emoji: FRUITS[Math.floor(Math.random() * FRUITS.length)],
      bomb: isBomb,
    })
    setTimeout(() => {
      targets.value = targets.value.filter(t => t.id !== targetId)
    }, 1400)
  }
  spawn()
  spawnTimer = setInterval(spawn, 600)
}

const onTargetClick = (t) => {
  if (t.bomb) score.value = Math.max(0, score.value - 5)
  else score.value += 10
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
const claimReward = () => {
  emit('reward', score.value)
}
const close = () => {
  clearTimers()
  playing.value = false
  gameOver.value = false
  visible.value = false
}

watch(visible, v => {
  if (v) {
    score.value = 0
    gameOver.value = false
    playing.value = false
    targets.value = []
  } else {
    clearTimers()
  }
})

onBeforeUnmount(() => clearTimers())
</script>

<style scoped>
.game-container {
  padding: 4px;
}
.game-header {
  margin-bottom: 14px;
}
.score-box {
  display: flex;
  justify-content: space-around;
  font-size: 16px;
  padding: 10px;
  background: linear-gradient(135deg, #fff3e0, #ffe0b2);
  border-radius: 12px;
  margin-bottom: 12px;
}
.score-box b {
  color: #e65100;
  font-size: 20px;
}
.rule { margin: 0 6px; }
.game-area {
  position: relative;
  height: 340px;
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
}
.start-screen .title {
  font-size: 80px;
}
.big-score {
  font-size: 20px;
  color: #666;
}
.score-num {
  font-size: 64px;
  font-weight: bold;
  color: #f57c00;
  line-height: 1;
}
.reward-info {
  background: #fff;
  padding: 10px 24px;
  border-radius: 12px;
  font-size: 15px;
  line-height: 1.8;
  text-align: center;
}
.playing-screen {
  position: relative;
  width: 100%;
  height: 100%;
}
.targets {
  position: absolute;
  inset: 0;
}
.target {
  position: absolute;
  font-size: 44px;
  cursor: pointer;
  transform: translate(-50%, -50%);
  animation: appear 0.2s ease-out;
}
.target:hover { transform: translate(-50%, -50%) scale(1.15); }
.target.bomb { animation: appear 0.2s ease-out, shake 0.5s infinite; }

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
