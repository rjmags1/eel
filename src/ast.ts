import { TokenValue, Token } from './tokenizer'


export class AST { 
    token: Token
    constructor(token: Token) {
        this.token = token
    }
}

export class Number extends AST {
    value: number
    constructor(token: Token) {
        super(token)
        this.value = this.token.value as number
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