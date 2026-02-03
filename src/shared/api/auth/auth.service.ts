import type { AxiosResponse } from "axios"
import { apiService } from "../../config"
import { authEndpoint } from "./auth.config"

type Response = AxiosResponse<{
    success: string | null
}>

const refreshToken = async (): Promise<Response>=>{
    const data = await apiService.post(authEndpoint.refreshToken())

    return data.data
}

const redirectLogin =async ()=> {
    const data = await apiService.post(authEndpoint.login, {
        username: 'admin',
        password: 'password123'
    })
    console.log("🚀 ~ redirectLogin ~ data:", data)

    return data.data
}

const logout = async ()=>{
    const data = await apiService.post(authEndpoint.logout)

    return data.data
}

const getMe = async ()=>{
    const data = await apiService.get(authEndpoint.getMe)
    console.log("🚀 ~ getMe ~ data:", data)

    return data.data
}

export const apiAPIService = {
    refreshToken,
    redirectLogin,
    logout,
    getMe
}