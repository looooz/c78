<template>
  <canvas
    ref="canvasRef"
    :width="canvasWidth"
    :height="canvasHeight"
    class="farm-canvas"
    @click="onCanvasClick"
    @mousemove="onCanvasHover"
  />
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'

const props = defineProps({
  plots: { type: Array, default: () => [] },
})
const emit = defineEmits(['plot-click'])

const canvasRef = ref(null)
const hoveredIndex = ref(-1)
const cols = 3
const rows = 2
const gap = 30
const padding = 30
const plotW = 200
const plotH = 180

const canvasWidth = cols * plotW + (cols + 1) * gap + padding * 2
const canvasHeight = rows * plotH + (rows + 1) * gap + padding * 2

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

  ctx.shadowBlur = 0
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

  drawCrop(ctx, plot, rect)

  if (plot.crop_id && !plot.is_harvested && plot.status !== 'ready') {
    drawProgress(ctx, plot, rect)
  }

  drawStatusBadge(ctx, plot, rect)

  if (plot.status === 'empty' || (!plot.crop_id && !plot.is_harvested)) {
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

const drawCrop = (ctx, plot, rect) => {
  const { x, y, w, h } = rect
  if (!plot.crop_id || plot.is_harvested) return

  const progress = Math.min(100, plot.progress || 0)
  const scale = 0.3 + (progress / 100) * 0.7
  const emoji = plot.emoji || '🌱'
  const emojiSize = Math.floor(60 * scale)

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

  ctx.fillText(emoji, x + w / 2, y + h / 2 - 10)
  ctx.restore()
}

const drawProgress = (ctx, plot, rect) => {
  const { x, y, w } = rect
  const progress = plot.progress || 0
  const barW = w - 30
  const barH = 10
  const barX = x + 15
  const barY = y + rect.h - 24

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
  ctx.fillText(remaining, barX + barW / 2, barY + 8)
  ctx.restore()
}

const drawStatusBadge = (ctx, plot, rect) => {
  const { x, y, w } = rect
  let badge = null
  if (plot.status === 'ready') badge = { text: '可收获', color: '#FF6F00' }
  else if (plot.status === 'harvested') badge = { text: '已收获', color: '#757575' }
  else if (plot.status === 'growing_dry' && plot.crop_id) badge = { text: '需浇水', color: '#E53935' }

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

  for (let i = 0; i < 6; i++) {
    const plot = props.plots[i] || { status: 'empty', index: i }
    plot.index = i
    drawPlot(ctx, plot, getPlotRect(i), hoveredIndex.value === i)
  }

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

const onCanvasClick = (e) => {
  const idx = getIndexFromEvent(e)
  if (idx === -1) return
  const plot = props.plots[idx] || { index: idx, status: 'empty' }
  plot.index = idx
  emit('plot-click', plot)
}

const onCanvasHover = (e) => {
  hoveredIndex.value = getIndexFromEvent(e)
}

let animFrame = null
const animate = () => {
  render()
  animFrame = requestAnimationFrame(animate)
}

onMounted(() => {
  nextTick(animate)
})
watch(() => props.plots, () => render(), { deep: true })
</script>

<style scoped>
.farm-canvas {
  display: block;
  cursor: pointer;
  max-width: 100%;
  height: auto;
  border-radius: 16px;
}
</style>
