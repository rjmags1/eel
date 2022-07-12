import Parser from "./parser"
import * as ast from "./ast"
import TokenType from "./tokenTypes"
import { Token } from "./tokenizer"


type InternalValue = number | boolean | string | null | any[] 

type IndexInfo = { array: any[], idx: number }

type VarInfo = {
    value: InternalValue | undefined
    type: Token
}

export default class Interpreter {
    parser: Parser
    globalMemory: Map<string, VarInfo>
    structs: Map<string, ast.StructField[]>
    constructor(parser: Parser) {
        this.parser = parser
        this.globalMemory = new Map()
        this.structs = new Map()
    }

    interpret(): void {
        const ast: ast.AST = this.parser.buildAST()
        this.visit(ast)
    }

    private visit(node: ast.AST): InternalValue | void {
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
        else if (node instanceof ast.Boolean) {
            return this.visitBoolean(node)
        }
        else if (node instanceof ast.Null) {
            return this.visitNull(node)
        }
        else if (node instanceof ast.String) {
            return this.visitString(node)
        }
        else if (node instanceof ast.Array) {
            return this.visitArray(node)
        }
        else if (node instanceof ast.ArrayIdx) {
            return this.visitArrayIdx(node) as InternalValue
        }
        else if (node instanceof ast.StructDecl) {
            return this.visitStructDecl(node)
        }

        throw new Error('runtime error')
    }

    private visitStructDecl(node: ast.StructDecl) {
        if (this.structs.has(node.name)) {
            throw new Error(`struct of type ${ node.name } previously declared`)
        }
        const validTypes = new Set([
            TokenType.ARRAY,
            TokenType.STRING,
            TokenType.NUMBER,
            TokenType.BOOLEAN,
            TokenType.ID
        ])
        const invalidTypes = node.fields.map(f => f.type).filter(
            t => !validTypes.has(t.type)).map(t => t.type.toLowerCase())
        if (invalidTypes.length > 0) {
            throw new Error(
                `invalid struct field type(s) ${ invalidTypes } 
                in declaration of struct ${ node.name }`)
        }
        const undeclaredStructFields = node.fields.filter(
            f => f.type.type === TokenType.ID && 
                !this.structs.has(f.type.value as string)).map(
                    f => (f.type.value as string).toLowerCase())
        if (undeclaredStructFields.length > 0) {
            throw new Error(
                `undeclared struct types ${ undeclaredStructFields } declared 
                as fields in declaration of struct ${ node.name }`)
        }

        this.structs.set(node.name, node.fields)
        console.log(node.name, ':', (this.structs.get(node.name) as any).map(
            (f: ast.StructField) => [f.name, '->', f.type]))
    }

    private visitBlock(node: ast.Block): void {
        for (const child of node.children) {
            this.visit(child)
        }
    }

    private visitAssign(node: ast.Assign): void {
        const { left, right } = node
        if (left instanceof ast.ArrayIdx) {
            this.mutateArray(left, right)
            return
        }

        const declaringAndAssigning = left.token.type === TokenType.LET
        if (declaringAndAssigning) this.visitVarDecl(left as ast.VarDecl)
        const alias = declaringAndAssigning ?
            (left as ast.VarDecl).alias : left.token.value as string
        if (!declaringAndAssigning && !this.varIsDeclared(alias)) {
            throw new Error(`reference error: ${ alias } has not been declared`) 
        }

        const declaredTypeToken = (this.globalMemory.get(alias) as VarInfo).type
        const declaredType = declaredTypeToken.type
        const assignedVal = this.visit(right)
        if (assignedVal !== null && (
            (declaredType === TokenType.ARRAY && !(assignedVal instanceof Array)) ||
            (declaredType === TokenType.NUMBER && typeof assignedVal !== 'number') ||
            (declaredType === TokenType.BOOLEAN && typeof assignedVal !== 'boolean') ||
            (declaredType === TokenType.STRING && typeof assignedVal !== 'string'))) {
            throw new Error(
                `type error: var ${ alias } of type ${ declaredType.toLowerCase() } cannot
                be assigned value of type ${ typeof assignedVal }`)
        }

        this.globalMemory.set(alias, { 
            value: assignedVal as InternalValue,
            type: declaredTypeToken
        })

        console.log(this.globalMemory)
    }

    private visitArrayIdx(node: ast.ArrayIdx, mutating=false): InternalValue | IndexInfo {
        const array = this.visit(node.array)
        let idx = this.visit(node.idx) as number
        if (!(array instanceof Array)) {
            throw new Error("index error: cannot index non-array value")
        }
        if (!(Number.isInteger(idx))) {
            throw new Error("index error: non-integer index")
        }
        if (idx < 0) idx += array.length
        if (idx < 0 || idx >= array.length) {
            throw new Error("index error: out of bounds")
        }

        return mutating ? { array, idx } : array[idx]
    }

