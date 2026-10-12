import { formatDate } from './dates'

// Placeholders available in the diary template (设置 → 日记模板)
export const TEMPLATE_PLACEHOLDERS = [{ key: '{{date}}', label: '日期，如 2026年10月12日 星期一' }]

export function applyDiaryTemplate(template: string, date: string): string {
  return template.split('{{date}}').join(formatDate(date))
}
