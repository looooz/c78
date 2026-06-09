<template>
  <div class="user-panel" v-if="user">
    <div class="user-info">
      <span class="avatar">👨‍🌾</span>
      <span class="username">{{ user.username }}</span>
      <el-tag type="danger" effect="dark" class="level-tag">Lv.{{ user.level }}</el-tag>
    </div>
    <div class="stats">
      <div class="stat-item coins">
        <span class="icon">💰</span>
        <span class="label">金币</span>
        <span class="value">{{ user.coins }}</span>
      </div>
      <div class="stat-item exp">
        <span class="icon">⭐</span>
        <span class="label">经验</span>
        <el-progress
          :percentage="expPercent"
          :stroke-width="14"
          :color="['#ffd700', '#ff8c00']"
          style="width: 140px;"
        >
          <span style="font-size: 11px; color: #fff; font-weight: bold;">
            {{ user.exp }}/{{ user.expNextLevel }}
          </span>
        </el-progress>
      </div>
      <div class="stat-item water">
        <span class="icon">💧</span>
        <span class="label">水源</span>
        <el-progress
          :percentage="waterPercent"
          :stroke-width="14"
          :color="['#87CEFA', '#4169E1']"
          style="width: 140px;"
        >
          <span style="font-size: 11px; color: #fff; font-weight: bold;">
            {{ user.water }}/{{ user.waterMax }}
          </span>
        </el-progress>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  user: { type: Object, default: null },
})

const expPercent = computed(() => {
  if (!props.user) return 0
  return Math.floor((props.user.exp / props.user.expNextLevel) * 100)
})
const waterPercent = computed(() => {
  if (!props.user) return 0
  return Math.floor((props.user.water / props.user.waterMax) * 100)
})
</script>

<style scoped>
.user-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 20px;
  color: #fff;
}
.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}
.avatar {
  font-size: 36px;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
}
.username {
  font-size: 20px;
  font-weight: bold;
  text-shadow: 1px 1px 3px rgba(0,0,0,0.4);
}
.level-tag {
  font-size: 14px;
  font-weight: bold;
  border-radius: 20px;
  padding: 4px 14px;
}
.stats {
  display: flex;
  align-items: center;
  gap: 28px;
  flex-wrap: wrap;
}
.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255,255,255,0.15);
  padding: 6px 14px;
  border-radius: 12px;
}
.stat-item .icon { font-size: 22px; }
.stat-item .label { font-weight: bold; font-size: 14px; }
.stat-item .value { font-weight: bold; font-size: 18px; color: #ffd700; }
</style>
