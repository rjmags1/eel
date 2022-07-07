import Parser from "./parser"
import * as ast from "./ast"
import TokenType from "./tokenTypes"


interface VarInfo {
    value: number | undefined
    type: TokenType
}

export default class Interpreter {
    parser: Parser
    globalMemory: Map<string, VarInfo>
    constructor(parser: Parser) {
        this.parser = parser
        this.globalMemory = new Map()
    }

    interpret(): number | void {
        const ast: ast.AST = this.parser.buildAST()
        return this.visit(ast)
    }

    private visit(node: ast.AST): number | void {
        if (node instanceof ast.UnaryOp) {
            return this.visitUnaryOp(node)
        }
        else if (node instanceof ast.BinOp) {
            return this.visitBinOp(node)
        }
        else if (node instanceof ast.Number) {
            return this.visitNumber(node)
        }
        else if (node instanceof ast.Var) {
            return this.visitVar(node)
        }
        else if (node instanceof ast.VarDecl) {
            return this.visitVarDecl(node)
        }
        else if (node instanceof ast.Assign) {
            return this.visitAssign(node)
        }
        else if (node instanceof ast.Block) {
            return this.visitBlock(node)
        }

        throw new Error('runtime error')
    }

    private visitBlock(node: ast.Block): void {
        for (const child of node.children) {
            this.visit(child)
        }
    }

    private visitAssign(node: ast.Assign): void {
        const { left, right } = node

        const declaringAndAssigning = left.token.type === TokenType.LET
        if (declaringAndAssigning) this.visitVarDecl(left as ast.VarDecl)
        const alias = declaringAndAssigning ?
            (left as ast.VarDecl).alias : left.token.value as string
        if (!declaringAndAssigning && !this.varIsDeclared(alias)) {
            throw new Error( `reference error: ${ alias } has not been declared`) 
        }

        const declaredType = (this.globalMemory.get(alias) as VarInfo).type
        const assignedVal = this.visit(right)
        if (declaredType === TokenType.NUMBER && typeof assignedVal !== 'number') {
            throw new Error(
                `type error: var ${ alias } of type number cannot 
                be assigned value of type ${ typeof assignedVal }`)
        }

        this.globalMemory.set(alias, { 
            value: assignedVal as number,
            type: declaredType 
        })

        console.log(this.globalMemory)
    }

    private visitVarDecl(node: ast.VarDecl): void {
        const { alias, type } = node
        if (this.varIsDeclared(alias)) {
            throw new Error(`reference error: ${ alias } previously declared`)
        }

        this.globalMemory.set(alias, { value: undefined, type: type })
    }

    private visitVar(node: ast.Var): number {
        const alias = node.token.value as string
        if (this.varIsDeclared(alias) && this.varIsDefined(alias)) {
            const varInfo = this.globalMemory.get(alias) as VarInfo
            return varInfo.value as number
        }

        throw new Error(`reference error: ${ alias } not defined`)
    }

    private varIsDeclared(alias: string): boolean {
        return this.globalMemory.has(alias)
    }

    private varIsDefined(alias: string): boolean {
        return (
            this.globalMemory.has(alias) && 
            this.globalMemory.get(alias)?.value !== undefined)
    }

    private visitNumber(node: ast.Number): number {
        return node.value
    }

    private visitUnaryOp(node: ast.UnaryOp): number {
        const op = node.op.type
        const value = this.visit(node.operand)
        
        return op === TokenType.PLUS ? +value : -value
    }

    private visitBinOp(node: ast.BinOp): number {
        const op = node.op.type
        const left = this.visit(node.left) as number
        const right = this.visit(node.right) as number

        if (op === TokenType.EXPONENT) {
            return left ** right
        }
        if (op === TokenType.MUL) {
            return left * right
        }
        if (op === TokenType.DIV) {
            return left / right
        }
        if (op === TokenType.FLOOR) {
            return Math.floor(left / right)
        }
        if (op === TokenType.MOD) {
            return left % right
        }
        if (op === TokenType.PLUS) {
            return left + right
        }
        if (op === TokenType.MINUS) {
            return left - right
        }

        throw new Error()
    }
}