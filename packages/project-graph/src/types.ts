export type PackageJson = {
  name: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  workspaces?: string[]
  scripts?: Record<string, string>
}

export type Package = {
  path: string
  children: Package[]
  parents: Package[]
  childWorkspaces: Package[]
  rootPackage?: Package
} & PackageJson
