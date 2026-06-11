<template>
  <el-dialog
    v-model="visible"
    :title="isLogin ? '🔐 用户登录' : '📝 用户注册'"
    width="400px"
    center
    :close-on-click-modal="false"
  >
    <el-form :model="form" label-width="80px" @submit.prevent="onSubmit">
      <el-form-item label="用户名">
        <el-input
          v-model="form.username"
          placeholder="请输入用户名"
          clearable
          @keyup.enter="onSubmit"
        />
      </el-form-item>
      <el-form-item label="密码">
        <el-input
          v-model="form.password"
          type="password"
          placeholder="请输入密码"
          show-password
          @keyup.enter="onSubmit"
        />
      </el-form-item>
      <el-form-item v-if="!isLogin" label="确认密码">
        <el-input
          v-model="form.confirmPassword"
          type="password"
          placeholder="请再次输入密码"
          show-password
          @keyup.enter="onSubmit"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="auth-footer">
        <span class="switch-text" @click="toggleMode">
          {{ isLogin ? '没有账号？立即注册' : '已有账号？立即登录' }}
        </span>
        <div class="button-group">
          <el-button @click="visible = false">取消</el-button>
          <el-button type="primary" :loading="loading" @click="onSubmit">
            {{ isLogin ? '登录' : '注册' }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { login, register, setToken } from '../api.js'
import { playClick, playCoin } from '../utils/sound.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
})

const emit = defineEmits(['update:visible', 'success'])

const visible = computed({
  get: () => props.visible,
  set: v => emit('update:visible', v),
})

const isLogin = ref(true)
const loading = ref(false)
const form = reactive({
  username: '',
  password: '',
  confirmPassword: '',
})

watch(() => props.visible, (val) => {
  if (!val) {
    form.username = ''
    form.password = ''
    form.confirmPassword = ''
  }
})

const toggleMode = () => {
  playClick()
  isLogin.value = !isLogin.value
}

const onSubmit = async () => {
  if (loading.value) return

  if (!form.username.trim()) {
    ElMessage.warning('请输入用户名')
    return
  }
  if (!form.password) {
    ElMessage.warning('请输入密码')
    return
  }

  if (!isLogin.value) {
    if (form.password.length < 6) {
      ElMessage.warning('密码长度不能少于 6 位')
      return
    }
    if (form.password !== form.confirmPassword) {
      ElMessage.warning('两次输入的密码不一致')
      return
    }
  }

  try {
    loading.value = true
    let res
    if (isLogin.value) {
      res = await login(form.username.trim(), form.password)
    } else {
      res = await register(form.username.trim(), form.password)
    }

    if (res.token) {
      setToken(res.token)
    }

    playCoin()
    ElMessage.success(res.message || (isLogin.value ? '登录成功' : '注册成功'))
    emit('update:visible', false)
    emit('success', res.user)
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.switch-text {
  color: #409eff;
  cursor: pointer;
  font-size: 14px;
}

.switch-text:hover {
  text-decoration: underline;
}

.button-group {
  display: flex;
  gap: 10px;
}
</style>
