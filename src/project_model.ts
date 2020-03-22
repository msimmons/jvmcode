import { ClassData } from './class_data/class_data'

export const SYSTEM_SOURCE = "System"
export const USER_SOURCE = "User"

export interface DependencyData {
    artifactId: string;
    fileName: string;
    groupId: string;
    jmod: string | null;
    modules: string[];
    resolved: boolean;
    scopes: string[];
    sourceFileName: string | null;
    transitive: boolean;
    version: string;
}

export interface DependencySourceData {
    dependencies: DependencyData[];
    description: string;
    source: string;
}

export interface PathData {
    classDir: string;
    module: string;
    name: string;
    source: string;
    sourceDir: string;
}

export interface JvmProject {
    classdata: ClassData[];
    classpath: string;
    dependencySources: DependencySourceData[];
    paths: PathData[];
}

export interface ProjectUpdateData {
    dependencySources: DependencySourceData[];
    paths: PathData[];
    source: string;
}
