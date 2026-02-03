import axios, { HttpStatusCode } from "axios"
import queryString from "query-string"
import {  authEndpoint, apiAPIService } from "../api"

let refreshTokenRequest: ReturnType<(typeof apiAPIService)['refreshToken']> | null = null

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
  function (config) {
    return config
  },
  function (error) {
    return Promise.reject(error)
  },
)

apiService.interceptors.response.use(
  function (response) {
    return response.data
  },
  async function (error) {
    //TODO: handle error 404, 500
    console.log({ error })
    let refreshTokenSuccess = false
    const originalRequest = error.config
    const isRefreshTokenError = error.config.url === authEndpoint.refreshToken()
    const shouldRenewToken =
      error.response?.status === HttpStatusCode.Unauthorized && !originalRequest._retry

    if (isRefreshTokenError) return Promise.reject(error)

    if (shouldRenewToken) {
      originalRequest._retry = true

      try {
        refreshTokenRequest = refreshTokenRequest ?? apiAPIService.refreshToken()
        const response = await refreshTokenRequest
        refreshTokenSuccess = response.success
      } catch (_refreshError) {
        refreshTokenSuccess = false
      } finally {
        refreshTokenRequest = null
      }

      if (refreshTokenSuccess) return apiService(originalRequest)
      apiAPIService.redirectLogin()
      return Promise.reject(error)
    }

    if (error.response?.status === HttpStatusCode.Forbidden)
      window.location.href = '/forbidden'

    return Promise.reject(error)
  },
)

export  {apiService}