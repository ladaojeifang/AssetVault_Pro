import { getLibraryInfo, getLibraryState } from '../../services/libraryApiService'
import { jsendSuccess } from '../serialize'

export async function handleLibraryInfo() {
  return jsendSuccess(await getLibraryInfo())
}

export function handleLibraryState() {
  return jsendSuccess(getLibraryState())
}
