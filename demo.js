var module = require("./index.js");

console.log(module)
console.log(module.DiffClient.prototype)
console.log(module.GitClient.prototype)
console.log(module.MerkleClient.prototype)

// class DiffClient {
//     diff() {}
//     diffLines() {}
// }
//
// class GitClient {
//     getCommitChain() {}
//     getCommitVerifyData() {}
//     getRepoHeadSha() {}
//     getTotalCommitCount() {}
//     getVerifyCommit() {}
//     throwIfCommitDoesntExist() {}
// }
//
// class MerkleClient {
//     computeMerkleTree() {}
//     computeMerkleTreeWithRipgrepIgnore() {}
//     deleteFile() {}
//     getAllDirFilesToEmbed() {}
//     getAllFiles() {}
//     getHashesForFiles() {}
//     getImportantPaths() {}
//     getNextFileToEmbed() {}
//     getNumEmbeddableFiles() {}
//     getSpline() {}
//     getSubtreeHash() {}
//     init() {}
//     initWithRipgrepIgnore() {}
//     isTooBig() {}
//     updateFile() {}
//     updateRootDirectory() {}
// }

console.log(module.DiffClient.prototype.constructor.toString())
console.log(module.GitClient.prototype.constructor.toString())
console.log(module.MerkleClient.prototype.constructor.toString())

let diffClient = new module.DiffClient();
console.log(diffClient)
let diff = diffClient.diff("a\nb", "b\nb");
console.log(diff)
let lines = diffClient.diffLines("a\nb", "b\nb");
console.log(lines)

let merkleClient = new module.MerkleClient(".");
merkleClient.init()
merkleClient.getAllFiles().then(files => {
    console.log(files)
})