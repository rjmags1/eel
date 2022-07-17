import KEYWORDS from "./types/keywords"
import { TokenType, LineColTuple } from "./types/base"
import Token from './types/token'


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
            if (this.currChar === '#') {
                this.skipComment()
                continue
            }

            const lineCol: LineColTuple = this.lineCol()

            if (this.currChar === '(') {
                this.advance()
                return new Token(TokenType.L_PAREN, '(', ...lineCol)
            }
            if (this.currChar === ')') {
                this.advance()
                return new Token(TokenType.R_PAREN, ')', ...lineCol)
            }
            if (this.currChar === '+') {
                this.advance()
                return new Token(TokenType.PLUS, '+', ...lineCol)
            }
            if (this.currChar === '-') {
                this.advance()
                return new Token(TokenType.MINUS, '-', ...lineCol)
            }
            if (this.currChar === '/' && this.nextChar() === '/') {
                this.advance()
                this.advance()
                return new Token(TokenType.FLOOR, '//', ...lineCol)
            }
            if (this.currChar === '/') {
                this.advance()
                return new Token(TokenType.DIV, '/', ...lineCol)
            }
            if (this.currChar === '%') {
                this.advance()
                return new Token(TokenType.MOD, '%', ...lineCol)
            }
            if (this.currChar === '*' && this.nextChar() === '*') {
                this.advance()
                this.advance()
                return new Token(TokenType.EXPONENT, '**', ...lineCol)
            }
            if (this.currChar === '*') {
                this.advance()
                return new Token(TokenType.MUL, '*', ...lineCol)
            }
            if (this.currChar === ':') {
                this.advance()
                return new Token(TokenType.COLON, ':', ...lineCol)
            }
            if (this.currChar === ';') {
                this.advance()
                return new Token(TokenType.SEMI, ';', ...lineCol)
            }
            if (this.currChar === '=' && this.nextChar() === '=') {
                this.advance()
                this.advance()
                return new Token(TokenType.EQUAL, '==', ...lineCol)
            }
            if (this.currChar === '=') {
                this.advance()
                return new Token(TokenType.ASSIGN, '=', ...lineCol)
            }
            if (this.currChar === '!' && this.nextChar() === '=') {
                this.advance()
                this.advance()
                return new Token(TokenType.NOT_EQUAL, '!=', ...lineCol)
            }
            if (this.currChar === '!') {
                this.advance()
                return new Token(TokenType.NOT, '!', ...lineCol)
            }
            if (this.currChar === '[') {
                this.advance()
                return new Token(TokenType.L_BRACK, '[', ...lineCol)
            }
            if (this.currChar === ']') {
                this.advance()
                return new Token(TokenType.R_BRACK, ']', ...lineCol)
            }
            if (this.currChar === ',') {
                this.advance()
                return new Token(TokenType.COMMA, ',', ...lineCol)
            }
            if (this.currChar === '<' && this.nextChar() === '=') {
                this.advance()
                this.advance()
                return new Token(TokenType.LTE, '<=', ...lineCol)
            }
            if (this.currChar === '<') {
                this.advance()
                return new Token(TokenType.LT, '<', ...lineCol)
            }
            if (this.currChar === '>' && this.nextChar() === '=') {
                this.advance()
                this.advance()
                return new Token(TokenType.GTE, '>=', ...lineCol)
            }
            if (this.currChar === '>') {
                this.advance()
                return new Token(TokenType.GT, '>', ...lineCol)
            }
            if (this.currChar === '&' && this.nextChar() === '&') {
                this.advance()
                this.advance()
                return new Token(TokenType.LOGICAL_AND, '&&', ...lineCol)
            }
            if (this.currChar === '|' && this.nextChar() === '|') {
                this.advance()
                this.advance()
                return new Token(TokenType.LOGICAL_OR, '||', ...lineCol)
            }
            if (this.currChar === '{') {
                this.advance()
                return new Token(TokenType.L_CURLY, '{', ...lineCol)
            }
            if (this.currChar === '}') {
                this.advance()
                return new Token(TokenType.R_CURLY, '}', ...lineCol)
            }
            if (this.currChar === '.') {
                this.advance()
                return new Token(TokenType.DOT, '.', ...lineCol)
            }
            if (this.currChar === "'" || this.currChar === '"') {
                return this.stringToken(...lineCol)
            }
            if (this.currCharIsDigit()) {
                return this.numberToken(...lineCol)
            }
            if (this.currCharIsAlpha()) {
                const keywordToken = this.foundKeyword(...lineCol)
                return keywordToken === null ? this.idToken(...lineCol) : keywordToken
            }

            throw new Error(`invalid character: line ${ this.line } col ${ this.col }`)
        }

        return new Token(TokenType.EOF, null, ...this.lineCol())
    }

    private skipComment(): void {
        while (this.currChar !== '\n' && this.currChar !== null) {
            this.advance()
        }
    }

    private lineCol(): LineColTuple {
        return [this.line, this.col]
    }

    private foundKeyword(line: number, col: number): Token | null {
        type TokenTypeString = keyof typeof TokenType

        for (const [type, keyword] of Object.entries(KEYWORDS)) {
            const stop = this.idx + keyword.length
            const keywordLenSliceFromText = this.text.slice(this.idx, stop)
            const delimited = (
                !this.isAlpha(this.text[stop]) && !this.isDigit(this.text[stop]))
            if (keyword === keywordLenSliceFromText && delimited) {
                return this.keywordToken(TokenType[type as TokenTypeString], line, col)
            }
        }

        return null
    }

    private keywordToken(keywordTokenType: TokenType, line: number, col: number): Token {
        const keyword = this.word()
        let tokenValue: string | boolean | null = keyword
        if (keyword === 'true') {
            tokenValue = true
        }
        else if (keyword === 'false') {
            tokenValue = false
        }
        else if (keyword === 'null') {
            tokenValue = null
        }

        return new Token(keywordTokenType, tokenValue, line, col)
    }

    private idToken(line: number, col: number): Token {
        const alias = this.word()
        return new Token(TokenType.ID, alias, line, col)
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

    private numberToken(line: number, col: number): Token {
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
        return new Token(TokenType.NUMBER_CONST, value, line, col)
    }

    private stringToken(line: number, col: number): Token {
        const quote = this.currChar
        this.advance()

        const chars = []
        while (this.currChar !== quote) {
            chars.push(this.currChar)
            this.advance()
        }
        this.advance()

        const str = chars.join("")
        return new Token(TokenType.STRING_CONST, str, line, col)
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
            this.col = -1
        }
        this.currChar = this.text[this.idx]
        this.col++
    }
}