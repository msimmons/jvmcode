# jvmcode README

## Features

Starts a JVM server that can host other JVM extensions and communicates with the extension host via websockets.  This extension
exports an API that can be used by other extensions to install their own JVM extensions (packaged as _verticles_) 
and communicate with them over the _vert.x_ Event Bus.  The benfits are a uniform communication method and consolidating the
 overhead of running a JVM process.  Possible uses are:

* _Gradle_ integration to expose dependency, classpath and task information

  * Can be used to support any JVM language extension
* Database access through _JDBC_ provides query execution, autocomplete, schema description
* Other integrations that would benefit from running on the JVM

\!\[feature X\]\(images/feature-x.png\)

## Requirements

If you have any requirements or dependencies, add a section describing those and how to install and configure them.

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: enable/disable this extension
* `myExtension.thing`: set to `blah` to do something

## Known Issues

## Release Notes

### 1.0.0

Initial release of jvmcode