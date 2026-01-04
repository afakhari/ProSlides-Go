import axios from 'axios';
import { getApiBase } from "../utils/api";
import { getAuthHeaders } from "../utils/auth";

const api = axios.create({ baseURL: getApiBase() });

api.interceptors.request.use((config) => {
  config.headers = { ...config.headers, ...getAuthHeaders() };
  return config;
});

// const API_BASE_URL = 'https://api.proslides.ir/api';

export const quizService = {
  // ایجاد کوئیز خالی
  createEmptyQuiz: async () => {
    try {
      const response = await api.post(`/quizzes/`, {
        title: "Default",
        author: "anonymous",
        music_url: "",
        background_color: "#ffffff",
        background_image_url: ""
      });
      return response.data;
    } catch (error) {
      console.error('Error creating quiz:', error);
      throw error;
    }
  },

  // دریافت کوئیز
  getQuiz: async (quizId) => {
    try {
      const response = await api.get(`/quizzes/${quizId}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching quiz:', error);
      throw error;
    }
  },

  // به‌روزرسانی کوئیز
  updateQuiz: async (quizId, quizData) => {
    try {
      const response = await api.put(`/quizzes/${quizId}/`, quizData);
      return response.data;
    } catch (error) {
      console.error('Error updating quiz:', error);
      throw error;
    }
  },

  updateQuizMusic: async (quizId, musicUrl) => {
    try {
      const response = await api.patch(
        `/quizzes/${quizId}/`,
        { music_url: musicUrl } // تغییر فیلد به music_url
      );
      return response.data;
    } catch (error) {
      console.error('Error updating quiz music:', error);
      throw error;
    }
  },

  updateQuizBackground: async (quizId, backgroundData) => {
    try {
      // فقط فیلدهایی که مقدار دارند را می‌فرستیم
      const payload = {};
      
      if (backgroundData.background_color !== undefined) {
        payload.background_color = backgroundData.background_color;
      }
      
      if (backgroundData.background_image_url !== undefined) {
        payload.background_image_url = backgroundData.background_image_url;
      }
      
      const response = await api.patch(
        `/quizzes/${quizId}/`,
        payload
      );
      return response.data;
    } catch (error) {
      console.error('Error updating quiz background:', error);
      throw error;
    }
  },

  // دریافت سوال
  getQuestion: async (quizId, slideId) => {
    try {
      const response = await api.get(
        `/quizzes/${quizId}/slides/${slideId}/question/`
      );
      return response.data;
    } catch (error) {
      // اگر سوال وجود نداشت، null برمی‌گردانیم
      if (error.response?.status === 404) {
        return null;
      }
      console.error('Error fetching question:', error);
      throw error;
    }
  },

  // ایجاد سوال جدید
  createQuestion: async (quizId, slideId, questionData) => {
    try {
      const response = await api.post(
        `/quizzes/${quizId}/slides/${slideId}/question/`,
        questionData
      );
      return response.data;
    } catch (error) {
      console.error('Error creating question:', error);
      throw error;
    }
  },

  // به‌روزرسانی سوال موجود
  updateQuestion: async (quizId, slideId, questionData) => {
    try {
      const response = await api.put(
        `/quizzes/${quizId}/slides/${slideId}/question/`,
        questionData
      );
      return response.data;
    } catch (error) {
      console.error('Error updating question:', error);
      throw error;
    }
  },

  // دریافت گزینه‌های سوال
  getOptions: async (quizId, slideId) => {
    try {
      const response = await api.get(
        `/quizzes/${quizId}/slides/${slideId}/question/options/`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching options:', error);
      throw error;
    }
  },

  // ایجاد گزینه جدید
  createOption: async (quizId, slideId, optionData) => {
    try {
      const response = await api.post(
        `/quizzes/${quizId}/slides/${slideId}/question/options/`,
        optionData
      );
      return response.data;
    } catch (error) {
      console.error('Error creating option:', error);
      throw error;
    }
  },

  // به‌روزرسانی گزینه موجود
  updateOption: async (quizId, slideId, optionId, optionData) => {
    try {
      const response = await api.put(
        `/quizzes/${quizId}/slides/${slideId}/question/options/${optionId}/`,
        optionData
      );
      return response.data;
    } catch (error) {
      console.error('Error updating option:', error);
      throw error;
    }
  },

  // حذف گزینه
  deleteOption: async (quizId, slideId, optionId) => {
    try {
      await api.delete(
        `/quizzes/${quizId}/slides/${slideId}/question/options/${optionId}/`
      );
    } catch (error) {
      console.error('Error deleting option:', error);
      throw error;
    }
  },


  createSlide: async (quizId, slideData) => {
    try {
      const response = await api.post(
        `/quizzes/${quizId}/slides/`, 
        slideData
      );
      return response.data;
    } catch (error) {
      console.error('Error creating slide:', error);
      throw error;
    }
  },

  // به‌روزرسانی اسلاید (برای show_leaderboard_after)
  updateSlide: async (quizId, slideId, slideData) => {
    try {
      const response = await api.put(
        `/quizzes/${quizId}/slides/${slideId}/`,
        slideData
      );
      return response.data;
    } catch (error) {
      console.error('Error updating slide:', error);
      throw error;
    }
  },

  // حذف اسلاید
  deleteSlide: async (quizId, slideId) => {
    try {
      await api.delete(
        `/quizzes/${quizId}/slides/${slideId}/`
      );
    } catch (error) {
      console.error('Error deleting slide:', error);
      throw error;
    }
  },


  // به‌روزرسانی order یک اسلاید
  updateSlideOrder: async (quizId, slideId, order) => {
    try {
      const response = await api.patch(
        `/quizzes/${quizId}/slides/${slideId}/`, 
        { order }
      );
      return response.data;
    } catch (error) {
      console.error('Error updating slide order:', error);
      throw error;
    }
  },


  getSlidesFromAPI : async (quizId) => {
    try {
      const response = await api.get(
        `/quizzes/${quizId}/export/`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching slides from API:', error);
      throw error;
    }
  },

  deleteLeaderboardSlide : async (quizId, slideId) => {
    try {
        const response = await api.patch(
          `/quizzes/${quizId}/slides/${slideId}/`,
          {show_leaderboard_after: false}
        );
        return response.data;
    } catch (error) {
        console.error('Error updating slide:', error);
        throw error;
    }
  },

};