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
import { ref, onMounted, watch, nextTick, computed } from 'vue'

const props = defineProps({
  animals: { type: Array, default: () => [] },
  pen: { type: Object, default: () => ({ capacity: 2, level: 1, currentCount: 0, expandCost: 400 }) },
})
const emit = defineEmits(['animal-click', 'slot-empty-click', 'expand-click'])

const canvasRef = ref(null)
const hoveredIndex = ref(-1)

const capacity = computed(() => props.pen?.capacity || 2)
const cols = computed(() => Math.min(3, Math.max(2, Math.ceil(Math.sqrt(capacity.value)))))
const rows = computed(() => Math.ceil(capacity.value / cols.value))

const gap = 30
const padding = 30
const slotW = 200
const slotH = 200

const canvasWidth = computed(() => cols.value * slotW + (cols.value + 1) * gap + padding * 2)
const canvasHeight = computed(() => rows.value * slotH + (rows.value + 1) * gap + padding * 2 + 70)

const getSlotRect = (index) => {
  const c = cols.value
  const col = index % c
  const row = Math.floor(index / c)
  return {
    x: padding + gap + col * (slotW + gap),
    y: padding + gap + 60 + row * (slotH + gap),
    w: slotW,
    h: slotH,
  }
}

const getStatusBadge = (animal) => {
  if (animal.isBaby) return { text: '🐣 幼崽', color: '#9C27B0' }
  if (animal.isSick) return { text: '🤒 生病', color: '#F44336' }
  if (animal.hungerLevel >= 100) return { text: '🔥 饿坏了', color: '#D32F2F' }
  if (animal.canCollect) return { text: '✨ 可收集', color: '#FF9800' }
  if (animal.needFeed) return { text: '🍖 需喂食', color: '#FF5722' }
  if (animal.hungerLevel >= 60) return { text: '⚠️ 饥饿', color: '#FFC107' }
  return { text: '💚 良好', color: '#4CAF50' }
}

const drawPenSlot = (ctx, slotIndex, animal, rect, isHovered) => {
  const { x, y, w, h } = rect
  const radius = 20
  ctx.save()

  let baseColor = '#A1887F'
  let topColor = '#BCAAA4'
  let borderColor = '#6D4C41'

  if (animal) {
    if (animal.needFeed || animal.hungerLevel >= 60) {
      baseColor = '#FFAB91'
      topColor = '#FFCCBC'
    }
    if (animal.canCollect) {
      baseColor = '#FFB74D'
      topColor = '#FFE0B2'
      borderColor = '#F57C00'
    }
  } else {
    baseColor = '#D7CCC8'
    topColor = '#EFEBE9'
  }

  ctx.shadowColor = 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = isHovered ? 15 : 8
  ctx.shadowOffsetY = 4
  if (isHovered && !animal) ctx.shadowColor = 'rgba(76,175,80,0.6)'
  if (isHovered && animal?.canCollect) ctx.shadowColor = 'rgba(255,152,0,0.6)'

  roundRect(ctx, x, y, w, h, radius)
  ctx.fillStyle = baseColor
  ctx.fill()

  ctx.shadowBlur = 0
  ctx.save()
  roundRect(ctx, x, y, w, h, radius)
  ctx.clip()

  ctx.font = '100px sans-serif'
  ctx.globalAlpha = 0.08
  ctx.textAlign = 'center'
  ctx.fillText('🏡', x + w / 2, y + h / 2 + 30)
  ctx.globalAlpha = 1
  ctx.restore()

  ctx.save()
  roundRect(ctx, x, y, w, h, radius)
  ctx.strokeStyle = borderColor
  ctx.lineWidth = isHovered ? 4 : 3
  if (animal?.canCollect) {
    ctx.strokeStyle = '#FF9800'
    ctx.shadowColor = '#FFD700'
    ctx.shadowBlur = 12
  }
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.font = 'bold 12px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.fillText(`栏位 #${slotIndex + 1}`, x + 12, y + 22)
  ctx.restore()

  if (animal) {
    drawAnimal(ctx, animal, rect)
    drawHungerBar(ctx, animal, rect)
    drawProductProgress(ctx, animal, rect)
    drawAnimalBadge(ctx, animal, rect)
  } else {
    ctx.save()
    ctx.font = 'bold 16px sans-serif'
    ctx.fillStyle = 'rgba(109,76,65,0.6)'
    ctx.textAlign = 'center'
    ctx.fillText('空栏位', x + w / 2, y + h / 2 + 14)
    ctx.font = '44px sans-serif'
    ctx.globalAlpha = 0.5
    ctx.fillText('➕', x + w / 2, y + h / 2 - 30)
    ctx.restore()
  }

  ctx.restore()
}

