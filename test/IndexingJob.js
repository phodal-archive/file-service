class HighLevelDescriptionJob {
    constructor(e, t, r) {
        this.repoClient = e, this.merkleClient = t, this.context = r, this.abortController = new AbortController
    }

    async compute() {
        try {
            const e = await this.merkleClient.getImportantPaths(100), t = this.context.storageUri
            if (void 0 === t) return
            const r = i.Uri.joinPath(t, d)
            a.IndexingRetrievalLogger.debug(`Computing high level folder description for ${e.length} files at ${r}`)
            try {
                const t = (await i.workspace.fs.readFile(r)).toString(), n = t.split('\n')[0]
                if (void 0 === n || n.length < 3) throw new Error('Invalid file content')
                const s = JSON.parse(n), o = Date.now() - 6048e5
                if (s.timestamp > o) {
                    s.paths = e.map((e => (0, u.getRelativePath)(e)))
                    const n = t.split('\n').slice(1).join('\n'), o = JSON.stringify(s) + '\n' + n
                    return void await i.workspace.fs.writeFile(r, Buffer.from(o, 'utf8'))
                }
            } catch (e) {
                a.IndexingRetrievalLogger.warn('Error reading high level folder description. Ignoring.', e)
            }
            const n = {timestamp: Date.now() - 5184e5, paths: e.map((e => (0, u.getRelativePath)(e)))}
            await i.workspace.fs.writeFile(r, Buffer.from(JSON.stringify(n) + '\n', 'utf8')), n.timestamp = Date.now() - 5184e5
            const s = await this.computeFull(e)
            if (void 0 === s) return
            const o = JSON.stringify(n) + '\n' + s
            await i.workspace.fs.writeFile(r, Buffer.from(o, 'utf8'))
        } catch (e) {
            a.IndexingRetrievalLogger.warn('Error computing high level folder description. Ignoring.', e)
        }
    }

    async computeFull(e) {
        try {
            const t = e.map((e => (0, u.getRelativePath)(e))), r = i.workspace.workspaceFolders,
                n = r?.at(0)?.uri.fsPath ?? '/', s = e.map((async e => {
                    const t = await i.workspace.fs.stat(i.Uri.file(e))
                    if (t && t.type === i.FileType.File && t.size < 1e5) {
                        const t = await i.workspace.fs.readFile(i.Uri.file(e))
                        return new l.GetHighLevelFolderDescriptionRequest_Readme({
                            contents: t.toString(),
                            relativeWorkspacePath: (0, u.getRelativePath)(e)
                        })
                    }
                })), o = await Promise.all(s)
            return (await this.repoClient.getHighLevelFolderDescription({
                workspaceRootPath: n,
                topLevelRelativeWorkspacePaths: t,
                readmes: o.filter((e => void 0 !== e))
            })).description
        } catch (e) {
            a.IndexingRetrievalLogger.warn('Error computing full high level folder description. Ignoring.', e)
        }
    }

    dispose() {
        this.abortController.abort()
    }
}

class RepoIndexWatcher {
    constructor(e, t, r, n, s, o) {
        this.repoInfo = e, this.repoClient = t, this.currentIndexingJobs = r, this.status = n, this.indexingIntent = s, this.context = o, this.disposableIntervals = [], this.isDisposed = !1, this.currentIndexingJob = void 0, l.IndexingRetrievalLogger.debug('Constructing repo index watch.'), this.disposableIntervals.push(setInterval((async () => {
            this.doUpdate()
        }), 6e5)), this.doUpdate()
    }

    async doUpdate() {
        try {
            if (this.isDisposed) return
            l.IndexingRetrievalLogger.debug('Doing repo index watch update.'), void 0 !== this.currentIndexingJob && this.currentIndexingJob.dispose(), (0, y.isPathEncryptorAvailable)() ? this.repoInfo.setUseLegacyRepoName(!1) : this.repoInfo.setUseLegacyRepoName(!0)
            const e = await a.commands.executeCommand(w.ConfigServiceActions.GetCachedServerConfig)
            let t
            t = void 0 === e || null == e || void 0 === e.indexingConfig ? R : e.indexingConfig, this.currentIndexingJob = new IndexingJob(this.repoInfo, this.repoClient, this.currentIndexingJobs, this.status, this.indexingIntent, this.context, t), this.currentIndexingJob.result.then((() => {
                l.IndexingRetrievalLogger.info('Indexing job successfully done or aborted.')
            })).catch((e => {
                let t = e ? e.toString() : 'Unknown error'
                l.IndexingRetrievalLogger.error('Indexing job failed.', e), this.status.set({
                    case: 'error',
                    error: `Unknown error: ${t}`
                })
            }))
        } catch (e) {
            let t = e ? e.toString() : 'Unknown error'
            l.IndexingRetrievalLogger.error('Unhandled error in doUpdate', e), this.status.set({
                case: 'error',
                error: `Unknown error: ${t}`
            })
        }
    }

    dispose() {
        l.IndexingRetrievalLogger.debug('Disposing repo index watch.'), this.currentIndexingJob?.dispose(), this.isDisposed = !0, this.disposableIntervals.forEach((e => {
            clearInterval(e)
        }))
    }
}

class RepoClientMultiplexer {
    constructor(e, t) {
        this.accessToken = e, this.backendUrl = t, this.repoClientUsageCount = 0, this.cachedExpirationResult = null, this.disposables = [], this.numMsForRequestToResetConnection = 1e4, this.networkChangeAbortController = new AbortController, this.repoClient = this.createRepoClient(), this.disposables.push(f.workspace.onDidChangeConfiguration((e => {
            e.affectsConfiguration(m.DISABLE_HTTP2_CONFIG_ID) && this.refreshRepoClient()
        }))), this.networkChangeMonitor = new h.NetworkChangeMonitor(5e3, (() => {
            this.refreshRepoClient(), this.networkChangeAbortController.abort(), this.networkChangeAbortController = new AbortController
        }))
    }

    resetConnectionIfIpChanged() {
        this.networkChangeMonitor.triggerCallbackIfDisconnected(this.backendUrl, this.accessToken)
    }

    createAbortAndErrorInterceptor() {
        return (0, E.createAbortErrorAndTimeoutInterceptor)((() => this.resetConnectionIfIpChanged()), this.numMsForRequestToResetConnection)
    }

    dispose() {
        this.disposables.forEach((e => e.dispose()))
    }

    getExpirationTime(e) {
        return 1e3 * (0, c.decodeJwt)(e).exp
    }

    isAlmostExpired(e) {
        if (null === this.cachedExpirationResult || this.cachedExpirationResult.accessToken !== e || this.cachedExpirationResult.cacheExpiration < Date.now()) {
            const t = this.getExpirationTime(e) - 3e5
            return Date.now() > t ? (this.cachedExpirationResult = null, !0) : (this.cachedExpirationResult = {
                accessToken: e,
                cacheExpiration: t
            }, !1)
        }
        return !1
    }

    refreshRepoClient() {
        this.repoClientUsageCount = 0, this.repoClient = this.createRepoClient()
    }

    get() {
        return this.repoClientUsageCount++, this.repoClientUsageCount > 500 && this.refreshRepoClient(), this.repoClient
    }

