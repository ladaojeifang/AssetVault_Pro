import { jsendSuccess } from '../serialize'
import { assertLibraryReady } from './common'
import { mapFullPageThrown } from '../errors'
import {
  fullPageSessionAbort,
  fullPageSessionAppend,
  fullPageSessionFinish,
  fullPageSessionGet,
  fullPageSessionStart
} from '../../services/fullPageSession/fullPageSessionService'

async function wrap<T>(fn: () => Promise<T> | T): Promise<ReturnType<typeof jsendSuccess>> {
  try {
    assertLibraryReady()
    const data = await fn()
    return jsendSuccess(data)
  } catch (err) {
    throw mapFullPageThrown(err)
  }
}

export async function handleFullPageSessionStart(body: Record<string, unknown>) {
  return wrap(() => fullPageSessionStart(body))
}

export async function handleFullPageSessionAppend(body: Record<string, unknown>) {
  return wrap(() => fullPageSessionAppend(body))
}

export async function handleFullPageSessionFinish(body: Record<string, unknown>) {
  return wrap(() => fullPageSessionFinish(body))
}

export async function handleFullPageSessionAbort(sessionId: string) {
  return wrap(() => fullPageSessionAbort(sessionId))
}

export async function handleFullPageSessionGet(sessionId: string) {
  return wrap(() => fullPageSessionGet(sessionId))
}
