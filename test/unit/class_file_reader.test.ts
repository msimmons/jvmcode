import { ClassFileReader } from '../../src/class_data/class_file_reader'
import { expect } from 'chai'
import 'mocha'
import { readFileSync } from 'fs'
import { ClassData } from '../../src/class_data/class_data'

describe('Load and parse a class file', () => {
    let cdr = new ClassFileReader()
    let classFile = 'test/fixtures/PluginModelBuilder.javaclass'
    let expected = JSON.parse(readFileSync('test/fixtures/PluginModelBuilder.json').toString()) as ClassData
    expected.path = classFile

    it('should load the expected class data', async () => {
        let result = await cdr.load(classFile)
        expected.lastModified = result.lastModified
        expect(result).to.deep.include(expected)
    })

})
