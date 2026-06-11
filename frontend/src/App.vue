<template>
  <div class="app-container" :class="graphicsClass">
    <div class="bg-decoration" v-if="graphicsQuality !== 'low'">
      <div class="cloud cloud-1">☁️</div>
      <div class="cloud cloud-2">☁️</div>
      <div class="cloud cloud-3">⛅</div>
      <div class="bird bird-1">🐦</div>
      <div class="bird bird-2">🐦</div>
    </div>

    <AuthDialog
      v-model:visible="authVisible"
      @success="handleAuthSuccess"
    />

    <SettingsDialog
      v-model:visible="settingsVisible"
      :current-user="currentUser"
      @logout="handleLogout"
      @login="authVisible = true"
    />

    <div v-if="!isLoggedIn" class="login-landing">
      <div class="landing-card">
        <div class="landing-icon">🌾</div>
        <h1 class="landing-title">快乐农场</h1>
        <p class="landing-subtitle">欢迎来到休闲模拟经营游戏</p>
        <div class="landing-features">
          <div class="feature-item">🌱 种植作物</div>
          <div class="feature-item">🐔 养殖动物</div>
          <div class="feature-item">🎨 装饰农场</div>
          <div class="feature-item">🎣 趣味小游戏</div>
        </div>
        <el-button type="primary" size="large" @click="authVisible = true" class="landing-btn">
          <el-icon><User /></el-icon>
          开始游戏（登录 / 注册）
        </el-button>
      </div>
    </div>

    <template v-else>
    <header class="top-bar">
      <UserPanel :user="user" />
      <div class="top-bar-actions">
        <el-button circle @click="openSettings" title="设置">
          <el-icon><Setting /></el-icon>
        </el-button>
        <el-dropdown @command="onUserMenuCommand">
          <el-button type="success">
            <el-icon><Avatar /></el-icon>
            {{ user?.username || '用户' }}
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">
                <el-icon><User /></el-icon>个人中心
              </el-dropdown-item>
              <el-dropdown-item command="settings">
                <el-icon><Setting /></el-icon>设置
              </el-dropdown-item>
              <el-dropdown-item divided command="logout">
                <el-icon><SwitchButton /></el-icon>退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <main class="main-area">
      <div class="view-switch">
        <el-radio-group v-model="currentView" size="large" class="view-radio">
          <el-radio-button value="farm">
            <el-icon style="margin-right:4px;"><Operation /></el-icon> 🌾 农场
          </el-radio-button>
          <el-radio-button value="ranch">
            <el-icon style="margin-right:4px;"><House /></el-icon> 🐾 牧场
          </el-radio-button>
        </el-radio-group>
      </div>

      <div class="farm-wrapper" v-show="currentView === 'farm'">
        <FarmCanvas
          ref="farmRef"
          :plots="plots"
          @plot-click="onPlotClick"
          @open-shop="shopVisible = true"
          @decorations-changed="onDecorationsChanged"
        />
      </div>

      <div class="ranch-wrapper" v-show="currentView === 'ranch'">
        <div class="ranch-toolbar">
          <el-tag v-if="penInfo" type="warning" effect="dark" size="large">
            🏡 动物栏 Lv.{{ penInfo.level }} ({{ penInfo.currentCount || 0 }}/{{ penInfo.capacity }})
          </el-tag>
          <el-button
            type="primary"
            :loading="expandLoading"
            @click="onExpandPen"
          >
            <el-icon><Plus /></el-icon>
            扩建 ({{ penInfo?.expandCost || 0 }}💰)
          </el-button>
        </div>
        <AnimalCanvas
          ref="animalRef"
          :animals="animals"
          :pen="penInfo"
          @animal-click="onAnimalClick"
          @slot-empty-click="onSlotEmptyClick"
        />
      </div>
    </main>

    <footer class="bottom-bar">
      <el-button type="warning" @click="openShop">
        <el-icon><Goods /></el-icon> 商店
      </el-button>
      <el-button type="success" @click="inventoryVisible = true">
        <el-icon><Box /></el-icon> 背包
      </el-button>
      <el-button type="danger" @click="processingVisible = true">
        <el-icon><KnifeFork /></el-icon> 加工工坊
      </el-button>
      <el-button type="primary" @click="gameVisible = true">
        <el-icon><Trophy /></el-icon> 小游戏
      </el-button>
      <el-button @click="refreshAll" :loading="isRefreshing">
        <el-icon><Refresh /></el-icon> {{ isRefreshing ? '刷新中...' : '刷新' }}
      </el-button>
    </footer>

    <SeedDialog
      v-model:visible="seedDialogVisible"
      :plot-index="selectedPlotIndex"
      :inventory="inventory"
      @plant="handlePlant"
    />

    <ShopDialog
      v-model:visible="shopVisible"
      :user-coins="user?.coins || 0"
      @buy="handleBuy"
      @buy-decoration="handleBuyDecoration"
    />

    <InventoryDialog
      v-model:visible="inventoryVisible"
      :inventory="inventory"
      @refreshed="refreshAll(false)"
    />

    <MiniGameDialog
      v-model:visible="gameVisible"
      :user-coins="user?.coins || 0"
      :daily-fishing-limit="user?.daily?.fishingLimit || 10"
      @reward="handleGameReward"
    />

    <el-dialog
      v-model="offlineEarningsVisible"
      title="📦 离线收益"
      width="480px"
      center
      :close-on-click-modal="false"
    >
      <div v-if="offlineEarnings" class="offline-earnings">
        <div class="offline-time">
          您离开了 <b>{{ offlineEarnings.offlineText }}</b>
        </div>

        <div class="earnings-summary">
          <div class="summary-item coins">
            <span class="icon">💰</span>
            <span class="label">金币收益</span>
            <span class="value">+{{ offlineEarnings.totalCoins }}</span>
          </div>
          <div class="summary-item exp">
            <span class="icon">⭐</span>
            <span class="label">经验收益</span>
            <span class="value">+{{ offlineEarnings.totalExp }}</span>
          </div>
          <div class="summary-item water" v-if="offlineEarnings.waterRegen > 0">
            <span class="icon">💧</span>
            <span class="label">水源恢复</span>
            <span class="value">+{{ offlineEarnings.waterRegen }}</span>
          </div>
        </div>

        <div class="earnings-detail" v-if="offlineEarnings.crops?.harvested?.length > 0">
          <div class="detail-title">🌾 作物收获</div>
          <div class="detail-list">
            <div v-for="c in offlineEarnings.crops.harvested" :key="c.plotIndex" class="detail-item">
              <span class="item-emoji">{{ c.emoji }}</span>
              <span class="item-name">{{ c.name }}</span>
              <span class="item-coin">+{{ c.coins }}💰</span>
            </div>
          </div>
        </div>

        <div class="earnings-detail" v-if="offlineEarnings.products?.collected?.length > 0">
          <div class="detail-title">🥚 动物产出</div>
          <div class="detail-list">
            <div v-for="p in offlineEarnings.products.collected" :key="p.instanceId" class="detail-item">
              <span class="item-emoji">{{ p.productEmoji }}</span>
              <span class="item-name">{{ p.productName }} x{{ p.amount }}</span>
              <span class="item-coin">+{{ p.coins }}💰</span>
            </div>
          </div>
        </div>

        <div class="claim-area">
          <el-button type="primary" size="large" @click="claimOffline" :loading="claimingOffline">
            领取奖励
          </el-button>
        </div>
      </div>
    </el-dialog>

    <PlotActionSheet
      v-model:visible="actionVisible"
      :plot="selectedPlot"
      :user-water="user?.water || 0"
      @water="handleWater"
      @harvest="handleHarvest"
      @clear="handleClear"
    />

    <AnimalActionSheet
      v-model:visible="animalActionVisible"
      :animal="selectedAnimal"
      @feed="handleFeed"
      @collect="handleAnimalCollect"
    />

    <ProcessingDialog
      v-model:visible="processingVisible"
      @refreshed="refreshAll(false)"
    />

    <transition name="reward-popup">
      <div v-if="showRewardPopup" class="reward-popup" @click="showRewardPopup = false">
        <div class="reward-content" @click.stop>
          <div class="reward-icon">{{ rewardPopupData.icon }}</div>
          <div class="reward-title">{{ rewardPopupData.title }}</div>
          <div class="reward-desc">{{ rewardPopupData.desc }}</div>
          <div v-if="rewardPopupData.rewards?.length" class="reward-items">
            <div v-for="(item, idx) in rewardPopupData.rewards" :key="idx" class="reward-item">
              <span class="reward-emoji">{{ item.emoji }}</span>
              <span class="reward-text">{{ item.text }}</span>
            </div>
          </div>
          <el-button type="primary" @click="showRewardPopup = false">太棒了！</el-button>
        </div>
      </div>
    </transition>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Operation, House, Plus, Goods, Box, KnifeFork, Trophy, Refresh,
  Setting, User, Avatar, ArrowDown, SwitchButton
} from '@element-plus/icons-vue'
import UserPanel from './components/UserPanel.vue'
import FarmCanvas from './components/FarmCanvas.vue'
import AnimalCanvas from './components/AnimalCanvas.vue'
import SeedDialog from './components/SeedDialog.vue'
import ShopDialog from './components/ShopDialog.vue'
import InventoryDialog from './components/InventoryDialog.vue'
import MiniGameDialog from './components/MiniGameDialog.vue'
import PlotActionSheet from './components/PlotActionSheet.vue'
import AnimalActionSheet from './components/AnimalActionSheet.vue'
import ProcessingDialog from './components/ProcessingDialog.vue'
import AuthDialog from './components/AuthDialog.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import {
  getUser, getPlots, getInventory,
  plantCrop, waterPlot, harvestPlot, clearPlot,
  buyFromShop, claimMiniGameReward,
  getAnimals, feedAnimal, collectAnimalProduct, expandPen,
  getOfflineEarnings, claimOfflineEarnings,
  getToken, setToken, clearToken, getSettings,
} from './api.js'
import {
  playPlant, playWater, playHarvest, playCoin,
  playLevelUp, playFishCatch, playClick, playError,
  playBuy, playAnimal, setSoundEnabled, setVolume, getSoundEnabled,
} from './utils/sound.js'

