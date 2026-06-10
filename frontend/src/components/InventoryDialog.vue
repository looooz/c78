<template>
  <el-dialog v-model="visible" title="🎒 我的背包" width="560px" align-center destroy-on-close>
    <el-tabs v-model="activeCategory" class="inv-tabs">
      <el-tab-pane label="全部" name="all">
        <div class="inv-grid scrollbar-thin">
          <InvItem
            v-for="item in allItems"
            :key="item.type + '-' + item.itemId"
            :item="item"
            @sell="onSell"
          />
          <el-empty v-if="allItems.length === 0" description="背包空空如也" />
        </div>
      </el-tab-pane>

      <el-tab-pane label="🌱 种子" name="seed">
        <div class="inv-grid scrollbar-thin">
          <InvItem v-for="item in seedItems" :key="'s-'+item.itemId" :item="item" @sell="onSell" />
          <el-empty v-if="seedItems.length === 0" description="暂无种子" />
        </div>
      </el-tab-pane>

      <el-tab-pane label="🌾 作物" name="crop">
        <div class="inv-grid scrollbar-thin">
          <InvItem v-for="item in cropItems" :key="'c-'+item.itemId" :item="item" @sell="onSell" />
          <el-empty v-if="cropItems.length === 0" description="暂无收获作物" />
        </div>
      </el-tab-pane>

      <el-tab-pane label="🍖 饲料" name="feed">
        <div class="inv-grid scrollbar-thin">
          <InvItem v-for="item in feedItems" :key="'f-'+item.itemId" :item="item" @sell="onSell" />
          <el-empty v-if="feedItems.length === 0" description="暂无饲料，去商店购买吧！" />
        </div>
      </el-tab-pane>

      <el-tab-pane label="🥚 动物产品" name="animal_product">
        <div class="inv-grid scrollbar-thin">
          <InvItem v-for="item in productItems" :key="'p-'+item.itemId" :item="item" @sell="onSell" />
          <el-empty v-if="productItems.length === 0" description="暂无动物产品" />
        </div>
      </el-tab-pane>

      <el-tab-pane label="🍞 加工品" name="processed_product">
        <div class="inv-grid scrollbar-thin">
          <InvItem v-for="item in processedItems" :key="'pp-'+item.itemId" :item="item" @sell="onSell" />
          <el-empty v-if="processedItems.length === 0" description="暂无加工品" />
        </div>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <div class="footer-tip">
        💡 点击商店购买种子和饲料；去牧场管理动物；去工坊加工产品
      </div>
    </template>
  </el-dialog>

  <el-dialog
    v-model="sellDialogVisible"
    :title="`出售 ${sellItemData?.name || ''}`"
    width="420px"
    align-center
    destroy-on-close
  >
    <div v-if="sellItemData" class="sell-body">
      <div class="sell-header">
        <span class="sell-emoji">{{ sellItemData.emoji || '📦' }}</span>
        <div class="sell-info">
          <div class="sell-name">{{ sellItemData.name }}</div>
          <div class="sell-meta">
            单价: <span class="price">💰 {{ sellItemData.sellPrice || 0 }}</span>
            <span class="sep">·</span>
            库存: {{ sellItemData.quantity }}
          </div>
        </div>
      </div>
      <div class="sell-row">
        <span class="sell-label">出售数量:</span>
        <el-input-number
          v-model="sellQty"
          :min="1"
          :max="sellItemData.quantity"
          size="default"
          style="width:180px;"
        />
      </div>
      <div class="sell-total">
        总计获得: 💰 {{ sellItemData.sellPrice || 0 }} × {{ sellQty }} =
        <span class="total-num">💰 {{ (sellItemData.sellPrice || 0) * sellQty }}</span>
      </div>
    </div>
    <template #footer>
      <el-button @click="sellDialogVisible = false">取消</el-button>
      <el-button type="success" @click="confirmSell">确认出售</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, defineComponent, h } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { sellItem } from '../api.js'

