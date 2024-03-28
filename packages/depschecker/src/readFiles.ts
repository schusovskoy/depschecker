import { config } from './config'
import path from 'path'
import fs from 'fs/promises'
import type { File } from './types'
import { glob } from 'glob'

const extensionRe = /\.([^.]+)$/
const readContentRe = new RegExp(config.read.join('|'))

export const readFiles = async (
  root: string,
  ignorePatterns: string[] = [],
): Promise<File[]> => {
  const globConfig = { cwd: root, dot: true }
  const ignoreFolders = [...ignorePatterns, ...config.ignoreFolders]
  const ignore = await glob(ignoreFolders, globConfig)

  // We use glob negation patterns to obtain a list of all files excluding the ignored ones.
  // For instance, if we have folder `dist` in the ignore list and two packages
  // (packages/a and packages/b) containing it, we get the following ignore paths:
  // packages/a/dist, packages/b/dist. In this case, we construct the following object:
  // { '': ['packages'], 'packages': ['a', 'b'], 'packages/a': ['dist'], 'packages/b': ['dist'] }
  // Then, we build a list of negation patterns using the object above:
  // ['!(packages)', 'packages/!(a|b)', 'packages/a/!(dist)', 'packages/b/!(dist)']
  const negationsSpec = ignore.reduce<Record<string, string[]>>(
    (acc, ignoredFolder) => {
      ignoredFolder.split(path.sep).reduce((locator, part) => {
        if (!acc[locator]) acc[locator] = [part]
        else if (!acc[locator]?.includes(part)) acc[locator]?.push(part)
        return path.join(locator, part)
      }, '')

      return acc
    },
    { '': [] },
  )

  const ignoreFiles = config.ignoreFiles.join('|')
  const filePatterns = Object.entries(negationsSpec)
    .map(([start, negations]) =>
      path.join(start, `!(${negations.join('|')})`, `**/!(${ignoreFiles})`),
    )
    .concat([`!(${ignoreFiles})`])
  const filePaths = await glob(filePatterns, { ...globConfig, nodir: true })

  return Promise.all(
    filePaths.map(async filePath => {
      const fullPath = path.join(root, filePath)
      const extension = extensionRe.exec(fullPath)?.[1] || ''
      const result: File = { path: fullPath, extension }
      if (!readContentRe.test(fullPath)) return result

      const content = await fs.readFile(fullPath, { encoding: 'utf-8' })
      result.content = content
      return result
    }),
  )
}
