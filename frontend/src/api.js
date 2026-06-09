import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
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

export const buyFromShop = (cropId, quantity = 1) =>
  api.post('/shop/buy', { cropId, quantity })

export const claimMiniGameReward = (score) =>
  api.post('/mini-game/reward', { score })