const drawAnimal = (ctx, animal, rect) => {
  const { x, y, w, h } = rect
  ctx.save()
  const bounce = Math.sin(Date.now() / 500 + animal.slot) * 4

  if (animal.canCollect) {
    for (let i = 0; i < 5; i++) {
      const angle = (Date.now() / 400 + i) * 0.6
      const rad = 38 + Math.sin(angle) * 10
      ctx.font = `${22}px sans-serif`
      ctx.fillText(
        '✨',
        x + w / 2 + Math.cos(i * 1.26) * rad,
        y + h / 2 - 20 + Math.sin(i * 1.26) * rad
      )
    }
  }

  if (animal.needFeed || animal.hungerLevel >= 80) {
    ctx.font = '28px sans-serif'
    ctx.fillText('💭', x + w / 2 + 50, y + 35 + Math.sin(Date.now() / 300) * 3)
    ctx.font = '18px sans-serif'
    ctx.fillText('🍖', x + w / 2 + 52, y + 60)
  }

  const emojiSize = 72
  ctx.font = `${emojiSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(animal.emoji, x + w / 2, y + h / 2 - 25 + bounce)

  ctx.font = 'bold 14px sans-serif'
  ctx.fillStyle = '#4E342E'
  ctx.shadowColor = 'rgba(255,255,255,0.8)'
  ctx.shadowBlur = 3
  ctx.fillText(animal.name, x + w / 2, y + h - 50)

  if (animal.isBaby) {
    ctx.font = 'bold 11px sans-serif'
    ctx.fillStyle = '#9C27B0'
    ctx.fillText('【幼崽中...】', x + w / 2, y + h - 32)
  } else {
    ctx.font = '13px sans-serif'
    ctx.fillStyle = '#5D4037'
    ctx.shadowBlur = 0
    ctx.fillText(`${animal.productEmoji} ${animal.productName}`, x + w / 2, y + h - 32)
  }

  ctx.restore()
}

const drawHungerBar = (ctx, animal, rect) => {
  const { x, y, w, h } = rect
  const barW = w - 36
  const barH = 8
  const barX = x + 18
  const barY = y + h - 22

  ctx.save()
  roundRect(ctx, barX, barY, barW, barH, 4)
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.fill()

  const hunger = Math.min(100, animal.hungerLevel || 0)
  const fillW = ((100 - hunger) / 100) * barW
  let color = '#66BB6A'
  if (hunger >= 80) color = '#EF5350'
  else if (hunger >= 50) color = '#FFA726'
  roundRect(ctx, barX, barY, fillW, barH, 4)
  ctx.fillStyle = color
  ctx.fill()

  ctx.font = 'bold 9px sans-serif'
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'left'
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 2
  ctx.fillText('饱食', barX + 4, barY + 7)
  ctx.textAlign = 'right'
  ctx.fillText(`${100 - hunger}%`, barX + barW - 4, barY + 7)
  ctx.restore()
}

const drawProductProgress = (ctx, animal, rect) => {
  const { x, y, w, h } = rect
  if (animal.isBaby) return

  const barW = w - 36
  const barH = 6
  const barX = x + 18
  const barY = y + h - 82

  ctx.save()
  roundRect(ctx, barX, barY, barW, barH, 3)
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.fill()

  const progress = Math.min(100, animal.prodProgress || 0)
  const fillW = (progress / 100) * barW
  let color = '#42A5F5'
  if (progress >= 100) color = '#FF9800'
  roundRect(ctx, barX, barY, fillW, barH, 3)
  ctx.fillStyle = color
  ctx.fill()

  ctx.font = 'bold 9px sans-serif'
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'left'
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 1
  const label = progress >= 100 ? '✨ 就绪!' : animal.prodRemaining > 0 ? `${animal.prodRemaining}s` : '产出中'
  ctx.textAlign = 'right'
  ctx.fillText(label, barX + barW - 4, barY + 5)
  ctx.restore()
}

const drawAnimalBadge = (ctx, animal, rect) => {
  const { x, y, w } = rect
  const badge = getStatusBadge(animal)
  if (!badge) return

  ctx.save()
  ctx.font = 'bold 11px sans-serif'
  const metrics = ctx.measureText(badge.text)
  const badgeW = metrics.width + 16
  const badgeH = 20
  const badgeX = x + w / 2 - badgeW / 2
  const badgeY = y - 8

  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 10)
  ctx.fillStyle = badge.color
  ctx.shadowColor = 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = 4
  ctx.fill()

  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowBlur = 0
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

const drawHeader = (ctx) => {
  ctx.save()
  ctx.font = 'bold 24px sans-serif'
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'left'
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 4
  ctx.fillText('🐾 我的牧场', 40, 42)

  const pen = props.pen
  const capText = `容量: ${pen.currentCount || 0}/${pen.capacity}  等级: Lv.${pen.level}`
  ctx.font = 'bold 14px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.textAlign = 'right'
  const textX = canvasWidth.value - 40
  ctx.fillText(capText, textX, 40)

  ctx.font = '12px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.fillText(`扩建费用: ${pen.expandCost}💰`, textX, 60)

  ctx.restore()
}

const render = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value)

  const bg = ctx.createLinearGradient(0, 0, 0, canvasHeight.value)
  bg.addColorStop(0, 'rgba(255,228,181,0.5)')
  bg.addColorStop(1, 'rgba(210,180,140,0.5)')
  ctx.fillStyle = bg
  roundRect(ctx, 10, 10, canvasWidth.value - 20, canvasHeight.value - 20, 24)
  ctx.fill()

  drawHeader(ctx)

  const animalMap = new Map()
  props.animals.forEach(a => animalMap.set(a.slot, a))

  for (let i = 0; i < capacity.value; i++) {
    const animal = animalMap.get(i)
    const isHovered = hoveredIndex.value === i
    drawPenSlot(ctx, i, animal, getSlotRect(i), isHovered)
  }
}

const getIndexFromEvent = (e) => {
  const canvas = canvasRef.value
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const mx = (e.clientX - rect.left) * scaleX
  const my = (e.clientY - rect.top) * scaleY

  for (let i = 0; i < capacity.value; i++) {
    const r = getSlotRect(i)
    if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return i
  }
  return -1
}

const onCanvasClick = (e) => {
  const idx = getIndexFromEvent(e)
  if (idx === -1) return
  const animalMap = new Map()
  props.animals.forEach(a => animalMap.set(a.slot, a))
  const animal = animalMap.get(idx)
  if (animal) {
    emit('animal-click', animal)
  } else {
    emit('slot-empty-click', idx)
  }
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

watch(() => [props.animals, props.pen], () => render(), { deep: true })
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
