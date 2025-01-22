vsocde.activate = function (A) {
    a.AlwaysLocalLogger.init(), Q.CppLogger.init(), a.FileSyncLogger.init();
    A.isDevelopment && Q.CursorDebugLogger.init()
    const i = new n.Differ
    l.push((async () => i.dispose()))
    const c = new t.Requester
    l.push((async () => c.dispose()))
    const h = new r.AiConnectTransportHandler(A)
    l.push((async () => h.dispose()))
    const u = new g.FileSyncer(A, h)
    l.push((async () => u.dispose()))
    const D = new B.ControlProvider(A, u, h)
    l.push((async () => D.dispose()))
    const d = new E.ExtHostEventLoggerImpl(D)
    l.push((async () => d.dispose())), e.stats = new o.Metrics, l.push((async () => e.stats?.dispose()))
    const w = new s.EverythingAlwaysLocalProviderCreator(A)
    l.push((async () => w.dispose()))
}

class FileSyncClient {
    constructor(A, e) {
        this.config = A, this.aiConnectTransport = e, this.myUUID = (0, r.randomUUID)(), this.clientKey = o.randomBytes(32), this.config.addCredChangeCallback((() => this.initialize())), this.rateLimiter = new B.FileSyncRateLimiter({
            rate: this.config.fsConfig?.rateLimiterRps ?? 10,
            capacity: this.config.fsConfig?.rateLimiterBurstCapacity ?? 100,
            breakerResetTime: this.config.fsConfig?.rateLimiterBreakerResetTimeMs ?? 3e5
        })
    }

    updateConfig(A) {
        this.rateLimiter.updateConfig(A)
    }

    async initialize() {
        try {
            await this.fsConfigUpdate()
        } catch (A) {
            throw s.FileSyncLogger.error('Failed to initialize FileSyncClient', A), A
        }
    }

    throwIfFSDisabled() {
        if (!this.config.isFileSyncEnabled()) throw new Error('File sync is disabled')
    }

    getFileSyncEncryptionHeader() {
        return {'x-fs-client-key': this.clientKey.toString('hex')}
    }

    async syncFile(A) {
        const e = performance.now()
        try {
            this.throwIfFSDisabled()
            const i = this.aiConnectTransport.getFilesyncClient()
            return await this.rateLimiter.executeForPath(A.relativeWorkspacePath, (async () => {
                const t = await i.fSSyncFile({uuid: this.myUUID, ...A}, {headers: this.getFileSyncEncryptionHeader()}),
                    a = performance.now()
                return s.FileSyncLogger.info(`Synced file ${A.relativeWorkspacePath} modelVersion=${A.modelVersion} in ${a - e}ms`), t
            }))
        } catch (e) {
            throw e instanceof B.RateLimitError && s.FileSyncLogger.warn(`Rate limit exceeded for file sync: ${A.relativeWorkspacePath}`), e
        }
    }

    async isEnabledForUserFromServer() {
        try {
            const A = this.aiConnectTransport.getFilesyncClient(), e = await A.fSIsEnabledForUser({uuid: this.myUUID})
            return e.enabled ? s.FileSyncLogger.info('[ENABLED STATUS] Filesync enabled from server.') : s.FileSyncLogger.info('[ENABLED STATUS] Filesync is NOT enabled from server.'), e.enabled
        } catch (A) {
            return s.FileSyncLogger.error('Failed to check if file sync is enabled for user', JSON.stringify(A)), !1
        }
    }

    async uploadFile(A) {
        const e = performance.now()
        try {
            this.throwIfFSDisabled()
            const i = this.aiConnectTransport.getFilesyncClient()
            return await this.rateLimiter.executeForPath(A.relativeWorkspacePath, (async () => {
                const t = await i.fSUploadFile({uuid: this.myUUID, ...A}, {headers: this.getFileSyncEncryptionHeader()}),
                    a = performance.now()
                return s.FileSyncLogger.info(`Uploaded file ${A.relativeWorkspacePath} modelVersion=${A.modelVersion} in ${a - e}ms`), t
            }))
        } catch (e) {
            throw e instanceof B.RateLimitError && s.FileSyncLogger.warn(`Rate limit exceeded for file sync: ${A.relativeWorkspacePath}`), e
        }
    }

    async fsConfig() {
        const A = performance.now()
        try {
            this.throwIfFSDisabled()
            const e = this.aiConnectTransport.getFilesyncClient(), i = await e.fSConfig({}), t = performance.now() - A
            return s.FileSyncLogger.info(`Fetched fsConfig in ${t}ms`), s.FileSyncLogger.info('FSConfig response:', JSON.stringify(i)), i
        } catch (A) {
            throw s.FileSyncLogger.error('Failed to fetch fsConfig', A), A
        }
    }

