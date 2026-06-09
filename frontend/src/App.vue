<template>
  <div class="app-container">
    <header class="top-bar">
      <UserPanel :user="user" />
    </header>

    <main class="main-area">
      <div class="farm-wrapper">
        <FarmCanvas
          ref="farmRef"
          :plots="plots"
          @plot-click="onPlotClick"
        />
      </div>
    </main>

    <footer class="bottom-bar">
      <el-button type="warning" @click="shopVisible = true">
        <el-icon><Goods /></el-icon> 商店
      </el-button>
      <el-button type="success" @click="inventoryVisible = true">
        <el-icon><Box /></el-icon> 背包
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
    />

    <InventoryDialog
      v-model:visible="inventoryVisible"
      :inventory="inventory"
    />

    <MiniGameDialog
      v-model:visible="gameVisible"
      @reward="handleGameReward"
    />

    <PlotActionSheet
      v-model:visible="actionVisible"
      :plot="selectedPlot"
      :user-water="user?.water || 0"
      @water="handleWater"
      @harvest="handleHarvest"
      @clear="handleClear"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import UserPanel from './components/UserPanel.vue'
import FarmCanvas from './components/FarmCanvas.vue'
import SeedDialog from './components/SeedDialog.vue'
import ShopDialog from './components/ShopDialog.vue'
import InventoryDialog from './components/InventoryDialog.vue'
import MiniGameDialog from './components/MiniGameDialog.vue'
import PlotActionSheet from './components/PlotActionSheet.vue'
import {
  getUser, getPlots, getInventory,
  plantCrop, waterPlot, harvestPlot, clearPlot,
  buyFromShop, claimMiniGameReward,
} from './api.js'

const user = ref(null)
const plots = ref([])
const inventory = ref([])
const isRefreshing = ref(false)

const farmRef = ref(null)
const shopVisible = ref(false)
const inventoryVisible = ref(false)
const gameVisible = ref(false)
const seedDialogVisible = ref(false)
const actionVisible = ref(false)
const selectedPlotIndex = ref(null)
const selectedPlot = ref(null)

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
const refreshAll = async (showMsg = true) => {
  try {
    isRefreshing.value = true
    await Promise.all([loadUser(), loadPlots(), loadInventory()])
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
  if (plot.status === 'empty') {
    selectedPlotIndex.value = plot.index
    seedDialogVisible.value = true
  } else {
    selectedPlot.value = plot
    actionVisible.value = true
  }
}

const handlePlant = async (cropId) => {
  try {
    const res = await plantCrop(selectedPlotIndex.value, cropId)
    ElMessage.success(res.message)
    seedDialogVisible.value = false
    await refreshAll()
  } catch (e) { ElMessage.error(e.message) }
}

const handleWater = async () => {
  try {
    const res = await waterPlot(selectedPlot.value.index)
    ElMessage.success(res.message)
    actionVisible.value = false
    await refreshAll()
  } catch (e) { ElMessage.error(e.message) }
}

const handleHarvest = async () => {
  try {
    const res = await harvestPlot(selectedPlot.value.index)
    ElMessage.success(res.message)
    if (res.levelUp) {
      ElMessage({ type: 'success', message: `🎉 升级到 Lv.${res.newLevel}！`, duration: 3000 })
    }
    actionVisible.value = false
    await refreshAll()
  } catch (e) { ElMessage.error(e.message) }
}

const handleClear = async () => {
  try {
    const res = await clearPlot(selectedPlot.value.index)
    ElMessage.success(res.message)
    actionVisible.value = false
    await refreshAll()
  } catch (e) { ElMessage.error(e.message) }
}

const handleBuy = async (cropId, quantity) => {
  try {
    const res = await buyFromShop(cropId, quantity)
    ElMessage.success(res.message)
    await loadUser()
    await loadInventory()
  } catch (e) { ElMessage.error(e.message) }
}

const handleGameReward = async (payload) => {
  try {
    const res = payload?.data || payload
    ElMessage.success(res.message || '奖励发放成功')
    if (res.levelUp) {
      ElMessage({ type: 'success', message: `🎉 升级到 Lv.${res.newLevel}！`, duration: 3000 })
    }
    gameVisible.value = false
    await loadUser()
    await loadInventory()
  } catch (e) { ElMessage.error(e.message) }
}

onMounted(async () => {
  await refreshAll()
  timer = setInterval(() => {
    loadPlots()
    loadUser()
  }, 2000)
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
}
.top-bar {
  padding: 12px 24px;
  background: rgba(139, 69, 19, 0.85);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 10;
}
.main-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 20px;
}
.farm-wrapper {
  background: rgba(255, 248, 220, 0.3);
  border-radius: 24px;
  padding: 30px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(4px);
}
.bottom-bar {
  padding: 14px 24px;
  background: rgba(139, 69, 19, 0.9);
  display: flex;
  justify-content: center;
  gap: 16px;
  z-index: 10;
}
.bottom-bar .el-button {
  font-size: 16px;
  padding: 10px 24px;
  border-radius: 12px;
}
</style>
