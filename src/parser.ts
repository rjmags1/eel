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
        const right = this.numExpr()

        return new ast.Assign(left, assignToken, right)
    }

    private variable(): ast.AST {
        const idToken = this.currToken
        this.eat(TokenType.ID)
        return new ast.Var(idToken)
    }

    private varDecl(): ast.VarDecl {
        const declaratorToken = this.currToken
        this.eat(TokenType.LET)
        const alias = this.currToken.value as string
        this.eat(TokenType.ID)
        this.eat(TokenType.COLON)
        const typeToken = this.typeSpecifier()
        return new ast.VarDecl(declaratorToken, alias, typeToken.type)
    }

    private typeSpecifier(): Token {
        if (this.currToken.type === TokenType.NUMBER) {
            const numberTypeToken = this.currToken
            this.eat(TokenType.NUMBER)
            return numberTypeToken
        }

        throw new Error('invalid syntax - unsupported type')
    }

    private numExpr(): ast.AST {
        let term2 = this.numTerm2()
        while ([TokenType.PLUS, TokenType.MINUS].includes(this.currToken.type)) {
            const opToken = this.currToken
            if (this.currToken.type === TokenType.PLUS) {
                this.eat(TokenType.PLUS)
                term2 = new ast.BinOp(term2, opToken, this.numTerm2())
            }
            else { // MINUS
                this.eat(TokenType.MINUS)
                term2 = new ast.BinOp(term2, opToken, this.numTerm2())
            }
        }

        return term2
    }

    private numTerm2(): ast.AST {
        let term1 = this.numTerm1()
        while ([
            TokenType.MUL, TokenType.DIV, TokenType.FLOOR, TokenType.MOD
        ].includes(this.currToken.type)) {

            const opToken = this.currToken
            if (this.currToken.type === TokenType.MUL) {
                this.eat(TokenType.MUL)
                term1 = new ast.BinOp(term1, opToken, this.numTerm1())
            }
            else if (this.currToken.type === TokenType.DIV) {
                this.eat(TokenType.DIV)
                term1 = new ast.BinOp(term1, opToken, this.numTerm1())
            }
            else if (this.currToken.type === TokenType.FLOOR) {
                this.eat(TokenType.FLOOR)
                term1 = new ast.BinOp(term1, opToken, this.numTerm1())
            }
            else { // MOD
                this.eat(TokenType.MOD)
                term1 = new ast.BinOp(term1, opToken, this.numTerm1())
            }
        }

        return term1
    }

    private numTerm1(): ast.AST {
        let factor = this.factor()
        while (this.currToken.type === TokenType.EXPONENT) {
            const exponentToken = this.currToken
            this.eat(TokenType.EXPONENT)
            factor = new ast.BinOp(factor, exponentToken, this.factor())
        }

        return factor
    }

    private factor(): ast.AST {
        if (this.currToken.type === TokenType.PLUS) { // unary
            const op = this.currToken
            this.eat(TokenType.PLUS)
            return new ast.UnaryOp(op, this.factor())
        }
        else if (this.currToken.type === TokenType.MINUS) { // unary
            const op = this.currToken
            this.eat(TokenType.MINUS)
            return new ast.UnaryOp(op, this.factor())
        }
        else if (this.currToken.type === TokenType.L_PAREN) {
            this.eat(TokenType.L_PAREN)
            const expr = this.numExpr()
            this.eat(TokenType.R_PAREN)
            return expr
        }
        else if (this.currToken.type === TokenType.ID) {
            return this.variable()
        }
        else {
            const num = new ast.Number(this.currToken)
            this.eat(TokenType.NUMBER_CONST)
            return num
        }
    }

    private eat(tokenType: TokenType): void {
        if (this.currToken.type === tokenType) {
            this.currToken = this.nextToken()
            return
        }

        throw new Error(`invalid syntax: line ${ this.tokenizer.line } col ${ this.tokenizer.col }`)
    }

    private nextToken(): Token {
        return this.tokenizer.getNextToken()
    }
}