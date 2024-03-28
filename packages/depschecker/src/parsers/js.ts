import type { Parser, ParserCreator } from '../types'
import type { ParseResult } from '@babel/parser'
import traverse, { NodePath } from '@babel/traverse'
import * as t from '@babel/types'
import type {
  ExportAllDeclaration,
  ExportNamedDeclaration,
  ImportDeclaration,
  TemplateElement,
} from '@babel/types'

type Config = {
  types: Record<string, string>
}
type RcConfig = Partial<Config>

export const js: ParserCreator = rc => {
  const rcConfig = rc as RcConfig
  const config: Config = { types: { ...rcConfig.types } }

  const parser: Parser = ({ extension, js }, modules) => {
    const result: string[] = []
    const ast = js as ParseResult<t.File> | undefined
    if (!ast || extension === 'json') return result

    const addDep = (dep: string) => {
      const moduleNameRe = /^((@[^/]+\/)?[^.<][^/]*)?.*$/
      const name = moduleNameRe.exec(dep)?.[1]
      if (name && !result.includes(name)) result.push(name)
    }

    type ImportExportDeclaration =
      | ImportDeclaration
      | ExportAllDeclaration
      | ExportNamedDeclaration
    const importExportVisitor = (path: NodePath<ImportExportDeclaration>) => {
      if (!path.node.source) return
      addDep(path.node.source.value)
    }

    traverse(ast, {
      ImportDeclaration: importExportVisitor,
      ExportAllDeclaration: importExportVisitor,
      ExportNamedDeclaration: importExportVisitor,

      CallExpression: ({ node }) => {
        const isImport = t.isImport(node.callee)

        const isRequire =
          t.isIdentifier(node.callee) && node.callee.name === 'require'

        const isRequireResolve =
          t.isMemberExpression(node.callee) &&
          t.isIdentifier(node.callee.object) &&
          node.callee.object.name === 'require' &&
          t.isIdentifier(node.callee.property) &&
          node.callee.property.name === 'resolve'

        if (
          (!isRequire && !isRequireResolve && !isImport) ||
          (!t.isStringLiteral(node.arguments[0]) &&
            !(
              t.isTemplateLiteral(node.arguments[0]) &&
              node.arguments[0].expressions.length === 0 &&
              t.isTemplateElement(node.arguments[0].quasis[0])
            ))
        ) {
          return
        }

        addDep(
          t.isStringLiteral(node.arguments[0])
            ? node.arguments[0].value
            : (node.arguments[0].quasis[0] as TemplateElement).value.raw,
        )
      },
    })

    return result
      .flatMap(toTypesDep)
      .filter(dep => modules.includes(dep))
      .concat(result)
  }

  const toTypesDep = (dep: string) => {
    const moduleNameRe = /(?:@([^/]+)\/)?(.+)/
    return [
      config.types[dep],
      `@types/${dep.replace(moduleNameRe, '$1__$2').replace(/^__/, '')}`,
    ].filter(<T>(a: T | undefined): a is T => !!a)
  }

  return parser
}
