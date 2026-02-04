import type { ExtractResponse, BulkValidationResponse } from './index'

export interface HistoryItemBase {
  id: string
  timestamp: number
  type: 'extract' | 'validate'
}

export interface ExtractHistoryItem extends HistoryItemBase {
  type: 'extract'
  source: string // 'text', 'url', 'file'
  sourceValue: string // текст источника, URL или имя файла
  result: ExtractResponse
  validationResult?: BulkValidationResponse // если была проведена валидация
}

export interface ValidateHistoryItem extends HistoryItemBase {
  type: 'validate'
  emailCount: number
  result: BulkValidationResponse
}

export type HistoryItem = ExtractHistoryItem | ValidateHistoryItem
