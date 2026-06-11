<template>
  <div class="farm-canvas-container">
    <div class="canvas-toolbar">
      <el-button
        :type="editMode ? 'warning' : 'primary'"
        size="small"
        @click="toggleEditMode"
      >
        <el-icon><Edit /></el-icon>
        {{ editMode ? '退出装饰' : '装饰模式' }}
      </el-button>
      <span v-if="editMode" class="edit-hint">
        💡 从右侧选择装饰品拖入农场，或拖动已有装饰品调整位置
      </span>
    </div>
    <div class="canvas-area">
      <div class="canvas-wrapper">
        <canvas
          ref="canvasRef"
          :width="canvasWidth"
          :height="canvasHeight"
          class="farm-canvas"
          @click="onCanvasClick"
          @mousemove="onCanvasHover"
          @mousedown="onMouseDown"
          @mouseup="onMouseUp"
          @mouseleave="onMouseLeave"
        />
        <div
          v-if="editMode && draggingDecoration"
          class="drag-preview"
          :style="{
            left: dragPos.x + 'px',
            top: dragPos.y + 'px',
          }"
        >
          {{ draggingDecoration.emoji }}
        </div>
      </div>

      <div v-if="editMode" class="decoration-palette">
      <div class="palette-title">🎨 我的装饰品</div>
      <div class="palette-list scrollbar-thin">
        <div
          v-for="item in userDecorations"
          :key="'ud-' + item.decorationId"
          class="palette-item"
          :class="{ disabled: item.quantity <= 0 }"
          @mousedown="startDragFromPalette(item, $event)"
        >
          <span class="item-emoji">{{ item.emoji }}</span>
          <span class="item-name">{{ item.name }}</span>
          <span class="item-qty">x{{ item.quantity }}</span>
        </div>
        <div v-if="userDecorations.length === 0" class="empty-palette">
          <el-empty description="暂无装饰品" :image-size="80">
            <el-button type="primary" size="small" @click="$emit('openShop')">
              去商店购买
            </el-button>
          </el-empty>
        </div>
      </div>
      <div class="palette-tip">
        点击已放置的装饰品可选中，按 Delete 键或点击下方按钮收回
      </div>
      <el-button
        v-if="selectedDecoration"
        type="danger"
        size="small"
        @click="removeSelectedDecoration"
      >
        收回选中的装饰品
      </el-button>
    </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick, computed } from 'vue'
import { Edit } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getUserDecorations,
  getPlacedDecorations,
  placeDecoration,
  moveDecoration,
  removeDecoration,
} from '../api.js'
import { playClick, playBuy } from '../utils/sound.js'

const props = defineProps({
  plots: { type: Array, default: () => [] },
})

const emit = defineEmits(['plot-click', 'openShop', 'decorationsChanged'])

const canvasRef = ref(null)
const hoveredIndex = ref(-1)
const editMode = ref(false)
const cols = 3
const rows = 2
const gap = 30
const padding = 30
const plotW = 200
const plotH = 180

const canvasWidth = cols * plotW + (cols + 1) * gap + padding * 2
const canvasHeight = rows * plotH + (rows + 1) * gap + padding * 2

const userDecorations = ref([])
const placedDecorations = ref([])
const selectedDecoration = ref(null)
const draggingDecoration = ref(null)
const dragPos = ref({ x: 0, y: 0 })
const dragOffset = ref({ x: 0, y: 0 })
const isDraggingPlaced = ref(false)
const dragPlacedId = ref(null)

const loadDecorations = async () => {
  try {
    const [userDecos, placedDecos] = await Promise.all([
      getUserDecorations(),
      getPlacedDecorations(),
    ])
    userDecorations.value = userDecos
    placedDecorations.value = placedDecos
  } catch (e) {
    console.warn('加载装饰品失败:', e.message)
  }
}

const toggleEditMode = () => {
  playClick()
  editMode.value = !editMode.value
  selectedDecoration.value = null
  if (editMode.value) {
    loadDecorations()
  }
}

const getPlotRect = (index) => {
  const col = index % cols
  const row = Math.floor(index / cols)
  return {
    x: padding + gap + col * (plotW + gap),
    y: padding + gap + row * (plotH + gap),
    w: plotW,
    h: plotH,
  }
}

