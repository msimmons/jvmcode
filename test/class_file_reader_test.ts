import { ClassFileReader } from '../src/class_data/class_file_reader'
import * as fs from 'fs'
import { ProjectRepository } from '../src/project_repository'
import * as JSZip from 'jszip'
import { StringDecoder } from 'string_decoder'

class TestClass {

    async testit() {
        let cdr = new ClassFileReader()
        let classFile = '/home/mark/work/jvmcode/server/build/classes/kotlin/main/net/contrapt/jvmcode/handler/GetClasspath.class'
        //let classFile = '/home/mark/work/jvmcode/server/build/classes/kotlin/main/net/contrapt/jvmcode/service/model/ProjectUpdateRequest.class'
        let result = await cdr.load(classFile)
        console.log(JSON.stringify(result, undefined, 3))
    }
}

let test = new TestClass()
test.testit()
