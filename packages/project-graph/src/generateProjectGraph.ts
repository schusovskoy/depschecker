import path from 'path'
import { fileExists, getPackage, loadJson, resolvePackageJson } from './utils'
import type { Package, PackageJson } from './types'
import { getProjectRoot } from './getProjectRoot'
import { globSync } from 'glob'

type ProjectGraph = Record<string, Package> & { graphRoot: Package }

export const generateProjectGraph = (
  includeNpmPackages = false,
): ProjectGraph => {
  const npmPackagesCache: Record<string, Package> = {}
  const root = getProjectRoot()
  const rootPackageJsonPath = path.join(root, 'package.json')
  const rootPackageJson = require(rootPackageJsonPath) as PackageJson
  const workspaces = rootPackageJson.workspaces || []

  const graph = globSync(workspaces, { cwd: root })
    .map(workspace => path.join(root, workspace, 'package.json'))
    .concat(rootPackageJsonPath)
    .filter(fileExists)
    .map(packageJsonPath => {
      const packageJson = require(packageJsonPath) as PackageJson
      const packagePath = path.dirname(packageJsonPath)
      return {
        ...packageJson,
        path: packagePath,
        children: [],
        parents: [],
        childWorkspaces: [],
      }
    })
    .reduce((acc, pkg) => ({ ...acc, [pkg.name]: pkg }), {} as ProjectGraph)

  Object.values(graph).forEach(workspacePackage => {
    workspacePackage.children = [
      ...Object.keys(workspacePackage.dependencies || {}),
      ...Object.keys(workspacePackage.devDependencies || {}),
      ...Object.keys(workspacePackage.optionalDependencies || {}),
    ]
      .map(dep => {
        const workspaceDep = graph[dep]
        if (workspaceDep) {
          workspaceDep.parents.push(workspacePackage)
          return workspaceDep
        }

        if (!includeNpmPackages) return

        const depPkgJsonPath = resolvePackageJson(dep, workspacePackage.path)
        if (!depPkgJsonPath) return

        const cachedPkg = npmPackagesCache[depPkgJsonPath]
        if (cachedPkg) {
          cachedPkg.parents.push(workspacePackage)
          return cachedPkg
        }

        const depPkgJson = loadJson(depPkgJsonPath) as PackageJson
        const depPath = path.dirname(depPkgJsonPath)
        const depPkg = {
          ...depPkgJson,
          path: depPath,
          children: [],
          parents: [workspacePackage],
          childWorkspaces: [],
        }
        npmPackagesCache[depPkgJsonPath] = depPkg
        return depPkg
      })
      .filter(<T>(a: T | undefined): a is T => !!a)
  })

  const graphRoot = getPackage(rootPackageJson.name, graph)
  graphRoot.childWorkspaces = Object.values(graph)
    .filter(pkg => pkg.name !== rootPackageJson.name)
    .map(pkg => ((pkg.rootPackage = graphRoot), pkg))
  graph.graphRoot = graphRoot

  return graph
}
