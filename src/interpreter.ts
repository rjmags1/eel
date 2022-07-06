import Parser from "./parser"
import * as ast from "./ast"
import TokenType from "./tokenTypes"


export default class Interpreter {
    parser: Parser
    constructor(parser: Parser) {
        this.parser = parser
    }

    interpret(): number {
        const ast: ast.AST = this.parser.buildAST()
        return this.visit(ast)
    }

    private visit(node: ast.AST): number {
        if (node instanceof ast.UnaryOp) {
            return this.visitUnaryOp(node)
        }
        else if (node instanceof ast.BinOp) {
            return this.visitBinOp(node)
        }
        else if (node instanceof ast.Number) {
            return this.visitNumber(node)
        }

        throw new Error('runtime error')
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
        const left = this.visit(node.left)
        const right = this.visit(node.right)

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