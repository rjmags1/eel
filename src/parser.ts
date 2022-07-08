import Tokenizer, { Token } from "./tokenizer"
import TokenType from "./tokenTypes"
import * as ast from "./ast"


export default class Parser {
    tokenizer: Tokenizer
    currToken: Token
    constructor(tokenizer: Tokenizer) {
        this.tokenizer = tokenizer
        this.currToken = this.nextToken()
    }

    buildAST(): ast.Block {
        const root = new ast.Block(true) // root=true
        while (this.currToken.type != TokenType.EOF) {
            root.children.push(this.varDeclareAssign())
            this.eat(TokenType.SEMI)
        }

        return root
    }

    private varDeclareAssign(): ast.AST {
        const left = this.currToken.type === TokenType.LET ? 
            this.varDecl() : this.variable()
        if (this.currToken.type !== TokenType.ASSIGN) {
            const varDecl = left
            return varDecl
        }

        const assignToken = this.currToken
        this.eat(TokenType.ASSIGN)

        return new ast.Assign(left, assignToken, this.expr())
    }

    private varDecl(): ast.VarDecl {
        const declaratorToken = this.currToken
        this.eat(TokenType.LET)
        const alias = this.currToken.value as string
        this.eat(TokenType.ID)
        this.eat(TokenType.COLON)

        return new ast.VarDecl(declaratorToken, alias, this.typeSpecifier())
    }

    private typeSpecifier(): Token {
        if (this.currToken.type === TokenType.NUMBER) {
            const numberTypeToken = this.currToken
            this.eat(TokenType.NUMBER)
            return numberTypeToken
        }
        if (this.currToken.type === TokenType.BOOLEAN) {
            const boolTypeToken = this.currToken
            this.eat(TokenType.BOOLEAN)
            return boolTypeToken
        }

        throw new Error('unexpected token - expected a type specifier')
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
            return this.variable()
        }

        throw new Error("unexpected primary token")
    }

    private variable(): ast.AST {
        const idToken = this.currToken
        this.eat(TokenType.ID)
        return new ast.Var(idToken)
    }

    private eat(tokenType: TokenType): void {
        console.log(tokenType, this.currToken)
        if (this.currToken.type === tokenType) {
            this.currToken = this.nextToken()
            return
        }

        throw new Error(
            `invalid syntax: line ${ this.tokenizer.line } 
            col ${ this.tokenizer.col }`)
    }

    private nextToken(): Token {
        return this.tokenizer.getNextToken()
    }
}