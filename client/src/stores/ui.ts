/**
 * UI 态仓库：仅界面偏好（抽屉开关等），不承载笔记数据。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  /** 回收站抽屉是否打开 */
  const trashDrawerOpen = ref(false)

  function openTrashDrawer() {
    trashDrawerOpen.value = true
  }
  function closeTrashDrawer() {
    trashDrawerOpen.value = false
  }

  return { trashDrawerOpen, openTrashDrawer, closeTrashDrawer }
})
