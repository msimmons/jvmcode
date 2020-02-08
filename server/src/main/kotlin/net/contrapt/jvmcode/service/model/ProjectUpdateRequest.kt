package net.contrapt.jvmcode.service.model

import net.contrapt.jvmcode.model.ProjectUpdateData

class ProjectUpdateRequest(
        override val source: String,
        override val dependencySources: Collection<DependencySource>,
        override val paths: Collection<Path>

) : ProjectUpdateData
