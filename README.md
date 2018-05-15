# JVMCode

## Features

This extension starts a JVM server running a [_Vertx.io_](https://vertx.io/) event bus.  This allows other extensions that need
like to run code in a JVM to be implemented as _verticles_ that communicate over the event bus.  If you want to use multiple extensions that run in a JVM, this saves the overhead of having to
run multiple JVM's to host the extensions.  It also provides a uniform communication method between the extension host and the JVM.  You can think of it as another kind of Extension Host. Some potential uses would be:

* _Gradle_ integration to expose dependency, classpath and task information.  Could be used to support any other specific JVM language extension

* Database access through _JDBC_ provides query execution, autocomplete, schema description for any database that has a _JDBC_ driver

## API
This extension exports an API that can be used to communicate on the 
event bus

You can send and receive messages on the event bus using the following API exported by this extension.

### Importing the API
Import the API as follows:

```typescript
jvmcode = vscode.extensions.getExtension('contrapt.jvmcode')
```

and call it as
```typescript
jvmcode.exports.send('address', {})
```

### Send Message
To send a message on the event bus and receive a response, use the
following call.  The response is returned as a _Promise_.  The response body contained in _response.body_

```typescript
send(address: string, message: any): Promise<any>
```
- _address_ The event bus address to send to (your verticle should be listening)
- _message_ A message
- _returns_ A Promise for the response

### Install your Verticle
To install your _verticle_ use the following call.  

```typescript
install(jarFiles: string[], verticleName: string): Promise<any>
```
- _jarFiles_ A list of absolute paths of jar files, including the one containing your verticle
- _verticleName_ The fully qualified class name of your verticle
- _returns_ A response whose body is:
```json
{
  "deploymentId":"45de37de-4b44-4054-b15a-8393d6905a92",
  "port":35889
}
```
### Set up an HTTP Server
To setup an HTTP endpoint to serve your content
```typescript
serve(path: string, webRoot: string)
```
- _path_ The context path to serve from
- _webRoot_ The absolute path to your content

### Register Consumer
Register a consumer to listen on the event bus
```typescript
registerConsumer(address: string, callback)
```
- _address_ The event bus address to listen to
- _callback_ The callback to execute on receiving a message

### Unregister Consumer
```typescript
unregisterConsumer(address: string, callback)
```
- _address_ The address you previously registered
- _callback_ The callback you previously registered

## Requirements

You must have a JDK installed to run the server.

## Extension Settings

## Known Issues

## Release Notes

### 1.0.0

Initial release of JVMCode