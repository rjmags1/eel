import { TokenType, TokenValue } from "./base"


export default class Token {
    type: TokenType
    value: TokenValue
    line: number
    col: number
    constructor(type: TokenType, value: TokenValue, line: number, col: number) {
        this.type = type
        this.value = value
        this.line = line
        this.col = col
    }
}