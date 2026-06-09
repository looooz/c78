<template>
  <el-dialog v-model="visible" title="🏪 农场商店" width="620px">
    <div class="shop-header">
      <el-tag type="warning" size="large" effect="dark">
        💰 我的金币: {{ userCoins }}
      </el-tag>
    </div>
    <div class="shop-grid scrollbar-thin">
      <div
        v-for="item in shopItems"
        :key="item.id"
        class="shop-card"
        :class="{ 'can-not-afford': userCoins < item.price }"
      >
        <div class="card-top">
          <span class="emoji">{{ item.emoji }}</span>
          <div class="text-info">
            <div class="name">{{ item.name }}种子</div>
            <div class="meta">
              <span title="生长时间">⏱ {{ formatTime(item.growTime) }}</span>
              <span title="售价">💵 {{ item.sellPrice }}</span>
              <span title="经验">⭐ {{ item.expReward }}</span>
            </div>
            <div class="desc">{{ item.description }}</div>
          </div>
        </div>
        <div class="card-bottom">
          <div class="price-tag">
            <span class="coin">💰</span>
            <span class="amount">{{ item.price }}</span>
          </div>
          <div class="buy-area">
            <el-input-number
              v-model="quantities[item.id]"
              :min="1"
              :max="99"
              size="small"
              controls-position="right"
              style="width: 100px;"
            />
            <el-button
              type="success"
              :disabled="userCoins < item.price * quantities[item.id]"
              @click="onBuy(item)"
            >
              购买
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getShop } from '../api.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  userCoins: { type: Number, default: 0 },
})
const emit = defineEmits(['update:visible', 'buy'])

const visible = computed({
  get: () => props.visible,
  set: v => emit('update:visible', v),
})

const shopItems = ref([])
const quantities = reactive({})

const formatTime = (s) => {
  if (s >= 60) return `${Math.floor(s / 60)}分${s % 60}秒`
  return `${s}秒`
}

const onBuy = (item) => {
  const qty = quantities[item.id] || 1
  const cost = item.price * qty
  if (props.userCoins < cost) {
    ElMessage.warning('金币不足')
    return
  }
  emit('buy', item.id, qty)
}

onMounted(async () => {
  try {
    const items = await getShop()
    shopItems.value = items
    items.forEach(i => quantities[i.id] = 1)
  } catch (e) {
    ElMessage.error(e.message)
  }
})
</script>

<style scoped>
.shop-header {
  margin-bottom: 14px;
  padding: 10px 14px;
  background: linear-gradient(135deg, #fff3cd, #ffeaa7);
  border-radius: 12px;
  text-align: center;
}
.shop-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 520px;
  overflow-y: auto;
}
.shop-card {
  border: 2px solid #ebeef5;
  border-radius: 14px;
  padding: 14px 16px;
  transition: all 0.2s;
  background: linear-gradient(145deg, #ffffff, #f5fff5);
}
.shop-card:hover {
  border-color: #67c23a;
  box-shadow: 0 4px 12px rgba(103,194,58,0.15);
}
.shop-card.can-not-afford {
  background: linear-gradient(145deg, #ffffff, #fff5f5);
}
.card-top {
  display: flex;
  gap: 14px;
}
.emoji {
  font-size: 52px;
  line-height: 1;
  align-self: center;
}
.text-info { flex: 1; }
.name {
  font-size: 17px;
  font-weight: bold;
  color: #333;
}
.meta {
  display: flex;
  gap: 14px;
  font-size: 13px;
  color: #666;
  margin: 4px 0;
}
.desc {
  font-size: 12px;
  color: #999;
}
.card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #e0e0e0;
}
.price-tag {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.price-tag .coin { font-size: 20px; }
.price-tag .amount {
  font-size: 22px;
  font-weight: bold;
  color: #f59e0b;
}
.buy-area {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
