import { apiService } from "../../config"
import { userEndpoint } from "./user.config"


const getList = async ()=>{
    const data = await apiService.get(userEndpoint.list)
    console.log("🚀 ~ getList ~ data:", data)

    return data.data
}

export const userAPIService = {
  getList
}