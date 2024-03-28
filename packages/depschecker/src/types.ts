export type File = Record<string, unknown> & {
  path: string
  extension: string
  content?: string
}

export type Transformer = (file: File) => File

export type Parser = (file: File, modules: string[]) => string[]
export type ParserCreator = (config: Record<string, unknown>) => Parser
