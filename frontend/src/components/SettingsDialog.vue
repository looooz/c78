<template>
  <el-dialog
    v-model="visible"
    title="⚙️ 游戏设置"
    width="420px"
    center
  >
    <div class="settings-content">
      <div class="setting-section">
        <div class="section-title">🔊 音效设置</div>
        <el-form label-width="100px">
          <el-form-item label="音效开关">
            <el-switch
              v-model="localSettings.soundEnabled"
              @change="onSoundChange"
              active-text="开"
              inactive-text="关"
            />
          </el-form-item>
          <el-form-item label="音量">
            <el-slider
              v-model="localSettings.volume"
              :min="0"
              :max="1"
              :step="0.1"
              :disabled="!localSettings.soundEnabled"
              @change="onVolumeChange"
              show-input
              :format-tooltip="(val) => Math.round(val * 100) + '%'"
            />
          </el-form-item>
        </el-form>
      </div>

      <div class="setting-section">
        <div class="section-title">🎨 画质设置</div>
        <el-form label-width="100px">
          <el-form-item label="画质等级">
            <el-radio-group v-model="localSettings.graphicsQuality" @change="saveSettings">
              <el-radio value="low">流畅</el-radio>
              <el-radio value="medium">均衡</el-radio>
              <el-radio value="high">高清</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>
      </div>

      <div class="setting-section">
        <div class="section-title">👤 账号设置</div>
        <div class="account-info">
          <el-tag v-if="currentUser" type="success">
            当前用户：{{ currentUser.username }}
          </el-tag>
          <el-tag v-else type="info">游客模式</el-tag>
        </div>
        <div class="account-actions">
          <el-button v-if="currentUser" type="danger" @click="onLogout">
            退出登录
          </el-button>
          <el-button v-else type="primary" @click="onLogin">
            登录 / 注册
          </el-button>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
      <el-button type="primary" @click="saveSettings">保存设置</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getSettings, saveSettings as saveSettingsApi, logout, clearToken } from '../api.js'
import { setSoundEnabled, setVolume, playClick } from '../utils/sound.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  currentUser: Object,
})

const emit = defineEmits(['update:visible', 'logout', 'login'])

const visible = computed({
  get: () => props.visible,
  set: v => emit('update:visible', v),
})

const localSettings = reactive({
  soundEnabled: true,
  musicEnabled: true,
  graphicsQuality: 'high',
  volume: 0.7,
  showTutorial: true,
})

const loading = ref(false)

const loadSettings = async () => {
  try {
    const settings = await getSettings()
    Object.assign(localSettings, settings)
    setSoundEnabled(settings.soundEnabled)
    setVolume(settings.volume)
  } catch (e) {
    console.warn('加载设置失败:', e.message)
  }
}

watch(() => props.visible, (val) => {
  if (val) {
    loadSettings()
  }
})

const onSoundChange = (val) => {
  playClick()
  setSoundEnabled(val)
}

const onVolumeChange = (val) => {
  setVolume(val)
}

const saveSettings = async () => {
  try {
    loading.value = true
    await saveSettingsApi({
      soundEnabled: localSettings.soundEnabled,
      musicEnabled: localSettings.musicEnabled,
      graphicsQuality: localSettings.graphicsQuality,
      volume: localSettings.volume,
    })
    setSoundEnabled(localSettings.soundEnabled)
    setVolume(localSettings.volume)
    playClick()
    ElMessage.success('设置已保存')
    emit('update:visible', false)
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

const onLogout = async () => {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await logout()
    clearToken()
    ElMessage.success('已退出登录')
    emit('logout')
    emit('update:visible', false)
  } catch (e) {
    if (e !== 'cancel' && e?.message !== 'cancel') {
      ElMessage.error(e.message || '操作取消')
    }
  }
}

const onLogin = () => {
  playClick()
  emit('login')
  emit('update:visible', false)
}
</script>

<style scoped>
.settings-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.setting-section {
  padding: 16px;
  background: #f5f7fa;
  border-radius: 12px;
}

.section-title {
  font-size: 16px;
  font-weight: bold;
  color: #333;
  margin-bottom: 12px;
}

.account-info {
  margin-bottom: 12px;
}

.account-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
