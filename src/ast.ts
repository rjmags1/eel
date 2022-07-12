import { Token } from './tokenizer'
import TokenType from './tokenTypes'


export class AST { 
    token: Token
    constructor(token: Token) {
        this.token = token
    }
}

export class Null extends AST {
    value: null
    constructor(token: Token) {
        super(token)
        this.value = this.token.value as null
    }
}

export class Array extends AST {
    value: any[]
    constructor(token: Token) {
        super(token)
        this.value = this.token.value as any[]
    }
}

export class ArrayIdx extends AST {
    array: AST
    idx: AST
    constructor(array: AST, idx: AST) {
        super(array.token)
        this.array = array
        this.idx = idx
    }
}

export class Number extends AST {
    value: number
    constructor(token: Token) {
        super(token)
        this.value = this.token.value as number
    }
}

export class String extends AST {
    value: string
    constructor(token: Token) {
        super(token)
        this.value = this.token.value as string
    }
}

export class Boolean extends AST {
    value: boolean
    constructor(token: Token) {
        super(token)
        this.value = this.token.value as boolean
    }
}

export class UnaryOp extends AST {
    op: Token
    operand: AST
    constructor(op: Token, operand: AST) {
        super(op)
        this.op = op
        this.operand = operand
    }
}

export class BinOp extends AST {
    op: Token
    left: AST
    right: AST
    constructor(left: AST, op: Token, right: AST) {
        super(op)
        this.left = left
        this.op = op
        this.right = right
    }
}

export class Var extends AST {
    constructor(token: Token) {
        super(token)
    }
}

export class VarDecl extends AST {
    alias: string
    type: Token
    constructor(declaratorToken: Token, alias: string, typeToken: Token) {
        super(declaratorToken)
        this.alias = alias
        this.type = typeToken
    }
}

export class Assign extends AST {
    left: AST
    right: AST
    constructor(left: AST, assign: Token, right: AST) {
        super(assign)
        this.left = left
        this.right = right
    }
}

export class Block extends AST {
    children: AST[]
    root: boolean
    constructor(token: Token, root=false) {
        super(token)
        this.root = root
        this.children = []
    }
}

export class StructDecl extends AST {
    name: string
    fields: StructField[]
    constructor(declaratorToken: Token, name: string, fields: StructField[]) {
        super(declaratorToken)
        this.name = name
        this.fields = fields
    }
}

export class StructField extends AST {
    name: string
    type: Token
    constructor(nameToken: Token, typeToken: Token) {
        super(nameToken)
        this.name = this.token.value as string
        this.type = typeToken
    }
}

export class StructMember extends AST {
    field: string
    structInstance: AST
    constructor(fieldToken: Token, struct: AST) {
        super(fieldToken)
        this.field = this.token.value as string
        this.structInstance = struct
    }
}