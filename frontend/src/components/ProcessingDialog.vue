<template>
  <el-dialog
    v-model="visible"
    title="🍳 产品加工工坊"
    width="720px"
    align-center
    destroy-on-close
    class="processing-dialog"
    @open="onOpen"
  >
    <div class="queue-header">
      <div class="queue-info">
        <h4>📋 生产队列</h4>
        <el-progress
          :percentage="queuePercent"
          :status="queueFull ? 'exception' : 'success'"
          :stroke-width="14"
          class="queue-progress"
        />
        <span class="queue-count">
          {{ queueCount }} / {{ maxQueue }} 槽位
          <el-tag v-if="queueFull" type="danger" size="small" effect="dark" style="margin-left:8px;">已满</el-tag>
        </span>
      </div>
      <el-button type="primary" plain @click="refreshAll">
        <el-icon><Refresh /></el-icon> 刷新
      </el-button>
    </div>

    <div v-if="queue.length > 0" class="queue-list">
      <div
        v-for="item in queue"
        :key="item.id"
        class="queue-item"
        :class="{ 'is-completed': item.isCompleted }"
      >
        <div class="q-emoji">{{ item.emoji }}</div>
        <div class="q-info">
          <div class="q-name-row">
            <span class="q-name">{{ item.recipeName }}</span>
            <el-tag v-if="item.isCompleted" type="success" effect="dark" size="small">完成</el-tag>
            <el-tag v-else type="primary" size="small">加工中</el-tag>
          </div>
          <el-progress
            :percentage="item.progress"
            :color="item.isCompleted ? '#67C23A' : '#E6A23C'"
            :stroke-width="10"
            :show-text="false"
          />
          <div class="q-meta">
            <span v-if="!item.isCompleted">⏱ 剩余 {{ item.remaining }}s</span>
            <span v-else>🎉 可领取: {{ item.output.emoji }} {{ item.output.name }} x{{ item.output.amount }}</span>
          </div>
        </div>
        <div class="q-action">
          <el-button
            type="success"
            :disabled="!item.isCompleted"
            size="small"
            @click="onCollect(item)"
          >
            {{ item.isCompleted ? '领取' : '加工中' }}
          </el-button>
        </div>
      </div>
    </div>
    <el-empty v-else description="生产队列空闲中，快选择配方开始加工吧！" class="queue-empty" />

    <el-divider content-position="left">
      <span class="divider-title">📜 加工配方</span>
    </el-divider>

    <div class="recipes-grid scrollbar-thin">
      <div
        v-for="recipe in recipes"
        :key="recipe.id"
        class="recipe-card"
        :class="{ 'can-make': recipe.canMake, 'disabled': !recipe.canMake || queueFull }"
      >
        <div class="rc-header">
          <div class="rc-emoji-area">
            <span class="rc-emoji">{{ recipe.emoji }}</span>
            <span class="rc-time-badge">⏱ {{ formatTime(recipe.processTime) }}</span>
          </div>
          <div class="rc-info">
            <h5 class="rc-name">{{ recipe.name }}</h5>
            <div class="rc-output">
              产出: <span class="rc-product">{{ recipe.output.emoji }} {{ recipe.output.name }} x{{ recipe.output.amount }}</span>
            </div>
            <div class="rc-price">
              售价: <el-tag type="warning" size="small">💰 {{ recipe.output.sellPrice }}</el-tag>
            </div>
          </div>
        </div>

        <div class="rc-ingredients">
          <div class="ing-label">所需原料:</div>
          <div class="ing-list">
            <div
              v-for="(ing, i) in recipe.ingredients"
              :key="i"
              class="ing-item"
              :class="{ 'enough': ing.enough, 'lack': !ing.enough }"
            >
              <span class="ing-emoji">{{ ing.emoji }}</span>
              <span class="ing-name">{{ ing.name }}</span>
              <span class="ing-qty">
                {{ ing.available }}/{{ ing.required }}
                <i v-if="!ing.enough" class="lack-icon">❌</i>
                <i v-else class="ok-icon">✅</i>
              </span>
            </div>
          </div>
        </div>

        <div class="rc-footer">
          <div class="rc-status">
            <el-tag v-if="queueFull" type="danger" size="small">队列已满</el-tag>
            <el-tag v-else-if="recipe.canMake" type="success" effect="dark" size="small">可以加工</el-tag>
            <el-tag v-else type="info" size="small">原料不足</el-tag>
          </div>
          <el-button
            type="success"
            size="small"
            :disabled="!recipe.canMake || queueFull"
            @click="onStartProcess(recipe)"
          >
            开始加工
          </el-button>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer-tip">
        💡 提示：收集农产品和动物产品后，可加工成更高价值的商品出售！
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import {
  getRecipes,
  getProcessingQueue,
  startProcessing,
  collectProcessed,
} from '../api.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
})
const emit = defineEmits(['update:visible', 'refreshed'])

const visible = computed({
  get: () => props.visible,
  set: v => emit('update:visible', v),
})

const recipes = ref([])
const queue = ref([])
const queueCount = ref(0)
const maxQueue = ref(3)
const isRefreshing = ref(false)

const queueFull = computed(() => queueCount.value >= maxQueue.value)
const queuePercent = computed(() => Math.round((queueCount.value / maxQueue.value) * 100))

