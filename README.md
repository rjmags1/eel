# eel
Interpreted language written in Typescript. Tokenizer -> recursive-descent-parser -> AST -> interpreter with stack-based, block-scoping memory model. Syntax mostly based on JS, but borrows a few features from C and Python. See grammar.txt for complete BNF-esque grammar rules, or `testfile.eel` in the examples folder for demos of all supported syntax. 


## Replit VM
Visit `https://replit.com/@maganinirj/eel` to experiment with eel in a replit VM. Click the link and enter `npm run exec examples/quicksort.eel` in the shell to get started. If a shell is not showing on the replit website, you may need to create an account and reload the url. The `examples` folder contains the aforementioned test file, quicksort and fibonacci implementations, as well as a bingo game simulator, all written in eel. Write your own eel scripts in replit's in-browser IDE once you get a feel for the syntax.


## Run it locally
Clone the repo:
```
$ git clone https://github.com/rjmags1/eel.git
```

Compile eel source and execute a .eel file using NodeJS runtime:
```
$ npm run exec examples/fib.eel
```

Skip the compilation step (after you have run exec at least once):
```
$ node dist/index.js examples/bingo.eel
```
