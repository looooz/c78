<template>
  <el-dialog
    v-model="visible"
    title="🌱 选择种子"
    width="520px"
    :close-on-click-modal="true"
  >
    <div class="seed-grid scrollbar-thin">
      <div
        v-for="item in seeds"
        :key="item.itemId"
        class="seed-card"
        :class="{ disabled: item.quantity <= 0 }"
        @click="onSelect(item)"
      >
        <div class="emoji">{{ item.emoji }}</div>
        <div class="name">{{ item.name }}</div>
        <div class="info">
          <span>⏱ {{ formatTime(item.growTime) }}</span>
          <span>💰 {{ item.sellPrice }}</span>
          <span>⭐ {{ item.expReward }}</span>
        </div>
        <div class="qty-tag" :class="{ warn: item.quantity <= 1 }">
          数量: {{ item.quantity }}
        </div>
        <div class="desc">{{ item.description }}</div>
      </div>
      <div v-if="seeds.length === 0" class="empty-tip">
        <el-empty description="背包中没有种子，去商店购买吧！" />
      </div>
    </div>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  visible: { type: Boolean, default: false },
  plotIndex: { type: Number, default: 0 },
  inventory: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:visible', 'plant'])

const visible = computed({
  get: () => props.visible,
  set: v => emit('update:visible', v),
})

const seeds = computed(() =>
  props.inventory
    .filter(i => i.type === 'seed' && i.quantity > 0)
    .map(i => ({ ...i }))
)

const formatTime = (s) => {
  const sec = Math.round(s)
  if (sec >= 60) return `${Math.floor(sec / 60)}分${sec % 60}秒`
  return `${sec}秒`
}

const onSelect = (item) => {
  if (item.quantity <= 0) {
    ElMessage.warning('种子不足')
    return
  }
  emit('plant', item.itemId)
}
</script>

<style scoped>
.seed-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  max-height: 460px;
  overflow-y: auto;
}
.seed-card {
  position: relative;
  border: 2px solid #e0e0e0;
  border-radius: 16px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
  background: linear-gradient(145deg, #fff8e1, #fffde7);
}
.seed-card:hover:not(.disabled) {
  border-color: #67c23a;
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(103, 194, 58, 0.3);
}
.seed-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.emoji {
  font-size: 48px;
  text-align: center;
}
.name {
  font-size: 18px;
  font-weight: bold;
  text-align: center;
  margin: 6px 0;
  color: #333;
}
.info {
  display: flex;
  justify-content: space-around;
  font-size: 12px;
  color: #666;
  margin: 6px 0;
  padding: 4px;
  background: rgba(255,255,255,0.6);
  border-radius: 8px;
}
.qty-tag {
  text-align: center;
  font-size: 13px;
  font-weight: bold;
  color: #67c23a;
  padding: 2px 0;
}
.qty-tag.warn { color: #e6a23c; }
.desc {
  font-size: 11px;
  color: #999;
  text-align: center;
  margin-top: 4px;
}
.empty-tip {
  grid-column: span 2;
  padding: 30px;
}
</style>
