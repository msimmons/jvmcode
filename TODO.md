# JVMCode
JVM Code will supply all non-language specific info.  Essentially all things realted to .class files

## TODO

- Dependency Management
  - _Default JDK dependencies_
  - _Allow manually entered jar dependencies and paths_
  - _Accept dependencies and paths from other tools (Gradle, Maven)_
  - _Tree view of project jar dependencies and paths_
  - _Compiled class output on classpath_
  - Supplier of Classpath
    - To repl shells
    - To run or debug a program
    - To run or debug a test
- Run/Debug a program
- Run/Debug a test
- Find Things
  - _Find and open a dependency class or resource_
  - _Exclude things from finding_
- Decompile class with no source (Fernflower?)

## Symbols
  - source: Either a jar dependency or a source file in current project (JAR, SOURCE)
  - namespace: The package of the symbol
  - name: The symbol name
  - type: The type of symbol (class, interface, object)
  - file: The uri for the file that contains the symbol
  - location: The line/column location of the symbol
  - doc: Documentation, if any

## Use Cases
- Know what is imported in current scope
- Suggest types from 1) current package, 2) imported types, 3) all dependencies
- On choosing a type, insert import statement if necessary (allow config for ordering imports)
- Show member and parameter help for dot completions

## See the following
[Class File Info](https://docs.oracle.com/javase/specs/jvms/se8/html/jvms-4.html#jvms-4.3.2)

[Javassist](http://www.javassist.org/)

[BNF] (http://cui.unige.ch/isi/bnf/JAVA/BNFindex.html)