    async syncMerkleSubtreeWithRetry(e, t) {
        let r = 2e3
        for (; r < 6e4;) {
            if (t.aborted) throw new Error('aborted')
            try {
                return await this.repoClient.syncMerkleSubtree(e, {
                    signal: AbortSignal.any([t, this.networkChangeAbortController.signal]),
                    timeoutMs: r
                })
            } catch (e) {
                if (t.aborted) throw e
                const n = new Promise((e => setTimeout(e, r))), s = new Promise(((e, r) => {
                    const s = () => r(new Error('aborted'))
                    t.addEventListener('abort', s, {once: !0}), n.finally((() => t.removeEventListener('abort', s)))
                }))
                await Promise.race([n, s]), r *= 2, A.IndexingRetrievalLogger.warn(`Retrying sync merkle subtree with timeout ${r}. Error: `, e)
            }
        }
        throw new Error('timeout in sync merkle subtree')
    }

    async deleteFastUpdateFileWithRetry(e, t) {
        let r = 1e4
        for (; r < 24e4;) {
            if (t.aborted) throw new Error('aborted')
            try {
                return await this.get().fastUpdateFile(e, {
                    signal: AbortSignal.any([t, this.networkChangeAbortController.signal]),
                    timeoutMs: r
                })
            } catch (e) {
                if (t.aborted) throw e
                const n = new Promise((e => setTimeout(e, r))), s = new Promise(((e, r) => {
                    const s = () => r(new Error('aborted'))
                    t.addEventListener('abort', s, {once: !0}), n.finally((() => t.removeEventListener('abort', s)))
                }))
                await Promise.race([n, s]), r *= 2, A.IndexingRetrievalLogger.warn(`Retrying fast update file (delete) with timeout ${r}. Error: `, e)
            }
        }
        throw new Error('timeout in fast update file (delete)')
    }

    async handshakeWithRetry(e, t) {
        let r = 2e3
        for (; r < 12e4;) {
            if (t.aborted) throw new Error('aborted')
            try {
                const n = performance.now()
                A.IndexingRetrievalLogger.info('Handshake start')
                const s = await this.get().fastRepoInitHandshake(e, {
                    signal: AbortSignal.any([t, this.networkChangeAbortController.signal]),
                    timeoutMs: r
                }), o = performance.now()
                if (A.IndexingRetrievalLogger.info('Handshake timing: ' + (o - n)), s.status === p.FastRepoInitHandshakeResponse_Status.FAILURE) throw new Error('FastRepoInitHandshakeResponse_Status.FAILURE in handshakeWithRetry')
                if (s.status === p.FastRepoInitHandshakeResponse_Status.UNSPECIFIED) throw new Error('FastRepoInitHandshakeResponse_Status.UNSPECIFIED in handshakeWithRetry')
                return s
            } catch (e) {
                if (t.aborted) throw e
                e instanceof a.ConnectError && e.code === a.Code.FailedPrecondition && this.refreshRepoClient()
                const n = new Promise((e => setTimeout(e, r))), s = new Promise(((e, r) => {
                    const s = () => r(new Error('aborted'))
                    t.addEventListener('abort', s, {once: !0}), n.finally((() => t.removeEventListener('abort', s)))
                }))
                await Promise.race([n, s]), r *= 2, A.IndexingRetrievalLogger.warn(`Retrying handshake with timeout ${r}. Error: `, e)
            }
        }
        throw new Error('timeout in handshake with retry')
    }

    async ensureIndexCreatedWithRetry(e, t) {
        let r = 2e3
        const n = 12e4
        for (; r < n;) {
            if (t.aborted) throw new Error('aborted')
            try {
                return await this.get().ensureIndexCreated(e, {
                    signal: AbortSignal.any([t, this.networkChangeAbortController.signal]),
                    timeoutMs: r
                })
            } catch (e) {
                if (t.aborted) throw e
                if (2 * r >= n) throw e
                const s = new Promise((e => setTimeout(e, r))), o = new Promise(((e, r) => {
                    const n = () => r(new Error('aborted'))
                    t.addEventListener('abort', n, {once: !0}), s.finally((() => t.removeEventListener('abort', n)))
                }))
                await Promise.race([s, o]), r *= 2, A.IndexingRetrievalLogger.warn(`Retrying ensure index created with timeout ${r}. Error: `, e)
            }
        }
        throw new Error('timeout in ensure index created with retry')
    }

    async fastUpdateFile(e, t) {
        return this.get().fastUpdateFile(e, {
            timeoutMs: 18e4,
            signal: AbortSignal.any([t, this.networkChangeAbortController.signal])
        })
    }

    async getHighLevelFolderDescription(e) {
        return this.get().getHighLevelFolderDescription(e, {
            timeoutMs: 18e4,
            signal: this.networkChangeAbortController.signal
        })
    }

    createRepoClient() {
        IndexingRetrievalLogger.info('Creating Indexing Repo client: ', this.backendUrl)
        const e = i.workspace.getConfiguration().get(m.DISABLE_HTTP2_CONFIG_ID, !1)
        let t = {agent: new g.Agent({keepAlive: !0})}, r = this.backendUrl, n = '2'
        e && r.includes('repo42.cursor') && (r = r.replace('repo42.cursor', 'api2.cursor'), n = '1.1')
        const s = r.includes('lclhst.build') || r.includes('localhost') ? {
            rejectUnauthorized: !1,
            ALPNProtocols: ['h2']
        } : {}, o = (0, l.createConnectTransport)({
            httpVersion: n, ...'1.1' === n ? t : {},
            baseUrl: r,
            interceptors: [e => t => i.tracing.runInSpan(`${u.RepositoryService.typeName}.${t.method.name}`, (() => e(t))), this.createAbortAndErrorInterceptor(), e => async t => {
                if (this.isAlmostExpired(this.accessToken)) {
                    await i.cursor.triggerRefreshCursorAuthToken()
                    const e = i.cursor.getCursorAuthToken()
                    e && (this.accessToken = e)
                }
                return t.header.set('Authorization', `Bearer ${this.accessToken}`), await e(t)
            }, e => async t => (i.cursor.getAllRequestHeadersExceptAccessToken({
                req: t,
                backupRequestId: (0, d.randomUUID)()
            }), await e(t))],
            jsonOptions: {ignoreUnknownFields: !0},
            nodeOptions: {...s},
            sendCompression: l.compressionGzip,
            acceptCompression: [l.compressionGzip]
        })
        return (0, a.createPromiseClient)(u.RepositoryService, o)
    }
}

class IndexingJob {
    constructor(repoInfo, repoClient, currentIndexingJobs, status, indexingIntent, context, config) {
        this.repoInfo = repoInfo, this.repoClient = repoClient
        this.currentIndexingJobs = currentIndexingJobs
        this.status = status, this.indexingIntent = indexingIntent
        this.context = context, this.config = config
        this.MAX_NUM_ITERATIONS = 1e7
        this.syncFileListToServerCalled = !1, this.abortController = new AbortController
        IndexingRetrievalLogger.info('Creating merkle client.')
        this.merkleClient = new c.MerkleClient(this.repoInfo.workspaceUri.fsPath)
        IndexingRetrievalLogger.info('Done creating merkle client.')
        this.highLevelDescriptionJob = new I.HighLevelDescriptionJob(this.repoClient, this.merkleClient, this.context)
        this.result = this.startIndexingRepository()
        this.result.finally((() => {
            this.dispose()
        }))
    }

