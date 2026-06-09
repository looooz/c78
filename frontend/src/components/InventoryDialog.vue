<template>
  <el-dialog v-model="visible" title="🎒 我的背包" width="520px">
    <div class="inv-grid scrollbar-thin">
      <div v-for="item in inventory" :key="`${item.type}-${item.itemId}`" class="inv-item">
        <div class="emoji">{{ item.emoji || '📦' }}</div>
        <div class="info">
          <div class="name">{{ item.name }}</div>
          <div class="type-tag">
            <el-tag size="small" :type="item.type === 'seed' ? 'success' : 'primary'">
              {{ item.type === 'seed' ? '种子' : '道具' }}
            </el-tag>
          </div>
          <div class="desc" v-if="item.description">{{ item.description }}</div>
        </div>
        <div class="qty">
          <span class="label">数量</span>
          <span class="value">{{ item.quantity }}</span>
        </div>
      </div>
      <div v-if="inventory.length === 0" class="empty">
        <el-empty description="背包空空如也" />
      </div>
    </div>
    <template #footer>
      <div class="footer-tip">
        💡 点击商店购买种子，点击空地进行种植
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  inventory: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:visible'])

const visible = computed({
  get: () => props.visible,
  set: v => emit('update:visible', v),
})
</script>

<style scoped>
.inv-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 480px;
  overflow-y: auto;
}
.inv-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: linear-gradient(145deg, #fafafa, #f0f7f0);
  border-radius: 14px;
  border: 2px solid #eef2ee;
}
.inv-item:hover {
  border-color: #67c23a;
}
.emoji {
  font-size: 44px;
  line-height: 1;
  width: 60px;
  text-align: center;
}
.info { flex: 1; }
.name {
  font-size: 17px;
  font-weight: bold;
  color: #333;
}
.type-tag { margin: 4px 0; }
.desc {
  font-size: 12px;
  color: #999;
}
.qty {
  text-align: center;
  padding: 8px 16px;
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e0e0e0;
}
.qty .label {
  display: block;
  font-size: 11px;
  color: #999;
}
.qty .value {
  display: block;
  font-size: 24px;
  font-weight: bold;
  color: #67c23a;
}
.empty { padding: 30px; }
.footer-tip {
  text-align: center;
  color: #909399;
  font-size: 13px;
}
</style>
