export const defaultConfig = {
  ignoreFolders: ['node_modules', '.git', '.yarn'],
  ignoreFiles: ['*.d.ts'],
  read: ['\\.(m?jsx?|tsx?|json|sh|ya?ml)$'],
  transformers: ['packageJsonToSh', 'ymlToJs', 'toJsAst', 'toShAst'],
  ignoreUnspecified: ['fs', 'path', 'child_process', 'util', 'crypto'],
}
