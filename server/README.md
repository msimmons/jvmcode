# jvmcode (server)

## JVM Extension Container for vscode

- Communicates with extension host via websocket connections which are bridged to a _vert.x_ event bus
- Supports installation of other _verticles_ to implement JVM based extensions, sharing the event bus and other resources
- Supports serving static content for hosted extensions (to allow implementation of complex content providers)
