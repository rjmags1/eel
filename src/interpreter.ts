import Parser from "./parser"
import * as ast from "./types/ast"
import Token from "./types/token"
import stdlib from "./lib/stdlib"
import {
    InternalValue, IndexInfo, VarInfo, ScopeInjection,
    MemoryStack, StructInstance, VoidReturn, IterationBlockInterrupt,
    FunctionReturnBlockInterrupt, TokenType
} from "./types/base"


export default class Interpreter {
    private parser: Parser
    private memoryStack: MemoryStack
    private structs: Map<string, ast.StructField[]>
    private functions: Map<string, ast.FunctionDecl>
    constructor(parser: Parser) {
        this.parser = parser
        this.memoryStack = []
        this.structs = new Map()
        this.functions = new Map()
    }

    public interpret(): void {
        /*
        main Interpreter method.

        builds AST using the parser and visits each node in the AST
        in a DFS manner.
        */

        const ast: ast.AST = this.parser.buildAST()
        this.visit(ast)
    }

    

    // visitors
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
        else if (node instanceof ast.MultiSelection) {
            return this.visitMultiSelection(node)
        }
        else if (node instanceof ast.WhileLoop) {
            return this.visitWhileLoop(node)
        }
        else if (node instanceof ast.IterControl) {
            return this.visitIterControl(node)
        }
        else if (node instanceof ast.ForLoop) {
            return this.visitForLoop(node)
        }
        else if (node instanceof ast.FunctionDecl) {
            return this.visitFunctionDecl(node)
        }
        else if (node instanceof ast.FunctionCall) {
            return this.visitFunctionCall(node)
        }
        else if (node instanceof ast.Return) {
            return this.visitReturn(node)
        }
        else if (node instanceof ast.StdLibCall) {
            return this.visitStdLibCall(node)
        }

