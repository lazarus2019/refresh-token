import axios, { HttpStatusCode } from "axios"
import queryString from "query-string"
import {  authEndpoint, apiAPIService } from "../api"

// let refreshTokenRequest: ReturnType<(typeof apiAPIService)['refreshToken']> | null = null
// let isRefreshing = false
// let pendingRequests: Array<VoidFunction> = []

// const waitForRefresh = (): Promise<void>=>{
//   return new Promise((resolve)=>{
//     pendingRequests.push(resolve)
//   })
// }

// const releaseRequests = ()=>{
//   pendingRequests.forEach(resolve => resolve())
//   pendingRequests = []
// }

const apiService = axios.create({
  baseURL: '/api/',
  headers: {},
  paramsSerializer: (params) =>
    queryString.stringify(params, {
      skipEmptyString: true,
      skipNull: true,
    }),
})

apiService.interceptors.request.use(
  async function (config) {
    const isRefreshCall = config.url === authEndpoint.refreshToken()

    console.log("🚀 ~ isRefreshing:", isRefreshing)
console.log("🚀 ~ pendingRequests:", pendingRequests)

    if (isRefreshing && !isRefreshCall) {
    await waitForRefresh()
  }
    return config
  },
  function (error) {
    return Promise.reject(error)
  },
)

console.log('aau')

// apiService.interceptors.response.use(
//   function (response) {
//     return response.data
//   },
//   async function (error) {
//     console.log("🚀 ~ error:", error)
//     //TODO: handle error 404, 500
//     let refreshTokenSuccess = false
//     const originalRequest = error.config
//     console.log("🚀 ~ originalRequest:", originalRequest)
//     const isRefreshTokenError = error.config.url === authEndpoint.refreshToken()
//     const shouldRenewToken =
//       error.response?.status === HttpStatusCode.Unauthorized && !originalRequest._retry
//     console.log("🚀 ~ shouldRenewToken:", shouldRenewToken)

//     if (isRefreshTokenError) return Promise.reject(error)

//       if(isRefreshing){
//         await waitForRefresh()
//         return apiService(originalRequest)
//       }

//       isRefreshing = true

//     if (shouldRenewToken) {
//       originalRequest._retry = true
      
//       console.log("🚀 ~ refreshTokenRequest:", refreshTokenRequest)
//       try {
//         refreshTokenRequest = refreshTokenRequest ?? apiAPIService.refreshToken()
//         const response = await refreshTokenRequest
//         console.log("🚀 ~ response:", response)
//         // refreshTokenSuccess = response.success
//         refreshTokenSuccess = true
//         releaseRequests()
//       } catch (_refreshError) {
//         refreshTokenSuccess = false
//       } finally {
//         refreshTokenRequest = null
//       }

//         console.log("🚀 ~ refreshTokenSuccess:", refreshTokenSuccess)
//       if (refreshTokenSuccess) return apiService(originalRequest)
//       apiAPIService.redirectLogin()
//       return Promise.reject(error)
//     }

//     if (error.response?.status === HttpStatusCode.Forbidden)
//       window.location.href = '/forbidden'

//     return Promise.reject(error)
//   },
// )

let isRefreshing = false
let refreshPromise: ReturnType<(typeof apiAPIService)['refreshToken']> | null = null
let pendingRequests: Array<() => void> = []

function waitForRefresh(): Promise<void> {
  return new Promise(resolve => {
    pendingRequests.push(resolve)
  })
}

function releaseRequests() {
  pendingRequests.forEach(resolve => resolve())
  pendingRequests = []
}

apiService.interceptors.response.use(
  res => res.data,
  async error => {
    const originalRequest = error.config

    const is401 = error.response?.status === 401
    const isRefreshCall = originalRequest.url === authEndpoint.refreshToken()

    if (!is401 || isRefreshCall || originalRequest._retry) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    // 🟥 Refresh already in progress → wait
    if (isRefreshing) {
      await waitForRefresh()
      return apiService(originalRequest)
    }

    // 🔒 Lock refresh
    isRefreshing = true

    try {
      refreshPromise = refreshPromise ?? apiAPIService.refreshToken()
      const response = await refreshPromise
      console.log("🚀 ~ response:", response)

      // 🍪 Cookies are now updated by browser
      releaseRequests()

      return apiService(originalRequest)
    } catch (e) {
      pendingRequests = []
      apiAPIService.redirectLogin()
      return Promise.reject(e)
    } finally {
      isRefreshing = false
      refreshPromise = null
    }
  }
)

export  {apiService}