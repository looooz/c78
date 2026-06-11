<template>
  <el-dialog v-model="visible" title="🏪 农场商店" width="660px" align-center destroy-on-close>
    <div class="shop-header">
      <el-tag type="warning" size="large" effect="dark">
        💰 我的金币: {{ userCoins }}
      </el-tag>
    </div>

    <el-tabs v-model="activeCategory" class="shop-tabs">
      <el-tab-pane label="🌱 种子" name="seed">
        <div class="shop-grid scrollbar-thin">
          <div
            v-for="item in seedItems"
            :key="'s-' + item.id"
            class="shop-card"
            :class="{ 'can-not-afford': userCoins < item.price || !item.unlocked, locked: !item.unlocked }"
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
                <div v-if="!item.unlocked" class="unlock-hint">
                  <el-tag size="mini" type="info">🔒 Lv.{{ item.unlockLevel }} 解锁</el-tag>
                </div>
              </div>
            </div>
            <div class="card-bottom">
              <div class="price-tag">
                <span class="coin">💰</span>
                <span class="amount">{{ item.price }}</span>
              </div>
              <div class="buy-area">
                <el-input-number
                  v-model="quantities['seed-' + item.id]"
                  :min="1"
                  :max="99"
                  size="small"
                  controls-position="right"
                  style="width: 100px;"
                  :disabled="!item.unlocked"
                />
                <el-button
                  type="success"
                  :disabled="userCoins < item.price * (quantities['seed-' + item.id] || 1) || !item.unlocked"
                  @click="onBuy(item)"
                >
                  {{ item.unlocked ? '购买' : '未解锁' }}
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="🌾 饲料" name="feed">
        <div class="shop-grid scrollbar-thin">
          <div
            v-for="item in feedItems"
            :key="'f-' + item.id"
            class="shop-card"
            :class="{ 'can-not-afford': userCoins < item.price }"
          >
            <div class="card-top">
              <span class="emoji">{{ item.emoji }}</span>
              <div class="text-info">
                <div class="name">{{ item.name }}</div>
                <div class="meta">
                  <span title="喂养效果">💪 等级 {{ item.feedValue }}</span>
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
                  v-model="quantities['feed-' + item.id]"
                  :min="1"
                  :max="99"
                  size="small"
                  controls-position="right"
                  style="width: 100px;"
                />
                <el-button
                  type="success"
                  :disabled="userCoins < item.price * (quantities['feed-' + item.id] || 1)"
                  @click="onBuy(item)"
                >
                  购买
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="🐾 动物" name="animal">
        <div class="tip-banner">
          <el-alert
            title="💡 购买动物需要动物栏有空闲栏位，动物栏可在牧场页面扩建"
            type="info"
            :closable="false"
            show-icon
          />
        </div>
        <div class="shop-grid scrollbar-thin">
          <div
            v-for="item in animalItems"
            :key="'a-' + item.id"
            class="shop-card"
            :class="{ 'can-not-afford': userCoins < item.price }"
          >
            <div class="card-top">
              <span class="emoji">{{ item.emoji }}</span>
              <div class="text-info">
                <div class="name">{{ item.name }}</div>
                <div class="meta">
                  <span title="喂食间隔">🍖 每{{ item.feedInterval }}s</span>
                  <span title="产出间隔">⏱ 每{{ item.productInterval }}s</span>
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
                  v-model="quantities['animal-' + item.id]"
                  :min="1"
                  :max="99"
                  size="small"
                  controls-position="right"
                  style="width: 100px;"
                />
                <el-button
                  type="success"
                  :disabled="userCoins < item.price * (quantities['animal-' + item.id] || 1)"
                  @click="onBuy(item)"
                >
                  购买
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="🏡 装饰" name="decoration">
        <div class="tip-banner">
          <el-alert
            title="💡 购买装饰品后可在农场装饰模式下放置，美化你的农场"
            type="success"
            :closable="false"
            show-icon
          />
        </div>
        <div class="shop-grid scrollbar-thin">
          <div
            v-for="item in decorationItems"
            :key="'d-' + item.id"
            class="shop-card"
            :class="{ 'can-not-afford': userCoins < item.price || !item.unlocked, locked: !item.unlocked }"
          >
            <div class="card-top">
              <span class="emoji">{{ item.emoji }}</span>
              <div class="text-info">
                <div class="name">{{ item.name }}</div>
                <div class="meta">
                  <span title="分类">
                    {{ item.category === 'fence' ? '🚧 栅栏' : '🎨 装饰' }}
                  </span>
                  <span title="大小">📐 {{ item.width }}x{{ item.height }}</span>
                </div>
                <div class="desc">{{ item.description }}</div>
                <div v-if="!item.unlocked" class="unlock-hint">
                  <el-tag size="mini" type="info">🔒 Lv.{{ item.unlockLevel }} 解锁</el-tag>
                </div>
              </div>
            </div>
            <div class="card-bottom">
              <div class="price-tag">
                <span class="coin">💰</span>
                <span class="amount">{{ item.price }}</span>
              </div>
              <div class="buy-area">
                <el-input-number
                  v-model="quantities['decoration-' + item.id]"
                  :min="1"
                  :max="99"
                  size="small"
                  controls-position="right"
                  style="width: 100px;"
                  :disabled="!item.unlocked"
                />
                <el-button
                  type="success"
                  :disabled="userCoins < item.price * (quantities['decoration-' + item.id] || 1) || !item.unlocked"
                  @click="onBuyDecoration(item)"
                >
                  {{ item.unlocked ? '购买' : '未解锁' }}
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getShop, getDecorations, buyDecoration } from '../api.js'
import { playBuy, playError } from '../utils/sound.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  userCoins: { type: Number, default: 0 },
})
const emit = defineEmits(['update:visible', 'buy', 'buy-decoration'])

