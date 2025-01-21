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

class Indexing {
    status = new Map();

    constructor(path) {
        this.merkleClient = new client.MerkleClient(path)
        this.status.set({ case: 'indexing-setup' })
    }

    async startFastRemoteSync() {
        const numbers = await this.merkleClient.getNumEmbeddableFiles()
        console.log(numbers)
        // const treeHash = await this.merkleClient.getSubtreeHash('.')
        // console.log(treeHash)
    }
}

let indexing = new Indexing('/Users/phodal/test/bloop');
indexing.startFastRemoteSync().then(() => {
    console.log('done')
});

