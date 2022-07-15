import Tokenizer, { Token } from "./tokenizer"
import TokenType from "./tokenTypes"
import * as ast from "./ast"
import stdlib from "./stdlib"

type StatementInfo = {
    topLevel?: boolean,
    inIterBlock?: boolean,
    inFunctionBlock?: boolean
}

export default class Parser {
    tokenizer: Tokenizer
    currToken: Token
    fnNames: Set<string>
    constructor(tokenizer: Tokenizer) {
        this.tokenizer = tokenizer
        this.currToken = this.nextToken()
        this.fnNames = new Set()
    }

    buildAST(): ast.Block {
        const rootToken = new Token(TokenType.ROOT, 'root', 0, 0)
        const root = new ast.Block(rootToken, true) // root=true
        while (this.currToken.type !== TokenType.EOF) {
            root.children.push(this.statement({ topLevel: true })) // topLevel=true
        }

        return root
    }

    private block(iterBlock: boolean, functionBlock: boolean): ast.Block {
        const block = new ast.Block(this.currToken)
        this.eat(TokenType.L_CURLY)
        while (this.currToken.type !== TokenType.R_CURLY) {
            block.children.push(this.statement({ 
                inIterBlock: iterBlock, inFunctionBlock: functionBlock }))
        }
        this.eat(TokenType.R_CURLY)

        return block
    }

    private statement({ 
        topLevel=false, 
        inIterBlock=false,
        inFunctionBlock=false 
    }: StatementInfo = {}): ast.AST {
        if (this.currToken.type === TokenType.IF) {
            return this.multiSelection({ inIterBlock, inFunctionBlock })
        }
        else if (this.currToken.type === TokenType.CONTINUE) {
            return this.iterControl({ inIterBlock })
        }
        else if (this.currToken.type === TokenType.BREAK) {
            return this.iterControl({ inIterBlock })
        }
        else if (this.currToken.type === TokenType.WHILE) {
            return this.whileLoop({ inFunctionBlock, inIterBlock: true })
        }
        else if (this.currToken.type === TokenType.FOR) {
            return this.forLoop({ inFunctionBlock, inIterBlock: true })
        }
        else if (this.currToken.type === TokenType.FUNCTION) {
            return this.functionDecl({ topLevel })
        }
        else if (this.currToken.type === TokenType.RETURN) {
            return this.return({ inFunctionBlock })
        }
        else if (this.currToken.type === TokenType.ID && (
                    this.fnNames.has(this.currToken.value as string) ||
                    stdlib.hasOwnProperty(this.currToken.value as string))) {
            return this.functionCall(this.variable(), true)
        }
        else {
            return this.declareAssign({ topLevel })
        }
    }

    private return({ inFunctionBlock }: StatementInfo): ast.Return {
        const returnToken = this.currToken
        if (!inFunctionBlock) {
            throw new Error(`illegal return statement outside of function block,
                ${ this.stringifyLineCol(returnToken) }`)
        }

        this.eat(TokenType.RETURN)
        const returnNode = new ast.Return(
            this.currToken.type === TokenType.SEMI ? 
                new Token(TokenType.VOID, 'void', 0, 0) : this.expr())
        this.eat(TokenType.SEMI)
        return returnNode
    }

    private functionDecl({ topLevel=false }: StatementInfo): ast.FunctionDecl {
        if (!topLevel) {
            throw new Error("illegal non-top level function declaration")
        }

        const fnToken = this.currToken
        this.eat(TokenType.FUNCTION)
        const nameToken = this.currToken
        this.fnNames.add(nameToken.value as string)
        this.eat(TokenType.ID)
        this.eat(TokenType.L_PAREN)
        const params = this.params()
        this.eat(TokenType.R_PAREN)
        this.eat(TokenType.COLON)
        return new ast.FunctionDecl(
            fnToken, nameToken, params, this.returnSpecifier(), this.block(false, true))
    }

