import { ProjectRepository } from '../src/project_repository'
import { DependencyData, PathData, DependencySourceData } from '../src/project_model'
import { LocalConfig } from '../src/models'

class TestClass {

    async testit() {
        let dd = {fileName: '/home/mark/Downloads/jd-gui-1.4.0.jar'}
        let repo = new ProjectRepository()
        let files = await repo.findRecursive('/home/mark/work/jvmcode/server/src/main/kotlin', 'UserPath.kt', undefined, false)
        console.log(files)
    }
}

let test = new TestClass()
test.testit()
