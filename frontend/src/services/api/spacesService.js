import apiClient from "./apiClient"

export const getSpaces = async ()=>{
    const {data} = await apiClient.get('/spaces');
    console.log(data);
    return data;
    


}