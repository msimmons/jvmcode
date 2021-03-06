# JVMCode (server)

## JVM Extension Container for vscode

- Communicates with extension host via websocket connections which are bridged to a _vert.x_ event bus
- Supports installation of other _verticles_ to implement JVM based extensions, sharing the event bus and other resources
- Supports serving static content for hosted extensions (to allow implementation of complex content providers)

### TODO
- When jvm project starts (must have all dependencies and paths), scan all source files and class files, make sure things are up-to-date
- Make sure things are compiled, watch .class files for changes?
- Notifications from server -> vscode when server is doing something
- _More inteligent mapping of class names to file:locations when loading source (Javassist)_
- Bytecode decompiler (Javassist as compromise maybe)
- Debugger interface
- _Allow filtering dependencies by package name_
- _Make sure blocking activities are executed safely_
- _Handle jmod as well as jars_
- _User supplied dependencies (manual not Gradle/Maven etc)_
- _Send config at server startup_
- _Monitor and show JVM memory stats_
- _Multiple jar/jmod per dependency_

## Class file data structure
{
    "path":"",
    "hash":"", // For avoiding reparse
    "source:"source file name",
    referenced: [ // Classes that are referenced in this class (limited to mutable ones)
    ]
}
- source2class (source -> [class])
   - allows finding classes that will change when the source changes
- class2source (class -> source)
   - allows opening correct source file 
- classrefs (referenced -> class)
   - allows deciding what to compile when 'referenced' changes

When a source file changes:
1. Find all the affected classes through _source2class_
0. For each affected class, find the classes that reference it through _classrefs_
0. For each affected classref, find the source through _class2source_
0. Request compile for all the affected sources

When asked to open source for a class:
1. Find the source file name through _class2source_
0. Resolve the package or jar path
0. Open it