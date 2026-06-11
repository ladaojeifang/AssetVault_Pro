/**
 * Minimal OpenAPI 3 paths parser (no YAML dependency).
 * Expects Pro-style indentation under top-level `paths:`.
 */

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options'])

/**
 * @param {string} yamlText
 * @returns {Map<string, Set<string>>} path -> uppercase methods
 */
export function parseOpenApiPathMethods(yamlText) {
  const result = new Map()
  let inPaths = false
  let currentPath = null

  for (const line of yamlText.split('\n')) {
    if (!inPaths) {
      if (line === 'paths:') inPaths = true
      continue
    }

    if (/^[a-zA-Z][\w]*:/.test(line) && !line.startsWith(' ')) {
      break
    }

    const pathMatch = line.match(/^  (\/[^:]+):$/)
    if (pathMatch) {
      currentPath = pathMatch[1]
      result.set(currentPath, new Set())
      continue
    }

    if (!currentPath) continue

    const methodMatch = line.match(/^    ([a-z]+):$/)
    if (methodMatch && HTTP_METHODS.has(methodMatch[1])) {
      result.get(currentPath).add(methodMatch[1].toUpperCase())
    }
  }

  return result
}

/**
 * @param {Map<string, Set<string>>} openapi
 * @param {string} path
 * @param {string} method uppercase
 */
export function openApiHasOperation(openapi, path, method) {
  const methods = openapi.get(path)
  return Boolean(methods?.has(method))
}
