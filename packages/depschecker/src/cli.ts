import { generateProjectGraph, getPackage } from '@depschecker/project-graph'
import { getDepFilesMap } from './getDepFilesMap'
import path from 'path'
import { dedup, getDepsConfig, subtract } from './utils'
import { config } from './config'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import chalk from 'chalk'
import { readFiles } from './readFiles'
import { execSync } from 'child_process'

const args = yargs(hideBin(process.argv))
  .option('packages', {
    alias: 'p',
    type: 'array',
    string: true,
    description: 'Packages to check',
    default: [] as string[],
  })
  .option('includeParents', {
    alias: 'i',
    type: 'boolean',
    description: 'Include direct parents of packages being checked',
    default: false,
  })
  .option('since', {
    alias: 's',
    type: 'string',
    description:
      'Include packages that have been changed since the specified ref (Yarn only)',
  })
  .help('h')
  .alias('h', 'help')
  .version(false)
  .parseSync()

type YarnWorkspaceSpec = { location: string; name: string }

const graph = generateProjectGraph(true)
const packages = (() => {
  if (!args.since) return args.packages

  return execSync(`yarn workspaces list --since="${args.since}" --json`, {
    encoding: 'utf-8',
  })
    .split('\n')
    .filter(a => !!a)
    .map(spec => (JSON.parse(spec) as YarnWorkspaceSpec).name)
})()
const parentPackages = packages.flatMap(name =>
  getPackage(name, graph).parents.map(({ name }) => name),
)
const localPackages = graph.graphRoot.childWorkspaces
  .map(({ name }) => name)
  .concat(graph.graphRoot.name)
const packagesToCheck = dedup([
  ...(packages.length ? packages : localPackages),
  ...(args.includeParents ? parentPackages : []),
])

const checkTasks = packagesToCheck.map(async name => {
  const pkg = getPackage(name, graph)
  const pkgDepsConfig = getDepsConfig(pkg)
  // Must not be deduped because we want to check if duplicates are necessary.
  // For example, if a package has a peer dependency that is also specified as
  // devDependency, and this dependency is used only to satisfy child's
  // peer requirement, then devDependency is unnecessary.
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
    ...Object.keys(pkg.optionalDependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
    ...pkgDepsConfig.rootDependencies,
  ]
  const directChildren = pkg.children.filter(
    child => !pkg.peerDependencies?.[child.name],
  )

  const unmetPeers = directChildren.map(child => {
    const childPeers = Object.keys(child.peerDependencies || {})
    const ignoreUnmet = pkgDepsConfig.ignoreUnmet[child.name] || []
    const ignoreUnmetForAll = pkgDepsConfig.ignoreUnmet.all || []
    const pkgDeps = [...allDeps, ...ignoreUnmet, ...ignoreUnmetForAll]
    return { name: child.name, dependencies: subtract(childPeers, pkgDeps) }
  })
  const unmetRoot = pkg.childWorkspaces.map(child => {
    const rootDependencies = getDepsConfig(child).rootDependencies
    return {
      name: child.name,
      dependencies: subtract(rootDependencies, allDeps),
    }
  })
  const unmet = [...unmetPeers, ...unmetRoot].filter(
    unmet => unmet.dependencies.length,
  )

  const childPeers = directChildren.flatMap(a =>
    Object.keys(a.peerDependencies || {}),
  )
  const childRootDeps = pkg.childWorkspaces.flatMap(
    a => getDepsConfig(a).rootDependencies,
  )
  const childPeersAndRootDeps = dedup([...childPeers, ...childRootDeps])
  const unusedIgnoreUnmet = subtract(
    dedup(Object.values(pkgDepsConfig.ignoreUnmet).flat()),
    subtract(childPeersAndRootDeps, allDeps),
  )
  const maybeUnused = dedup(subtract(allDeps, childPeersAndRootDeps))

  const relativeBaseUrl =
    name in config.baseUrl ? config.baseUrl[name] : config.baseUrl.default
  const baseUrl = relativeBaseUrl
    ? path.join(pkg.path, relativeBaseUrl)
    : undefined

  const files = await readFiles(pkg.path, pkg.workspaces)
  const depFilesMap = getDepFilesMap(files, allDeps, baseUrl)
  const foundDeps = Object.keys(depFilesMap)

  const unusedDeps = subtract(maybeUnused, [
    ...foundDeps,
    ...pkgDepsConfig.ignoreUnused,
  ])
  const unusedIgnoreUnused = subtract(
    pkgDepsConfig.ignoreUnused,
    subtract(maybeUnused, foundDeps),
  )

  const unspecifiedDeps = subtract(foundDeps, [
    ...allDeps,
    ...pkgDepsConfig.ignoreUnspecified,
    ...config.ignoreUnspecified,
  ]).map(name => ({ name, files: depFilesMap[name] }))
  const unusedIgnoreUnspecified = subtract(
    pkgDepsConfig.ignoreUnspecified,
    subtract(foundDeps, [...allDeps, ...config.ignoreUnspecified]),
  )

  return {
    name,
    path: path.join(pkg.path, 'package.json'),
    unmet,
    unusedDeps,
    unspecifiedDeps,
    unusedIgnoreUnmet,
    unusedIgnoreUnused,
    unusedIgnoreUnspecified,
  }
})

void (async () => {
  const checks = await Promise.all(checkTasks)
  let thereWasError = false
  checks.forEach(
    ({
      name,
      path,
      unmet,
      unusedDeps,
      unspecifiedDeps,
      unusedIgnoreUnmet,
      unusedIgnoreUnused,
      unusedIgnoreUnspecified,
    }) => {
      if (
        !unmet.length &&
        !unusedDeps.length &&
        !unspecifiedDeps.length &&
        !unusedIgnoreUnmet.length &&
        !unusedIgnoreUnused.length &&
        !unusedIgnoreUnspecified.length
      ) {
        return
      }

      if (thereWasError) {
        console.log('\n' + '-'.repeat(process.stdout.columns))
      }
      thereWasError = true
      console.log(`\nPackage ${chalk.bold(name)}`)
      console.log(path)

      if (unusedDeps.length) {
        console.log(chalk.bold('\nUnused dependencies:'))
        console.log(unusedDeps.join('\n'))
      }

      if (unmet.length) {
        console.log(chalk.yellow.bold('\nUnmet peer dependencies'))
      }
      unmet.forEach(({ name, dependencies }) => {
        console.log(chalk.yellow(`${name}: ${dependencies.join(', ')}`))
      })

      unspecifiedDeps.forEach(({ name, files }) => {
        console.log(
          chalk.red(`\nDependency ${chalk.red.bold(name)} is unspecified`),
        )
        console.log(files?.join('\n'))
      })

      if (unusedIgnoreUnmet.length) {
        console.log(chalk.yellow.bold('\nUnused ignoreUnmet dependencies:'))
        console.log(chalk.yellow(unusedIgnoreUnmet.join('\n')))
      }

      if (unusedIgnoreUnused.length) {
        console.log(chalk.bold('\nUnused ignoreUnused dependencies:'))
        console.log(unusedIgnoreUnused.join('\n'))
      }

      if (unusedIgnoreUnspecified.length) {
        console.log(chalk.red('\nUnused ignoreUnspecified dependencies:'))
        console.log(unusedIgnoreUnspecified.join('\n'))
      }
    },
  )
  if (thereWasError) process.exit(1)
})()
