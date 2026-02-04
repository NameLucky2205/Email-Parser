import React, { useState } from 'react'
import { History, Clock, Mail, Shield, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react'
import type { HistoryItem, ExtractHistoryItem, ValidateHistoryItem } from '../types/history'

interface HistoryPanelProps {
  history: HistoryItem[]
  onSelectItem: (item: HistoryItem) => void
  onRemoveItem: (id: string) => void
  onClearHistory: () => void
}

export function HistoryPanel({ history, onSelectItem, onRemoveItem, onClearHistory }: HistoryPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (history.length === 0) {
    return null
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Только что'
    if (diffMins < 60) return `${diffMins} мин. назад`
    if (diffHours < 24) return `${diffHours} ч. назад`
    if (diffDays === 1) return 'Вчера'
    if (diffDays < 7) return `${diffDays} дн. назад`

    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getItemTitle = (item: HistoryItem): string => {
    if (item.type === 'extract') {
      const extractItem = item as ExtractHistoryItem
      return `Извлечено ${extractItem.result.count} email`
    } else {
      const validateItem = item as ValidateHistoryItem
      return `Валидация ${validateItem.emailCount} email`
    }
  }

  const getItemSubtitle = (item: HistoryItem): string => {
    if (item.type === 'extract') {
      const extractItem = item as ExtractHistoryItem
      if (extractItem.source === 'text') return 'Из текста'
      if (extractItem.source === 'url') return extractItem.sourceValue
      return extractItem.sourceValue || 'Из файла'
    } else {
      const validateItem = item as ValidateHistoryItem
      return `${validateItem.result.valid} валидных, ${validateItem.result.invalid} невалидных`
    }
  }

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-full shadow-2xl hover:shadow-3xl transition-all hover:scale-105 z-50"
      >
        <History className="w-5 h-5" />
        <span>История ({history.length})</span>
      </button>

      {/* History Panel */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl z-50 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-500 to-purple-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <History className="w-6 h-6" />
                <h3 className="text-lg font-bold">История</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            {history.length > 0 && (
              <button
                onClick={onClearHistory}
                className="mt-2 text-sm text-white/90 hover:text-white underline"
              >
                Очистить всю историю
              </button>
            )}
          </div>

          {/* History Items */}
          <div className="flex-1 overflow-y-auto">
            {history.map((item) => {
              const isExpanded = expandedId === item.id
              return (
                <div
                  key={item.id}
                  className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 cursor-pointer" onClick={() => onSelectItem(item)}>
                        <div
                          className={`p-2 rounded-lg ${
                            item.type === 'extract'
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-green-100 text-green-600'
                          }`}
                        >
                          {item.type === 'extract' ? (
                            <Mail className="w-5 h-5" />
                          ) : (
                            <Shield className="w-5 h-5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 truncate">{getItemTitle(item)}</h4>
                          <p className="text-sm text-gray-600 truncate">{getItemSubtitle(item)}</p>
                          <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            <span>{formatDate(item.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-600" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-600" />
                          )}
                        </button>
                        <button
                          onClick={() => onRemoveItem(item.id)}
                          className="p-1 hover:bg-red-100 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        {item.type === 'extract' && (
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium text-gray-700">Найдено:</span>{' '}
                              <span className="text-gray-900">{(item as ExtractHistoryItem).result.count} email</span>
                            </div>
                            {(item as ExtractHistoryItem).validationResult && (
                              <div>
                                <span className="font-medium text-gray-700">Валидация:</span>{' '}
                                <span className="text-green-600">
                                  {(item as ExtractHistoryItem).validationResult!.valid} валидных
                                </span>
                                {', '}
                                <span className="text-red-600">
                                  {(item as ExtractHistoryItem).validationResult!.invalid} невалидных
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                        {item.type === 'validate' && (
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium text-gray-700">Проверено:</span>{' '}
                              <span className="text-gray-900">{(item as ValidateHistoryItem).emailCount} email</span>
                            </div>
                            <div>
                              <span className="text-green-600">
                                ✓ {(item as ValidateHistoryItem).result.valid}
                              </span>
                              {' | '}
                              <span className="text-red-600">
                                ✗ {(item as ValidateHistoryItem).result.invalid}
                              </span>
                              {' | '}
                              <span className="text-yellow-600">
                                ⚠ {(item as ValidateHistoryItem).result.disposable}
                              </span>
                            </div>
                          </div>
                        )}
                        <button
                          onClick={() => onSelectItem(item)}
                          className="mt-3 w-full py-2 px-4 bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-600 transition-colors text-sm"
                        >
                          Открыть результат
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
