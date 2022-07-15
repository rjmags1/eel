import { InternalValue, StructInstance, VoidReturn } from "./interpreter"

const stdlib: { [key: string]: Function } = {
    print: (...args: InternalValue[]): void => {
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
    len: (array: InternalValue[]): number => {
        if (!(array instanceof Array)) {
            throw new Error(`cannot call len on non-array value`)
        }
        return array.length
    },
    append: (array: InternalValue[], val: InternalValue): void => {
        if (!(array instanceof Array)) {
            throw new Error(`cannot call append on non-array value`)
        }
        array.push(val)
    },
    members: (structInstance: StructInstance): any[][] => {
        if (!(structInstance instanceof StructInstance)) {
            throw new Error(`cannot call members on non-struct type value`)
        }
        return Object.entries(structInstance.members)
    }
}

export default stdlib