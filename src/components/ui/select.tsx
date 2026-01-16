'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, Check } from 'lucide-react'

interface SelectContextValue {
  value: string
  displayValue: string
  setDisplayValue: (value: string) => void
  onValueChange: (value: string, displayValue: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  disabled: boolean
  registerItem: (value: string, displayText: string) => void
}

const SelectContext = React.createContext<SelectContextValue | undefined>(undefined)

interface SelectProps {
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  disabled?: boolean
}

function Select({ value = '', onValueChange, children, disabled = false }: SelectProps) {
  const [open, setOpen] = React.useState(false)
  const [displayValue, setDisplayValue] = React.useState('')
  const itemsMapRef = React.useRef<Map<string, string>>(new Map())

  const handleValueChange = React.useCallback((newValue: string, newDisplayValue: string) => {
    setDisplayValue(newDisplayValue)
    onValueChange?.(newValue)
  }, [onValueChange])

  // 註冊 item 的值和顯示文字
  const registerItem = React.useCallback((itemValue: string, displayText: string) => {
    itemsMapRef.current.set(itemValue, displayText)
    // 如果當前值與此 item 匹配，更新 displayValue
    if (value === itemValue && !displayValue) {
      setDisplayValue(displayText)
    }
  }, [value, displayValue])

  // 當 value 改變時，從 itemsMap 中查找對應的 displayValue
  React.useEffect(() => {
    if (value && itemsMapRef.current.has(value)) {
      setDisplayValue(itemsMapRef.current.get(value) || '')
    } else if (!value) {
      setDisplayValue('')
    }
  }, [value])

  return (
    <SelectContext.Provider
      value={{
        value,
        displayValue,
        setDisplayValue,
        onValueChange: handleValueChange,
        open,
        setOpen: disabled ? () => {} : setOpen,
        disabled,
        registerItem,
      }}
    >
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  )
}

function SelectTrigger({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const context = React.useContext(SelectContext)
  if (!context) throw new Error('SelectTrigger must be used within Select')

  return (
    <button
      type="button"
      className={cn(
        'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      onClick={() => context.setOpen(!context.open)}
      disabled={context.disabled}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  )
}

function SelectValue({
  placeholder,
  children,
}: {
  placeholder?: string
  children?: React.ReactNode
}) {
  const context = React.useContext(SelectContext)
  if (!context) throw new Error('SelectValue must be used within Select')

  // 顯示 displayValue 或 placeholder
  const showPlaceholder = !context.value && !context.displayValue

  // 如果傳入 children，優先顯示 children（舊版兼容）
  if (children && context.value) {
    return <span>{children}</span>
  }

  return (
    <span className={cn(showPlaceholder && 'text-muted-foreground')}>
      {showPlaceholder ? placeholder : context.displayValue || context.value}
    </span>
  )
}

function SelectContent({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const context = React.useContext(SelectContext)
  if (!context) throw new Error('SelectContent must be used within Select')

  // 永遠渲染 children 以便 SelectItem 能夠註冊，但只在 open 時顯示
  return (
    <>
      {/* 隱藏的容器用於註冊 items */}
      <div className="hidden">{children}</div>

      {context.open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => context.setOpen(false)}
          />
          <div
            className={cn(
              'absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
              className
            )}
          >
            {children}
          </div>
        </>
      )}
    </>
  )
}

function SelectItem({
  value,
  children,
  className,
}: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  const context = React.useContext(SelectContext)
  if (!context) throw new Error('SelectItem must be used within Select')

  const isSelected = context.value === value

  // 取得顯示文字
  const getDisplayText = React.useCallback(() => {
    if (typeof children === 'string') return children
    // 嘗試從 React children 中提取文字
    const extractText = (node: React.ReactNode): string => {
      if (typeof node === 'string') return node
      if (typeof node === 'number') return String(node)
      if (Array.isArray(node)) return node.map(extractText).join('')
      if (React.isValidElement(node) && node.props.children) {
        return extractText(node.props.children)
      }
      return ''
    }
    return extractText(children)
  }, [children])

  // 註冊此 item
  React.useEffect(() => {
    context.registerItem(value, getDisplayText())
  }, [value, getDisplayText, context.registerItem])

  return (
    <div
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
        isSelected && 'bg-accent',
        className
      )}
      onClick={() => {
        context.onValueChange(value, getDisplayText())
        context.setOpen(false)
      }}
    >
      <span className="flex-1">{children}</span>
      {isSelected && <Check className="h-4 w-4 ml-2" />}
    </div>
  )
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