    private params(): ast.Param[] {
        const params: ast.Param[] = []
        while (this.currToken.type !== TokenType.R_PAREN) {
            const nameToken = this.currToken
            this.eat(TokenType.ID)
            this.eat(TokenType.COLON)
            params.push(new ast.Param(nameToken, this.typeSpecifier()))
            if (this.currToken.type as TokenType !== TokenType.R_PAREN) {
                this.eat(TokenType.COMMA)
            }
        }

        return params
    }

    private forLoop({ inFunctionBlock=false }: StatementInfo): ast.ForLoop {
        const forToken = this.currToken
        this.eat(TokenType.FOR)
        const iterVar = this.variable()
        this.eat(TokenType.IN)
        this.eat(TokenType.L_BRACK)
        const start = this.expr()
        this.eat(TokenType.COMMA)
        const stop = this.expr()
        this.eat(TokenType.R_BRACK)
        return new ast.ForLoop(forToken, iterVar, start, stop, this.block(true, inFunctionBlock))
    }

    private whileLoop({ inFunctionBlock=false }: StatementInfo): ast.WhileLoop {
        const whileToken = this.currToken
        this.eat(TokenType.WHILE)
        this.eat(TokenType.L_PAREN)
        const condition = this.expr()
        this.eat(TokenType.R_PAREN)
        return new ast.WhileLoop(whileToken, condition, this.block(true, inFunctionBlock))
    }

    private iterControl({ inIterBlock }: StatementInfo): ast.IterControl {
        if (!inIterBlock) {
            throw new Error(`illegal ${ this.currToken.value } statement 
                outside of iteration block, 
                ${ this.stringifyLineCol(this.currToken) }`)
        }
        const controlNode = new ast.IterControl(this.currToken)
        if (this.currToken.type === TokenType.CONTINUE) {
            this.eat(TokenType.CONTINUE)
        }
        else {
            this.eat(TokenType.BREAK)
        }
        this.eat(TokenType.SEMI)

        return controlNode
    }

    private multiSelection({ 
        inIterBlock=false, 
        inFunctionBlock=false 
    }: StatementInfo): ast.MultiSelection {
        const ifToken = this.currToken
        const selections: ast.Selection[] = [this.selection({ inIterBlock, inFunctionBlock })]
        let defaultBlock: ast.Block | null = null
        while (this.currToken.type === TokenType.ELSE) {
            this.eat(TokenType.ELSE)
            if (this.currToken.type as TokenType === TokenType.L_CURLY) {
                defaultBlock = this.block(inIterBlock, inFunctionBlock)
                break
            }

            selections.push(this.selection({ inIterBlock, inFunctionBlock }))
        }

        return new ast.MultiSelection(ifToken, selections, defaultBlock)
    }

    private selection({ 
        inIterBlock=false, 
        inFunctionBlock=false 
    }: StatementInfo): ast.Selection {
        const ifToken = this.currToken
        this.eat(TokenType.IF)
        this.eat(TokenType.L_PAREN)
        const condition = this.expr()
        this.eat(TokenType.R_PAREN)
        return new ast.Selection(ifToken, condition, this.block(inIterBlock, inFunctionBlock))
    }

    private declareAssign({ topLevel }: StatementInfo): ast.AST {
        if (this.currToken.type === TokenType.STRUCT) {
            if (!topLevel) {
                throw new Error(`syntax error: illegal non top level struct 
                    declaration ${ this.stringifyLineCol(this.currToken) }`)
            }
            const structDec = this.structDecl()
            this.eat(TokenType.SEMI)
            return structDec
        }

        const left = this.currToken.type === TokenType.LET ?
            this.varDecl() : this.ref()
        if (this.currToken.type as TokenType !== TokenType.ASSIGN &&
            left instanceof ast.VarDecl) {
            this.eat(TokenType.SEMI)
            return left
        }

        const assignToken = this.currToken
        this.eat(TokenType.ASSIGN)
        const assignment = new ast.Assign(left, assignToken, this.expr())
        this.eat(TokenType.SEMI)
        return assignment
    }

