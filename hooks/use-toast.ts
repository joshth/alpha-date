"use client"

import * as React from "react"

interface ToastProps {
  id?: string
  title?: React.ReactNode
  description?: React.ReactNode
  duration?: number
  action?: React.ReactNode
  variant?: "default" | "destructive"
  onOpenChange?: (open: boolean) => void
}

interface ToastState extends ToastProps {
  id: string
  open: boolean
}

const TOAST_LIMIT = 3
const TOAST_REMOVE_DELAY = 5000
// How long to keep a dismissed toast mounted so Radix can play its exit animation.
const TOAST_EXIT_ANIMATION_MS = 300

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType =
  | { type: "ADD_TOAST"; toast: ToastState }
  | { type: "UPDATE_TOAST"; toast: Partial<ToastState> & { id: string } }
  | { type: "DISMISS_TOAST"; toastId?: string }
  | { type: "REMOVE_TOAST"; toastId?: string }

interface State {
  toasts: ToastState[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const scheduleDismiss = (toastId: string, delay: number) => {
  if (toastTimeouts.has(toastId)) {
    clearTimeout(toastTimeouts.get(toastId)!)
  }
  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({ type: "DISMISS_TOAST", toastId })
  }, delay)
  toastTimeouts.set(toastId, timeout)
}

const scheduleRemove = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    clearTimeout(toastTimeouts.get(toastId)!)
  }
  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({ type: "REMOVE_TOAST", toastId })
  }, TOAST_EXIT_ANIMATION_MS)
  toastTimeouts.set(toastId, timeout)
}

// Not a React useReducer — this is module-level state, so scheduling timers here is fine.
const reducer = (state: State, action: ActionType): State => {
  switch (action.type) {
    case "ADD_TOAST":
      scheduleDismiss(action.toast.id, action.toast.duration ?? TOAST_REMOVE_DELAY)
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }
    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      }
    case "DISMISS_TOAST": {
      const { toastId } = action
      state.toasts.forEach((t) => {
        if (toastId === undefined || t.id === toastId) {
          scheduleRemove(t.id)
        }
      })
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined ? { ...t, open: false } : t,
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return { ...state, toasts: [] }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
    default:
      return state
  }
}

const listeners: Array<(state: State) => void> = []
let memoryState: State = { toasts: [] }

function dispatch(action: ActionType) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => listener(memoryState))
}

function toast(props: Omit<ToastProps, "id" | "onOpenChange">) {
  const id = genId()
  const update = (newProps: Partial<ToastState>) => dispatch({ type: "UPDATE_TOAST", toast: { ...newProps, id } })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })
  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      // Radix fires this when the close button, swipe gesture, or its own
      // duration timer closes the toast — without it the X button is inert
      // because `open` is a controlled prop.
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })
  return { id, dismiss, update }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)
  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [])
  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast, type ToastProps }