    dispose() {
        this.abortController.abort(), this.highLevelDescriptionJob.dispose()
    }

    hackyGetSplineWhenYouCantRelyOnTree(e) {
        let t = [], r = e, n = 100
        for (; n > 0;) {
            n -= 1
            const dirname = i.dirname(r)
            if ('.' === (0, u.getRelativePath)(dirname)) {
                t.push(dirname)
                break
            }
            t.push(dirname), r = dirname
        }
        return t
    }

    async updateNumberOfUploadJobs(e, t, r) {
        const merkleClient = this.merkleClient
        const numbers = (await Promise.allSettled(t.map((async e => {
            const t = i.join(r, e)
            return merkleClient.getAllDirFilesToEmbed(t).then((e => e.length))
        })))).reduce(((e, t) => 'fulfilled' === t.status ? e + t.value : e), e.length)
        IndexingRetrievalLogger.info('setting numJobsToGo to ' + numbers)
        this.currentIndexingJobs.setNumJobsToGo(numbers)
        return numbers
    }

    async startSync(e) {
        if ('onlyCallThisFromStartFastRemoteSync' !== e) return (0, d.Err)('You must call this from startFastRemoteSync')
        const entriesToProcess = [], treeHash = await this.merkleClient.getSubtreeHash('.')
        entriesToProcess.push({relativePath: '.', hash: treeHash})
        const n = new Set, s = new Set, o = new Set, a = new Set, c = new p.Semaphore(this.config.syncConcurrency)
        let g = 0
        const f = []
        for (; (c.getCount() > 0 || entriesToProcess.length > 0) && g < this.MAX_NUM_ITERATIONS;) {
            if (g += 1, this.abortController.signal.aborted) return (0, d.Err)('Aborted')
            if (0 === entriesToProcess.length) {
                IndexingRetrievalLogger.info('Waiting on semaphore to be released', c.getCount()), await new Promise((e => setTimeout(e, 200)))
                continue
            }
            if (this.abortController.signal.aborted) return (0, d.Err)('Aborted')
            const entry = entriesToProcess.pop()
            if (IndexingRetrievalLogger.info('[startSync]: ----------------------\nsyncing point nextSubtree' + JSON.stringify(entry)), void 0 === entry) break
            const r = entry.relativePath, filePath = i.join(this.repoInfo.workspaceUri.fsPath, r);
            const m = c.withSemaphore((async () => {
                if (this.abortController.signal.aborted) return (0, d.Err)('Aborted')
                const c = await (0, d.wrapWithRes)((async () => await this.repoClient.syncMerkleSubtreeWithRetry({
                    repository: {
                        ...this.repoInfo.export(),
                        isLocal: !0,
                        numFiles: 0,
                        isTracked: !1,
                        remoteNames: [],
                        remoteUrls: []
                    },
                    localPartialPath: {
                        hashOfNode: entry.hash,
                        relativeWorkspacePath: (0, y.encryptPath)(r, this.repoInfo.pathEncryptionKey)
                    }
                }, this.abortController.signal)))
                if (this.abortController.signal.aborted) return (0, d.Err)('Aborted')
                if (!c.ok() || void 0 === c.v) return entriesToProcess.push(entry), IndexingRetrievalLogger.warn('[startSync]: res not ok or undefined'), (0, d.Ok)('res not ok or undefined')
                const m = c.v
                if ('match' === m.result.case || void 0 === m.result.value) return IndexingRetrievalLogger.debug('[startSync]: child just synced or value undefined'), (0, d.Ok)('child just synced or value undefined')
                const g = m.result.value.children
                if (0 === g.length) return s.add(r), (0, d.Ok)('Finished subtree')
                g.forEach((e => {
                    e.relativeWorkspacePath = (0, y.decryptPath)(e.relativeWorkspacePath, this.repoInfo.pathEncryptionKey)
                }))
                const f = g.map((e => e.relativeWorkspacePath)), h = new Map
                IndexingRetrievalLogger.debug('[startSync]: relativePathsOnServer: ' + JSON.stringify(f))
                const E = f.map((async e => {
                    try {
                        let t = await this.merkleClient.getSubtreeHash(e)
                        return h.set(e, t), t
                    } catch (e) {
                        return IndexingRetrievalLogger.debug('[startSync]: EXPECTED ERROR IF SERVER IS OUT OF SYNC filetree hash error: ' + e), '-1'
                    }
                })), C = await Promise.all(E)
                if (this.abortController.signal.aborted) return (0, d.Err)('Aborted')
                if (IndexingRetrievalLogger.debug('[startSync]: localHashesForChildrenOnServer: ' + JSON.stringify(C)), C.length !== g.length) return IndexingRetrievalLogger.error('Number of children is not the same!'), (0, d.Err)('Number of children is not the same!')
                const I = g.filter(((e, t) => '-1' === C[t] || '' === C[t]))
                I.forEach((e => {
                    a.add(e.relativeWorkspacePath)
                })), IndexingRetrievalLogger.debug('[startSync]: pathsToDelete: ' + JSON.stringify(Array.from(a), null, 2))
                const _ = g.filter(((e, t) => {
                    const r = C[t]
                    return !(e.hashOfNode === r || '-1' === r || '' === r || (IndexingRetrievalLogger.debug('[startSync]: mismatched child: ' + e.relativeWorkspacePath), IndexingRetrievalLogger.debug('[startSync]: hashonserver: ' + e.hashOfNode), IndexingRetrievalLogger.debug('[startSync]: localhash: ' + r), 0))
                }))
                IndexingRetrievalLogger.debug('[startSync]: misMatchedChildren: ' + JSON.stringify(_, null, 2))
                let B = (await (0, fs.readdir)(filePath, {
                    encoding: 'utf-8',
                    withFileTypes: !0,
                    recursive: !1
                })).map((e => (e.path = i.join(filePath, e.name), e))).map((async e => {
                    let t = !1
                    try {
                        '' === await this.merkleClient.getSubtreeHash((0, u.getRelativePath)(e.path)) && (t = !0)
                    } catch (e) {
                        t = !0
                    }
                    return t ? -1 : e
                }))
                if (this.abortController.signal.aborted) return (0, d.Err)('Aborted')
                const T = await Promise.all(B), S = []
                for (const e of T) -1 !== e && S.push(e)
                const w = S.filter((e => e.isFile())).map((e => (0, u.getRelativePath)(e.path)))
                if (IndexingRetrievalLogger.debug('[startSync]: trueChildrenFiles: ' + JSON.stringify(w, null, 2)), this.abortController.signal.aborted) return (0, d.Err)('Aborted')
                const R = _.filter((e => w.includes(e.relativeWorkspacePath)))
                IndexingRetrievalLogger.debug('[startSync]: filesToUpdate: ' + JSON.stringify(R, null, 2)), R.forEach((e => {
                    n.add(e.relativeWorkspacePath)
                })), IndexingRetrievalLogger.debug('[startSync]: updates: ' + JSON.stringify(Array.from(n), null, 2))
                const v = S.filter((e => e.isDirectory())).map((e => (0, u.getRelativePath)(e.path)))
                IndexingRetrievalLogger.debug('[startSync]: trueChildrenDirectories: ' + JSON.stringify(v, null, 2))
                const k = _.filter((e => v.includes(e.relativeWorkspacePath)))
                IndexingRetrievalLogger.debug('[startSync]: directoriesToUpdate: ' + JSON.stringify(k, null, 2)), k.forEach((e => {
                    entriesToProcess.push({
                        relativePath: e.relativeWorkspacePath,
                        hash: h.get(e.relativeWorkspacePath)
                    })
                })), IndexingRetrievalLogger.debug('[startSync]: subtreeQueue: ' + JSON.stringify(entriesToProcess))
                const Q = v.filter((e => !f.includes(e))), N = w.filter((e => !f.includes(e)))
                if (Q.forEach((e => s.add(e))), N.forEach((e => o.add(e))), IndexingRetrievalLogger.debug('[startSync]: newDirectoriesToSend: ' + JSON.stringify(Array.from(s))), IndexingRetrievalLogger.debug('[startSync]: newFilesToSend: ' + JSON.stringify(Array.from(o))), 0 === I.length && 0 === R.length && 0 === k.length && 0 === Q.length && 0 === N.length) if (w.length > 0) {
                    const e = w[0]
                    n.add(e)
                } else if (v.length > 0) {
                    const e = v[0]
                    s.add(e)
                }
                return (0, d.Ok)('Finished subtree')
            }))
            f.push(m)
        }
        if (g === this.MAX_NUM_ITERATIONS) return IndexingRetrievalLogger.error('startSync: There is likely an infinite loop here.'), (0, d.Ok)(!1)
        const h = await Promise.all(f)
        if (this.abortController.signal.aborted) return (0, d.Err)('Aborted')
        h.forEach((e => {
            e.isErr() && IndexingRetrievalLogger.error(e.error())
        })), IndexingRetrievalLogger.debug('[startSync]: ------------------'), IndexingRetrievalLogger.debug('[startSync]: updates: ' + JSON.stringify(Array.from(n), null, 2)), IndexingRetrievalLogger.debug('[startSync]: newDirectoriesToSend: ' + JSON.stringify(Array.from(s))), IndexingRetrievalLogger.debug('[startSync]: newFilesToSend: ' + JSON.stringify(Array.from(o))), IndexingRetrievalLogger.debug('[startSync]: pathsToDelete: ' + JSON.stringify(Array.from(a))), IndexingRetrievalLogger.debug('[startSync]: ------------------')
        let E = [...Array.from(n), ...Array.from(o)]
        const C = Array.from(s)
        let I = await this.updateNumberOfUploadJobs(E, C, this.repoInfo.workspaceUri.fsPath)
        if (IndexingRetrievalLogger.info('[startSync]: numJobs: ' + I), I >= this.config.absoluteMaxNumberFiles) return IndexingRetrievalLogger.error('Too many jobs to upload. Aborting.'), this.status.set({
            case: 'error',
            error: 'Too many files to upload.'
        }), (0, d.Err)('Too many files to upload.')
        let _ = Array.from(a)
        if (await this.deleteFileListFromServer(_), this.abortController.signal.aborted) return (0, d.Err)('Aborted')
        for (const e of C) {
            let t = await this.merkleClient.getAllDirFilesToEmbed(i.join(this.repoInfo.workspaceUri.fsPath, e))
            E.push(...t.map((e => (0, u.getRelativePath)(e))))
        }
        const B = await this.syncFileListToServer(E.map((e => ({
            absolutePath: i.join(this.repoInfo.workspaceUri.fsPath, e),
            relativePath: e,
            updateType: m.FastUpdateFileRequest_UpdateType.ADD
        }))))
        return this.abortController.signal.aborted ? (0, d.Err)('Aborted') : B.isErr() ? (IndexingRetrievalLogger.error('Failed to upload files.'), (0, d.Err)(B.error())) : (0, d.Ok)(!0)
    }

