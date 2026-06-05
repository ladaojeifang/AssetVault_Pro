import { jsendSuccess } from '../serialize'
import { assertLibraryReady } from './common'
import { mapPageVideoThrown } from '../errors'
import {
  pageVideoImportBatch,
  pageVideoImportCancel,
  pageVideoImportCreate,
  pageVideoImportGetBatch,
  pageVideoImportGetJob
} from '../../services/pageVideoImport/pageVideoImportService'

async function wrap<T>(fn: () => Promise<T> | T): Promise<ReturnType<typeof jsendSuccess>> {
  try {
    assertLibraryReady()
    const data = await fn()
    return jsendSuccess(data)
  } catch (err) {
    throw mapPageVideoThrown(err)
  }
}

export async function handlePageVideoImportCreate(body: Record<string, unknown>) {
  return wrap(() => pageVideoImportCreate(body))
}

export async function handlePageVideoImportBatch(body: Record<string, unknown>) {
  return wrap(() => pageVideoImportBatch(body))
}

export async function handlePageVideoImportGetJob(jobId: string) {
  return wrap(() => pageVideoImportGetJob(jobId))
}

export async function handlePageVideoImportGetBatch(batchId: string) {
  return wrap(() => pageVideoImportGetBatch(batchId))
}

export async function handlePageVideoImportCancel(jobId: string) {
  return wrap(() => pageVideoImportCancel(jobId))
}