const currentView = ref('farm')
const user = ref(null)
const plots = ref([])
const inventory = ref([])
const animals = ref([])
const penInfo = ref({ capacity: 2, level: 1, currentCount: 0, expandCost: 400 })
const isRefreshing = ref(false)
const expandLoading = ref(false)

const farmRef = ref(null)
const animalRef = ref(null)
const shopVisible = ref(false)
const inventoryVisible = ref(false)
const gameVisible = ref(false)
const seedDialogVisible = ref(false)
const actionVisible = ref(false)
const animalActionVisible = ref(false)
const processingVisible = ref(false)
const settingsVisible = ref(false)
const authVisible = ref(false)
const offlineEarningsVisible = ref(false)
const offlineEarnings = ref(null)
const claimingOffline = ref(false)
const selectedPlotIndex = ref(null)
const selectedPlot = ref(null)
const selectedAnimal = ref(null)

const isLoggedIn = ref(false)
const currentUser = ref(null)
const graphicsQuality = ref('high')

const showRewardPopup = ref(false)
const rewardPopupData = ref({
  icon: '🎉',
  title: '',
  desc: '',
  rewards: [],
})

const graphicsClass = computed(() => `graphics-${graphicsQuality.value}`)

let timer = null

const loadUser = async () => {
  try { user.value = await getUser() } catch (e) { ElMessage.error(e.message) }
}
const loadPlots = async () => {
  try { plots.value = await getPlots() } catch (e) { ElMessage.error(e.message) }
}
const loadInventory = async () => {
  try { inventory.value = await getInventory() } catch (e) { ElMessage.error(e.message) }
}
const loadAnimals = async () => {
  try {
    const res = await getAnimals()
    animals.value = res.animals
    penInfo.value = res.pen
  } catch (e) { ElMessage.error(e.message) }
}