const visible = computed({
  get: () => props.visible,
  set: v => emit('update:visible', v),
})

const activeCategory = ref('seed')
const shopItems = ref([])
const decorationItems = ref([])
const quantities = reactive({})

const seedItems = computed(() => shopItems.value.filter(i => i.type === 'seed'))
const feedItems = computed(() => shopItems.value.filter(i => i.type === 'feed'))
const animalItems = computed(() => shopItems.value.filter(i => i.type === 'animal'))

const formatTime = (s) => {
  if (s >= 60) return `${Math.floor(s / 60)}分${s % 60}秒`
  return `${s}秒`
}

const onBuy = (item) => {
  const qty = quantities[item.type + '-' + item.id] || 1
  const cost = item.price * qty
  if (props.userCoins < cost) {
    playError()
    ElMessage.warning('金币不足')
    return
  }
  playBuy()
  emit('buy', item.type, item.id, qty)
}

const onBuyDecoration = async (item) => {
  const qty = quantities['decoration-' + item.id] || 1
  const cost = item.price * qty
  if (props.userCoins < cost) {
    playError()
    ElMessage.warning('金币不足')
    return
  }
  try {
    playBuy()
    const res = await buyDecoration(item.id, qty)
    ElMessage.success(res.message)
    emit('buy-decoration', res)
    await loadDecorations()
  } catch (e) {
    playError()
    ElMessage.error(e.message)
  }
}

const loadShop = async () => {
  try {
    const items = await getShop()
    shopItems.value = items
    items.forEach(i => {
      if (quantities[i.type + '-' + i.id] == null) quantities[i.type + '-' + i.id] = 1
    })
  } catch (e) {
    ElMessage.error(e.message)
  }
}

const loadDecorations = async () => {
  try {
    const items = await getDecorations()
    decorationItems.value = items
    items.forEach(i => {
      if (quantities['decoration-' + i.id] == null) quantities['decoration-' + i.id] = 1
    })
  } catch (e) {
    ElMessage.error(e.message)
  }
}

watch(() => props.visible, (v) => {
  if (v) {
    loadShop()
    loadDecorations()
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
.shop-tabs {
  margin-top: 4px;
}
.tip-banner {
  margin-bottom: 10px;
}
.shop-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 480px;
  overflow-y: auto;
  padding: 4px;
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
.shop-card.locked {
  opacity: 0.7;
  background: linear-gradient(145deg, #fafafa, #f0f0f0);
}
.shop-card.locked .emoji {
  filter: grayscale(1);
}
.unlock-hint {
  margin-top: 6px;
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
  flex-wrap: wrap;
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