const formatTime = (s) => {
  if (s >= 60) return `${Math.floor(s / 60)}分${s % 60}秒`
  return `${s}秒`
}

const loadRecipes = async () => {
  try {
    const res = await getRecipes()
    recipes.value = res.recipes
    queueCount.value = res.queueCount
    maxQueue.value = res.maxQueue
  } catch (e) { ElMessage.error(e.message) }
}

const loadQueue = async () => {
  try {
    const res = await getProcessingQueue()
    queue.value = res.queue
    queueCount.value = res.count
    maxQueue.value = res.maxQueue
  } catch (e) { ElMessage.error(e.message) }
}

const refreshAll = async () => {
  try {
    isRefreshing.value = true
    await Promise.all([loadRecipes(), loadQueue()])
  } finally {
    setTimeout(() => { isRefreshing.value = false }, 300)
  }
}

const onOpen = () => {
  refreshAll()
  startPolling()
}

const onStartProcess = async (recipe) => {
  try {
    const res = await startProcessing(recipe.id)
    ElMessage.success(res.message)
    await refreshAll()
    emit('refreshed')
  } catch (e) { ElMessage.error(e.message) }
}

const onCollect = async (item) => {
  try {
    const res = await collectProcessed(item.id)
    ElMessage({
      message: res.message,
      type: 'success',
      duration: 2500,
      showClose: true,
    })
    await refreshAll()
    emit('refreshed')
  } catch (e) { ElMessage.error(e.message) }
}

let pollTimer = null
const startPolling = () => {
  stopPolling()
  pollTimer = setInterval(() => {
    if (props.visible) loadQueue()
  }, 1500)
}
const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

onMounted(() => {
  if (props.visible) {
    refreshAll()
    startPolling()
  }
})
</script>

<style scoped>
.queue-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: linear-gradient(135deg, #FFF3E0, #FFE0B2);
  border-radius: 12px;
  margin-bottom: 12px;
}
.queue-info { flex: 1; }
.queue-info h4 {
  margin: 0 0 8px 0;
  color: #E65100;
}
.queue-progress {
  max-width: 320px;
  margin-bottom: 4px;
}
.queue-count {
  font-size: 13px;
  font-weight: 600;
  color: #5D4037;
}
.queue-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 220px;
  overflow-y: auto;
  padding: 4px;
}
.queue-empty {
  padding: 10px 0;
}
.queue-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  background: #fff;
  border: 2px solid #E0E0E0;
  border-radius: 14px;
  transition: all 0.2s;
}
.queue-item.is-completed {
  border-color: #67C23A;
  background: linear-gradient(135deg, #F1F8E9, #DCEDC8);
  animation: pulse-glow 2s infinite;
}
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 rgba(103,194,58,0); }
  50% { box-shadow: 0 0 16px rgba(103,194,58,0.4); }
}
.q-emoji {
  font-size: 44px;
  flex-shrink: 0;
}
.q-info {
  flex: 1;
  min-width: 0;
}
.q-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.q-name {
  font-weight: bold;
  font-size: 15px;
  color: #333;
}
.q-meta {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}
.q-action { flex-shrink: 0; }

.divider-title {
  font-size: 15px;
  font-weight: bold;
  color: #5D4037;
}

.recipes-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
  padding: 4px;
}
.recipe-card {
  border: 2px solid #EFEBE9;
  border-radius: 14px;
  padding: 14px;
  background: linear-gradient(145deg, #ffffff, #FAFAFA);
  transition: all 0.2s;
}
.recipe-card.can-make {
  border-color: #A5D6A7;
  background: linear-gradient(145deg, #ffffff, #F1F8E9);
}
.recipe-card.disabled {
  opacity: 0.75;
}
.rc-header {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}
.rc-emoji-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.rc-emoji {
  font-size: 52px;
  line-height: 1;
}
.rc-time-badge {
  font-size: 11px;
  background: #FFF3E0;
  color: #E65100;
  padding: 3px 8px;
  border-radius: 10px;
  font-weight: 600;
}
.rc-info { flex: 1; min-width: 0; }
.rc-name {
  margin: 0 0 4px 0;
  font-size: 17px;
  font-weight: bold;
  color: #3E2723;
}
.rc-output {
  font-size: 13px;
  color: #5D4037;
  margin-bottom: 2px;
}
.rc-product {
  font-weight: 600;
  color: #2E7D32;
}
.rc-price {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}
.rc-ingredients {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed #E0E0E0;
}
.ing-label {
  font-size: 12px;
  color: #757575;
  font-weight: 600;
  margin-bottom: 6px;
}
.ing-list {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.ing-item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  background: #F5F5F5;
  border-radius: 10px;
  font-size: 12px;
  border: 1px solid #E0E0E0;
  transition: all 0.2s;
}
.ing-item.enough {
  background: #E8F5E9;
  border-color: #A5D6A7;
  color: #2E7D32;
}
.ing-item.lack {
  background: #FFEBEE;
  border-color: #EF9A9A;
  color: #C62828;
}
.ing-emoji { font-size: 16px; }
.ing-name { font-weight: 500; }
.ing-qty {
  font-weight: bold;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.lack-icon { font-style: normal; font-size: 11px; }
.ok-icon { font-style: normal; font-size: 11px; }

.rc-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 10px;
}
.dialog-footer-tip {
  text-align: center;
  color: #909399;
  font-size: 13px;
}
</style>
