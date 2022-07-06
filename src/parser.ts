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

    buildAST(): ast.AST {
        return this.numExpr()
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
        if (this.currToken.type === TokenType.PLUS) {
            const op = this.currToken
            this.eat(TokenType.PLUS)
            return new ast.UnaryOp(op, this.factor())
        }
        else if (this.currToken.type === TokenType.MINUS) {
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

        throw new Error('invalid syntax')
    }

    private nextToken(): Token {
        return this.tokenizer.getNextToken()
    }
}