const getStageEmoji = (plot) => {
  const p = Math.min(100, plot.progress || 0)
  if (p >= 100) return plot.emoji || '🌱'
  if (p >= 66) return plot.stage3 || '🪴'
  if (p >= 33) return plot.stage2 || '🌿'
  return plot.stage1 || '🌱'
}

const getStageLabel = (plot) => {
  const p = Math.min(100, plot.progress || 0)
  if (p >= 100) return { text: '成熟', color: '#FF6F00' }
  if (p >= 66) return { text: '青壮', color: '#2E7D32' }
  if (p >= 33) return { text: '幼苗', color: '#558B2F' }
  return { text: '发芽', color: '#689F38' }
}

const drawPlot = (ctx, plot, rect, isHovered) => {
  const { x, y, w, h } = rect
  const radius = 16
  ctx.save()

  let baseColor = '#8B4513'
  let topColor = '#A0522D'
  let borderColor = '#654321'

  if (plot.status === 'growing_dry') {
    baseColor = '#D2691E'
    topColor = '#CD853F'
  }
  if (plot.status === 'growing_watered' || plot.watered) {
    baseColor = '#5D4037'
    topColor = '#6D4C41'
  }
  if (plot.status === 'ready') {
    baseColor = '#795548'
    topColor = '#8D6E63'
    borderColor = '#FFA500'
  }
  if (plot.status === 'harvested') {
    baseColor = '#A9A9A9'
    topColor = '#C0C0C0'
  }
  if (plot.status === 'empty') {
    baseColor = '#8B7355'
    topColor = '#B8860B'
  }

  ctx.shadowColor = 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = isHovered ? 15 : 8
  ctx.shadowOffsetY = 4
  if (isHovered) ctx.shadowColor = 'rgba(255,215,0,0.6)'

  roundRect(ctx, x, y, w, h, radius)
  ctx.fillStyle = baseColor
  ctx.fill()

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
  roundRect(ctx, x, y, w, h - 30, radius)
  ctx.clip()

  const rowLines = 4
  for (let i = 0; i < rowLines; i++) {
    const ly = y + 20 + i * ((h - 40) / rowLines)
    ctx.beginPath()
    ctx.moveTo(x + 10, ly)
    for (let lx = x + 10; lx < x + w - 10; lx += 6) {
      ctx.lineTo(lx, ly + Math.sin((lx + i * 13) * 0.1) * 2)
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
  ctx.restore()

  ctx.save()
  roundRect(ctx, x, y, w, h, radius)
  ctx.strokeStyle = borderColor
  ctx.lineWidth = isHovered ? 4 : 3
  if (plot.status === 'ready') {
    ctx.strokeStyle = '#FFA500'
    ctx.shadowColor = '#FFD700'
    ctx.shadowBlur = 12
  }
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.font = 'bold 12px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText(`#${plot.index + 1}`, x + 12, y + 20)
  ctx.restore()

  drawCrop(ctx, plot, rect)

  if (plot.cropId && !plot.isHarvested && plot.status !== 'ready') {
    drawProgress(ctx, plot, rect)
  }

  drawStatusBadge(ctx, plot, rect)
  drawStageLabel(ctx, plot, rect)

  if (plot.status === 'empty' || (!plot.cropId && !plot.isHarvested)) {
    ctx.save()
    ctx.font = 'bold 18px sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.textAlign = 'center'
    ctx.fillText('点击种植', x + w / 2, y + h / 2 + 8)
    ctx.font = '36px sans-serif'
    ctx.fillText('➕', x + w / 2, y + h / 2 - 24)
    ctx.restore()
  }
}

const drawStageLabel = (ctx, plot, rect) => {
  if (!plot.cropId || plot.isHarvested) return
  const stage = getStageLabel(plot)
  const { x, y, w } = rect
  ctx.save()
  ctx.font = 'bold 10px sans-serif'
  const metrics = ctx.measureText(stage.text)
  const bw = metrics.width + 14
  const bh = 18
  const bx = x + w - bw - 8
  const by = y + 8
  roundRect(ctx, bx, by, bw, bh, 9)
  ctx.fillStyle = stage.color
  ctx.globalAlpha = 0.9
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(stage.text, bx + bw / 2, by + bh / 2 + 1)
  ctx.restore()
}

const drawCrop = (ctx, plot, rect) => {
  const { x, y, w, h } = rect
  if (!plot.cropId || plot.isHarvested) return

  const progress = Math.min(100, plot.progress || 0)
  const scaleBase = progress < 33 ? 0.5 : progress < 66 ? 0.7 : progress < 100 ? 0.85 : 1.0
  const stageEmoji = getStageEmoji(plot)
  const emojiSize = Math.floor(60 * scaleBase)

  if (plot.status === 'ready') {
    ctx.save()
    for (let i = 0; i < 6; i++) {
      const angle = (Date.now() / 500 + i) * 0.5
      const rad = 30 + Math.sin(angle) * 8
      ctx.font = `${20}px sans-serif`
      ctx.fillText(
        '✨',
        x + w / 2 + Math.cos(i * 1.04) * rad,
        y + h / 2 - 20 + Math.sin(i * 1.04) * rad
      )
    }
    ctx.restore()
  }

  ctx.save()
  ctx.font = `${emojiSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (plot.watered && progress < 100) {
    for (let i = 0; i < 3; i++) {
      const dropY = y + h / 2 - 10 + (Date.now() / 500 + i * 20) % 40
      ctx.font = '18px sans-serif'
      ctx.fillText('💧', x + w / 2 + (i - 1) * 18, dropY)
    }
    ctx.font = `${emojiSize}px sans-serif`
  }

  ctx.fillText(stageEmoji, x + w / 2, y + h / 2 - 10)
  ctx.restore()
}

const drawProgress = (ctx, plot, rect) => {
  const { x, y, w, h } = rect
  const progress = plot.progress || 0
  const barW = w - 30
  const barH = 10
  const barX = x + 15
  const barY = y + h - 24

  ctx.save()
  roundRect(ctx, barX, barY, barW, barH, 5)
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.fill()

  const fillW = (progress / 100) * barW
  let color = '#7CB342'
  if (plot.status === 'growing_dry') color = '#F57C00'
  roundRect(ctx, barX, barY, fillW, barH, 5)
  ctx.fillStyle = color
  ctx.fill()

  ctx.font = 'bold 11px sans-serif'
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  const remaining = plot.remaining > 0 ? `${plot.remaining}s` : '即将成熟'
  ctx.fillText(`${Math.floor(progress)}% · ${remaining}`, barX + barW / 2, barY + 8)
  ctx.restore()
}

const drawStatusBadge = (ctx, plot, rect) => {
  const { x, y, w } = rect
  let badge = null
  if (plot.status === 'ready') badge = { text: '🎉 可收获', color: '#FF6F00' }
  else if (plot.status === 'harvested') badge = { text: '已收获', color: '#757575' }
  else if (plot.status === 'growing_dry' && plot.cropId) badge = { text: '🔥 需浇水', color: '#E53935' }
  else if (plot.status === 'growing_watered') badge = { text: '💧 已浇水', color: '#1E88E5' }

  if (!badge) return

  ctx.save()
  ctx.font = 'bold 12px sans-serif'
  const metrics = ctx.measureText(badge.text)
  const badgeW = metrics.width + 18
  const badgeH = 22
  const badgeX = x + w / 2 - badgeW / 2
  const badgeY = y - 10

  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 11)
  ctx.fillStyle = badge.color
  ctx.shadowColor = 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = 4
  ctx.fill()

  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(badge.text, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1)
  ctx.restore()
}

const drawDecorations = (ctx) => {
  if (!editMode.value) return

  placedDecorations.value.forEach((deco) => {
    const isSelected = selectedDecoration.value?.id === deco.id
    const size = 48

    ctx.save()
    ctx.font = `${size}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    if (isSelected) {
      ctx.shadowColor = '#FFD700'
      ctx.shadowBlur = 20
      ctx.strokeStyle = '#FFD700'
      ctx.lineWidth = 3
      roundRect(ctx, deco.x - size / 2 - 6, deco.y - size / 2 - 6, size + 12, size + 12, 8)
      ctx.stroke()
    }

    ctx.globalAlpha = isDraggingPlaced.value && dragPlacedId.value === deco.id ? 0.5 : 1
    ctx.fillText(deco.emoji, deco.x, deco.y)
    ctx.restore()
  })
}

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

