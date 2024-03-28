import type { ParserCreator } from '../types'
import shParser from 'mvdan-sh'
import type { File, Node, CallExpr, Lit } from 'mvdan-sh'

type Config = Record<string, string>

export const sh: ParserCreator = rc => {
  const config = rc as Config

  return ({ sh }) => {
    const result: string[] = []
    const ast = sh as File | undefined
    if (!ast) return result

    shParser.syntax.Walk(ast, node => {
      if (!isCallExpr(node)) return true
      const firstPart = node.Args[0]?.Parts[0]
      const secondPart = node.Args[1]?.Parts[0]
      if (!firstPart || !isLit(firstPart)) return true

      const firstArg = firstPart.Value
      const secondArg = secondPart && isLit(secondPart) && secondPart.Value
      const command = firstArg === 'npx' ? secondArg : firstArg

      const dep = command && config[command]
      if (dep && !result.includes(dep)) result.push(dep)
      return true
    })

    return result
  }
}

const isCallExpr = (node: Node): node is CallExpr =>
  shParser.syntax.NodeType(node) === 'CallExpr'

const isLit = (node: Node): node is Lit =>
  shParser.syntax.NodeType(node) === 'Lit'
