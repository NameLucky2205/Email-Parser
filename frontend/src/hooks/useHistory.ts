import { useState, useEffect } from 'react'
import type { HistoryItem, ExtractHistoryItem, ValidateHistoryItem } from '../types/history'
import type { ExtractResponse, BulkValidationResponse } from '../types'

const HISTORY_KEY = 'email-parser-history'
const MAX_HISTORY_ITEMS = 50

export function useHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([])

  // Загрузить историю из localStorage при монтировании
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as HistoryItem[]
        setHistory(parsed)
      }
    } catch (error) {
      console.error('Failed to load history:', error)
    }
  }, [])

  // Сохранить историю в localStorage при изменении
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    } catch (error) {
      console.error('Failed to save history:', error)
    }
  }, [history])

  // Добавить запись извлечения
  const addExtractHistory = (
    source: string,
    sourceValue: string,
    result: ExtractResponse,
    validationResult?: BulkValidationResponse
  ) => {
    const item: ExtractHistoryItem = {
      id: `extract-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: 'extract',
      source,
      sourceValue,
      result,
      validationResult,
    }

    setHistory((prev) => {
      const newHistory = [item, ...prev]
      // Ограничить размер истории
      return newHistory.slice(0, MAX_HISTORY_ITEMS)
    })

    return item.id
  }

  // Обновить запись извлечения результатом валидации
  const updateExtractWithValidation = (id: string, validationResult: BulkValidationResponse) => {
    setHistory((prev) =>
      prev.map((item) => {
        if (item.id === id && item.type === 'extract') {
          return { ...item, validationResult }
        }
        return item
      })
    )
  }

  // Добавить запись валидации
  const addValidateHistory = (emailCount: number, result: BulkValidationResponse) => {
    const item: ValidateHistoryItem = {
      id: `validate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: 'validate',
      emailCount,
      result,
    }

    setHistory((prev) => {
      const newHistory = [item, ...prev]
      return newHistory.slice(0, MAX_HISTORY_ITEMS)
    })

    return item.id
  }

  // Удалить запись из истории
  const removeHistoryItem = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id))
  }

  // Очистить всю историю
  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem(HISTORY_KEY)
  }

  // Получить запись по ID
  const getHistoryItem = (id: string): HistoryItem | undefined => {
    return history.find((item) => item.id === id)
  }

  return {
    history,
    addExtractHistory,
    updateExtractWithValidation,
    addValidateHistory,
    removeHistoryItem,
    clearHistory,
    getHistoryItem,
  }
}
