import { InternalValue, StructInstance, VoidReturn } from "./interpreter"

const stdlib: { [key: string]: Function } = {
    print: (...args: InternalValue[]) => {
        for (const arg of args) {
            if (arg instanceof StructInstance) {
                console.log(arg.structType, arg.members)
            }
            else if (arg instanceof VoidReturn || arg === undefined) {
                console.log('void')
            }
            else console.log(arg)
        }
    },
    len: (array: InternalValue[]) => {
        if (!(array instanceof Array)) {
            throw new Error(`cannot call len on non-array value`)
        }
        return array.length
    },
    members: (structInstance: StructInstance) => {
        if (!(structInstance instanceof StructInstance)) {
            throw new Error(`cannot call members on non-struct type value`)
        }
        return Object.entries(structInstance.members)
    }
}

export default stdlib