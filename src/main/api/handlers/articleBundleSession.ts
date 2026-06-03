import { jsendSuccess } from '../serialize'
import { assertLibraryReady } from './common'
import { mapArticleBundleThrown } from '../errors'
import {
  articleBundleSessionAbort,
  articleBundleSessionAppend,
  articleBundleSessionFinish,
  articleBundleSessionGet,
  articleBundleSessionStart
} from '../../services/articleBundleSession/articleBundleSessionService'

async function wrap<T>(fn: () => Promise<T> | T): Promise<ReturnType<typeof jsendSuccess>> {
  try {
    assertLibraryReady()
    const data = await fn()
    return jsendSuccess(data)
  } catch (err) {
    throw mapArticleBundleThrown(err)
  }
}

export async function handleArticleBundleSessionStart(body: Record<string, unknown>) {
  return wrap(() => articleBundleSessionStart(body))
}

export async function handleArticleBundleSessionAppend(body: Record<string, unknown>) {
  return wrap(() => articleBundleSessionAppend(body))
}

export async function handleArticleBundleSessionFinish(body: Record<string, unknown>) {
  return wrap(() => articleBundleSessionFinish(body))
}

export async function handleArticleBundleSessionAbort(sessionId: string) {
  return wrap(() => articleBundleSessionAbort(sessionId))
}

export async function handleArticleBundleSessionGet(sessionId: string) {
  return wrap(() => articleBundleSessionGet(sessionId))
}
