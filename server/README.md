# JVMCode (server)

## JVM Extension Container for vscode

- Communicates with extension host via websocket connections which are bridged to a _vert.x_ event bus
- Supports installation of other _verticles_ to implement JVM based extensions, sharing the event bus and other resources
- Supports serving static content for hosted extensions (to allow implementation of complex content providers)

### TODO
- Allow filtering dependencies by package name
- _Make sure blocking activities are executed safely_
- Handle jmod as well as jars
- More inteligent mapping of class names to file:locations when loading source