    async fsConfigUpdate() {
        const A = await this.isEnabledForUserFromServer()
        this.config.isEnabledFromServer = A
        try {
            const A = await this.fsConfig()
            this.config.fsConfig = A
        } catch (A) {
            s.FileSyncLogger.error('Failed to fetch fsConfig', A), this.config.fsConfig = void 0
        }
    }
}

class FileSyncer {
    constructor(A, e) {
        this.context = A, this.aiConnectTransport = e, this.observationDisposables = [], this.maxFileSizeToSyncBytes = p, this.successiveSyncsRequiredForReliance = 5, this.ONE_HUNDRED_MS = 100, this.config = new E.FileSyncConfigManager(this.context);
        this.client = new FileSyncClient(this.config, this.aiConnectTransport), this.recentUpdatesManager = new l.RecentUpdatesManager;
        this.syncerAndUploader = new SyncerAndUploader(this.client, this.config, this.recentUpdatesManager);
        this.initialize()
    }

    async initialize() {
        try {
            await this.client.initialize(), await new Promise((A => setTimeout(A, 3 * this.ONE_HUNDRED_MS))), s.cursor.onDidChangeFileSyncClientEnabled(this.handleFileSyncEnabledChange.bind(this)), this.config.addCredChangeCallback((() => this.syncVisibleTabs())), this.registerEventListeners(), this.syncVisibleTabs(), this.registerFileSyncActions()
        } catch (A) {
            r.FileSyncLogger.error('Failed to initialize FileSyncer', A), this.config.isDevelopment() && this.config.isFileSyncEnabled() && s.window.showErrorMessage('Failed to initialize file sync. Please try reloading the window.' + (A instanceof Error ? ` Error: ${A.message}` : ''))
        }
    }

    registerFileSyncActions() {
        (0, u.registerAction)(D.FileSyncActions.GetFileSyncUpdates, (async A => this.config.isFileSyncEnabled() ? (await this.getRecentFilesyncUpdates(A)).map((A => A.toJson())) : [])), (0, u.registerAction)(D.FileSyncActions.ShouldRelyOnFileSyncForFile, (async A => this.shouldRelyOnFileSyncForFile(A.relativeWorkspacePath, A.modelVersion))), (0, u.registerAction)(D.FileSyncActions.GetFileSyncEncryptionHeader, (async () => this.getFileSyncEncryptionHeader())), (0, u.registerAction)(D.FileSyncActions.ResetSequentialSuccessfulSync, (async A => {
            this.resetSequentialSuccessfulSync(A.relativeWorkspacePath)
        }))
    }

    async scheduleFSConfigUpdate() {
        await this.client.fsConfigUpdate(), this.updateConfig(this.config.fsConfig), setInterval((async () => {
            await this.client.fsConfigUpdate(), this.updateConfig(this.config.fsConfig)
        }), 3e5)
    }

    updateConfig(A) {
        this.syncerAndUploader.updateConfig(A), this.recentUpdatesManager.updateConfig(A), this.client.updateConfig(A), this.maxFileSizeToSyncBytes = A?.maxFileSizeToSyncBytes ?? p, this.successiveSyncsRequiredForReliance = A?.successiveSyncsRequiredForReliance ?? 5
    }

    async getRecentFilesyncUpdates({
                                       maxUpdates: A,
                                       relativeWorkspacePath: e,
                                       requestedModelVersion: i
                                   }) {
        if (void 0 !== e && void 0 !== i) {
            const A = 5, t = 4
            for (let a = 0; a < A; a++) {
                const A = this.recentUpdatesManager.getLatestModelVersion(e)
                if (void 0 !== A && A >= i) break
                await new Promise((A => setTimeout(A, t)))
            }
        }
        return this.recentUpdatesManager.getRecentUpdates(A, e)
    }

    getFileSyncEncryptionHeader() {
        return this.client.getFileSyncEncryptionHeader()
    }

    registerEventListeners() {
        r.FileSyncLogger.info('[registerEventListeners] Registering event listeners'), this.observationDisposables.push(s.workspace.onDidChangeTextDocument(this.handleDocumentChange.bind(this)), s.window.onDidChangeVisibleTextEditors(this.handleVisibleEditorsChange.bind(this)))
    }

    async handleDocumentChange(A) {
        if (!this.shouldSyncDocument(A.document)) return
        if (!this.config.isFileSyncEnabled()) return
        const e = s.workspace.asRelativePath(A.document.uri)
        this.pushToRecentUpdatesManager(A, e)
        const i = await this.getRecentFilesyncUpdates({relativeWorkspacePath: e})
        await this.syncerAndUploader.syncDocumentChanges(A.document, i, e)
    }

