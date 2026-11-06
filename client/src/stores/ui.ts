/**
 * UI 态仓库：仅界面偏好（抽屉/命令面板开关等），不承载笔记数据。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  /** 回收站抽屉是否打开 */
  const trashDrawerOpen = ref(false)
  /** 命令面板（Ctrl+K）是否打开 */
  const commandOpen = ref(false)

  function openTrashDrawer() {
    trashDrawerOpen.value = true
  }
  function closeTrashDrawer() {
    trashDrawerOpen.value = false
  }
  function openCommandPalette() {
    commandOpen.value = true
  }
  function closeCommandPalette() {
    commandOpen.value = false
  }
  function toggleCommandPalette() {
    commandOpen.value = !commandOpen.value
  }

  return {
    trashDrawerOpen,
    commandOpen,
    openTrashDrawer,
    closeTrashDrawer,
    openCommandPalette,
    closeCommandPalette,
    toggleCommandPalette,
  }
})