const loadSettings = async () => {
  try {
    const settings = await getSettings()
    setSoundEnabled(settings.soundEnabled)
    setVolume(settings.volume)
    graphicsQuality.value = settings.graphicsQuality
  } catch (e) {
    console.warn('加载设置失败:', e.message)
  }
}

const refreshAll = async (showMsg = true) => {
  try {
    isRefreshing.value = true
    await Promise.all([loadUser(), loadPlots(), loadInventory(), loadAnimals()])
    if (showMsg) {
      ElMessage({
        message: '✅ 农场数据已刷新',
        type: 'success',
        duration: 1500,
        showClose: true,
      })
    }
  } catch (e) {
    ElMessage.error('刷新失败：' + e.message)
  } finally {
    setTimeout(() => { isRefreshing.value = false }, 500)
  }
}

const onPlotClick = (plot) => {
  if (!requireLogin()) return
  if (plot.status === 'empty') {
    selectedPlotIndex.value = plot.index
    seedDialogVisible.value = true
  } else {
    selectedPlot.value = plot
    actionVisible.value = true
  }
}

const onAnimalClick = (animal) => {
  if (!requireLogin()) return
  selectedAnimal.value = animal
  animalActionVisible.value = true
}

const onSlotEmptyClick = (slotIndex) => {
  if (!requireLogin()) return
  ElMessage.info(`🏡 栏位 #${slotIndex + 1} 空闲，去商店购买动物放入吧！`)
  setTimeout(() => { shopVisible.value = true }, 400)
}