const render = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)

  const bg = ctx.createLinearGradient(0, 0, 0, canvasHeight)
  bg.addColorStop(0, 'rgba(144, 238, 144, 0.4)')
  bg.addColorStop(1, 'rgba(34, 139, 34, 0.3)')
  ctx.fillStyle = bg
  roundRect(ctx, 10, 10, canvasWidth - 20, canvasHeight - 20, 24)
  ctx.fill()

  const plotMap = new Map()
  props.plots.forEach(p => plotMap.set(p.index, p))

  for (let i = 0; i < 6; i++) {
    const plot = plotMap.get(i) || { status: 'empty', index: i, watered: false, cropId: null, isHarvested: false, progress: 0 }
    drawPlot(ctx, plot, getPlotRect(i), hoveredIndex.value === i)
  }

  drawDecorations(ctx)

  ctx.font = 'bold 22px sans-serif'
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 4
  ctx.fillText('🌾 我的农场 🌾', canvasWidth / 2, 28)
  ctx.shadowBlur = 0
}

const getIndexFromEvent = (e) => {
  const canvas = canvasRef.value
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const mx = (e.clientX - rect.left) * scaleX
  const my = (e.clientY - rect.top) * scaleY

  for (let i = 0; i < 6; i++) {
    const r = getPlotRect(i)
    if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return i
  }
  return -1
}