        throw new Error(`runtime error: unvisitable node in AST: 
            ${ node } generated at ${ this.stringifyLineCol(node) }`)
    }

    private visitStdLibCall(node: ast.StdLibCall): InternalValue | void {
        const visitedArgs = node.args.map(arg => this.visit(arg))
        try {
            return stdlib[node.name](...visitedArgs)
        }
        catch (e) {
            throw new Error((e as Error).message + 
                `, ${ this.stringifyLineCol(node) }`)
        }
    }

    private visitFunctionCall(node: ast.FunctionCall): InternalValue | void {
        const { called, args } = node
        if (!this.functions.has(called)) {
            throw new Error(`attempted to call undeclared function ${ called },
                ${ this.stringifyLineCol(node) }`)
        }
        const { params, body: functionBody } = (
            this.functions.get(called) as ast.FunctionDecl)
        if (params.length !== args.length) {
            throw new Error(`calls to ${ called } expect ${ params.length } args 
                but ${ args.length } were provided, ${ this.stringifyLineCol(node) }`)
        }
        
        const paramsToArgVals = this.genArgsMap(params, args)
        try {
            // execute the call by visiting function block, passing its
            // params mapped to call arg values
            this.visitBlock(functionBody, { argsMap: paramsToArgVals })
            return new VoidReturn()
        }
        catch (e) {
            // if exception occurred during function block visit,
            // return the value passed in the exception instead of rethrowing
            if (e instanceof FunctionReturnBlockInterrupt) {
                return e.returnValue
            }
            throw e
        }
    }

    private visitReturn(node: ast.Return): void {
        /*
        throw FunctionReturnBlockInterrupt to return control to the nearest
        this.visitFunctionCall call on the internal (NodeJS) call stack
        */

        if (node.token.type === TokenType.VOID) {
            throw new FunctionReturnBlockInterrupt(new VoidReturn())
        }

        const retNode = node.returned as ast.AST
        throw new FunctionReturnBlockInterrupt(this.visit(retNode) as InternalValue)
    }

    private visitFunctionDecl(node: ast.FunctionDecl): void {
        const fnName = node.name.value as string
        this.checkStdlibCollision(node, fnName)
        if (this.functions.has(fnName) || this.varIsDeclared((fnName))) {
            throw new Error(`${ fnName } previously declared`)
        }

        const undeclaredStructTypeParams = node.params.filter(p => (
            p.type.type === TokenType.ID && 
            !this.structs.has(p.type.value as string))
        )
        if (undeclaredStructTypeParams.length > 0) {
            const undeclaredStructNames = undeclaredStructTypeParams.map(
                p => p.type.value)
            throw new Error(
                `invalid function param(s) of undeclared struct type(s) 
                ${ undeclaredStructNames }, ${ this.stringifyLineCol(node) }`)
        }

        this.functions.set(fnName, node)
    }

    private visitMultiSelection(node: ast.MultiSelection): void {
        for (const selection of node.selections) {
            const { condition, block } = selection
            const visitedCondition = this.visit(condition)
            if (typeof visitedCondition !== 'boolean') {
                throw new Error(`non boolean expression in conditional 
                    statement:  ${ this.stringifyLineCol(selection) }`)
            }
            if (visitedCondition) { 
                // visit the block of the first true if condition
                this.visitBlock(block)
                return
            }
        }

        if (node.default !== null) {
            this.visit(node.default)
        }
    }

    private visitStructMember(node: ast.StructMember, mutating=false): InternalValue {
        const structInstance = this.visit(node.structInstance) as StructInstance
        if (!(structInstance instanceof StructInstance)) {
            throw new Error(
                `invalid attempt to access member of non-struct instance value:
                ${ this.stringifyLineCol(node)}`)
        }

        // make sure <struct-instance>.member is actually a field of
        // struct type of <struct-instance>
        if (!(structInstance.members.hasOwnProperty(node.field))) {
            const internalStructInfo = this.memoryRetrieve(
                structInstance.firstAlias) as VarInfo
            throw new Error(
                `reference error: field ${ node.field } not present on 
                 struct type ${ internalStructInfo.type.value },
                 ${ this.stringifyLineCol(node) }`)
        }

        return mutating ? structInstance : structInstance.members[node.field]
    }

    private visitStructDecl(node: ast.StructDecl): void {
        if (this.structs.has(node.name)) {
            throw new Error(`struct of type ${ node.name } previously declared,
                ${ this.stringifyLineCol(node) }`)
        }
        
        // make sure any fields of a struct type correspond to a struct type
        // that has been declared
        const undeclaredStructTypeFields = node.fields.filter(f => (
                f.type.type === TokenType.ID && 
                !this.structs.has(f.type.value as string))
            ).map(f => (f.type.value as string).toLowerCase())
        if (undeclaredStructTypeFields.length > 0) {
            throw new Error(
                `undeclared struct type(s) ${ undeclaredStructTypeFields } declared 
                as fields in declaration of struct ${ node.name },
                ${ this.stringifyLineCol(node) }`)
        }

        this.structs.set(node.name, node.fields)
    }

    private visitBlock(
        node: ast.Block, 
        { iterVarInfo, argsMap }: ScopeInjection = {}
    ): void {
        this.memoryStack.push(new Map()) // put new block scope in memory

        if (iterVarInfo) { // if specified, load iterator var in new block scope
            this.memorySet(iterVarInfo.name, {
                value: iterVarInfo.count,
                type: iterVarInfo.counterToken
            }, true)
        }
        if (argsMap) { // if specified, load args map in new block scope
            argsMap.forEach(
                (varInfo, param) => this.memorySet(param, varInfo, true))
        }

        for (const child of node.children) {
            // execute each of the blocks child statements
            try {
                this.visit(child)
            }
            catch (e) {
                // pop this blocks scope from memory stack before rethrowing
                if (e instanceof IterationBlockInterrupt ||
                    e instanceof FunctionReturnBlockInterrupt) {
                    this.memoryStack.pop()
                }
                throw e
            }
        }

        // pop this blocks scope from memory stack after executing child statements
        this.memoryStack.pop() 
    }

    private visitIterControl(node: ast.IterControl): void {
        /*
        throw IterationBlockInterrupt to return control to nearest
        this.visitForLoop or this.visitWhileLoop on the internal (NodeJS) call stack
        */

        throw new IterationBlockInterrupt(node.keyword)
    }

    private visitForLoop(node: ast.ForLoop): void {
        const { start, stop, block, iterVar } = node
        const visitedStart = this.visit(start) as number
        const visitedStop = this.visit(stop) as number
        if ([visitedStart, visitedStop].some(bound => !Number.isInteger(bound))) {
            throw new Error(`non integer for loop bound, 
                ${ this.stringifyLineCol(node)}`)
        }

        let counter = visitedStart
        const counterToken = new Token(
            TokenType.NUMBER_CONST, 
            visitedStart, 
            iterVar.token.line, 
            iterVar.token.col
        )
        while (counter <= visitedStop) {
            const iterVarInfo = { 
                count: counter++,
                name: iterVar.token.value as string, 
                counterToken
            }
            try {
                this.visitBlock(block, { iterVarInfo })
            }
            catch (e) {
                if (e instanceof IterationBlockInterrupt) { // don't rethrow
                    if (e.keyword === 'continue') {
                        continue // visit the for loop block again
                    }
                    else { // e.keyword === 'break'
                        return // stop visiting the for loop block
                    }
                }
                throw e
            }
        }
    }

    private visitWhileLoop(node: ast.WhileLoop): void {
        const { condition, block } = node
        while (1) {
            const conditionStatus = this.visit(condition)
            if (typeof conditionStatus !== 'boolean') {
                throw new Error(`non boolean expression in while loop condition,
                    ${ this.stringifyLineCol(node) }`)
            }
            if (!conditionStatus) return

            try {
                this.visit(block)
            }
            catch (e) {
                if (e instanceof IterationBlockInterrupt) { // don't rethrow
                    if (e.keyword === 'continue') {
                        continue // visit the while loop block again
                    }
                    else {
                        return // stop visiting the while loop block
                    }
                }
                throw e
            }
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

        const declaredTypeToken = (this.memoryRetrieve(alias) as VarInfo).type
        const assignedVal = this.visit(right) as InternalValue
        if (!this.assignedCorrectType(declaredTypeToken, assignedVal, right)) {
            this.throwAssignedTypeError(declaredTypeToken, assignedVal, right, "var")
        }

        this.memorySet(alias, { 
            value: assignedVal as InternalValue,
            type: declaredTypeToken
        })
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
        
        
        if (idx < 0) idx += array.length // wrap negative index before EOB check
        if (idx < 0 || idx >= array.length) {
            throw new Error(`index error: out of bounds, 
                ${ this.stringifyLineCol(node.idx) }`)
        }

        return mutating ? { array, idx } : array[idx]
    }

    private visitVarDecl(node: ast.VarDecl): void {
        const { alias, type } = node
        this.checkStdlibCollision(node, alias)
        if (this.varIsDeclaredInCurrScope(alias)) {
            throw new Error(`reference error: ${ alias } previously declared,
                ${ this.stringifyLineCol(node) }`)
        }
        if (type.type !== TokenType.ID) {
            this.memorySet(alias, { value: undefined, type: type }, true)
            return
        }

        const structType = type.value as string
        if (!this.structs.has(structType)) {
            throw new Error(`struct of type ${ structType } has not been declared,
                ${ this.stringifyLineCol(node) }`)
        }
        const structFields = this.structs.get(structType) as ast.StructField[]
        this.memorySet(alias, {
            value: new StructInstance(alias, structType, structFields),
            type: type
        }, true)
    }

    private visitVar(node: ast.Var): InternalValue {
        const alias = node.token.value as string
        if (this.varIsDeclared(alias) && this.varIsDefined(alias)) {
            const varInfo = this.memoryRetrieve(alias) as VarInfo
            return varInfo.value as InternalValue
        }

        throw new Error(`reference error: variable ${ alias } not defined,
            ${ this.stringifyLineCol(node) }`)
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



    // mutators
    private mutateArray(indexed: ast.ArrayIdx, newValue: ast.AST): void {
        const { array, idx } = this.visitArrayIdx(indexed, true) as IndexInfo
        array[idx] = this.visit(newValue)
    }

    private mutateStruct(left: ast.StructMember, newValue: ast.AST): void {
        const internalStructInstance = this.visitStructMember(left, true) as StructInstance
        const structType = internalStructInstance.structType
        const fields = this.structs.get(structType) as ast.StructField[]
        const relevantFieldInfo = fields.filter(f => f.name === left.field)[0]
        const fieldTypeToken = relevantFieldInfo.type
        const visitedNewVal = this.visit(newValue) as InternalValue
        if (!this.assignedCorrectType(relevantFieldInfo.type, visitedNewVal, newValue)) {
            this.throwAssignedTypeError(fieldTypeToken, visitedNewVal, newValue, 
                `field of struct type ${ structType }`)
        }

        internalStructInstance.members[left.field] = visitedNewVal
    }



    // memory
    private memoryRetrieve(alias: string): VarInfo | null {
        for (let level = this.memoryStack.length - 1; level >= 0; level--) {
            const blockScopeAtLevel = this.memoryStack[level]
            if (blockScopeAtLevel.has(alias)) {
                return blockScopeAtLevel.get(alias) as VarInfo
            }
        }

        return null
    }

    private memorySet(alias: string, varInfo: VarInfo, currScope=false): void {
        const currScopeLevel = this.memoryStack.length - 1
        if (currScope) {
            this.memoryStack[currScopeLevel].set(alias, varInfo)
            return
        }

        for (let level = currScopeLevel; level >= 0; level--) {
            const blockScopeAtLevel = this.memoryStack[level]
            if (blockScopeAtLevel.has(alias)) {
                blockScopeAtLevel.set(alias, varInfo)
                return
            }
        }
    }

    private varIsDeclared(alias: string): boolean {
        return this.memoryRetrieve(alias) !== null
    }

    private varIsDefined(alias: string): boolean {
        return this.memoryRetrieve(alias)?.value !== undefined
    }

    private varIsDeclaredInCurrScope(alias: string) {
        return this.memoryStack[this.memoryStack.length - 1].has(alias)
    }



    // utils
    private stringifyLineCol(node: ast.AST) {
        return `line: ${ node.token.line } col: ${ node.token.col }`
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

    private checkStdlibCollision(node: ast.AST, alias: string): void {
        if (stdlib.hasOwnProperty(alias)) {
            throw new Error(`${ alias } has a name collision with a stdlib function,
                ${ this.stringifyLineCol(node) }`)
        }
    }

    private printMemory(): void {
        console.log("===============================")
        console.log(...this.memoryStack.map(
            (st, i) => [
                `level: ${ i }`, 
                `-------------------`,
                st
            ]).reverse())
        console.log("===============================")
    }

    private throwAssignedTypeError(
        expectedTypeToken: Token, 
        visitedAssigned: InternalValue, 
        assigned: ast.AST,
        assigningToType: string
    ): void {
        const dType = expectedTypeToken.type === TokenType.ID ? 
            `struct ${ expectedTypeToken.value }` : 
            expectedTypeToken.type.toLowerCase()
        const aType = visitedAssigned instanceof StructInstance ?
            `struct ${ visitedAssigned.structType }` : typeof visitedAssigned
        throw new Error(
            `type error: declared ${ assigningToType } of type  
            ${ dType } cannot be assigned value of type ${ aType }, 
            ${ this.stringifyLineCol( assigned )}`)
    }

    private genArgsMap(params: ast.Param[], args: ast.AST[]): Map<string, VarInfo> {
        const visitedArgs = args.map(arg => this.visit(arg))
        const argsMap: Map<string, VarInfo> = new Map()
        for (let i = 0; i < visitedArgs.length; i++) {
            const visitedArg = visitedArgs[i] as InternalValue
            const paramTypeToken = params[i].type
            if (!this.assignedCorrectType(paramTypeToken, visitedArg, args[i])) {
                this.throwAssignedTypeError(
                    paramTypeToken, visitedArg, args[i], "param")
            }

            argsMap.set(params[i].name as string, {
                value: visitedArg,
                type: params[i].type
            })
        }

        return argsMap
    }
}