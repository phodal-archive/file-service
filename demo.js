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
const client = require("./index.js");

class IndexingRetrievalLogger {
    static debug (e) {console.log(e)}
    static info (e) {console.log(e)}
    static warn (e) {console.log(e)}
    static error (e) {console.log(e)}
}

const FastRepoInitHandshakeResponse_Status = Object.freeze({
    EMPTY: 'EMPTY',
    OUT_OF_SYNC: 'OUT_OF_SYNC',
    FAILURE: 'FAILURE',
    UP_TO_DATE: 'UP_TO_DATE',
    UNSPECIFIED: 'UNSPECIFIED',
});

class IndexingJob {
    status = new Map();

    constructor(path) {
        this.merkleClient = new client.MerkleClient(path)
        this.status.set({ case: 'indexing-setup' })
    }

    async startFastRemoteSync() {
        console.log(this.merkleClient)
        const numbers = await this.merkleClient.getNumEmbeddableFiles()
        console.log(numbers)
        // const treeHash = await this.merkleClient.getSubtreeHash('.')
        // console.log(treeHash)
    }
}

let indexing = new IndexingJob('/Users/phodal/source/ai/co-unit');
indexing.startFastRemoteSync().then(() => {
    console.log('done')
});