const getDecorationAtPoint = (x, y) => {
  const size = 48
  for (let i = placedDecorations.value.length - 1; i >= 0; i--) {
    const deco = placedDecorations.value[i]
    if (
      x >= deco.x - size / 2 &&
      x <= deco.x + size / 2 &&
      y >= deco.y - size / 2 &&
      y <= deco.y + size / 2
    ) {
      return deco
    }
  }
  return null
}

const onCanvasClick = (e) => {
  if (editMode.value) {
    const canvas = canvasRef.value
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const mx = (e.clientX - rect.left) * scaleX
    const my = (e.clientY - rect.top) * scaleY

    const deco = getDecorationAtPoint(mx, my)
    if (deco) {
      playClick()
      selectedDecoration.value = deco
      return
    }
    selectedDecoration.value = null
    return
  }

  const idx = getIndexFromEvent(e)
  if (idx === -1) return
  const plotMap = new Map()
  props.plots.forEach(p => plotMap.set(p.index, p))
  const plot = plotMap.get(idx) || { index: idx, status: 'empty', watered: false, cropId: null, isHarvested: false, progress: 0 }
  emit('plot-click', plot)
}

const onCanvasHover = (e) => {
  hoveredIndex.value = getIndexFromEvent(e)
}

const startDragFromPalette = (item, e) => {
  if (item.quantity <= 0) return
  playClick()
  draggingDecoration.value = item
  isDraggingPlaced.value = false
  dragPos.value = { x: e.clientX, y: e.clientY }

  const onMouseMove = (ev) => {
    dragPos.value = { x: ev.clientX, y: ev.clientY }
  }

  const onMouseUp = (ev) => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)

    const canvas = canvasRef.value
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const mx = (ev.clientX - rect.left) * scaleX
    const my = (ev.clientY - rect.top) * scaleY

    if (mx > 0 && mx < canvasWidth && my > 0 && my < canvasHeight) {
      placeDecorationItem(item.decorationId, mx, my)
    }

    draggingDecoration.value = null
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

const placeDecorationItem = async (decorationId, x, y) => {
  try {
    playBuy()
    const res = await placeDecoration(decorationId, x, y, 0)
    ElMessage.success(res.message)
    await loadDecorations()
    emit('decorationsChanged')
  } catch (e) {
    ElMessage.error(e.message)
  }
}

