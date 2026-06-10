<template>
  <div class="app-container">
    <header class="top-bar">
      <UserPanel :user="user" />
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
      <el-button type="warning" @click="shopVisible = true">
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
    />

    <InventoryDialog
      v-model:visible="inventoryVisible"
      :inventory="inventory"
      @refreshed="refreshAll(false)"
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
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Operation, House, Plus, Goods, Box, KnifeFork, Trophy, Refresh } from '@element-plus/icons-vue'
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
import {
  getUser, getPlots, getInventory,
  plantCrop, waterPlot, harvestPlot, clearPlot,
  buyFromShop, claimMiniGameReward,
  getAnimals, feedAnimal, collectAnimalProduct, expandPen,
} from './api.js'

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
const selectedPlotIndex = ref(null)
const selectedPlot = ref(null)
const selectedAnimal = ref(null)

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
  if (plot.status === 'empty') {
    selectedPlotIndex.value = plot.index
    seedDialogVisible.value = true
  } else {
    selectedPlot.value = plot
    actionVisible.value = true
  }
}

const onAnimalClick = (animal) => {
  selectedAnimal.value = animal
  animalActionVisible.value = true
}

const onSlotEmptyClick = (slotIndex) => {
  ElMessage.info(`🏡 栏位 #${slotIndex + 1} 空闲，去商店购买动物放入吧！`)
  setTimeout(() => { shopVisible.value = true }, 400)
}

const onExpandPen = async () => {
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
    ElMessage.success(res.message)
    await loadUser()
    await loadAnimals()
  } catch (e) {
    if (e !== 'cancel' && e?.message !== 'cancel') {
      ElMessage.error(e?.message || '操作取消')
    }
  } finally {
    expandLoading.value = false
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

const handleFeed = async (animal) => {
  try {
    const res = await feedAnimal(animal.instanceId, 1)
    ElMessage.success(res.message)
    animalActionVisible.value = false
    await Promise.all([loadInventory(), loadAnimals()])
  } catch (e) { ElMessage.error(e.message) }
}

const handleAnimalCollect = async (animal) => {
  try {
    const res = await collectAnimalProduct(animal.instanceId)
    ElMessage.success(res.message)
    if (res.levelUp) {
      ElMessage({ type: 'success', message: `🎉 升级到 Lv.${res.newLevel}！`, duration: 3000 })
    }
    animalActionVisible.value = false
    await refreshAll()
  } catch (e) { ElMessage.error(e.message) }
}

const handleBuy = async (itemType, itemId, quantity) => {
  try {
    const res = await buyFromShop(itemType, itemId, quantity)
    ElMessage.success(res.message)
    await loadUser()
    if (itemType === 'animal') {
      await loadAnimals()
    } else {
      await loadInventory()
    }
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
    if (currentView.value === 'ranch') loadAnimals()
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
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  overflow: auto;
  padding: 16px 20px 20px 20px;
  gap: 16px;
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
</style>