    pushToRecentUpdatesManager(A, e) {
        const i = A.document.version, t = A.contentChanges.map((A => new o.SingleUpdateRequest({
            startPosition: A.rangeOffset,
            endPosition: A.rangeOffset + A.rangeLength,
            changeLength: A.rangeLength,
            replacedString: A.text
        })))
        this.recentUpdatesManager.push(new o.FilesyncUpdateWithModelVersion({
            modelVersion: i,
            relativeWorkspacePath: e,
            updates: t,
            expectedFileLength: A.document.getText().length
        }))
    }

    async handleVisibleEditorsChange(A) {
        if (!this.config.isFileSyncEnabled()) return
        const e = performance.now()
        A.forEach((A => {
            this.shouldSyncDocument(A.document) && this.syncerAndUploader.syncFullDocument(A.document)
        }))
        const i = performance.now()
        r.FileSyncLogger.info(`Handled visible editors change in ${i - e}ms`)
    }

    async handleFileSyncEnabledChange(A) {
        this.config.refresh(), await this.client.fsConfigUpdate(), r.FileSyncLogger.info(`File sync enabled status: ${this.config.isFileSyncEnabled()}`), this.config.isFileSyncEnabled() && await this.syncVisibleTabs()
    }

    async syncVisibleTabs() {
        if (!this.config.isFileSyncEnabled()) return
        r.FileSyncLogger.info('Starting sync of visible tabs')
        const A = performance.now(),
            e = s.window.visibleTextEditors.filter((A => this.shouldSyncDocument(A.document))).map((A => this.syncerAndUploader.syncFullDocument(A.document)))
        await Promise.all(e)
        const i = performance.now()
        r.FileSyncLogger.info(`Synced all visible tabs in ${i - A}ms`)
    }

    shouldSyncDocument(A) {
        return !('file' !== A.uri.scheme && 'untitled' !== A.uri.scheme && 'vscode-remote' !== A.uri.scheme || this.syncerAndUploader.getLatestDocumentVersionSynced(s.workspace.asRelativePath(A.uri)) === A.version && !this.config.isDevelopment() || (A.getText().length > this.maxFileSizeToSyncBytes || !(0, h.isCppEnabledForFile)(s.cursor.cppEnabled(), {
            languageId: A.languageId,
            fsPath: A.uri.fsPath
        }, s.workspace.getConfiguration().get(h.CPP_DISABLED_LANGUAGES_CONFIG_ID) ?? [])) && (this.syncerAndUploader.resetSequentialSuccessfulSync(s.workspace.asRelativePath(A.uri)), 1))
    }

    dispose() {
        this.observationDisposables.forEach((A => A.dispose()))
    }

    shouldRelyOnFileSyncForFile(A, e) {
        if (!this.config.isFileSyncEnabled() || 1 === e) return !1
        const i = this.syncerAndUploader.getLatestDocumentVersionSynced(A)
        if (void 0 === i || void 0 !== e && i < e - 10) return !1
        const t = this.syncerAndUploader.getSequentialSuccessfulSyncCount(A)
        return void 0 !== t && t >= this.successiveSyncsRequiredForReliance
    }

    resetSequentialSuccessfulSync(A) {
        this.syncerAndUploader.resetSequentialSuccessfulSync(A)
    }
}

class SyncerAndUploader {
    constructor(A, e, i) {
        this.client = A, this.config = e, this.recentUpdatesManager = i, this.retryConfig = {
            numOfAttempts: 3,
            startingDelay: 20,
            timeMultiple: 2
        }, this.extraSuccessfulSyncsNeededAfterError = 0, this.syncDebounceMs = 250, this.syncUpdateThreshold = 10, this.pendingSyncs = new Map, this.documentSyncDetails = this.newFileSyncStatusCache(5, I), this.config.addCredChangeCallback((() => this.documentSyncDetails.clear()))
    }

    newFileSyncStatusCache(A, e) {
        return new c.LRUCache({
            max: A,
            ttl: e,
            updateAgeOnGet: !1,
            updateAgeOnHas: !1,
            allowStale: !1,
            noUpdateTTL: !1
        })
    }

    updateConfig(A) {
        this.recentUpdatesManager.updateConfig(A), this.retryConfig.numOfAttempts = A?.syncRetryMaxAttempts ?? this.retryConfig.numOfAttempts, this.retryConfig.startingDelay = A?.syncRetryInitialDelayMs ?? this.retryConfig.startingDelay, this.retryConfig.timeMultiple = A?.syncRetryTimeMultiplier ?? this.retryConfig.timeMultiple, this.extraSuccessfulSyncsNeededAfterError = A?.syncRetryMaxAttempts ?? this.extraSuccessfulSyncsNeededAfterError, this.syncDebounceMs = A?.syncDebounceMs ?? this.syncDebounceMs, this.syncUpdateThreshold = A?.syncUpdateThreshold ?? this.syncUpdateThreshold
        const e = A?.fileSyncStatusMaxCacheSize ?? 5, i = A?.fileSyncStatusTtlMs ?? I
        if (this.documentSyncDetails.max !== e || this.documentSyncDetails.ttl !== i) {
            const A = this.documentSyncDetails
            this.documentSyncDetails = this.newFileSyncStatusCache(e, i), this.documentSyncDetails.load(A.dump())
        }
    }