    async startRepoUpload(e) {
        if (IndexingRetrievalLogger.info('Starting repository upload from scratch.'), 'onlyCallThisFromStartFastRemoteSync' !== e) return (0, d.Err)('You must call this from startFastRemoteSync')
        const t = await this.merkleClient.getAllFiles()
        if (this.abortController.signal.aborted) return (0, d.Err)('Aborted')
        const r = await this.syncFileListToServer(t.map((e => ({
            absolutePath: e,
            relativePath: (0, u.getRelativePath)(e),
            updateType: m.FastUpdateFileRequest_UpdateType.ADD
        }))))
        return this.abortController.signal.aborted ? (0, d.Err)('Aborted') : r.isErr() ? (IndexingRetrievalLogger.error('Failed to upload files.'), (0, d.Err)(r.error())) : (0, d.Ok)(!0)
    }

    async startFastRemoteSync(e) {
        if (IndexingRetrievalLogger.info('Starting fast remote sync.'), this.abortController.signal.aborted) return (0, d.Ok)(!1)
        this.currentIndexingJobs.reset()
        const t = await this.merkleClient.getNumEmbeddableFiles()
        if (this.abortController.signal.aborted) return (0, d.Ok)(!1)
        if (this.currentIndexingJobs.setTotalNumEmbeddableFiles(t), IndexingRetrievalLogger.info('Total num embeddable files: ' + t), t > this.config.absoluteMaxNumberFiles) return IndexingRetrievalLogger.error('Too many files to upload.'), this.status.set({
            case: 'error',
            error: 'Too many files to upload.'
        }), (0, d.Err)('Too many files to upload.')
        const r = await this.merkleClient.getSubtreeHash('.')
        if (this.abortController.signal.aborted) return (0, d.Ok)(!1)
        IndexingRetrievalLogger.info('Root hash: ' + r)
        const n = 'onlyCallThisFromStartFastRemoteSync'
        switch (e) {
            case m.FastRepoInitHandshakeResponse_Status.EMPTY: {
                this.status.set({case: 'indexing-setup'})
                let e = await this.startRepoUpload(n)
                return this.abortController.signal.aborted ? (0, d.Ok)(!1) : e.isErr() ? (0, d.Err)(e.error()) : (0, d.Ok)(!0)
            }
            case m.FastRepoInitHandshakeResponse_Status.OUT_OF_SYNC: {
                IndexingRetrievalLogger.info('In the out of sync case.'), this.status.set({case: 'indexing-setup'})
                let e = await this.startSync(n)
                return this.abortController.signal.aborted ? (0, d.Ok)(!1) : e.isErr() ? (0, d.Err)(e.error()) : (0, d.Ok)(!0)
            }
            case m.FastRepoInitHandshakeResponse_Status.FAILURE:
                return (0, d.Err)('Handshake failed.')
            case m.FastRepoInitHandshakeResponse_Status.UP_TO_DATE:
                return (0, d.Ok)(!0)
            case m.FastRepoInitHandshakeResponse_Status.UNSPECIFIED:
                return (0, d.Err)('Handshake failed. REPORT THIS TO DATADOG PLEASE!')
            default:
                throw new Error(`Unhandled case: ${e}`)
        }
    }

