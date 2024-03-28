import type { Parser, ParserCreator } from '../types'
import type { ParseResult } from '@babel/parser'
import traverse from '@babel/traverse'
import * as t from '@babel/types'
import type {
  ArrayExpression,
  MemberExpression,
  Node,
  ObjectProperty,
  StringLiteral,
} from '@babel/types'

const importComment = 'depschecker-import'
const ignoreComment = 'depschecker-ignore'
const toolComment = 'depschecker-tool:'

type KeyDescriptor = { include: string[]; exclude: string[] }
type ReplaceDescriptor = { keys: string[]; re: RegExp; replace: string }
type Config = {
  importObjectKeys: Record<string, KeyDescriptor>
  replace: Record<string, ReplaceDescriptor[]>
  configs: Record<string, { tool: string; deps: string[] }>
}
type RcConfig = {
  importObjectKeys?: string[]
  replace?: Record<string, Record<string, string>>
  configs?: Record<string, string | { tool: string; deps: string[] }>
}

export const configs: ParserCreator = rc => {
  const rcConfig = rc as RcConfig
  const rcReplaceMap = {
    ...rcConfig.replace,
    global: {
      '^((@[^/]+/)?[^.<][^/]*)?.*$': '$1',
      ...rcConfig.replace?.global,
    },
  }
  const configsEntries = Object.entries(rcConfig.configs || {}).map(entry => {
    const [key, value] = entry
    const normalized =
      typeof value === 'string' ? { tool: value, deps: [] } : value
    return [key, normalized] as const
  })
  const config: Config = {
    importObjectKeys: getImportObjectKeys(rcConfig.importObjectKeys || []),
    replace: createReplaceMap(rcReplaceMap),
    configs: Object.fromEntries(configsEntries),
  }

  const parser: Parser = ({ path, extension, js }) => {
    const configDescriptor = Object.entries(config.configs).find(([pattern]) =>
      new RegExp(pattern).test(path),
    )?.[1]
    const result = [...(configDescriptor?.deps || [])]

    const ast = js as ParseResult<t.File> | undefined
    if (!ast || ['jsx', 'tsx'].includes(extension)) return result
    if (extension === 'json' && !configDescriptor) return result

    const tool = (() => {
      if (configDescriptor) return configDescriptor.tool
      return ast.comments
        ?.find(({ value }) => value.indexOf(toolComment) !== -1)
        ?.value.match(new RegExp(`${toolComment} *([^ ]+)`))?.[1]
    })()
    const tools = tool?.split(',').filter(a => a !== 'global') || []

    const addDep = (dep: string, key?: string) => {
      const name = normalizeName(dep, tools, key)
      if (name && !result.includes(name)) result.push(name)
    }

    const hasLeadingComment = (node: Node, comment: string) =>
      !!node.leadingComments?.some(({ value }) => value.indexOf(comment) !== -1)

    const skipIfIgnored = (node: StringLiteral | ObjectProperty) => {
      if (hasLeadingComment(node, ignoreComment)) return
      if (t.isStringLiteral(node)) return node.value
      return t.isStringLiteral(node.key)
        ? node.key.value
        : t.isIdentifier(node.key)
          ? node.key.name
          : undefined
    }

    traverse(ast, {
      StringLiteral: ({ node }) => {
        if (!hasLeadingComment(node, importComment)) return
        addDep(node.value)
      },

      ObjectProperty: ({ node }) => {
        const key =
          (t.isStringLiteral(node.key) && node.key.value) ||
          (t.isIdentifier(node.key) && node.key.name)

        const keyDescriptor = key && config.importObjectKeys[key]
        if (!keyDescriptor) return

        const toolIsExcluded = tools.some(
          tool =>
            (keyDescriptor.include.length &&
              !keyDescriptor.include.includes(tool)) ||
            (keyDescriptor.exclude.length &&
              keyDescriptor.exclude.includes(tool)),
        )

        if (
          toolIsExcluded ||
          hasLeadingComment(node, ignoreComment) ||
          (!t.isStringLiteral(node.value) &&
            !t.isArrayExpression(node.value) &&
            !(
              t.isCallExpression(node.value) &&
              t.isMemberExpression(node.value.callee) &&
              t.isArrayExpression(node.value.callee.object)
            ))
        ) {
          return
        }

        const sources = (() => {
          if (t.isStringLiteral(node.value)) return [node.value.value]

          const elements = t.isArrayExpression(node.value)
            ? node.value.elements
            : (
                (node.value.callee as MemberExpression)
                  .object as ArrayExpression
              ).elements

          return elements.map(element => {
            if (!element) return
            if (t.isStringLiteral(element)) return skipIfIgnored(element)
            if (
              t.isArrayExpression(element) &&
              t.isStringLiteral(element.elements[0])
            ) {
              return skipIfIgnored(element.elements[0])
            }
            if (
              t.isLogicalExpression(element) &&
              t.isStringLiteral(element.right)
            ) {
              return skipIfIgnored(element.right)
            }
            if (
              t.isLogicalExpression(element) &&
              t.isArrayExpression(element.right) &&
              t.isStringLiteral(element.right.elements[0])
            ) {
              return skipIfIgnored(element.right.elements[0])
            }
            if (
              t.isObjectExpression(element) &&
              element.properties.length === 1 &&
              t.isObjectProperty(element.properties[0])
            ) {
              return skipIfIgnored(element.properties[0])
            }
          })
        })()

        sources
          .filter(<T>(a: T | undefined): a is T => !!a)
          .forEach(dep => addDep(dep, key))
      },
    })

    return result
  }

  const normalizeName = (name: string, tools: string[], key?: string) => {
    const descriptors = tools.reduce(
      (acc, tool) => acc.concat(config.replace[tool] || []),
      config.replace.global || [],
    )
    return descriptors.reduce((acc, { keys, re, replace }) => {
      if (keys.length && (!key || !keys.includes(key))) return acc
      return acc.replace(re, replace)
    }, name)
  }

  return parser
}

const getImportObjectKeys = (
  patterns: string[],
): Record<string, KeyDescriptor> => {
  const entries = patterns.map(pattern => {
    const descriptor = pattern.split('#') as [string, string | undefined]
    const [name, incExc] = [descriptor[0], descriptor[1]?.split(',') || []]
    const include = incExc.filter(
      tool => !tool.startsWith('!') && tool !== 'global',
    )
    const exclude = incExc
      .filter(tool => tool.startsWith('!'))
      .map(tool => tool.substring(1))
    return [name, { include, exclude }] as const
  })
  return Object.fromEntries(entries)
}

const createReplaceMap = (
  map: Record<string, Record<string, string>>,
): Record<string, ReplaceDescriptor[]> => {
  const entries = Object.entries(map).map(([tool, config]) => {
    const replaceDescriptors = Object.entries(config).map(
      ([pattern, replace]) => {
        const descriptor = pattern.split('#') as [string, string | undefined]
        const [re, keys] = [descriptor[0], descriptor[1]?.split(',') || []]
        return { keys, re: new RegExp(re), replace }
      },
    )
    return [tool, replaceDescriptors] as const
  })
  return Object.fromEntries(entries)
}