const onExpandPen = async () => {
  if (!requireLogin()) return
  const cost = penInfo.value?.expandCost || 0
  try {
    await ElMessageBox.confirm(
      `扩建动物栏需要 ${cost} 金币，容量将增加1个，确定吗？`,
      '🏡 扩建动物栏',
      {
        confirmButtonText: '确认扩建',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    expandLoading.value = true
    const res = await expandPen()
    playCoin()
    ElMessage.success(res.message)
    await loadUser()
    await loadAnimals()
  } catch (e) {
    if (e !== 'cancel' && e?.message !== 'cancel') {
      playError()
      ElMessage.error(e?.message || '操作取消')
    }
  } finally {
    expandLoading.value = false
  }
}

const handlePlant = async (cropId) => {
  if (!requireLogin()) return
  try {
    const res = await plantCrop(selectedPlotIndex.value, cropId)
    playPlant()
    ElMessage.success(res.message)
    seedDialogVisible.value = false
    await refreshAll()
  } catch (e) {
    playError()
    ElMessage.error(e.message)
  }
}

const handleWater = async () => {
  if (!requireLogin()) return
  try {
    const res = await waterPlot(selectedPlot.value.index)
    playWater()
    ElMessage.success(res.message)
    actionVisible.value = false
    await refreshAll()
  } catch (e) {
    playError()
    ElMessage.error(e.message)
  }
}

const handleHarvest = async () => {
  if (!requireLogin()) return
  try {
    const res = await harvestPlot(selectedPlot.value.index)
    playHarvest()
    if (res.levelUp) {
      playLevelUp()
      showRewardPopup.value = true
      rewardPopupData.value = {
        icon: '🌟',
        title: `升级到 Lv.${res.newLevel}！`,
        desc: '恭喜你升级了！',
        rewards: [
          { emoji: '💰', text: `+${res.coins} 金币` },
          { emoji: '⭐', text: `+${res.coinReward || 0} 升级奖励` },
        ],
      }
    } else {
      showRewardPopup.value = true
      rewardPopupData.value = {
        icon: '🌾',
        title: '收获成功！',
        desc: selectedPlot.value.cropName,
        rewards: [
          { emoji: '💰', text: `+${res.coins} 金币` },
          { emoji: '⭐', text: `+${res.exp} 经验` },
        ],
      }
    }
    actionVisible.value = false
    await refreshAll()
  } catch (e) {
    playError()
    ElMessage.error(e.message)
  }
}

const handleClear = async () => {
  if (!requireLogin()) return
  try {
    const res = await clearPlot(selectedPlot.value.index)
    playClick()
    ElMessage.success(res.message)
    actionVisible.value = false
    await refreshAll()
  } catch (e) {
    playError()
    ElMessage.error(e.message)
  }
}

const handleFeed = async (animal) => {
  if (!requireLogin()) return
  try {
    const res = await feedAnimal(animal.instanceId)
    playAnimal()
    ElMessage.success(res.message)
    animalActionVisible.value = false
    await Promise.all([loadInventory(), loadAnimals()])
  } catch (e) {
    playError()
    ElMessage.error(e.message)
  }
}

const handleAnimalCollect = async (animal) => {
  if (!requireLogin()) return
  try {
    const res = await collectAnimalProduct(animal.instanceId)
    playCoin()
    if (res.levelUp) {
      playLevelUp()
      showRewardPopup.value = true
      rewardPopupData.value = {
        icon: '🌟',
        title: `升级到 Lv.${res.newLevel}！`,
        desc: '恭喜你升级了！',
        rewards: [
          { emoji: '💰', text: `+${res.coinReward || 0} 升级奖励` },
        ],
      }
    }
    animalActionVisible.value = false
    await refreshAll()
  } catch (e) {
    playError()
    ElMessage.error(e.message)
  }
}

const handleBuy = async (itemType, itemId, quantity) => {
  if (!requireLogin()) return
  try {
    const res = await buyFromShop(itemType, itemId, quantity)
    playBuy()
    ElMessage.success(res.message)
    await loadUser()
    if (itemType === 'animal') {
      await loadAnimals()
    } else {
      await loadInventory()
    }
  } catch (e) {
    playError()
    ElMessage.error(e.message)
  }
}

const handleBuyDecoration = async () => {
  if (!requireLogin()) return
  await Promise.all([loadUser(), loadPlots()])
  if (farmRef.value) {
    farmRef.value.refreshDecorations()
  }
}

const handleGameReward = async (payload) => {
  if (!requireLogin()) return
  try {
    const res = payload?.data || payload
    playFishCatch()
    if (res.levelUp) {
      playLevelUp()
      showRewardPopup.value = true
      rewardPopupData.value = {
        icon: '🎣',
        title: '钓鱼成功！',
        desc: `钓到了${res.fish?.name || '鱼'}`,
        rewards: [
          { emoji: '⭐', text: `升级到 Lv.${res.newLevel}` },
          { emoji: '💰', text: `+${res.coinReward || 0} 升级奖励` },
        ],
      }
    }
    ElMessage.success(res.message || '奖励发放成功')
    await loadUser()
    await loadInventory()
  } catch (e) {
    playError()
    ElMessage.error(e.message)
  }
}

const checkOfflineEarnings = async () => {
  try {
    const res = await getOfflineEarnings()
    if (res.available && res.totalCoins + res.totalExp > 0) {
      offlineEarnings.value = res
      offlineEarningsVisible.value = true
    }
  } catch (e) {
    console.warn('检查离线收益失败:', e.message)
  }
}

const claimOffline = async () => {
  if (!requireLogin()) return
  try {
    claimingOffline.value = true
    const res = await claimOfflineEarnings()
    playCoin()
    if (res.levelUp) {
      playLevelUp()
    }
    ElMessage.success(res.message)
    offlineEarningsVisible.value = false
    offlineEarnings.value = null
    await refreshAll(false)
  } catch (e) {
    playError()
    ElMessage.error(e.message)
  } finally {
    claimingOffline.value = false
  }
}

const openShop = () => {
  if (!requireLogin()) return
  playClick()
  shopVisible.value = true
}

const openSettings = () => {
  playClick()
  settingsVisible.value = true
}

const onDecorationsChanged = () => {
  if (!isLoggedIn.value) return
  loadUser()
}

const handleAuthSuccess = async (userData) => {
  currentUser.value = userData
  isLoggedIn.value = true
  await refreshAll()
  await loadSettings()
}

const handleLogout = async () => {
  clearToken()
  isLoggedIn.value = false
  currentUser.value = null
  user.value = null
  plots.value = []
  inventory.value = []
  animals.value = []
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  ElMessage.success('已退出登录')
  authVisible.value = true
}

const onUserMenuCommand = (command) => {
  playClick()
  if (command === 'logout') {
    handleLogout()
  } else if (command === 'settings') {
    settingsVisible.value = true
  } else if (command === 'profile') {
    ElMessage.info('个人中心功能开发中...')
  }
}

watch(graphicsQuality, (val) => {
  document.body.setAttribute('data-graphics', val)
})

watch(authVisible, (val) => {
  if (!val && !isLoggedIn.value) {
    setTimeout(() => {
      authVisible.value = true
    }, 100)
  }
})

const requireLogin = () => {
  if (!isLoggedIn.value) {
    playError()
    authVisible.value = true
    ElMessage.warning('请先登录后再操作')
    return false
  }
  return true
}

onMounted(async () => {
  await loadSettings()
  if (getToken()) {
    try {
      isLoggedIn.value = true
      await refreshAll()
      setTimeout(() => {
        checkOfflineEarnings()
      }, 500)
      timer = setInterval(() => {
        loadPlots()
        loadUser()
        if (currentView.value === 'ranch') loadAnimals()
      }, 2000)
    } catch (e) {
      clearToken()
      isLoggedIn.value = false
      authVisible.value = true
    }
  } else {
    authVisible.value = true
  }
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.app-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #87CEEB 0%, #98FB98 40%, #8B4513 100%);
  position: relative;
  overflow: hidden;
}

.login-landing {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
  padding: 20px;
}

.landing-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 24px;
  padding: 48px 56px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(8px);
  text-align: center;
  max-width: 480px;
  width: 100%;
}

.landing-icon {
  font-size: 80px;
  margin-bottom: 16px;
  animation: bounce 2s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.landing-title {
  font-size: 36px;
  font-weight: bold;
  color: #5D4037;
  margin: 0 0 8px 0;
}

.landing-subtitle {
  font-size: 16px;
  color: #795548;
  margin: 0 0 32px 0;
}

.landing-features {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 32px;
}

.feature-item {
  background: linear-gradient(135deg, #81C784 0%, #66BB6A 100%);
  color: white;
  padding: 14px 16px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(102, 187, 106, 0.3);
}

.landing-btn {
  width: 100%;
  font-size: 18px;
  padding: 14px 24px;
  border-radius: 14px;
}

.bg-decoration {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 0;
}

.cloud {
  position: absolute;
  font-size: 60px;
  opacity: 0.8;
  animation: floatCloud 60s linear infinite;
}

.cloud-1 {
  top: 8%;
  left: -10%;
  animation-duration: 80s;
}

.cloud-2 {
  top: 15%;
  left: 30%;
  animation-duration: 100s;
  animation-delay: -20s;
  font-size: 50px;
}

.cloud-3 {
  top: 5%;
  right: 20%;
  animation-duration: 90s;
  animation-delay: -40s;
  font-size: 70px;
}

@keyframes floatCloud {
  0% { transform: translateX(0); }
  100% { transform: translateX(120vw); }
}

.bird {
  position: absolute;
  font-size: 24px;
  animation: flyBird 15s linear infinite;
}

.bird-1 {
  top: 20%;
  left: -5%;
  animation-duration: 20s;
}

.bird-2 {
  top: 30%;
  left: -10%;
  animation-duration: 25s;
  animation-delay: -10s;
  font-size: 20px;
}

@keyframes flyBird {
  0% { transform: translateX(0) translateY(0); }
  25% { transform: translateX(25vw) translateY(-10px); }
  50% { transform: translateX(50vw) translateY(5px); }
  75% { transform: translateX(75vw) translateY(-5px); }
  100% { transform: translateX(110vw) translateY(0); }
}

.graphics-low .cloud,
.graphics-low .bird {
  display: none;
}

.top-bar {
  padding: 12px 24px;
  background: rgba(139, 69, 19, 0.85);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.top-bar-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  overflow: auto;
  padding: 16px 20px 20px 20px;
  gap: 16px;
  position: relative;
  z-index: 1;
}

.view-switch {
  margin-top: 4px;
}

.view-radio {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  border-radius: 14px;
  overflow: hidden;
  background: rgba(255,255,255,0.9);
}

.view-radio :deep(.el-radio-button__inner) {
  font-size: 16px;
  font-weight: 600;
  padding: 12px 28px;
}

.farm-wrapper {
  background: rgba(255, 248, 220, 0.3);
  border-radius: 24px;
  padding: 30px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(4px);
  position: relative;
}

.ranch-wrapper {
  background: rgba(255, 243, 224, 0.35);
  border-radius: 24px;
  padding: 24px 30px 30px 30px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(4px);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ranch-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
}

.ranch-toolbar .el-tag {
  font-size: 15px;
  padding: 6px 14px;
}

.bottom-bar {
  padding: 14px 24px;
  background: rgba(139, 69, 19, 0.9);
  display: flex;
  justify-content: center;
  gap: 16px;
  z-index: 10;
  flex-wrap: wrap;
}

.bottom-bar .el-button {
  font-size: 16px;
  padding: 10px 24px;
  border-radius: 12px;
}

.offline-earnings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.offline-time {
  text-align: center;
  font-size: 16px;
  color: #666;
  padding: 10px;
  background: linear-gradient(135deg, #fff3e0, #ffe0b2);
  border-radius: 10px;
}

.offline-time b {
  color: #e65100;
  font-size: 18px;
}

.earnings-summary {
  display: flex;
  justify-content: space-around;
  gap: 10px;
}

.summary-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 10px;
  border-radius: 12px;
  background: #fafafa;
}

.summary-item .icon { font-size: 28px; }
.summary-item .label { font-size: 13px; color: #888; }
.summary-item .value {
  font-size: 20px;
  font-weight: bold;
}
.summary-item.coins .value { color: #f57c00; }
.summary-item.exp .value { color: #7b1fa2; }
.summary-item.water .value { color: #1976d2; }

.earnings-detail {
  background: #fafafa;
  border-radius: 12px;
  padding: 12px;
}

.detail-title {
  font-weight: bold;
  color: #555;
  margin-bottom: 8px;
  font-size: 14px;
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 120px;
  overflow-y: auto;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #fff;
  border-radius: 8px;
  font-size: 14px;
}

.item-emoji { font-size: 20px; }
.item-name { flex: 1; color: #555; }
.item-coin { color: #f57c00; font-weight: bold; }

.claim-area {
  text-align: center;
  margin-top: 8px;
}

.claim-area .el-button {
  padding: 12px 48px;
  font-size: 16px;
}

.reward-popup {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  backdrop-filter: blur(4px);
}

.reward-content {
  background: linear-gradient(180deg, #fff9e6 0%, #fff 100%);
  border-radius: 24px;
  padding: 40px 50px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  min-width: 320px;
  position: relative;
  border: 4px solid #ffd700;
}

.reward-icon {
  font-size: 80px;
  margin-bottom: 16px;
  animation: bounce 0.8s ease infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-15px); }
}

.reward-title {
  font-size: 28px;
  font-weight: bold;
  color: #ff6f00;
  margin-bottom: 8px;
  text-shadow: 2px 2px 4px rgba(255, 215, 0, 0.5);
}

.reward-desc {
  font-size: 16px;
  color: #666;
  margin-bottom: 20px;
}

.reward-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 24px;
}

.reward-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 10px 20px;
  background: linear-gradient(135deg, #fff3cd, #ffe69c);
  border-radius: 30px;
  font-size: 18px;
  font-weight: 600;
  color: #856404;
}

.reward-emoji {
  font-size: 24px;
}

.reward-popup-enter-active {
  animation: popupIn 0.4s ease;
}

.reward-popup-leave-active {
  animation: popupOut 0.3s ease;
}

@keyframes popupIn {
  0% {
    opacity: 0;
    transform: scale(0.5);
  }
  70% {
    transform: scale(1.1);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes popupOut {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.8);
  }
}

.reward-content::before,
.reward-content::after {
  content: '✨';
  position: absolute;
  font-size: 30px;
  animation: sparkle 2s ease-in-out infinite;
}

.reward-content::before {
  top: 10px;
  left: 15px;
}

.reward-content::after {
  top: 15px;
  right: 15px;
  animation-delay: 1s;
}

@keyframes sparkle {
  0%, 100% { opacity: 0.3; transform: scale(0.8) rotate(0deg); }
  50% { opacity: 1; transform: scale(1.2) rotate(180deg); }
}
</style>