    async getServerStatus() {
        IndexingRetrievalLogger.info('Doing a startup handshake.'), IndexingRetrievalLogger.debug('Repository info: ' + JSON.stringify(this.repoInfo))
        const e = await (async () => {
            try {
                if (this.context.storageUri) {
                    const e = a.Uri.joinPath(this.context.storageUri, 'embeddable_files.txt')
                    return await a.workspace.fs.writeFile(e, new Uint8Array), e.fsPath
                }
            } catch (e) {
                return void IndexingRetrievalLogger.error('Failed to create embeddable_files.txt: ' + (e instanceof Error ? e.message : 'unknown error'))
            }
        })(), t = await this.initializeMerkleTreeWithRipgrepIgnore(e)
        if (!t.ok()) return (0, d.Err)(t.error())
        this.highLevelDescriptionJob.compute()
        const r = async () => !0, n = await this.merkleClient.getSubtreeHash('.')
        IndexingRetrievalLogger.info('Doing the initial handshake with hash: ' + n)
        const s = await this.merkleClient.getNumEmbeddableFiles()
        let o, i
        try {
            o = await this.repoClient.handshakeWithRetry({
                repository: {
                    ...this.repoInfo.export(),
                    isLocal: !0,
                    numFiles: s,
                    isTracked: !1,
                    remoteNames: [],
                    remoteUrls: []
                }, rootHash: n, potentialLegacyRepoName: this.repoInfo.legacyRepoName
            }, this.abortController.signal), o.repoName === this.repoInfo.legacyRepoName && this.repoInfo.setUseLegacyRepoName(!0)
        } catch (e) {
            i = e
        }
        if (this.abortController.signal.aborted) return (0, d.Err)('Aborted')
        if (void 0 === o) return IndexingRetrievalLogger.error('Handshake failed:'), IndexingRetrievalLogger.error(i), (0, d.Err)('Handshake failed.')
        switch (IndexingRetrievalLogger.info('Handshake result:', JSON.stringify(o)), o.status) {
            case m.FastRepoInitHandshakeResponse_Status.EMPTY:
                return a.cursor.registerIsNewIndexProvider(r), this.status.set({case: 'not-indexed'}), (0, d.Ok)(o.status)
            case m.FastRepoInitHandshakeResponse_Status.OUT_OF_SYNC:
                return a.cursor.registerIsNewIndexProvider(r), this.status.set({case: 'out-of-sync'}), (0, d.Ok)(o.status)
            case m.FastRepoInitHandshakeResponse_Status.FAILURE:
                return this.status.set({case: 'error', error: i}), (0, d.Err)('Handshake failed.')
            case m.FastRepoInitHandshakeResponse_Status.UP_TO_DATE:
                return a.cursor.registerIsNewIndexProvider(r), this.status.set({case: 'synced'}), a.cursor.updateUploadProgress(1, a.UploadType.Syncing, !0), this.currentIndexingJobs.setNumJobsToGo(0), (0, d.Ok)(o.status)
            case m.FastRepoInitHandshakeResponse_Status.UNSPECIFIED:
                return this.status.set({case: 'error', error: 'Handshake failed.' + i}), (0, d.Err)('Handshake failed.')
            default: {
                const e = o.status
                throw new Error(`Unhandled case: ${e}`)
            }
        }
    }

    async initializeMerkleTreeWithRipgrepIgnore(e) {
        try {
            IndexingRetrievalLogger.debug('Initializing merkle tree.')
            let t = performance.now()
            if (this.abortController.signal.aborted) return (0, d.Err)('Aborted')
            await this.merkleClient.initWithRipgrepIgnore(e, {maxNumFiles: this.config.absoluteMaxNumberFiles}), IndexingRetrievalLogger.info(`Finished initializing merkle tree in ${performance.now() - t} ms.`)
            const r = await this.merkleClient.getNumEmbeddableFiles()
            if (this.indexingIntent === T.IndexingIntent.FallBackToDefault && r > this.config.autoIndexingMaxNumFiles) return this.abortController.abort(), this.status.set({
                case: 'not-auto-indexing',
                numFiles: r
            }), (0, d.Err)(`Not automatically indexing because folder has ${r} files.`)
        } catch (e) {
            return (0, d.Err)(e)
        }
        return (0, d.Ok)(!0)
    }

    async startIndexingRepository() {
        if (this.repoInfo.workspaceUri.fsPath === B.homedir()) return IndexingRetrievalLogger.error('We currently do not allow indexing the home directory.'), void this.status.set({
            case: 'error',
            error: 'We currently do not allow indexing the home directory. Please open a specific workspace in the home directory.'
        })
        this.status.set({case: 'indexing-setup'})
        const e = await this.getServerStatus()
        if (e.ok()) {
            if (!this.abortController.signal.aborted) {
                IndexingRetrievalLogger.debug('Starting to send up the repository.')
                try {
                    const t = await this.startFastRemoteSync(e.v)
                    if (this.abortController.signal.aborted) return
                    if (t.isErr()) return void (!1 === this.abortController.signal.aborted ? (this.status.set({
                        case: 'error',
                        error: t.error().toString()
                    }), IndexingRetrievalLogger.error(t.error())) : IndexingRetrievalLogger.debug('Aborted', t.error()))
                } catch (e) {
                    return void (!1 === this.abortController.signal.aborted ? IndexingRetrievalLogger.error(e) : IndexingRetrievalLogger.debug('Aborted', e))
                }
                this.abortController.signal.aborted || (this.currentIndexingJobs.set([]), IndexingRetrievalLogger.info('Finished indexing repository.'))
            }
        } else !1 === this.abortController.signal.aborted ? (this.status.set({
            case: 'error',
            error: e.error().toString()
        }), IndexingRetrievalLogger.error(e.error())) : IndexingRetrievalLogger.debug('Aborted', e.error())
    }

    async deletePathOnServer(path, toDeleted, signal) {
        try {
            let n = []
            try {
                const t = this.hackyGetSplineWhenYouCantRelyOnTree(path)
                n = t?.map((e => new m.PartialPathItem({
                    relativeWorkspacePath: (0, y.encryptPath)(e, this.repoInfo.pathEncryptionKey),
                    hashOfNode: ''
                })))
            } catch (e) {
                e instanceof Error && IndexingRetrievalLogger.warn('hackyGetSplineWhenYouCantRelyOnTree failed: ' + e.message)
            }
            IndexingRetrievalLogger.debug('deleting directory: ' + toDeleted)
            let s = await this.repoClient.deleteFastUpdateFileWithRetry({
                repository: {
                    ...this.repoInfo.export(),
                    isLocal: !0,
                    numFiles: 0,
                    isTracked: !1,
                    remoteNames: [],
                    remoteUrls: []
                },
                partialPath: {
                    case: 'directory',
                    value: {
                        relativeWorkspacePath: (0, y.encryptPath)(toDeleted, this.repoInfo.pathEncryptionKey),
                        hashOfNode: ''
                    }
                },
                ancestorSpline: n,
                updateType: m.FastUpdateFileRequest_UpdateType.DELETE
            }, signal)
            return s.status === m.FastUpdateFileResponse_Status.SUCCESS ? (0, d.Ok)({relativePath: toDeleted}) : s.status === m.FastUpdateFileResponse_Status.EXPECTED_FAILURE ? (0, d.Err)('Expected failure') : (0, d.Err)('Unexpected failure')
        } catch (e) {
            return (0, d.Err)(e)
        }
    }

