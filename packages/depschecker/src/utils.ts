import type { Package } from '@depschecker/project-graph'

export const dedup = <T>(arr: T[]): T[] => [...new Set(arr)]

// Subtract elements from `from` array that are present in `arr`.
// Removes the same amount of repeated elements as in `arr`.
// Example: subtract([1, 2, 2, 3], [2, 3, 3]) => [1, 2]
export const subtract = <T>(from: T[], arr: T[]): T[] => {
  const copy = [...arr]
  return from.filter(a => {
    const index = copy.indexOf(a)
    if (index === -1) return true
    copy.splice(index, 1)
    return false
  })
}

type DepsConfig = {
  ignoreUnmet: Record<string, string[]>
  ignoreUnused: string[]
  ignoreUnspecified: string[]
  rootDependencies: string[]
}
type PackageWithDepsConfig = Package & { depschecker: Partial<DepsConfig> }

export const getDepsConfig = (pkg: Package): DepsConfig => {
  const config = hasDepsConfig(pkg) ? pkg.depschecker : {}
  return {
    ignoreUnmet: { ...config.ignoreUnmet },
    ignoreUnused: config.ignoreUnused || [],
    ignoreUnspecified: config.ignoreUnspecified || [],
    rootDependencies: config.rootDependencies || [],
  }
}

const hasDepsConfig = (pkg: Package): pkg is PackageWithDepsConfig =>
  'depschecker' in pkg && typeof pkg.depschecker === 'object'
