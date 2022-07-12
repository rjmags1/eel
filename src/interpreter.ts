import Parser from "./parser"
import * as ast from "./ast"
import TokenType from "./tokenTypes"
import { Token } from "./tokenizer"


type InternalValue = number | boolean | string | null | any[] | StructInstance

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
        else if (node instanceof ast.StructMember) {
            return this.visitStructMember(node)
        }

        throw new Error(`runtime error: unvisitable node in AST: 
            ${ this.stringifyLineCol(node) }`)
    }

    private stringifyLineCol(node: ast.AST) {
        return `line: ${ node.token.line } col: ${ node.token.col }`
    }

    private visitStructMember(node: ast.StructMember, mutating=false): InternalValue {
        const structInstance = this.visit(node.structInstance) as StructInstance
        if (!(structInstance instanceof StructInstance)) {
            throw new Error(
                `invalid attempt to access member of non-struct instance value:
                ${ this.stringifyLineCol(node)}`)
        }
        if (!(structInstance.members.hasOwnProperty(node.field))) {
            const internalStructInfo = this.globalMemory.get(
                structInstance.firstAlias) as VarInfo
            throw new Error(
                `reference error: field ${ node.field } not present on 
                 struct type ${ internalStructInfo.type.value },
                 ${ this.stringifyLineCol(node) }`)
        }

        return mutating ? structInstance : structInstance.members[node.field]
    }

    private mutateStruct(left: ast.StructMember, newValue: ast.AST): void {
        const internalStructInstance = this.visitStructMember(left, true) as StructInstance
        const structType = internalStructInstance.structType
        const fields = this.structs.get(structType) as ast.StructField[]
        const relevantFieldInfo = fields.filter(f => f.name === left.field)[0]
        const fieldTypeToken = relevantFieldInfo.type
        const visitedNewVal = this.visit(newValue) as InternalValue
        if (!this.assignedCorrectType(relevantFieldInfo.type, visitedNewVal, newValue)) {
            const fieldType = fieldTypeToken.type
            const dType = fieldTypeToken.type === TokenType.ID ? 
                `struct ${ fieldTypeToken.value }` : fieldType.toLowerCase()
            const aType = visitedNewVal instanceof StructInstance ?
                `struct ${ visitedNewVal.structType }` : typeof visitedNewVal
            throw new Error(
                `type error: declared field of type ${ dType } of struct type
                 ${ internalStructInstance.structType } cannot be assigned
                value of type ${ aType }, ${ this.stringifyLineCol(newValue)}`)
        }

        console.log("before", internalStructInstance)
        internalStructInstance.members[left.field] = visitedNewVal
        console.log("after", internalStructInstance)
    }

    private visitStructDecl(node: ast.StructDecl): void {
        if (this.structs.has(node.name)) {
            throw new Error(`struct of type ${ node.name } previously declared,
                ${ this.stringifyLineCol(node) }`)
        }
        const undeclaredStructFields = node.fields.filter(f => (
                f.type.type === TokenType.ID && 
                !this.structs.has(f.type.value as string))
            ).map(f => (f.type.value as string).toLowerCase())
        if (undeclaredStructFields.length > 0) {
            throw new Error(
                `undeclared struct type(s) ${ undeclaredStructFields } declared 
                as fields in declaration of struct ${ node.name },
                ${ this.stringifyLineCol(node) }`)
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
        if (left instanceof ast.StructMember) {
            this.mutateStruct(left, right)
            return
        }

        const declaringAndAssigning = left.token.type === TokenType.LET
        if (declaringAndAssigning) this.visitVarDecl(left as ast.VarDecl)
        const alias = declaringAndAssigning ?
            (left as ast.VarDecl).alias : left.token.value as string
        if (!declaringAndAssigning && !this.varIsDeclared(alias)) {
            throw new Error(`reference error: ${ alias } has not been declared,
                ${ this.stringifyLineCol(left) }`) 
        }

        const declaredTypeToken = (this.globalMemory.get(alias) as VarInfo).type
        const declaredType = declaredTypeToken.type
        const assignedVal = this.visit(right) as InternalValue
        if (!this.assignedCorrectType(declaredTypeToken, assignedVal, right)) {
            const dType = declaredType === TokenType.ID ? 
                `struct ${ declaredTypeToken.value }` : declaredType.toLowerCase()
            const aType = assignedVal instanceof StructInstance ?
                `struct ${ assignedVal.structType }` : typeof assignedVal
            throw new Error(
                `type error: var ${ alias } of type ${ dType } cannot
                be assigned value of type ${ aType }, ${ this.stringifyLineCol(left) }`)
        }

        this.globalMemory.set(alias, { 
            value: assignedVal as InternalValue,
            type: declaredTypeToken
        })

        console.log(this.globalMemory)
    }

    private assignedCorrectType(
        declaredTypeToken: Token, assignedVal: InternalValue, assignedNode: ast.AST): boolean {
        const declaredType = declaredTypeToken.type
        if (assignedVal === null) {
            return true
        }
        if (declaredType === TokenType.ID) {
            return assignedVal instanceof StructInstance &&
                declaredTypeToken.value === (assignedVal as StructInstance).structType
        }
        if (declaredType === TokenType.ARRAY) {
            return assignedVal instanceof Array
        }
        if (declaredType === TokenType.NUMBER) {
            return typeof assignedVal === 'number'
        }
        if (declaredType === TokenType.BOOLEAN) {
            return typeof assignedVal === 'boolean'
        }
        if (declaredType === TokenType.STRING) {
            return typeof assignedVal === 'string'
        }
        
        throw new Error(`runtime error while typechecking assignment,
            ${ this.stringifyLineCol(assignedNode) }`)
    }

    private visitArrayIdx(node: ast.ArrayIdx, mutating=false): InternalValue | IndexInfo {
        const array = this.visit(node.array)
        let idx = this.visit(node.idx) as number
        if (!(array instanceof Array)) {
            throw new Error(`index error: attempted to index non-array value,
                ${ this.stringifyLineCol(node.array) }`)
        }
        if (!(Number.isInteger(idx))) {
            throw new Error(`index error: non-integer index, 
                ${ this.stringifyLineCol(node.idx) }`)
        }
        if (idx < 0) idx += array.length
        if (idx < 0 || idx >= array.length) {
            throw new Error(`index error: out of bounds, 
                ${ this.stringifyLineCol(node.idx) }`)
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
            throw new Error(`reference error: ${ alias } previously declared,
                ${ this.stringifyLineCol(node) }`)
        }
        if (type.type !== TokenType.ID) {
            this.globalMemory.set(alias, { value: undefined, type: type })
            return
        }

        const structType = type.value as string
        if (!this.structs.has(structType)) {
            throw new Error(`struct of type ${ structType } has not been declared,
                ${ this.stringifyLineCol(node) }`)
        }
        const structFields = this.structs.get(structType) as ast.StructField[]
        this.globalMemory.set(alias, {
            value: new StructInstance(alias, structType, structFields),
            type: type
        })
        console.log(this.globalMemory)
    }

    private visitVar(node: ast.Var): InternalValue {
        const alias = node.token.value as string
        if (this.varIsDeclared(alias) && this.varIsDefined(alias)) {
            const varInfo = this.globalMemory.get(alias) as VarInfo
            return varInfo.value as InternalValue
        }

        throw new Error(`reference error: ${ alias } not defined,
            ${ this.stringifyLineCol(node) }`)
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

        const value = this.visit(node.operand)
        if (value === null) {
            throw new Error(`cannot perform unary ${ op.toLowerCase() } on a 
                null value, ${ this.stringifyLineCol(node) }`)
        }
        if (typeof value !== 'number' && op === TokenType.PLUS) {
            throw new Error(`cannot perform unary plus on non-number value,
                ${ this.stringifyLineCol(node) }`)
        }
        else if (typeof value !== 'number' && op === TokenType.MINUS) {
            throw new Error(
                `cannot perform unary minus on non-number value,
                ${ this.stringifyLineCol(node) }`)
        }

        if (op === TokenType.NOT) {
            if (typeof value !== 'boolean') {
                throw new Error(
                    `cannot perform logical negation on non-boolean value,
                    ${ this.stringifyLineCol(node) }`)
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
                `cannot perform op ${ node.op.value } on null values
                ${ this.stringifyLineCol(node) }`)
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
            `cannot perform ${ node.op.value } on operands of type 
            ${ typeof left } and ${ typeof right }, ${ this.stringifyLineCol(node) }`)
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

class StructInstance {
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