    async deleteFileListFromServer(e) {
        IndexingRetrievalLogger.debug('Deleting ' + e.length + ' files from the server.')
        try {
            const t = [], r = 10
            let n = 0, s = 0
            for (; s < e.length;) {
                if (this.abortController.signal.aborted) return (0, d.Err)('Aborted')
                if (n < r) {
                    const r = e[s]
                    const o = i.join(this.repoInfo.workspaceUri.fsPath, r)
                    const a = this.deletePathOnServer(o, r, this.abortController.signal)
                    t.push(a), a.finally((() => n--)), n++, s++
                } else await new Promise((e => setTimeout(e, 300)))
            }
            const o = await Promise.allSettled(t)
            IndexingRetrievalLogger.debug('[startSync]: pathsToDeleteResults: ' + JSON.stringify(o))
        } catch (e) {
            return (0, d.Err)(e)
        }
        return (0, d.Ok)(!0)
    }

    async syncFileListToServer(e, t) {
        if (this.abortController.signal.aborted) return (0, d.Err)('Aborted')
        if (IndexingRetrievalLogger.info(`Uploading ${e.length} files.`), this.syncFileListToServerCalled) throw new Error('syncFileListToServer should only be called once in the life of the indexing job!')
        this.syncFileListToServerCalled = !0
        const r = await this.merkleClient.getNumEmbeddableFiles()
        if (this.abortController.signal.aborted) return (0, d.Err)('Aborted')
        this.status.set({case: 'indexing'}), this.currentIndexingJobs.setTotalNumEmbeddableFiles(r), this.currentIndexingJobs.setNumJobsToGo(e.length), this.currentIndexingJobs.set([])
        let n = 0
        const s = e.map((e => ({...e, errorCount: 0})))
        let o = {current: 2}, i = {current: 0}
        const a = new C.SlidingWindow(3e5), u = new C.SlidingWindow(3e5), p = {current: Date.now() - 6e4},
            A = (e, t) => {
                if (e) i.current > 0 ? i.current = Math.max(0, i.current / 2 - 100) : u.getCurrentValue() / a.getCurrentValue() < .1 && (o.current = Math.min(this.config.maxConcurrentUploads, o.current + 1)) else {
                    if (u.getCurrentValue() / a.getCurrentValue() < .3 && !0 !== t) return
                    if (p.current > Date.now() - 3e4 && !0 !== t) return
                    p.current = Date.now(), 1 === o.current && (i.current = Math.min(1e4, 2 * (i.current + 100))), o.current = Math.max(1, o.current / 2)
                }
            }
        for (; s.length > 0 || this.currentIndexingJobs.length > 0;) {
            if (this.abortController.signal.aborted) return (0, d.Err)('Aborted')
            for (IndexingRetrievalLogger.debug('fileQueue.length: ' + s.length); this.currentIndexingJobs.length >= o.current || 0 === s.length;) {
                if (await new Promise((e => setTimeout(e, i.current))), this.abortController.signal.aborted) return (0, d.Err)('Aborted')
                if (0 === this.currentIndexingJobs.length) break
                const e = this.currentIndexingJobs.get(), r = await Promise.race(e.map((e => e.future))), o = r.jobId,
                    p = r.error
                let c = e.findIndex((e => e.id === o))
                if (-1 !== c) {
                    const t = e.splice(c, 1)
                    if (this.currentIndexingJobs.set(e), n += 1, 1 !== t.length) throw IndexingRetrievalLogger.error('VIOLATION: Completed job length is not 1'), new Error('VIOLATION: Completed job length is not 1')
                    if (void 0 === p || '' === p) IndexingRetrievalLogger.debug('Completed job successfully: ' + t[0].relativePath), a.incr(1), A(!0), this.currentIndexingJobs.updateNumJobsToGo(-1) else {
                        if (!0 === r.errorIsFatal) return this.currentIndexingJobs.updateNumJobsToGo(-1), (0, d.Err)(p ?? 'Unknown fatal error')
                        !0 === r.errorIsRetryable ? (IndexingRetrievalLogger.debug('Completed job unsuccessfully, will retry: ' + t[0].relativePath + ' error: ' + p), u.incr(1), A(!1, r.errorIsRateLimitError), t[0].errorCount < this.config.maxFileRetries ? s.push({
                            absolutePath: t[0].absolutePath,
                            errorCount: t[0].errorCount + 1,
                            relativePath: t[0].relativePath,
                            updateType: t[0].updateType
                        }) : (this.currentIndexingJobs.updateNumJobsToGo(-1), IndexingRetrievalLogger.debug('Ignoring file because it has too many errors: ' + t[0].relativePath))) : (this.currentIndexingJobs.updateNumJobsToGo(1), IndexingRetrievalLogger.debug(`Non-retryable error for file ${t[0].relativePath}: ` + p))
                    }
                }
                n % 50 == 0 && IndexingRetrievalLogger.info('Completed ' + n + ' jobs for absoluteDirectoryPath: ' + t)
            }
            if (0 === s.length) continue
            let e = s.shift(), r = (0, g.v4)()
            if (void 0 !== e) {
                const t = e.absolutePath, n = e.relativePath, s = e.updateType, o = async () => {
                    let e = []
                    try {
                        e = await this.merkleClient.getSpline(t)
                    } catch (e) {
                        return IndexingRetrievalLogger.info('weird. maybe the file was deleted?'), {
                            jobId: r,
                            error: 'weird. maybe the file was deleted?'
                        }
                    }
                    if (this.abortController.signal.aborted) return {jobId: r, error: 'aborted'}
                    try {
                        const o = await this.syncFile(t, n, e, s)
                        return o.isErr() ? {
                            jobId: r,
                            error: o.err.error,
                            errorIsRetryable: o.err.errorIsRetryable,
                            errorIsFatal: o.err.errorIsFatal,
                            errorIsRateLimitError: o.err.errorIsRateLimitError
                        } : {jobId: r}
                    } catch (e) {
                        return this.abortController.signal.aborted || IndexingRetrievalLogger.debug(e), {
                            jobId: r,
                            error: e,
                            errorIsRetryable: !0
                        }
                    }
                }
                this.currentIndexingJobs.push({
                    id: r,
                    future: o(),
                    relativePath: n,
                    absolutePath: t,
                    errorCount: e.errorCount,
                    updateType: s
                })
            }
        }
        if (IndexingRetrievalLogger.debug('Finished uploading files in the while loop.'), this.abortController.signal.aborted) return (0, d.Err)('Aborted')
        const c = this.currentIndexingJobs.get()
        if (await Promise.allSettled(c.map((e => e.future))), this.abortController.signal.aborted) return (0, d.Err)('Aborted')
        this.status.set({case: 'creating-index'})
        try {
            await this.repoClient.ensureIndexCreatedWithRetry({
                repository: {
                    ...this.repoInfo.export(),
                    isLocal: !0,
                    numFiles: 0,
                    isTracked: !1,
                    remoteNames: [],
                    remoteUrls: []
                }
            }, this.abortController.signal)
        } catch (e) {
            if (this.abortController.signal.aborted) return (0, d.Err)('Aborted')
            if (e instanceof h.ConnectError && e.code === h.Code.Canceled) return (0, d.Err)('Aborted')
            let t = e ? e.toString() : 'Unknown error'
            return this.status.set({case: 'error', error: 'Creating index failed: ' + t}), (0, d.Err)(e)
        }
        return this.abortController.signal.aborted ? (0, d.Err)('Aborted') : (IndexingRetrievalLogger.debug('Should set to synced.'), this.status.set({case: 'synced'}), this.currentIndexingJobs.setNumJobsToGo(0), this.currentIndexingJobs.forceUpdateProgressBar(), this.currentIndexingJobs.set([]), (0, d.Ok)(!0))
    }