const InvItem = defineComponent({
  name: 'InvItem',
  props: { item: Object },
  emits: ['sell'],
  setup(props, { emit }) {
    const typeConfig = {
      seed: { label: '种子', tagType: 'success', gradient: 'linear-gradient(145deg, #f0fff0, #e0f7e0)' },
      crop: { label: '作物', tagType: '', gradient: 'linear-gradient(145deg, #fffbeb, #fef3c7)' },
      feed: { label: '饲料', tagType: 'warning', gradient: 'linear-gradient(145deg, #fff7ed, #ffedd5)' },
      animal_product: { label: '动物产品', tagType: 'primary', gradient: 'linear-gradient(145deg, #eff6ff, #dbeafe)' },
      processed_product: { label: '加工品', tagType: 'danger', gradient: 'linear-gradient(145deg, #fdf2f8, #fce7f3)' },
    }
    const cfg = computed(() => typeConfig[props.item.type] || { label: '道具', tagType: 'info', gradient: '#fafafa' })
    const canSell = computed(() => ['crop', 'animal_product', 'processed_product'].includes(props.item.type))

    return () => {
      const item = props.item
      return h('div', { class: 'inv-item', style: { background: cfg.value.gradient } }, [
        h('div', { class: 'emoji' }, item.emoji || '📦'),
        h('div', { class: 'info' }, [
          h('div', { class: 'name' }, item.name),
          h('div', { class: 'type-tag' }, [
            h('el-tag', { size: 'small', type: cfg.value.tagType }, () => cfg.value.label),
            item.sellPrice
              ? h('el-tag', {
                  size: 'small',
                  type: 'warning',
                  effect: 'plain',
                  style: { marginLeft: '6px' }
                }, () => `💰 ${item.sellPrice}`)
              : null
          ]),
          item.description ? h('div', { class: 'desc' }, item.description) : null
        ]),
        h('div', { class: 'qty' }, [
          h('span', { class: 'label' }, '数量'),
          h('span', { class: 'value' }, String(item.quantity)),
          canSell.value
            ? h('el-button', {
                type: 'success',
                size: 'small',
                style: { marginTop: '6px' },
                onClick: () => emit('sell', item)
              }, () => '出售')
            : null
        ])
      ])
    }
  }
})

const props = defineProps({
  visible: { type: Boolean, default: false },
  inventory: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:visible', 'refreshed'])

const visible = computed({
  get: () => props.visible,
  set: v => emit('update:visible', v),
})

const activeCategory = ref('all')

const allItems = computed(() => props.inventory)
const seedItems = computed(() => props.inventory.filter(i => i.type === 'seed'))
const cropItems = computed(() => props.inventory.filter(i => i.type === 'crop'))
const feedItems = computed(() => props.inventory.filter(i => i.type === 'feed'))
const productItems = computed(() => props.inventory.filter(i => i.type === 'animal_product'))
const processedItems = computed(() => props.inventory.filter(i => i.type === 'processed_product'))

const sellableTypes = ['crop', 'animal_product', 'processed_product']

const sellDialogVisible = ref(false)
const sellItemData = ref(null)
const sellQty = ref(1)

const onSell = (item) => {
  if (!sellableTypes.includes(item.type)) {
    ElMessage.warning('该类型物品不可直接出售')
    return
  }
  sellItemData.value = item
  sellQty.value = Math.min(1, item.quantity || 1)
  sellDialogVisible.value = true
}

const confirmSell = async () => {
  if (!sellItemData.value) return
  try {
    const qty = Number(sellQty.value) || 1
    const res = await sellItem(sellItemData.value.type, sellItemData.value.itemId, qty)
    ElMessage.success(res.message)
    sellDialogVisible.value = false
    sellItemData.value = null
    emit('refreshed')
  } catch (e) {
    ElMessage.error(e?.message || '出售失败')
  }
}
</script>

<style scoped>
.inv-tabs {
  margin-top: 4px;
}
.inv-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 480px;
  overflow-y: auto;
  padding: 4px;
}
.inv-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 2px solid transparent;
  transition: all 0.2s;
}
.inv-item:hover {
  border-color: #67c23a;
  box-shadow: 0 4px 12px rgba(103,194,58,0.15);
}
.emoji {
  font-size: 44px;
  line-height: 1;
  width: 60px;
  text-align: center;
}
.info { flex: 1; min-width: 0; }
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
  padding: 8px 14px;
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e0e0e0;
  min-width: 82px;
}
.qty .label {
  display: block;
  font-size: 11px;
  color: #999;
}
.qty .value {
  display: block;
  font-size: 22px;
  font-weight: bold;
  color: #67c23a;
}
.empty { padding: 30px; }
.footer-tip {
  text-align: center;
  color: #909399;
  font-size: 13px;
}
.sell-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 10px 0;
}
.sell-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px;
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  border-radius: 12px;
}
.sell-emoji {
  font-size: 48px;
  line-height: 1;
}
.sell-info { flex: 1; }
.sell-name {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}
.sell-meta {
  font-size: 13px;
  color: #666;
  margin-top: 4px;
}
.sell-meta .price {
  color: #f59e0b;
  font-weight: bold;
}
.sell-meta .sep {
  margin: 0 6px;
  color: #ccc;
}
.sell-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 6px;
}
.sell-label {
  color: #666;
  font-size: 14px;
  min-width: 80px;
}
.sell-total {
  padding: 12px 16px;
  background: linear-gradient(135deg, #ecfdf5, #d1fae5);
  border-radius: 10px;
  text-align: right;
  color: #059669;
  font-weight: 600;
  font-size: 14px;
}
.total-num {
  font-size: 20px;
  color: #f59e0b;
  margin-left: 6px;
  font-weight: bold;
}
</style>
