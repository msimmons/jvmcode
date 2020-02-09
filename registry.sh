curl -X POST \
-H "Accept: application/vnd.github.package-deletes-preview+json" \
-H "Authorization: bearer 592b14c11e4351993b582c774ab73eb78272af57" \
-d '{"query": "query { registryPackageForQuery(input:{}) { success }}"}' \
https://api.github.com/graphql

curl -X POST \
-H "Accept: application/vnd.github.package-deletes-preview+json" \
-H "Authorization: bearer 592b14c11e4351993b582c774ab73eb78272af57" \
-d '{"query":"mutation { deletePackageVersion(input:{packageVersionId:\"MDIyOlJlZ2lzdHJ5UGFja2FnZVZlcnNpb243MTExNg==\"}) { success }}"}' \
https://api.github.com/graphql