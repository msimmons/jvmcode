import { ClassFileReader } from '../src/class_data/class_file_reader'

class TestClass {

    async testit() {
        let cdr = new ClassFileReader()
        let result = await cdr.load('server/build/classes/kotlin/main/net/contrapt/jvmcode/model/ClassData.class')
        console.log(JSON.stringify(result, undefined, 3))
    }
}

let test = new TestClass()
test.testit()