    private mutateArray(indexed: ast.ArrayIdx, newValue: ast.AST): void {
        const { array, idx } = this.visitArrayIdx(indexed, true) as IndexInfo
        array[idx] = this.visit(newValue)
        console.log(this.globalMemory)
    }

    private visitVarDecl(node: ast.VarDecl): void {
        const { alias, type } = node
        if (this.varIsDeclared(alias)) {
            throw new Error(`reference error: ${ alias } previously declared`)
        }

        this.globalMemory.set(alias, { value: undefined, type: type })
    }

    private visitVar(node: ast.Var): InternalValue {
        const alias = node.token.value as string
        if (this.varIsDeclared(alias) && this.varIsDefined(alias)) {
            const varInfo = this.globalMemory.get(alias) as VarInfo
            return varInfo.value as InternalValue
        }

        throw new Error(`reference error: ${ alias } not defined`)
    }

    private varIsDeclared(alias: string): boolean {
        return this.globalMemory.has(alias)
    }

    private varIsDefined(alias: string): boolean {
        return this.globalMemory.get(alias)?.value !== undefined
    }

    private visitArray(node: ast.Array): any[] {
        return node.value.map((elem: ast.AST) => this.visit(elem))
    }

    private visitNull(node: ast.Null): null {
        return node.value
    }

    private visitNumber(node: ast.Number): number {
        return node.value
    }
    
    private visitBoolean(node: ast.Boolean): boolean {
        return node.value
    }

    private visitString(node: ast.String): string {
        return node.value
    }

    private visitUnaryOp(node: ast.UnaryOp): number | boolean {
        const op = node.op.type
        if (![TokenType.NOT, TokenType.PLUS, TokenType.MINUS].includes(op)) {
            throw new Error(
                `invalid unary operator ${ node.op }`)
        }

        const value = this.visit(node.operand)
        if (value === null) {
            throw new Error(`cannot perform unary ${ op } on a null value`)
        }
        if (typeof value !== 'number' && op === TokenType.PLUS) {
            throw new Error("cannot perform unary plus on non-number value")
        }
        else if (typeof value !== 'number' && op === TokenType.MINUS) {
            throw new Error(
                "cannot perform numerical negation on non-number value")
        }

        if (op === TokenType.NOT) {
            if (typeof value !== 'boolean') {
                throw new Error(
                    "cannot perform logical negation on non-boolean value")
            }
            
            return !value
        }
        
        return op === TokenType.PLUS ? +value : -value
    }

    private visitBinOp(node: ast.BinOp): number | boolean {
        const op = node.op.type
        const left = this.visit(node.left)
        const right = this.visit(node.right)

        if ((left === null || right === null) &&
            ![TokenType.EQUAL, TokenType.NOT_EQUAL].includes(op)) {
            throw new Error(
                `cannot perform op ${ node.op.value } on null values`)
        }

        if (typeof left === 'number' && typeof right === 'number') {
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
            if (op === TokenType.LT) {
                return left < right
            }
            if (op === TokenType.LTE) {
                return left <= right
            }
            if (op === TokenType.GT) {
                return left > right
            }
            if (op === TokenType.GTE) {
                return left >= right
            }
        }

        else if (typeof left === 'string' && typeof right === 'string') {
            if (op === TokenType.LT) {
                return left < right
            }
            if (op === TokenType.LTE) {
                return left <= right
            }
            if (op === TokenType.GT) {
                return left > right
            }
            if (op === TokenType.GTE) {
                return left >= right
            }
        }
        
        else if (typeof left === 'boolean' && typeof right === 'boolean') {
            if (op === TokenType.LOGICAL_AND) {
                return left && right
            }
            if (op === TokenType.LOGICAL_OR) {
                return left || right
            }
        }

        else if (left instanceof Array && right instanceof Array) {
            if (op === TokenType.LT) {
                return left < right
            }
            if (op === TokenType.LTE) {
                return left < right || this.arrayEqual(left, right)
            }
            if (op === TokenType.GT) {
                return left > right
            }
            if (op === TokenType.GTE) {
                return left > right || this.arrayEqual(left, right)
            }
            if (op === TokenType.NOT_EQUAL) {
                return !this.arrayEqual(left, right)
            }
            if (op === TokenType.EQUAL) {
                return this.arrayEqual(left, right)
            }
        }
        
        if (op === TokenType.NOT_EQUAL) {
            return left !== right
        }
        if (op === TokenType.EQUAL) {
            return left === right
        }

        throw new Error(
            `cannot perform ${ op.toLowerCase() } on operands of type 
            ${ typeof left } and ${ typeof right }`)
    }

    private arrayEqual(left: any[], right: any[]): boolean {
        if (left === right) return true
        if (left.length !== right.length) return false

        let i = 0, l, r
        for (; i < left.length; i++) {
            l = left[i], r = right[i]
            if (l !== r) break
        }

        return l === r
    }
}