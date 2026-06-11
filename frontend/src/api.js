import axios from 'axios'

const TOKEN_KEY = 'farm_game_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers['x-auth-token'] = token
  }
  return config
})

api.interceptors.response.use(
  res => res.data,
  err => {
    const msg = err.response?.data?.error || err.message || '请求失败'
    return Promise.reject(new Error(msg))
  }
)

export const getUser = () => api.get('/user')
export const getCrops = () => api.get('/crops')
export const getPlots = () => api.get('/plots')
export const getInventory = () => api.get('/inventory')
export const getShop = () => api.get('/shop')

export const plantCrop = (plotIndex, cropId) =>
  api.post('/plant', { plotIndex, cropId })

export const waterPlot = (plotIndex) =>
  api.post('/water', { plotIndex })

export const harvestPlot = (plotIndex) =>
  api.post('/harvest', { plotIndex })

export const clearPlot = (plotIndex) =>
  api.post('/clear', { plotIndex })

export const buyFromShop = (itemType, itemId, quantity = 1) =>
  api.post('/shop/buy', { itemType, itemId, quantity })

export const claimMiniGameReward = (score, difficulty = 'normal') =>
  api.post('/mini-game/reward', { score, difficulty })

export const getAnimals = () =>
  api.get('/animals-corrected')

export const feedAnimal = (instanceId, feedId) =>
  api.post('/animal/feed', { instanceId, feedId })

export const collectAnimalProduct = (instanceId) =>
  api.post('/animal/collect', { instanceId })

export const expandPen = () =>
  api.post('/animal/pen-expand')

export const getRecipes = () =>
  api.get('/recipes')

export const getProcessingQueue = () =>
  api.get('/processing-queue')

export const startProcessing = (recipeId) =>
  api.post('/process/start', { recipeId })

export const collectProcessed = (queueId) =>
  api.post('/process/collect', { queueId })

export const sellItem = (itemType, itemId, quantity = 1) =>
  api.post('/inventory/sell', { itemType, itemId, quantity })

export const getFish = () =>
  api.get('/fish')

export const getFishingStatus = () =>
  api.get('/fishing/status')

export const catchFish = (accuracy) =>
  api.post('/fishing/catch', { accuracy })

export const getOfflineEarnings = () =>
  api.get('/offline-earnings')

export const claimOfflineEarnings = () =>
  api.post('/offline-earnings/claim')

export const register = (username, password) =>
  api.post('/auth/register', { username, password })

export const login = (username, password) =>
  api.post('/auth/login', { username, password })

export const logout = () =>
  api.post('/auth/logout')

export const getCurrentUser = () =>
  api.get('/auth/me')

export const getDecorations = () =>
  api.get('/decorations')

export const getUserDecorations = () =>
  api.get('/user/decorations')

export const buyDecoration = (decorationId, quantity = 1) =>
  api.post('/decoration/buy', { decorationId, quantity })

export const getPlacedDecorations = () =>
  api.get('/placed-decorations')

export const placeDecoration = (decorationId, x, y, layer = 0) =>
  api.post('/decoration/place', { decorationId, x, y, layer })

export const moveDecoration = (placedId, x, y, layer) =>
  api.post('/decoration/move', { placedId, x, y, layer })

export const removeDecoration = (placedId) =>
  api.post('/decoration/remove', { placedId })

export const getSettings = () =>
  api.get('/settings')

export const saveSettings = (settings) =>
  api.post('/settings', settings)
