import * as ast from './ast'
import Token from './token'

// Tokenizer
export enum TokenType {
    // operators
    PLUS = 'PLUS',
    MINUS = 'MINUS',
    MUL = 'MUL',
    DIV = 'DIV',
    FLOOR = 'FLOOR',
    MOD = 'MOD',
    EXPONENT = 'EXPONENT',
    LT = 'LT',
    LTE = 'LTE',
    GTE = 'GTE',
    GT = 'GT',
    ASSIGN = 'ASSIGN',
    EQUAL = 'EQUAL',
    NOT_EQUAL = 'NOT_EQUAL',
    NOT = 'NOT',
    LOGICAL_OR = 'LOGICAL_OR',
    LOGICAL_AND = 'LOGICAL_AND',

    // delimiters
    L_PAREN = 'L_PAREN',
    R_PAREN = 'R_PAREN',
    L_CURLY = 'L_CURLY',
    R_CURLY = 'R_CURLY',
    L_BRACK = 'L_BRACK',
    R_BRACK = 'R_BRACK',
    SEMI = 'SEMI',
    DOT = 'DOT',
    COLON = 'COLON',
    COMMA = 'COMMA',

    // keywords
    NUMBER = 'NUMBER',
    STRING = 'STRING',
    BOOLEAN = 'BOOLEAN',
    ARRAY = 'ARRAY',
    NULL = 'NULL',
    VOID = 'VOID',
    IF = 'IF',
    ELSE = 'ELSE',
    FOR = 'FOR',
    WHILE = 'WHILE',
    LET = 'LET',
    RETURN = 'RETURN',
    FUNCTION = 'FUNCTION',
    TRUE = 'TRUE',
    FALSE = 'FALSE',
    STRUCT = 'STRUCT',
    BREAK = 'BREAK',
    CONTINUE = 'CONTINUE',
    IN = 'IN',

    // misc
    NUMBER_CONST = 'NUMBER_CONST',
    STRING_CONST = 'STRING_CONST',
    ARRAY_CONST = 'ARRAY_CONST',
    ID = 'ID',
    EOF = 'EOF',
    BLOCK = 'BLOCK',
    ROOT = 'ROOT',
    COMMENT = '#'
}

export type TokenValue = number | null | string | boolean | any[]

export type LineColTuple = [line: number, col: number]





// parser
export type StatementInfo = {
    topLevel?: boolean,
    inIterBlock?: boolean,
    inFunctionBlock?: boolean
}





// interpreter
export type InternalValue = (
    number | boolean | string | null | any[] | StructInstance | VoidReturn
)

export type IndexInfo = { array: any[], idx: number }

export type VarInfo = {
    value: InternalValue | undefined
    type: Token
}

export type IteratorVarInfo = {
    count: number
    name: string
    counterToken: Token
}

export type ScopeInjection = {
    iterVarInfo?: IteratorVarInfo,
    argsMap?: Map<string, VarInfo>
}

export type MemoryStack = Map<string, VarInfo>[]

export class StructInstance {
    structType: string
    firstAlias: string
    members: { [key: string]: InternalValue }
    constructor(alias: string, type: string, fields: ast.StructField[]) {
        this.firstAlias = alias
        this.structType = type
        this.members = {}
        for (const field of fields) {
            this.members[field.name] = null
        }
    }
}

export class VoidReturn { }

export class IterationBlockInterrupt extends Error {
    keyword: 'continue' | 'break'
    constructor(keyword: 'continue' | 'break') {
        super()
        this.keyword = keyword
    }
}

export class FunctionReturnBlockInterrupt extends Error {
    returnValue: InternalValue
    constructor(returnValue: InternalValue) {
        super()
        this.returnValue = returnValue
    }
}