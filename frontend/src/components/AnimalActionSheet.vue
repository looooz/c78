<template>
  <el-dialog
    v-model="visible"
    :title="title"
    width="440px"
    align-center
    destroy-on-close
    class="animal-action-sheet"
  >
    <div v-if="animal" class="animal-detail">
      <div class="animal-header">
        <div class="emoji-area">
          <span class="main-emoji">{{ animal.emoji }}</span>
          <span v-if="animal.isBaby" class="baby-tag">幼崽</span>
        </div>
        <div class="info">
          <h3 class="name">{{ animal.name }}</h3>
          <div class="status-row">
            <el-tag size="small" :type="statusTagType" effect="dark">
              {{ statusText }}
            </el-tag>
            <span v-if="!animal.isBaby" class="product-info">
              产出: {{ animal.productEmoji }} {{ animal.productName }}
            </span>
          </div>
          <p class="desc">{{ animal.description }}</p>
        </div>
      </div>

      <div class="progress-section">
        <div class="progress-item">
          <div class="label-row">
            <span class="label">🍖 饱食度</span>
            <span class="value" :class="{'warn': animal.hungerLevel >= 60, 'danger': animal.hungerLevel >= 100}">
              {{ 100 - animal.hungerLevel }}%
            </span>
          </div>
          <el-progress
            :percentage="100 - animal.hungerLevel"
            :color="hungerColor"
            :stroke-width="12"
            :show-text="false"
          />
          <div class="mini-tip">
            <span v-if="animal.needFeed || animal.hungerLevel >= 60" class="tip-warn">
              ⚠️ 需要喂食！{{ animal.feedRemaining > 0 ? `${animal.feedRemaining}秒后饥饿` : '已到喂食时间' }}
            </span>
            <span v-else class="tip-ok">💚 状态良好</span>
          </div>
        </div>

        <div v-if="!animal.isBaby" class="progress-item">
          <div class="label-row">
            <span class="label">{{ animal.productEmoji }} 产出进度</span>
            <span class="value" :class="{'ready': animal.canCollect}">
              {{ animal.canCollect ? '✨ 可收集!' : animal.prodRemaining > 0 ? `${animal.prodRemaining}秒` : '准备中' }}
            </span>
          </div>
          <el-progress
            :percentage="animal.prodProgress"
            :color="animal.canCollect ? '#FF9800' : '#42A5F5'"
            :stroke-width="12"
            :show-text="false"
          />
          <div class="mini-tip">
            <span v-if="animal.canCollect" class="tip-warn">🎉 可以收集产品了！</span>
            <span v-else-if="animal.hungerLevel >= 100" class="tip-warn">🔥 动物太饿，暂停产出！</span>
            <span v-else class="tip-ok">产量效率: {{ (animal.efficiency * 100).toFixed(0) }}%</span>
          </div>
        </div>

        <div v-if="animal.isBaby" class="baby-tip">
          <el-alert
            title="🐣 动物正在成长为成体..."
            type="info"
            :closable="false"
            show-icon
          />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="action-footer">
        <el-button
          type="warning"
          size="large"
          :disabled="!canFeed"
          @click="onFeed"
        >
          🍖 喂食
        </el-button>
        <el-button
          type="success"
          size="large"
          :disabled="!canCollect"
          @click="onCollect"
        >
          {{ animal?.productEmoji || '✨' }} 收集产品
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  animal: { type: Object, default: null },
})
const emit = defineEmits(['update:visible', 'feed', 'collect'])

const visible = computed({
  get: () => props.visible,
  set: v => emit('update:visible', v),
})

const title = computed(() => props.animal ? `${props.animal.emoji} ${props.animal.name}` : '动物操作')

const canFeed = computed(() => {
  if (!props.animal) return false
  return props.animal.needFeed || props.animal.hungerLevel >= 50
})

const canCollect = computed(() => {
  if (!props.animal) return false
  return props.animal.canCollect && !props.animal.isBaby
})

const statusText = computed(() => {
  const a = props.animal
  if (!a) return ''
  if (a.isBaby) return '🐣 幼崽'
  if (a.isSick) return '🤒 生病'
  if (a.hungerLevel >= 100) return '🔥 饿坏了'
  if (a.canCollect) return '✨ 可收集'
  if (a.needFeed) return '🍖 需喂食'
  if (a.hungerLevel >= 60) return '⚠️ 饥饿'
  return '💚 状态良好'
})

const statusTagType = computed(() => {
  const a = props.animal
  if (!a) return 'info'
  if (a.isBaby) return 'warning'
  if (a.isSick || a.hungerLevel >= 100) return 'danger'
  if (a.canCollect) return 'warning'
  if (a.needFeed || a.hungerLevel >= 60) return 'warning'
  return 'success'
})

const hungerColor = computed(() => {
  const h = props.animal?.hungerLevel || 0
  const val = 100 - h
  if (val <= 20) return '#EF5350'
  if (val <= 50) return '#FFA726'
  return '#66BB6A'
})

const onFeed = () => {
  emit('feed', props.animal)
}
const onCollect = () => {
  emit('collect', props.animal)
}
</script>

<style scoped>
.animal-detail {
  padding: 8px 4px;
}
.animal-header {
  display: flex;
  gap: 18px;
  padding: 14px;
  background: linear-gradient(135deg, #FFF8E1, #FFECB3);
  border-radius: 14px;
  margin-bottom: 16px;
}
.emoji-area {
  position: relative;
  flex-shrink: 0;
}
.main-emoji {
  font-size: 78px;
  line-height: 1;
  display: block;
}
.baby-tag {
  position: absolute;
  bottom: -6px;
  right: -10px;
  background: #9C27B0;
  color: #fff;
  font-size: 11px;
  font-weight: bold;
  padding: 3px 8px;
  border-radius: 10px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
}
.info { flex: 1; min-width: 0; }
.name {
  font-size: 20px;
  font-weight: bold;
  margin: 0 0 6px 0;
  color: #3E2723;
}
.status-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.product-info {
  font-size: 13px;
  color: #5D4037;
  font-weight: 500;
}
.desc {
  font-size: 12px;
  color: #795548;
  margin: 0;
  line-height: 1.5;
}
.progress-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.progress-item {
  padding: 12px 14px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #F0EEE8;
}
.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.label {
  font-size: 13px;
  font-weight: 600;
  color: #4E342E;
}
.value {
  font-size: 13px;
  font-weight: bold;
  color: #5D4037;
}
.value.warn { color: #EF6C00; }
.value.danger { color: #D32F2F; }
.value.ready { color: #E65100; font-size: 14px; }
.mini-tip {
  margin-top: 6px;
  font-size: 11px;
}
.tip-ok { color: #43A047; }
.tip-warn { color: #E65100; font-weight: 500; }
.baby-tip {
  margin-top: 4px;
}
.action-footer {
  display: flex;
  gap: 12px;
  justify-content: center;
  width: 100%;
}
.action-footer .el-button {
  flex: 1;
  max-width: 180px;
  border-radius: 12px;
  font-weight: 600;
}
</style>
