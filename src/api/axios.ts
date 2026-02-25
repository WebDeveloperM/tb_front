// src/api/axios.ts yoki axios.js
import axios from "axios";
import { BASE_URL } from "../utils/urls"; // Backend bazaviy URL manzili

const axioss = axios.create({
    baseURL: BASE_URL, // Barcha so'rovlar shu URL dan boshlanadi
    withCredentials: false, // Important for CORS requests
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
});

// **Har bir so'rov oldidan tokenni qo'shish**
axioss.interceptors.request.use(
    async (config) => {
        const token = localStorage.getItem("token"); // Tokenni localStorage'dan olish
        if (token) {
            config.headers.Authorization = `Token ${token}`; // Headerga token qo'shish
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default axioss; // Instanceni eksport qilamiz
