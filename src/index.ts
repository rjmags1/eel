import Tokenizer from "./tokenizer"
import Parser from "./parser"
import { readFileSync } from 'fs'
import Interpreter from "./interpreter"


const main = () => {
    const inFilePath = process.argv[2]
    if (inFilePath.slice(-4) !== ".eel") {
        console.log("can only interpret .eel files")
        return
    }

    const text = readFileSync(inFilePath, { encoding: 'utf-8' })

    const tokenizer = new Tokenizer(text)
    const parser = new Parser(tokenizer)
    const interpreter = new Interpreter(parser)

    const result = interpreter.interpret()
    console.log(result)
}

main()