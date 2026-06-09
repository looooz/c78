<template>
  <el-dialog
    v-model="visible"
    width="460px"
    :close-on-click-modal="true"
    center
  >
    <template #header>
      <div class="dialog-header">
        <span v-if="plot?.cropId">{{ plot?.emoji }} {{ plot?.cropName }}</span>
        <span v-else>第 {{ plot?.index + 1 }} 号土地</span>
      </div>
    </template>

    <div v-if="plot" class="plot-info">
      <div class="big-emoji">{{ statusEmoji }}</div>

      <div class="status-row">
        <el-tag :type="statusType" size="large" effect="dark">
          {{ statusText }}
        </el-tag>
        <el-tag type="info" size="large">
          土地 #{{ plot.index + 1 }}
        </el-tag>
      </div>

      <div v-if="plot.cropId && plot.status !== 'harvested'" class="info-grid">
        <div class="info-item">
          <span class="label">💰 预计收入</span>
          <span class="value">{{ plot.sellPrice }} 金币</span>
        </div>
        <div class="info-item">
          <span class="label">⭐ 预计经验</span>
          <span class="value">{{ plot.expReward }} exp</span>
        </div>
        <div class="info-item" v-if="plot.progress < 100">
          <span class="label">⏱ 剩余时间</span>
          <span class="value">{{ plot.remaining }}秒</span>
        </div>
        <div class="info-item">
          <span class="label">💧 浇水状态</span>
          <span class="value" :class="{ dry: !plot.watered }">
            {{ plot.watered ? '已浇水' : '未浇水' }}
          </span>
        </div>
        <div v-if="plot.progress < 100" class="info-item full">
          <span class="label">📊 生长进度</span>
          <el-progress :percentage="Math.floor(plot.progress)" />
        </div>
        <div v-if="!plot.watered && plot.cropId" class="tip warn">
          ⚠️ 不浇水将减产至{{ Math.floor(plot.yieldBonus * 100) }}%！
        </div>
      </div>

      <div v-if="plot.isHarvested" class="info-item full">
        <el-empty description="土地已收获，请清理后可重新种植" />
      </div>

      <div v-if="!plot.cropId" class="info-item full">
        <el-empty description="土地空闲中" />
      </div>
    </div>

    <template #footer>
      <div class="action-buttons">
        <el-button @click="visible = false">关闭</el-button>
        <el-button
          v-if="plot?.status === 'empty' || plot?.status === 'harvested'"
          type="danger"
          @click="onClear"
        >
          <el-icon><Delete /></el-icon> 清理土地
        </el-button>
        <el-button
          v-if="plot?.cropId && !plot?.watered && plot?.status !== 'ready' && !plot?.isHarvested"
          type="primary"
          @click="onWater"
          :disabled="userWater <= 0"
        >
          💧 浇水 ({{ userWater }})
        </el-button>
        <el-button
          v-if="plot?.status === 'ready'"
          type="success"
          @click="onHarvest"
        >
          <el-icon><Promotion /></el-icon> 收获！
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  plot: { type: Object, default: null },
  userWater: { type: Number, default: 0 },
})
const emit = defineEmits(['update:visible', 'water', 'harvest', 'clear'])

const visible = computed({
  get: () => props.visible,
  set: v => emit('update:visible', v),
})

const statusText = computed(() => {
  const p = props.plot
  if (!p) return ''
  switch (p.status) {
    case 'empty': return '空地'
    case 'growing_watered': return '🌱 生长中(已浇水)'
    case 'growing_dry': return '🌾 生长中(需要浇水'
    case 'ready': return '🎉 可收获'
    case 'harvested': return '已收获'
    default: return ''
  }
})
const statusType = computed(() => {
  const p = props.plot
  if (!p) return 'info'
  switch (p.status) {
    case 'empty': return 'info'
    case 'growing_watered': return 'success'
    case 'growing_dry': return 'warning'
    case 'ready': return 'danger'
    case 'harvested': return ''
    default: return 'info'
  }
})
const statusEmoji = computed(() => {
  const p = props.plot
  if (!p?.cropId) return '🟫'
  if (p?.status === 'harvested') return '🧺'
  return p?.emoji || '🌱'
})

const onWater = () => emit('water')
const onHarvest = () => emit('harvest')
const onClear = () => emit('clear')
</script>

<style scoped>
.dialog-header {
  font-size: 18px;
  font-weight: bold;
}
.big-emoji {
  font-size: 80px;
  text-align: center;
  margin: 10px 0 6px;
}
.status-row {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 14px;
}
.status-row .el-tag { font-size: 14px; }
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 12px;
  background: #fafafa;
  border-radius: 12px;
}
.info-item {
  padding: 8px 12px;
  background: #fff;
  border-radius: 8px;
}
.info-item.full {
  grid-column: span 2;
}
.info-item .label {
  font-size: 12px;
  color: #909399;
  display: block;
  margin-bottom: 4px;
}
.info-item .value {
  font-size: 15px;
  font-weight: bold;
  color: #303133;
}
.info-item .value.dry {
  color: #e6a23c;
}
.tip {
  grid-column: span 2;
  padding: 8px 12px;
  border-radius: 8px;
  text-align: center;
  font-size: 13px;
}
.tip.warn {
  background: #fdf6ec;
  color: #e6a23c;
  border: 1px solid #faecd8;
}
.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}
</style>