    maybeGetFileHash(A) {
        const e = this.config.fsConfig?.checkFilesyncHashPercent || 0
        if (this.config.isDevelopment() || Math.random() < e) return this.getFileSHA256(A)
    }

    async syncDocumentChanges(A, e, i) {
        const t = this.getLatestDocumentVersionSynced(i)
        if (void 0 === t || A.version <= 1 || t < A.version - 50 || t > A.version) return this.resetSequentialSuccessfulSync(i, !0), await this.syncFullDocument(A)
        const a = this.pendingSyncs.get(i)
        if (a && clearTimeout(a), e.length >= this.syncUpdateThreshold && e.length % this.syncUpdateThreshold == 0) return this.pendingSyncs.delete(i), await this.performSync(A, e, i)
        const n = setTimeout((() => {
            this.pendingSyncs.delete(i), this.performSync(A, e, i)
        }), this.syncDebounceMs)
        this.pendingSyncs.set(i, n)
    }

    shouldRetry(A) {
        if (A instanceof d.RateLimitError) return !1
        if (A instanceof w.ConnectError) {
            const e = A.findDetails(m.ErrorDetails).at(0)
            if (!1 === e?.details?.isRetryable) return !1
        }
        return !0
    }

    async performSync(A, e, i) {
        const t = e.filter((A => A.relativeWorkspacePath === i)).map((A => A.modelVersion)).sort(((A, e) => A - e)).pop()
        if (void 0 === t) return
        const a = this.maybeGetFileHash(A.getText()), n = this.shouldRetry
        try {
            await (0, g.backOff)((async () => {
                await this.client.syncFile({
                    relativeWorkspacePath: i,
                    modelVersion: t,
                    filesyncUpdates: e,
                    sha256Hash: a
                }), this.recentUpdatesManager.clearUpdatesUpToVersion(i, t)
            }), {
                ...this.retryConfig,
                retry: (A, e) => !!n(A) && (r.FileSyncLogger.warn(`Failed to sync changes for ${i}, version=${t}, retrying (attempt ${e})`, A), !0)
            }), this.incrementSequentialSuccessfulSync(i, t)
        } catch (e) {
            r.FileSyncLogger.error(`Failed to sync changes for ${i}, version=${t}, attempting full file sync`, e), this.resetSequentialSuccessfulSync(i, !0), await this.syncFullDocument(A)
        }
    }

    async syncFullDocument(A) {
        const e = s.workspace.asRelativePath(A.uri), i = A.version, t = A.getText(), a = this.maybeGetFileHash(t),
            n = this.shouldRetry
        try {
            await (0, g.backOff)((async () => {
                await this.client.uploadFile({
                    relativeWorkspacePath: e,
                    modelVersion: i,
                    contents: t,
                    sha256Hash: a
                }), this.recentUpdatesManager.clearUpdatesUpToVersion(e, i)
            }), {
                ...this.retryConfig,
                retry: (A, t) => !!n(A) && (r.FileSyncLogger.warn(`Failed to sync full file ${e}, version=${i}, retrying (attempt ${t})`, A), !0)
            }), this.incrementSequentialSuccessfulSync(e, i)
        } catch (A) {
            throw r.FileSyncLogger.error(`Failed to sync full file after all retries for ${e}, version=${i}`, A), this.resetSequentialSuccessfulSync(e, !0), A
        }
    }

    getFileSHA256(A) {
        return (0, B.createHash)('sha256').update(A).digest('hex')
    }

    incrementSequentialSuccessfulSync(A, e) {
        const i = this.documentSyncDetails.get(A) || {
            modelVersion: e,
            sequentialSuccessfulSyncCount: 0
        }
        i.sequentialSuccessfulSyncCount += 1, i.modelVersion = e, this.documentSyncDetails.set(A, i)
    }

    getLatestDocumentVersionSynced(A) {
        return this.documentSyncDetails.get(A)?.modelVersion
    }

    resetSequentialSuccessfulSync(A, e = !1) {
        const i = this.documentSyncDetails.get(A)
        void 0 !== i && (e ? i.sequentialSuccessfulSyncCount = -this.extraSuccessfulSyncsNeededAfterError : this.documentSyncDetails.delete(A))
    }

    getSequentialSuccessfulSyncCount(A) {
        return this.documentSyncDetails.get(A)?.sequentialSuccessfulSyncCount
    }
}
