# JVMCode
How about we provide any non-language specific JVM kind of thing in this
plugin

## TODO

- Dependency Management
  - _Default JDK dependencies_
  - _Allow manually entered jar dependencies_
  - _Accept dependencies from other tools (Gradle, Maven)_
  - _Tree view of jar dependencies_
    - source: group:artifact:version
      - jarfile.jar | jmod
        - com.package1
        - com.package2
  - _Compiled class output on classpath_
  - Supplier of Classpath
    - To repl shells
    - To run or debug a program
    - To run or debug a test
- Run/Debug a program
- Run/Debug a test
- Find Things
  - Find and open a dependency class or resource
  - Exclude things from finding
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
- On choosing a type, insert import statement if necessary
- Show member and parameter help for dot completions