    private stringifyLineCol(token: Token): string {
        const { line, col } = token
        return `line: ${ line } col: ${ col }`
    }

    private structDecl(): ast.StructDecl {
        const declaratorToken = this.currToken
        this.eat(TokenType.STRUCT)
        const structName = this.currToken.value as string
        this.eat(TokenType.ID)
        const openingCurlyToken = this.currToken
        this.eat(TokenType.L_CURLY)
        const fields: ast.StructField[] = []
        const fieldNames: Set<string> = new Set()
        while (this.currToken.type !== TokenType.R_CURLY) {
            const fieldToken = this.currToken
            const field = this.structField()
            if (fieldNames.has(field.name)) {
                throw new Error(
                    `duplicate struct fields: ${ this.stringifyLineCol(fieldToken) }`)
            }
            fields.push(field)
            fieldNames.add(field.name)
        }
        this.eat(TokenType.R_CURLY)

        if (fields.length === 0) {
            throw new Error( `empty structs not allowed: 
                ${ this.stringifyLineCol(openingCurlyToken)}`)
        }

        return new ast.StructDecl(declaratorToken, structName, fields)
    }

    private structField(): ast.StructField {
        const field = this.currToken
        this.eat(TokenType.ID)
        this.eat(TokenType.COLON)
        const fieldType = this.typeSpecifier()
        if (this.currToken.type !== TokenType.R_CURLY) {
            this.eat(TokenType.COMMA)
        }

        return new ast.StructField(field, fieldType)
    }

    private varDecl(): ast.VarDecl {
        const declaratorToken = this.currToken
        this.eat(TokenType.LET)
        const alias = this.currToken.value as string
        this.eat(TokenType.ID)
        this.eat(TokenType.COLON)

        return new ast.VarDecl(declaratorToken, alias, this.typeSpecifier())
    }

    private returnSpecifier(): Token {
        try {
            return this.typeSpecifier()
        }
        catch (e) {
            if (this.currToken.type === TokenType.VOID) {
                const voidToken = this.currToken
                this.eat(TokenType.VOID)
                return voidToken
            }
            throw e
        }
    }

    private typeSpecifier(): Token {
        const token = this.currToken
        if (this.currToken.type === TokenType.NUMBER) {
            this.eat(TokenType.NUMBER)
        }
        else if (this.currToken.type === TokenType.BOOLEAN) {
            this.eat(TokenType.BOOLEAN)
        }
        else if (this.currToken.type === TokenType.STRING) {
            this.eat(TokenType.STRING)
        }
        else if (this.currToken.type === TokenType.ARRAY) {
            this.eat(TokenType.ARRAY)
        }
        else if (this.currToken.type === TokenType.STRUCT) {
            this.eat(TokenType.STRUCT)
            const structType = this.currToken
            this.eat(TokenType.ID)
            return structType
        }
        else {
            throw new Error(`unexpected token - expected a type specifier:
                ${ this.stringifyLineCol(token) }`)
        }

        return token
    }

    private expr(): ast.AST {
        let expr = this.equality()
        while ([
            TokenType.LOGICAL_AND, TokenType.LOGICAL_OR
        ].includes(this.currToken.type)) {
            const opToken = this.currToken
            if (opToken.type === TokenType.LOGICAL_AND) {
                this.eat(TokenType.LOGICAL_AND)
            }
            else {
                this.eat(TokenType.LOGICAL_OR)
            }

            expr = new ast.BinOp(expr, opToken, this.equality())
        }

        return expr
    }