const onMouseDown = (e) => {
  if (!editMode.value) return

  const canvas = canvasRef.value
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const mx = (e.clientX - rect.left) * scaleX
  const my = (e.clientY - rect.top) * scaleY

  const deco = getDecorationAtPoint(mx, my)
  if (deco) {
    playClick()
    isDraggingPlaced.value = true
    dragPlacedId.value = deco.id
    selectedDecoration.value = deco
    dragOffset.value = { x: mx - deco.x, y: my - deco.y }

    const onMouseMove = (ev) => {
      const canvas2 = canvasRef.value
      const rect2 = canvas2.getBoundingClientRect()
      const sx = canvas2.width / rect2.width
      const sy = canvas2.height / rect2.height
      const newX = (ev.clientX - rect2.left) * sx - dragOffset.value.x
      const newY = (ev.clientY - rect2.top) * sy - dragOffset.value.y

      const idx = placedDecorations.value.findIndex(d => d.id === deco.id)
      if (idx !== -1) {
        placedDecorations.value[idx].x = newX
        placedDecorations.value[idx].y = newY
      }
    }

    const onMouseUp = async (ev) => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)

      const canvas2 = canvasRef.value
      const rect2 = canvas2.getBoundingClientRect()
      const sx = canvas2.width / rect2.width
      const sy = canvas2.height / rect2.height
      const finalX = (ev.clientX - rect2.left) * sx - dragOffset.value.x
      const finalY = (ev.clientY - rect2.top) * sy - dragOffset.value.y

      try {
        await moveDecoration(deco.id, finalX, finalY, 0)
        await loadDecorations()
        emit('decorationsChanged')
      } catch (e) {
        ElMessage.error(e.message)
        await loadDecorations()
      }

      isDraggingPlaced.value = false
      dragPlacedId.value = null
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }
}

const onMouseUp = () => {
}

const onMouseLeave = () => {
  hoveredIndex.value = -1
}

const removeSelectedDecoration = async () => {
  if (!selectedDecoration.value) return
  try {
    await ElMessageBox.confirm('确定要收回这个装饰品吗？', '提示', {
      confirmButtonText: '收回',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await removeDecoration(selectedDecoration.value.id)
    playClick()
    ElMessage.success('已收回背包')
    selectedDecoration.value = null
    await loadDecorations()
    emit('decorationsChanged')
  } catch (e) {
    if (e !== 'cancel' && e?.message !== 'cancel') {
      ElMessage.error(e.message)
    }
  }
}

const handleKeyDown = (e) => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (editMode.value && selectedDecoration.value) {
      removeSelectedDecoration()
    }
  }
  if (e.key === 'Escape') {
    if (editMode.value) {
      toggleEditMode()
    }
  }
}

let animFrame = null
const animate = () => {
  render()
  animFrame = requestAnimationFrame(animate)
}

onMounted(() => {
  nextTick(animate)
  document.addEventListener('keydown', handleKeyDown)
  loadDecorations()
})

watch(() => props.plots, () => render(), { deep: true })
watch(editMode, () => {
  if (editMode.value) {
    loadDecorations()
  }
})

defineExpose({
  refreshDecorations: loadDecorations,
})
</script>

<style scoped>
.farm-canvas-container {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.canvas-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  backdrop-filter: blur(4px);
  width: 100%;
  box-sizing: border-box;
}

.edit-hint {
  font-size: 13px;
  color: #666;
  flex: 1;
}

.canvas-area {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.canvas-wrapper {
  position: relative;
  display: inline-block;
}

.farm-canvas {
  display: block;
  cursor: pointer;
  max-width: 100%;
  height: auto;
  border-radius: 16px;
}

.decoration-palette {
  width: 180px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(8px);
  flex-shrink: 0;
}

.palette-title {
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 8px;
  color: #333;
  text-align: center;
}

.palette-list {
  max-height: 300px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: #f5f7fa;
  border-radius: 8px;
  cursor: grab;
  transition: all 0.2s;
  user-select: none;
}

.palette-item:hover {
  background: #e8f5e9;
  transform: translateX(2px);
}

.palette-item:active {
  cursor: grabbing;
}

.palette-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.item-emoji {
  font-size: 24px;
}

.item-name {
  flex: 1;
  font-size: 13px;
  color: #333;
}

.item-qty {
  font-size: 12px;
  color: #666;
  font-weight: bold;
}

.palette-tip {
  font-size: 11px;
  color: #999;
  text-align: center;
  margin-bottom: 8px;
  line-height: 1.4;
}

.empty-palette {
  padding: 20px 0;
}

.drag-preview {
  position: fixed;
  font-size: 48px;
  pointer-events: none;
  z-index: 1000;
  transform: translate(-50%, -50%);
  opacity: 0.8;
}
</style>
