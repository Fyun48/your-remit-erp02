import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

export type AIProvider = 'openai' | 'gemini' | 'disabled'

export interface AIConfig {
  provider: AIProvider
  apiKey: string
  model?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AIResponse {
  content: string
  error?: string
}

const SYSTEM_PROMPT = `你是 ERP 系統的智慧助理。你可以幫助使用者：
1. 查詢資料（如請假記錄、出勤狀況、報銷單據）
2. 回答系統使用問題
3. 提供操作指引

請用繁體中文回答，保持簡潔友善的語氣。如果使用者詢問的功能不在系統範圍內，請禮貌地說明。`

export class AIService {
  private config: AIConfig

  constructor(config: AIConfig) {
    this.config = config
  }

  async chat(messages: ChatMessage[]): Promise<AIResponse> {
    if (this.config.provider === 'disabled' || !this.config.apiKey) {
      return {
        content: '',
        error: 'AI 服務未啟用。請聯繫系統管理員設定 API Key。',
      }
    }

    try {
      if (this.config.provider === 'openai') {
        return await this.chatWithOpenAI(messages)
      } else if (this.config.provider === 'gemini') {
        return await this.chatWithGemini(messages)
      }

      return {
        content: '',
        error: '不支援的 AI 供應商',
      }
    } catch (error) {
      console.error('AI Service Error:', error)
      return {
        content: '',
        error: error instanceof Error ? error.message : '發生未知錯誤',
      }
    }
  }

  private async chatWithOpenAI(messages: ChatMessage[]): Promise<AIResponse> {
    const openai = new OpenAI({
      apiKey: this.config.apiKey,
    })

    const model = this.config.model || 'gpt-3.5-turbo'

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.map(m => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })),
      ],
      max_tokens: 1000,
      temperature: 0.7,
    })

    const content = response.choices[0]?.message?.content || ''
    return { content }
  }

  private async chatWithGemini(messages: ChatMessage[]): Promise<AIResponse> {
    const genAI = new GoogleGenerativeAI(this.config.apiKey)
    const model = genAI.getGenerativeModel({
      model: this.config.model || 'gemini-pro'
    })

    // Convert messages to Gemini format
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const lastMessage = messages[messages.length - 1]

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: '請記住：' + SYSTEM_PROMPT }] },
        { role: 'model', parts: [{ text: '好的，我會遵守這些指引。' }] },
        ...history,
      ],
    })

    const result = await chat.sendMessage(lastMessage.content)
    const response = await result.response
    const content = response.text()

    return { content }
  }
}

// Factory function to create AI service from system settings
export function createAIService(config: AIConfig): AIService {
  return new AIService(config)
}

// Validate AI configuration
export function isAIConfigValid(config: Partial<AIConfig>): boolean {
  if (!config.provider || config.provider === 'disabled') {
    return false
  }
  if (!config.apiKey || config.apiKey.trim() === '') {
    return false
  }
  return true
}
