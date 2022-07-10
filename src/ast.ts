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
    outerArray: AST
    idxs: AST[]
    constructor(outerArray: AST, idxs: AST[]) {
        super(outerArray.token)
        this.outerArray = outerArray
        this.idxs = idxs
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
    type: TokenType
    constructor(declaratorToken: Token, alias: string, typeToken: Token) {
        super(declaratorToken)
        this.alias = alias
        this.type = typeToken.type
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
    constructor(root=false) {
        super(new Token(TokenType.BLOCK, null))
        this.root = root
        this.children = []
    }
}