//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as myExtension from '../src/extension';

// Defines a Mocha test suite to group tests of similar kind together
suite("Extension Tests", () => {
    
    // Defines a Mocha unit test
    test("Basic echo test", async () => {
        myExtension.projectController.start()
        let reply = await myExtension.server.send('jvmcode.echo', {message: 'hello'})
        assert.equal(reply.body.echo.message, 'hello')
    }).timeout(3000);

    test("No classes", async () => {
        let reply = await myExtension.projectService.getClasses()
        assert.equal(reply.length, 0)
    })

    test("Dependencies and jar entries", async () => {
        let root = myExtension.extensionContext.extensionPath
        await myExtension.projectService.addDependency(`${root}/server/src/test/resources/postgresql-42.1.4.jar`)
        let jars = await myExtension.projectService.getJarEntries()
        assert(jars.length > 4000, "Has some jar entries")
    })

    test("Classes", async () => {
        let root = myExtension.extensionContext.extensionPath
        await myExtension.projectService.addClassDirectory(`${root}/server/build/classes/kotlin/main`)
        let classes = myExtension.projectService.getClasses()
        assert(classes.length > 40)
    })
});