import * as XLSX from 'xlsx'
import type { BulkValidationResponse, ValidationResult, ExtractResponse } from '../types'

/**
 * Экспорт результатов валидации в Excel файл
 */
export function exportValidationToExcel(data: BulkValidationResponse) {
  // Создать данные для Excel
  const excelData = data.results.map((result: ValidationResult) => ({
    'Email': result.email,
    'Валидный': result.valid ? 'Да' : 'Нет',
    'Провайдер': result.provider?.provider || 'Неизвестно',
    'Домен': result.domain || '',
    'Формат': result.checks?.format ? 'Ок' : 'Ошибка',
    'MX записи': result.checks?.mx ? 'Найдены' : result.checks?.mx === false ? 'Не найдены' : 'Не проверялись',
    'Одноразовый': result.disposable?.is_disposable ? 'Да' : 'Нет',
    'Уровень риска': result.risk_level ? getRiskLevelLabel(result.risk_level) : 'Неизвестно',
    'Оценка риска': result.risk_score !== undefined ? result.risk_score : '',
    'Популярный провайдер': result.provider?.is_popular ? 'Да' : 'Нет',
    'Количество MX': result.mx_records?.mx_count || 0,
    'Основной MX': result.mx_records?.primary_mx || '',
    'Ошибка': result.error || '',
  }))

  // Создать сводную статистику
  const summaryData = [
    { 'Метрика': 'Всего email', 'Значение': data.total },
    { 'Метрика': 'Валидных', 'Значение': data.valid },
    { 'Метрика': 'Невалидных', 'Значение': data.invalid },
    { 'Метрика': 'Одноразовых', 'Значение': data.disposable },
    { 'Метрика': 'Высокий риск', 'Значение': data.high_risk },
    { 'Метрика': 'Время обработки (сек)', 'Значение': data.processing_time },
  ]

  // Создать workbook
  const workbook = XLSX.utils.book_new()

  // Добавить лист со сводкой
  const summarySheet = XLSX.utils.json_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Сводка')

  // Добавить лист с детальными результатами
  const detailsSheet = XLSX.utils.json_to_sheet(excelData)

  // Настроить ширину колонок
  const columnWidths = [
    { wch: 30 }, // Email
    { wch: 12 }, // Валидный
    { wch: 20 }, // Провайдер
    { wch: 20 }, // Домен
    { wch: 10 }, // Формат
    { wch: 15 }, // MX записи
    { wch: 12 }, // Одноразовый
    { wch: 15 }, // Уровень риска
    { wch: 12 }, // Оценка риска
    { wch: 18 }, // Популярный провайдер
    { wch: 12 }, // Количество MX
    { wch: 30 }, // Основной MX
    { wch: 30 }, // Ошибка
  ]
  detailsSheet['!cols'] = columnWidths

  XLSX.utils.book_append_sheet(workbook, detailsSheet, 'Детали')

  // Если есть списки валидных/невалидных email
  if (data.valid_emails.length > 0) {
    const validSheet = XLSX.utils.json_to_sheet(
      data.valid_emails.map(email => ({ 'Валидный Email': email }))
    )
    XLSX.utils.book_append_sheet(workbook, validSheet, 'Валидные')
  }

  if (data.invalid_emails.length > 0) {
    const invalidSheet = XLSX.utils.json_to_sheet(
      data.invalid_emails.map(item => ({
        'Невалидный Email': item.email,
        'Причина': item.error,
      }))
    )
    XLSX.utils.book_append_sheet(workbook, invalidSheet, 'Невалидные')
  }

  // Скачать файл
  const fileName = `email-validation-${new Date().toISOString().split('T')[0]}.xlsx`
  XLSX.writeFile(workbook, fileName)
}

/**
 * Экспорт списка извлеченных email в Excel файл
 */
export function exportEmailListToExcel(data: ExtractResponse, source: string = 'Unknown') {
  // Создать данные для Excel
  const excelData = data.emails.map((email, index) => ({
    '№': index + 1,
    'Email': email,
    'Источник': source,
  }))

  // Создать сводную статистику
  const summaryData = [
    { 'Метрика': 'Всего найдено', 'Значение': data.count },
    { 'Метрика': 'Время обработки (сек)', 'Значение': data.processing_time },
    { 'Метрика': 'Источник', 'Значение': source },
    { 'Метрика': 'Дата экспорта', 'Значение': new Date().toLocaleString('ru-RU') },
  ]

  // Создать workbook
  const workbook = XLSX.utils.book_new()

  // Добавить лист со сводкой
  const summarySheet = XLSX.utils.json_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Сводка')

  // Добавить лист с email адресами
  const emailsSheet = XLSX.utils.json_to_sheet(excelData)

  // Настроить ширину колонок
  emailsSheet['!cols'] = [
    { wch: 5 },  // №
    { wch: 35 }, // Email
    { wch: 20 }, // Источник
  ]

  XLSX.utils.book_append_sheet(workbook, emailsSheet, 'Email адреса')

  // Скачать файл
  const fileName = `email-extraction-${new Date().toISOString().split('T')[0]}.xlsx`
  XLSX.writeFile(workbook, fileName)
}

function getRiskLevelLabel(level: string): string {
  switch (level) {
    case 'low':
      return 'Низкий'
    case 'medium':
      return 'Средний'
    case 'high':
      return 'Высокий'
    default:
      return 'Неизвестно'
  }
}