    private equality(): ast.AST {
        let eq = this.compare()
        while ([
            TokenType.NOT_EQUAL, TokenType.EQUAL
        ].includes(this.currToken.type)) {
            const opToken = this.currToken
            if (opToken.type === TokenType.NOT_EQUAL) {
                this.eat(TokenType.NOT_EQUAL)
            }
            else {
                this.eat(TokenType.EQUAL)
            }

            eq = new ast.BinOp(eq, opToken, this.compare())
        }

        return eq
    }

    private compare(): ast.AST {
        let comp = this.term()
        while ([
            TokenType.GT, TokenType.LT, TokenType.GTE, TokenType.LTE
        ].includes(this.currToken.type)) {
            const opToken = this.currToken
            if (opToken.type === TokenType.GT) {
                this.eat(TokenType.GT)
            }
            else if (opToken.type === TokenType.GTE) {
                this.eat(TokenType.GTE)
            }
            else if (opToken.type === TokenType.LT) {
                this.eat(TokenType.LT)
            }
            else {
                this.eat(TokenType.LTE)
            }

            comp = new ast.BinOp(comp, opToken, this.term())
        }

        return comp
    }

    private term(): ast.AST {
        let term = this.factor()
        while ([TokenType.PLUS, TokenType.MINUS].includes(this.currToken.type)) {
            const opToken = this.currToken
            if (opToken.type === TokenType.PLUS) {
                this.eat(TokenType.PLUS)
            }
            else {
                this.eat(TokenType.MINUS)
            }

            term = new ast.BinOp(term, opToken, this.factor())
        }

        return term
    }

    private factor(): ast.AST {
        let factor = this.exponent()
        while ([
            TokenType.MUL, TokenType.DIV, TokenType.MOD, TokenType.FLOOR
        ].includes(this.currToken.type)) {
            const opToken = this.currToken
            if (opToken.type === TokenType.MUL) {
                this.eat(TokenType.MUL)
            }
            else if (opToken.type === TokenType.DIV) {
                this.eat(TokenType.DIV)
            }
            else if (opToken.type === TokenType.MOD) {
                this.eat(TokenType.MOD)
            }
            else {
                this.eat(TokenType.FLOOR)
            }

            factor = new ast.BinOp(factor, opToken, this.exponent())
        }

        return factor
    }

    private exponent(): ast.AST {
        let exponent = this.unary()
        while (this.currToken.type === TokenType.EXPONENT) {
            const opToken = this.currToken
            this.eat(TokenType.EXPONENT)
            exponent = new ast.BinOp(exponent, opToken, this.unary())
        }

        return exponent
    }

    private unary(): ast.AST {
        if ([
            TokenType.PLUS, TokenType.MINUS, TokenType.NOT
        ].includes(this.currToken.type)) {
            const opToken = this.currToken
            if (opToken.type === TokenType.PLUS) {
                this.eat(TokenType.PLUS)
            }
            else if (opToken.type === TokenType.MINUS) {
                this.eat(TokenType.MINUS)
            }
            else {
                this.eat(TokenType.NOT)
            }

            return new ast.UnaryOp(opToken, this.unary())
        }

        return this.primary()
    }

    private primary(): ast.AST {
        const token = this.currToken
        if (this.currToken.type === TokenType.NUMBER_CONST) {
            this.eat(TokenType.NUMBER_CONST)
            return new ast.Number(token)
        }
        else if (this.currToken.type === TokenType.TRUE) {
            this.eat(TokenType.TRUE)
            return new ast.Boolean(token)
        }
        else if (this.currToken.type === TokenType.FALSE) {
            this.eat(TokenType.FALSE)
            return new ast.Boolean(token)
        }
        else if (this.currToken.type === TokenType.L_PAREN) {
            this.eat(TokenType.L_PAREN)
            const expr = this.expr()
            this.eat(TokenType.R_PAREN)
            return expr
        }
        else if (this.currToken.type === TokenType.ID) {
            return this.ref()
        }
        else if (this.currToken.type === TokenType.NULL) {
            this.eat(TokenType.NULL)
            return new ast.Null(token)
        }
        else if (this.currToken.type === TokenType.STRING_CONST) {
            this.eat(TokenType.STRING_CONST)
            return new ast.String(token)
        }
        else if (this.currToken.type === TokenType.L_BRACK) {
            return this.ref()
        }

        throw new Error(`unexpected token: ${ this.stringifyLineCol(token) }`)
    }

