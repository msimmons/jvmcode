package net.contrapt.jvmcode.service.model

import net.contrapt.jvmcode.model.ClasspathData
import net.contrapt.jvmcode.model.DependencySourceData
import net.contrapt.jvmcode.model.ProjectUpdateData

class ProjectUpdateRequest(
        override val source: String,
        override val dependencySources: Collection<DependencySourceData>,
        override val classDirs: Collection<ClasspathData>

) : ProjectUpdateData