    async syncFile(e, t, r, n) {
        try {
            const s = r.map((e => (0, u.getRelativePath)(e))), o = s.map((e => new m.PartialPathItem({
                relativeWorkspacePath: (0, y.encryptPath)(e, this.repoInfo.pathEncryptionKey),
                hashOfNode: ''
            }))), i = await a.workspace.fs.readFile(a.Uri.file(e)), p = new TextDecoder('utf-8').decode(i), A = {
                repository: {...this.repoInfo.export(), isLocal: !0},
                partialPath: {
                    case: 'localFile',
                    value: {
                        file: {
                            relativeWorkspacePath: (0, y.encryptPath)(t, this.repoInfo.pathEncryptionKey),
                            contents: p
                        }, unencryptedRelativeWorkspacePath: t, hash: (0, f.getHash)(p)
                    }
                },
                ancestorSpline: o,
                updateType: n
            }
            IndexingRetrievalLogger.debug('syncing file: ' + t)
            let c = await this.repoClient.fastUpdateFile(A, this.abortController.signal)
            return c.status === m.FastUpdateFileResponse_Status.FAILURE ? (0, d.Err)({
                error: 'Failed to sync file (unexpected)',
                errorIsFatal: !1,
                errorIsRetryable: !0,
                errorIsRateLimitError: !1
            }) : c.status === m.FastUpdateFileResponse_Status.EXPECTED_FAILURE ? (0, d.Err)({
                error: 'Failed to sync file (expected)',
                errorIsFatal: !1,
                errorIsRetryable: !1,
                errorIsRateLimitError: !1
            }) : c.status === m.FastUpdateFileResponse_Status.SUCCESS ? (0, d.Ok)(!0) : (0, d.Err)({
                error: 'Bad unexpected error',
                errorIsFatal: !1,
                errorIsRetryable: !0,
                errorIsRateLimitError: !1
            })
        } catch (e) {
            if (!(e instanceof h.ConnectError)) return (0, d.Err)({
                error: 'Bad unexpected error',
                errorIsFatal: !1,
                errorIsRetryable: !0,
                errorIsRateLimitError: !1
            })
            if (e.code === h.Code.Canceled) return (0, d.Err)({
                error: 'Bad unexpected error',
                errorIsFatal: !1,
                errorIsRetryable: !0,
                errorIsRateLimitError: !1
            })
            const t = (0, _.getErrorDetail)(e)
            return null != t && k(t) ? (0, d.Err)({
                error: 'Rate limit error. ' + e.rawMessage,
                errorIsFatal: !1,
                errorIsRetryable: !0,
                errorIsRateLimitError: !0
            }) : null != t && Q(t) ? (0, d.Err)({
                error: `Usage limit error. ${e.rawMessage}`,
                errorIsFatal: !0,
                errorIsRetryable: !1,
                errorIsRateLimitError: !1
            }) : e.code === h.Code.ResourceExhausted ? (0, d.Err)({
                error: 'Rate limit error: ' + e.rawMessage,
                errorIsFatal: !1,
                errorIsRetryable: !0,
                errorIsRateLimitError: !0
            }) : (0, d.Err)({
                error: 'Weird error: ' + e,
                errorIsFatal: !1,
                errorIsRetryable: !0,
                errorIsRateLimitError: !1
            })
        }
    }
}

class FastIndexer {
    constructor(e) {
        this.context = e, this.disposables = [], this.status = new m.LocalIndexingStatus, this.currentIndexingJobs = new m.CurrentIndexingJobs, this.highLevelDescriptionGetter = new f.HighLevelDescriptionGetter(e), this.getInitialValues = (async () => {
            try {
                for (; void 0 === this.backendUrl;) this.accessToken = a.cursor.getCursorAuthToken(), this.backendUrl = a.cursor.getCursorCreds()?.repoBackendUrl, await this.createRepositoryClient(), await new Promise((e => setTimeout(e, 250)))
            } catch (e) {
                l.IndexingRetrievalLogger.error('failed to create the client', e)
            }
        })()
        const t = {
            getCurrentJobs: async () => this.currentIndexingJobs.get().slice(-15).map((e => ({fileName: e.relativePath}))),
            decryptPaths: async e => {
                if (void 0 === this.repoIndexWatcher) throw new Error('Repo index watcher is undefined. We cannot decrypt the paths.')
                const t = this.repoIndexWatcher.repoInfo.pathEncryptionKey
                return void 0 === t ? e : e.map((e => (0, C.decryptPath)(e, t)))
            },
            compileGlobFilter: async e => {
                if (void 0 === this.repoIndexWatcher) throw new Error('Repo index watcher is undefined. We cannot compile the glob filter.')
                const t = this.repoIndexWatcher.repoInfo.pathEncryptionKey
                return void 0 === t ? e : {
                    globFilter: e.globFilter ? (0, C.encryptGlob)(e.globFilter, t) : void 0,
                    notGlobFilter: e.notGlobFilter ? (0, C.encryptGlob)(e.notGlobFilter, t) : void 0
                }
            },
            getRepoInfo: async () => {
                if (void 0 !== this.repoIndexWatcher) return this.repoIndexWatcher.repoInfo.export()
                const e = this.getWorkspaceRootInfoWithProperError()
                return void 0 === e.error && void 0 !== e.info ? e.info.export() : void 0
            },
            getStatus: async () => this.status.get(),
            getIndexingProgress: async () => await this.currentIndexingJobs.getCurrentProgress(),
            getHighLevelFolderDescription: async () => this.highLevelDescriptionGetter.getHighLevelFolderDescription()
        }
        let r = a.cursor.registerIndexProvider(t)
        this.disposables.push(r), this.status.init(), this.disposables.push(a.cursor.onDidChangeCursorAuthToken((e => {
            this.accessToken = e, this.createRepositoryClient().catch(l.IndexingRetrievalLogger.error).then((() => {
                this.createRepoIndexWatcherIfShouldIndex({shouldRecreateIfExists: !0})
            }))
        }))), this.disposables.push(a.cursor.onDidChangeCursorCreds((e => {
            this.backendUrl = e.repoBackendUrl, this.createRepositoryClient().catch(l.IndexingRetrievalLogger.error).then((() => {
                this.createRepoIndexWatcherIfShouldIndex({shouldRecreateIfExists: !0})
            }))
        }))), this.disposables.push(a.cursor.onDidRequestRepoIndex((async () => {
            await this.getInitialValues
            const e = this.getWorkspaceRootInfoWithProperError()
            if (void 0 !== e.error || void 0 === e.info) return e.error === I.UserNotLoggedInError ? this.status.set({
                case: 'error',
                error: 'You aren\'t logged in. We only support indexing for registered users.'
            }) : e.error === I.NoWorkspaceUriError ? this.status.set({
                case: 'error',
                error: 'We do not support single files yet.'
            }) : e.error === I.WorkspaceUriUndefinedError ? this.status.set({
                case: 'error',
                error: 'You don\'t have a proper workspace open. We only support indexing for vscode workspaces.'
            }) : this.status.set({
                case: 'error',
                error: 'We had a trouble setting up the indexing. Please report this to hi@cursor.so'
            }), void l.IndexingRetrievalLogger.error(e.error ?? 'Unknown error')
            const t = e.info
            l.IndexingRetrievalLogger.info('Setting indexing intent to should-index'), this.setIndexingIntent(t, A.IndexingIntent.ShouldIndex), await this.createRepoIndexWatcherIfShouldIndex({shouldRecreateIfExists: !1})
        }))), this.disposables.push(a.cursor.onDidRequestRepoInterrupt((e => {
            if (this.repoIndexWatcher?.dispose(), this.repoIndexWatcher = void 0, e) this.status.set({case: 'paused'}), a.cursor.onDidChangeIndexingStatus() else {
                const e = this.getWorkspaceRootInfo()
                e.ok() && this.setIndexingIntent(e.v, A.IndexingIntent.ShouldNotIndex), this.currentIndexingJobs.set([]), a.cursor.updateUploadProgress(0, a.UploadType.Syncing, !1), this.status.set({case: 'not-indexed'}), a.cursor.onDidChangeIndexingStatus()
            }
        }))), this.createRepoIndexWatcherIfShouldIndex({shouldRecreateIfExists: !1})
    }