    private ref(): ast.AST {
        let ref = this.currToken.type === TokenType.L_BRACK ?
            this.arrayLiteral() : this.variable()

        if (this.currToken.type === TokenType.L_PAREN) {
            if (ref instanceof ast.Array) {
                throw new Error(`array literals are not callable, 
                    ${ this.stringifyLineCol(this.currToken) }`)
            }
            ref = this.functionCall(ref)
        }

        return this.element(ref)
    }

    private functionCall(fnRef: ast.AST, statementCall=false) {
        const call = stdlib.hasOwnProperty(fnRef.token.value as string) ? 
            this.stdLibCall(fnRef.token) : new ast.FunctionCall(fnRef, this.args()) 
        if (statementCall) {
            this.eat(TokenType.SEMI)
        }
        return call
    }

    private stdLibCall(calledToken: Token): ast.StdLibCall {
        const callNode = new ast.StdLibCall(calledToken, this.args())
        return callNode
    }

    private args(): ast.AST[] {
        this.eat(TokenType.L_PAREN)
        const args: ast.AST[] = []
        while (this.currToken.type !== TokenType.R_PAREN) {
            args.push(this.expr())
            if (this.currToken.type as TokenType !== TokenType.R_PAREN) {
                this.eat(TokenType.COMMA)
            }
        }
        this.eat(TokenType.R_PAREN)

        return args
    }

    private element(collection: ast.AST): ast.AST {
        let ref = collection
        while (this.currToken.type === TokenType.L_BRACK ||
            this.currToken.type === TokenType.DOT) {
            
            if (ref instanceof ast.Array && this.currToken.type === TokenType.DOT) {
                throw new Error(
                    `syntax error: dot notation can only access members of struct instances,
                    ${ this.stringifyLineCol(this.currToken) }`)
            }
            
            ref = this.currToken.type === TokenType.L_BRACK ? 
                this.idx(ref) : this.member(ref)
        }
        
        return ref
    }

    private member(structInstance: ast.AST): ast.AST {
        this.eat(TokenType.DOT)
        const fieldNode = this.variable()
        return new ast.StructMember(fieldNode.token, structInstance)
    }

    private idx(array: ast.AST): ast.AST {
        this.eat(TokenType.L_BRACK)
        const idx = this.term()
        this.eat(TokenType.R_BRACK)
        return new ast.ArrayIdx(array, idx)
    }

    private arrayLiteral(): ast.AST {
        const { line, col } = this.currToken
        this.eat(TokenType.L_BRACK)
        const elems = []
        while (this.currToken.type !== TokenType.R_BRACK) {
            const elem = this.expr()
            elems.push(elem)

            if (this.currToken.type as TokenType !== TokenType.R_BRACK) {
                this.eat(TokenType.COMMA)
            }
        }
        this.eat(TokenType.R_BRACK)

        const arrayToken = new Token(TokenType.ARRAY_CONST, elems, line, col)
        return new ast.Array(arrayToken)
    }

    private variable(): ast.AST {
        const idToken = this.currToken
        this.eat(TokenType.ID)
        return new ast.Var(idToken)
    }

    private eat(tokenType: TokenType): void {
        //console.log(tokenType, this.currToken)
        if (this.currToken.type === tokenType) {
            this.currToken = this.nextToken()
            return
        }

        throw new Error(
            `invalid syntax: ${ this.stringifyLineCol(this.currToken) }`)
    }

    private nextToken(): Token {
        return this.tokenizer.getNextToken()
    }
}