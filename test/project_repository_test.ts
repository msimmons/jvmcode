import { ProjectRepository } from '../src/project_repository'
import { DependencyData, PathData, DependencySourceData } from '../src/project_model'
import { LocalConfig } from '../src/models'

class TestClass {

    async testit() {
        let dd = {fileName: '/home/mark/Downloads/jd-gui-1.4.0.jar'}
        let repo = new ProjectRepository()
        let begin = new Date().valueOf()
        let pkgs = await repo.getPackages(dd as DependencyData)
        //let result = await repo.readJarFile('/home/mark/Downloads/jd-gui-1.4.0.jar')
        let end = new Date().valueOf()
        //console.log(JSON.stringify(pkgs, undefined, 3))
        console.log(`${end-begin}ms`)
        let config = {jmodIncludes: ['jdk.base', 'jdk.net'], javaHome: '/usr/lib/jvm/java-11-openjdk-amd64'} as LocalConfig
        let paths = {source:'me', classDir: 'classes', 'sourceDir': 'src/main/java'} as PathData
        let dependency = {fileName: '/home/mark/Downloads/jd-gui-1.4.0.jar'} as DependencyData
        let dependencies = {source: 'me', dependencies: [dependency], description: 'Me one'} as DependencySourceData
        let jvmproject = repo.updateProject(config, {source: 'me', paths: [paths], dependencySources: [dependencies]})
        console.log(jvmproject)
    }
}

let test = new TestClass()
test.testit()