    async createRepoIndexWatcherIfShouldIndex(e) {
        try {
            if (void 0 !== this.repoIndexWatcher) {
                if (!e.shouldRecreateIfExists) return
                this.repoIndexWatcher.dispose(), this.repoIndexWatcher = void 0
            }
            if (await this.getInitialValues, void 0 === this.accessToken) return void l.IndexingRetrievalLogger.error('accessToken is undefined. User is not logged in. We shouldn\'t do any indexing.')
            const t = this.getWorkspaceRootInfo()
            if (!t.ok()) return void l.IndexingRetrievalLogger.error(t.error())
            const r = t.v, n = a.cursor.shouldIndexNewRepos(), s = this.getIndexingIntent(r)
            if (!(s === A.IndexingIntent.FallBackToDefault ? n : s === A.IndexingIntent.ShouldIndex)) return l.IndexingRetrievalLogger.info('Not indexing because user does not want to index this workspace.'), void this.status.set({case: 'not-indexed'})
            if (void 0 === this.repoClient) return void l.IndexingRetrievalLogger.error('Repo client is undefined. We shouldn\'t be indexing! This is a serious bug.')
            if (void 0 !== this.repoIndexWatcher) return
            this.repoIndexWatcher = new c.RepoIndexWatcher(r, this.repoClient, this.currentIndexingJobs, this.status, s, this.context)
        } finally {
            a.cursor.onDidChangeIndexingStatus()
        }
    }

    getAuthId() {
        const e = this.accessToken
        if (void 0 !== e) return (0, p.decodeJwt)(e).sub
    }

    dispose() {
        for (const e of this.disposables) e.dispose()
        this.repoIndexWatcher?.dispose(), this.highLevelDescriptionGetter.dispose(), this.repoClient?.dispose()
    }

    async createRepositoryClient() {
        void 0 !== this.repoClient && this.repoClient.dispose(), void 0 !== this.accessToken && void 0 !== this.backendUrl ? this.repoClient = new g.RepoClientMultiplexer(this.accessToken, this.backendUrl) : this.repoClient = void 0
    }

    getWorkspaceRootInfoWithProperError() {
        const e = a.workspace.workspaceFolders
        if (void 0 === e || 0 === e.length) return {info: void 0, error: I.NoWorkspaceUriError}
        const t = e[0].uri
        if (void 0 === t) return {info: void 0, error: I.WorkspaceUriUndefinedError}
        const r = this.getAuthId()
        if (void 0 === r || void 0 === this.accessToken || void 0 === this.backendUrl) return {
            info: void 0,
            error: I.UserNotLoggedInError
        }
        const n = this.getLegacyRepoName(t), s = this.getRepoKeysKey(n)
        let o = this.context.workspaceState.get(s, void 0)
        void 0 === o && (o = this.getInitialRepoKeys(), this.context.workspaceState.update(s, o))
        const i = new E.InternalRepoInfo({
            repoName: o.repoName,
            legacyRepoName: n,
            repoOwner: r,
            relativeWorkspacePath: '.',
            workspaceUri: t,
            orthogonalTransformSeed: o.orthogonalTransformationSeed,
            pathEncryptionKey: o.pathEncryptionKey
        })
        return l.IndexingRetrievalLogger.setUser(r), l.IndexingRetrievalLogger.setRepo(o.repoName), {
            info: i,
            error: void 0
        }
    }

    getWorkspaceRootInfo() {
        const {info: e, error: t} = this.getWorkspaceRootInfoWithProperError()
        return void 0 !== t || void 0 === e ? (0, d.Err)(t ?? 'Unknown error') : (0, d.Ok)(e)
    }

    getInitialRepoKeys() {
        return {
            repoName: (0, h.generateUuid)(),
            orthogonalTransformationSeed: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
            pathEncryptionKey: (0, C.generatePathEncryptionKey)()
        }
    }

    getLegacyRepoName(e) {
        const t = i.basename(e.fsPath)
        return (0, u.getHash)(e.fsPath) + '-' + t
    }

    setIndexingIntent(e, t) {
        const r = this.getIndexingIntentKey(e)
        this.context.workspaceState.update(r, t)
    }

    getIndexingIntent(e) {
        const t = this.getIndexingIntentKey(e),
            r = this.context.workspaceState.get(t, A.IndexingIntent.FallBackToDefault)
        try {
            return void 0 !== A.IndexingIntent[r] ? A.IndexingIntent.FallBackToDefault : r
        } catch (e) {
            return A.IndexingIntent.FallBackToDefault
        }
    }

    getIndexingIntentKey(e) {
        return `map/${e.legacyRepoName}/${e.repoOwner}/indexingIntent`
    }

    getRepoKeysKey(e) {
        return `map/${e}/repoKeys`
    }
}