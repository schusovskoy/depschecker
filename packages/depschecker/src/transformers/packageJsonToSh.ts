import type { PackageJson } from 'project-graph'
import type { Transformer } from '../types'

export const packageJsonToSh: Transformer = file => {
  if (!file.content || !/\/package\.json$/.test(file.path)) return file
  const packageJson = JSON.parse(file.content) as PackageJson
  const scripts = packageJson.scripts || {}
  file.shSource = Object.values(scripts).join('\n')
  return file
}
