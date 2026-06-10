<template>
  <el-dialog
    v-model="visible"
    :title="title"
    width="460px"
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
          <div class="feed-level-tip">
            <el-tag size="small" type="info" effect="plain">
              📊 饲料等级: 需{{ requiredFeedLevel }}级及以上
            </el-tag>
          </div>
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

      <div class="feed-select-section">
        <div class="section-title">🍽️ 选择饲料</div>
        <div class="feed-list">
          <div
            v-for="feed in feedOptions"
            :key="feed.id"
            class="feed-item"
            :class="{
              'selected': selectedFeedId === feed.id,
              'disabled': !feed.canUse,
              'not-enough': feed.canUse && feed.count < feed.needQty
            }"
            @click="feed.canUse && selectFeed(feed.id)"
          >
            <div class="feed-icon">{{ feed.emoji }}</div>
            <div class="feed-info">
              <div class="feed-name">
                {{ feed.name }}
                <el-tag v-if="feed.feedValue >= requiredFeedLevel" size="small" type="success" effect="light">
                  ✓ 适用
                </el-tag>
                <el-tag v-else size="small" type="danger" effect="light">
                  ✗ 等级不足
                </el-tag>
              </div>
              <div class="feed-meta">
                <span>等级 {{ feed.feedValue }}</span>
                <span class="dot">•</span>
                <span>库存: {{ feed.count }}</span>
                <span class="dot">•</span>
                <span>需{{ feed.needQty }}个</span>
              </div>
            </div>
            <div class="feed-check">
              <el-radio :model-value="selectedFeedId" :label="feed.id" :disabled="!feed.canUse" />
            </div>
          </div>
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
import { computed, ref, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  animal: { type: Object, default: null },
  feeds: { type: Array, default: () => [] },
  inventory: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:visible', 'feed', 'collect'])

const selectedFeedId = ref(null)

const visible = computed({
  get: () => props.visible,
  set: v => emit('update:visible', v),
})

const title = computed(() => props.animal ? `${props.animal.emoji} ${props.animal.name}` : '动物操作')

const requiredFeedLevel = computed(() => {
  if (!props.animal) return 1
  return Math.max(1, Math.ceil(props.animal.feedCost / 2))
})

const feedOptions = computed(() => {
  const invMap = {}
  props.inventory.forEach(inv => {
    if (inv.type === 'feed') {
      invMap[inv.item_id] = inv.quantity
    }
  })

  return props.feeds.map(feed => {
    const count = invMap[feed.id] || 0
    const needQty = Math.max(1, Math.ceil((props.animal?.feedCost || 1) / feed.feed_value))
    const canUse = feed.feed_value >= requiredFeedLevel.value
    return {
      ...feed,
      feedValue: feed.feed_value,
      count,
      needQty,
      canUse,
    }
  }).sort((a, b) => a.feedValue - b.feedValue)
})

const canFeed = computed(() => {
  if (!props.animal) return false
  if (!(props.animal.needFeed || props.animal.hungerLevel >= 50)) return false
  const validFeed = feedOptions.value.find(f => f.canUse && f.count >= f.needQty)
  return !!validFeed
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

watch(() => props.visible, (val) => {
  if (val) {
    const defaultFeed = feedOptions.value.find(f => f.canUse && f.count >= f.needQty)
    selectedFeedId.value = defaultFeed ? defaultFeed.id : null
  }
})

const selectFeed = (id) => {
  selectedFeedId.value = id
}

const onFeed = () => {
  emit('feed', { animal: props.animal, feedId: selectedFeedId.value })
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
.feed-level-tip {
  margin-top: 8px;
}
.progress-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 16px;
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
.feed-select-section {
  background: #FFF9F0;
  border-radius: 12px;
  padding: 12px 14px;
  border: 1px solid #FFE0B2;
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #5D4037;
  margin-bottom: 10px;
}
.feed-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.feed-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: #fff;
  border-radius: 10px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}
.feed-item:hover:not(.disabled) {
  background: #FFF3E0;
}
.feed-item.selected {
  border-color: #FF9800;
  background: #FFF3E0;
}
.feed-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.feed-item.not-enough {
  opacity: 0.7;
}
.feed-icon {
  font-size: 32px;
  line-height: 1;
  flex-shrink: 0;
}
.feed-info {
  flex: 1;
  min-width: 0;
}
.feed-name {
  font-size: 14px;
  font-weight: 600;
  color: #3E2723;
  display: flex;
  align-items: center;
  gap: 8px;
}
.feed-meta {
  font-size: 12px;
  color: #8D6E63;
  margin-top: 4px;
}
.feed-meta .dot {
  margin: 0 4px;
  color: #BCAAA4;
}
.feed-check {
  flex-shrink: 0;
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
