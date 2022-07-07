import TokenType, { KEYWORDS } from "./tokenTypes"


export type TokenValue = number | null | string | boolean //| Array<any> | object
export class Token {
    type: TokenType
    value: TokenValue
    constructor(type: TokenType, value: TokenValue) {
        this.type = type
        this.value = value
    }
}


export default class Tokenizer {
    line: number
    col: number
    private currChar: string | null
    private text: string
    private idx: number
    constructor(text: string) {
        this.idx = 0
        this.line = 1
        this.col = 1
        this.text = text
        this.currChar = this.text[this.idx]
    }

    getNextToken(): Token {
        while (this.currChar !== null) {
            if (this.currChar === ' ' || this.currChar === '\n') {
                this.skipWhitespace()
                continue
            }

            if (this.currChar === '(') {
                this.advance()
                return new Token(TokenType.L_PAREN, '(')
            }
            if (this.currChar === ')') {
                this.advance()
                return new Token(TokenType.R_PAREN, ')')
            }
            if (this.currChar === '+') {
                this.advance()
                return new Token(TokenType.PLUS, '+')
            }
            if (this.currChar === '-') {
                this.advance()
                return new Token(TokenType.MINUS, '-')
            }
            if (this.currChar === '/' && this.nextChar() === '/') {
                this.advance()
                this.advance()
                return new Token(TokenType.FLOOR, '//')
            }
            if (this.currChar === '/') {
                this.advance()
                return new Token(TokenType.DIV, '/')
            }
            if (this.currChar === '%') {
                this.advance()
                return new Token(TokenType.MOD, '%')
            }
            if (this.currChar === '*' && this.nextChar() === '*') {
                this.advance()
                this.advance()
                return new Token(TokenType.EXPONENT, '**')
            }
            if (this.currChar === '*') {
                this.advance()
                return new Token(TokenType.MUL, '*')
            }
            if (this.currChar === ':') {
                this.advance()
                return new Token(TokenType.COLON, ':')
            }
            if (this.currChar === ';') {
                this.advance()
                return new Token(TokenType.SEMI, ';')
            }
            if (this.currChar === '=') {
                this.advance()
                return new Token(TokenType.ASSIGN, '=')
            }
            if (this.currCharIsDigit()) {
                return this.numberToken()
            }
            if (this.currCharIsAlpha()) {
                const keywordToken = this.foundKeyword()
                return keywordToken === null ? this.idToken() : keywordToken
            }

            throw new Error(`invalid character: line ${ this.line } col ${ this.col }`)
        }

        return new Token(TokenType.EOF, null)
    }

    private foundKeyword(): Token | null {
        type TokenTypeString = keyof typeof TokenType

        for (const [type, keyword] of Object.entries(KEYWORDS)) {
            const stop = this.idx + keyword.length
            const keywordLenSliceFromText = this.text.slice(this.idx, stop)
            const delimited = (
                !this.isAlpha(this.text[stop]) && !this.isDigit(this.text[stop]))
            if (keyword === keywordLenSliceFromText && delimited) {
                return this.keywordToken(TokenType[type as TokenTypeString])
            }
        }

        return null
    }

    private keywordToken(keywordTokenType: TokenType): Token {
        const keyword = this.word()
        let tokenValue: string | boolean = keyword
        if (keyword === 'true') {
            tokenValue = true
        }
        else if (keyword === 'false') {
            tokenValue = false
        }

        return new Token(keywordTokenType, tokenValue)
    }

    private idToken(): Token {
        const alias = this.word()
        return new Token(TokenType.ID, alias)
    }

    private word(): string {
        const chars = []
        while (this.currCharIsAlpha() || this.currCharIsDigit()) {
            chars.push(this.currChar)
            this.advance()
        }

        return chars.join("")
    }

    private currCharIsAlpha(): boolean {
        return this.currChar !== null && this.isAlpha(this.currChar)
    }

    private isAlpha(char: string): boolean {
        return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z')
    }

    private isDigit(char: string): boolean {
        return char >= '0' && char <= '9'
    }

    private numberToken(): Token {
        const digits = []
        while (this.currCharIsDigit()) {
            digits.push(this.currChar)
            this.advance()
        }

        if (this.currChar === '.') {
            digits.push(this.currChar)
            this.advance()
            while (this.currCharIsDigit()) {
                digits.push(this.currChar)
                this.advance()
            }
        }

        const value = Number(digits.join(""))
        return new Token(TokenType.NUMBER_CONST, value)
    }

    private currCharIsDigit(): boolean {
        return this.currChar !== null && this.isDigit(this.currChar)
    }

    private nextChar(): string | null {
        return this.idx < this.text.length - 1 ? this.text[this.idx + 1] : null
    }

    private skipWhitespace(): void {
        while (this.currChar === ' ' || this.currChar === '\n') {
            this.advance()
        }
    }

    private advance(): void {
        if (++this.idx >= this.text.length) {
            this.currChar = null
            return
        }

        if (this.text[this.idx] === '\n') {
            this.line++
            this.col = 0
        }
        this.currChar = this.text[this.idx]
        this.col++
    }
}