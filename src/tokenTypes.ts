enum TokenType {
    // operators
    PLUS = 'PLUS',
    MINUS = 'MINUS',
    MUL = 'MUL',
    DIV = 'DIV',
    FLOOR = 'FLOOR',
    MOD = 'MOD',
    EXPONENT = 'EXPONENT',
    //LT = 'LT'
    //LTE = 'LTE'
    //GTE = 'GTE',
    //GT = 'GT,
    //ASSIGN = 'ASSIGN',
    //EQUAL = 'EQUAL',
    //NOT_EQUAL = 'NOT_EQUAL',
    //NOT = 'NOT',
    //LOGICAL_OR = 'LOGICAL_OR',
    //LOGICAL_AND = 'LOGICAL_AND',

    // delimiters
    L_PAREN = 'L_PAREN',
    R_PAREN = 'R_PAREN',
    //L_CURLY = 'L_CURLY',
    //R_CURLY = 'R_CURLY',
    //L_BRACK = 'L_BRACK',
    //R_BRACK = 'R_BRACK',
    //SEMI = 'SEMI',
    //DOT = 'DOT',
    //COLON = 'COLON',
    //COMMA = 'COMMA',

    // keywords
    NUMBER = 'NUMBER',
    //STRING = 'STRING',
    //BOOLEAN = 'BOOLEAN',
    //ARRAY = 'ARRAY',
    //NULL = 'NULL',
    //VOID = 'VOID',
    //IF = 'IF',
    //ELSE = 'ELSE',
    //FOR = 'FOR',
    //WHILE = 'WHILE',
    //LET = 'LET',
    //RETURN = 'RETURN',
    //FUNCTION = 'FUNCTION',
    //TRUE = 'TRUE',
    //FALSE = 'FALSE',
    //STRUCT = 'STRUCT',

    // misc
    NUMBER_CONST = 'NUMBER_CONST',
    // STRING_CONST = 'string_const',
    // BOOL_CONST = 'bool_const',
    // ID = 'id',
    EOF = 'EOF',
}

export default TokenType