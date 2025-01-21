class IndexingJob {
	constructor (repoInfo, repoClient, currentIndexingJobs, status, indexingIntent, context, config) {
		this.repoInfo = repoInfo, this.repoClient = repoClient
		this.currentIndexingJobs = currentIndexingJobs
		this.status = status, this.indexingIntent = indexingIntent
		this.context = context, this.config = config
		this.MAX_NUM_ITERATIONS = 1e7
		this.syncFileListToServerCalled = !1, this.abortController = new AbortController
		l.IndexingRetrievalLogger.info('Creating merkle client.')
		this.merkleClient = new c.MerkleClient(this.repoInfo.workspaceUri.fsPath)
		l.IndexingRetrievalLogger.info('Done creating merkle client.')
		this.highLevelDescriptionJob = new I.HighLevelDescriptionJob(this.repoClient, this.merkleClient, this.context)
		this.result = this.startIndexingRepository()
		this.result.finally((() => {this.dispose()}))
	}

	dispose () {this.abortController.abort(), this.highLevelDescriptionJob.dispose()}

	hackyGetSplineWhenYouCantRelyOnTree (e) {
		let t = [], r = e, n = 100
		for (; n > 0;) {
			n -= 1
			const e = i.dirname(r)
			if ('.' === (0, u.getRelativePath)(e)) {
				t.push(e)
				break
			}
			t.push(e), r = e
		}
		return t
	}

	async updateNumberOfUploadJobs (e, t, r) {
		const merkleClient = this.merkleClient, s = (await Promise.allSettled(t.map((async e => {
			const t = i.join(r, e)
			return merkleClient.getAllDirFilesToEmbed(t).then((e => e.length))
		})))).reduce(((e, t) => 'fulfilled' === t.status ? e + t.value : e), e.length)
		return l.IndexingRetrievalLogger.info('setting numJobsToGo to ' + s), this.currentIndexingJobs.setNumJobsToGo(s), s
	}

	async startSync (e) {
		if ('onlyCallThisFromStartFastRemoteSync' !== e) return (0, d.Err)('You must call this from startFastRemoteSync')
		const t = [], treeHash = await this.merkleClient.getSubtreeHash('.')
		t.push({ relativePath: '.', hash: treeHash })
		const n = new Set, s = new Set, o = new Set, a = new Set, c = new p.Semaphore(this.config.syncConcurrency)
		let g = 0
		const f = []
		for (; (c.getCount() > 0 || t.length > 0) && g < this.MAX_NUM_ITERATIONS;) {
			if (g += 1, this.abortController.signal.aborted) return (0, d.Err)('Aborted')
			if (0 === t.length) {
				l.IndexingRetrievalLogger.info('Waiting on semaphore to be released', c.getCount()), await new Promise((e => setTimeout(e, 200)))
				continue
			}
			if (this.abortController.signal.aborted) return (0, d.Err)('Aborted')
			const e = t.pop()
			if (l.IndexingRetrievalLogger.info('[startSync]: ----------------------\nsyncing point nextSubtree' + JSON.stringify(e)), void 0 === e) break
			const r = e.relativePath, p = i.join(this.repoInfo.workspaceUri.fsPath, r), m = c.withSemaphore((async () => {
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
						hashOfNode: e.hash,
						relativeWorkspacePath: (0, y.encryptPath)(r, this.repoInfo.pathEncryptionKey)
					}
				}, this.abortController.signal)))
				if (this.abortController.signal.aborted) return (0, d.Err)('Aborted')
				if (!c.ok() || void 0 === c.v) return t.push(e), l.IndexingRetrievalLogger.warn('[startSync]: res not ok or undefined'), (0, d.Ok)('res not ok or undefined')
				const m = c.v
				if ('match' === m.result.case || void 0 === m.result.value) return l.IndexingRetrievalLogger.debug('[startSync]: child just synced or value undefined'), (0, d.Ok)('child just synced or value undefined')
				const g = m.result.value.children
				if (0 === g.length) return s.add(r), (0, d.Ok)('Finished subtree')
				g.forEach((e => {e.relativeWorkspacePath = (0, y.decryptPath)(e.relativeWorkspacePath, this.repoInfo.pathEncryptionKey)}))
				const f = g.map((e => e.relativeWorkspacePath)), h = new Map
				l.IndexingRetrievalLogger.debug('[startSync]: relativePathsOnServer: ' + JSON.stringify(f))
				const E = f.map((async e => {
					try {
						let t = await this.merkleClient.getSubtreeHash(e)
						return h.set(e, t), t
					} catch (e) {return l.IndexingRetrievalLogger.debug('[startSync]: EXPECTED ERROR IF SERVER IS OUT OF SYNC filetree hash error: ' + e), '-1'}
				})), C = await Promise.all(E)
				if (this.abortController.signal.aborted) return (0, d.Err)('Aborted')
				if (l.IndexingRetrievalLogger.debug('[startSync]: localHashesForChildrenOnServer: ' + JSON.stringify(C)), C.length !== g.length) return l.IndexingRetrievalLogger.error('Number of children is not the same!'), (0, d.Err)('Number of children is not the same!')
				const I = g.filter(((e, t) => '-1' === C[t] || '' === C[t]))
				I.forEach((e => {a.add(e.relativeWorkspacePath)})), l.IndexingRetrievalLogger.debug('[startSync]: pathsToDelete: ' + JSON.stringify(Array.from(a), null, 2))
				const _ = g.filter(((e, t) => {
					const r = C[t]
					return !(e.hashOfNode === r || '-1' === r || '' === r || (l.IndexingRetrievalLogger.debug('[startSync]: mismatched child: ' + e.relativeWorkspacePath), l.IndexingRetrievalLogger.debug('[startSync]: hashonserver: ' + e.hashOfNode), l.IndexingRetrievalLogger.debug('[startSync]: localhash: ' + r), 0))
				}))
				l.IndexingRetrievalLogger.debug('[startSync]: misMatchedChildren: ' + JSON.stringify(_, null, 2))
				let B = (await (0, A.readdir)(p, {
					encoding: 'utf-8',
					withFileTypes: !0,
					recursive: !1
				})).map((e => (e.path = i.join(p, e.name), e))).map((async e => {
					let t = !1
					try {'' === await this.merkleClient.getSubtreeHash((0, u.getRelativePath)(e.path)) && (t = !0)} catch (e) {t = !0}
					return t ? -1 : e
				}))
				if (this.abortController.signal.aborted) return (0, d.Err)('Aborted')
				const T = await Promise.all(B), S = []
				for (const e of T) -1 !== e && S.push(e)
				const w = S.filter((e => e.isFile())).map((e => (0, u.getRelativePath)(e.path)))
				if (l.IndexingRetrievalLogger.debug('[startSync]: trueChildrenFiles: ' + JSON.stringify(w, null, 2)), this.abortController.signal.aborted) return (0, d.Err)('Aborted')
				const R = _.filter((e => w.includes(e.relativeWorkspacePath)))
				l.IndexingRetrievalLogger.debug('[startSync]: filesToUpdate: ' + JSON.stringify(R, null, 2)), R.forEach((e => {n.add(e.relativeWorkspacePath)})), l.IndexingRetrievalLogger.debug('[startSync]: updates: ' + JSON.stringify(Array.from(n), null, 2))
				const v = S.filter((e => e.isDirectory())).map((e => (0, u.getRelativePath)(e.path)))
				l.IndexingRetrievalLogger.debug('[startSync]: trueChildrenDirectories: ' + JSON.stringify(v, null, 2))
				const k = _.filter((e => v.includes(e.relativeWorkspacePath)))
				l.IndexingRetrievalLogger.debug('[startSync]: directoriesToUpdate: ' + JSON.stringify(k, null, 2)), k.forEach((e => {
					t.push({
						relativePath: e.relativeWorkspacePath,
						hash: h.get(e.relativeWorkspacePath)
					})
				})), l.IndexingRetrievalLogger.debug('[startSync]: subtreeQueue: ' + JSON.stringify(t))
				const Q = v.filter((e => !f.includes(e))), N = w.filter((e => !f.includes(e)))
				if (Q.forEach((e => s.add(e))), N.forEach((e => o.add(e))), l.IndexingRetrievalLogger.debug('[startSync]: newDirectoriesToSend: ' + JSON.stringify(Array.from(s))), l.IndexingRetrievalLogger.debug('[startSync]: newFilesToSend: ' + JSON.stringify(Array.from(o))), 0 === I.length && 0 === R.length && 0 === k.length && 0 === Q.length && 0 === N.length) if (w.length > 0) {
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
		if (g === this.MAX_NUM_ITERATIONS) return l.IndexingRetrievalLogger.error('startSync: There is likely an infinite loop here.'), (0, d.Ok)(!1)
		const h = await Promise.all(f)
		if (this.abortController.signal.aborted) return (0, d.Err)('Aborted')
		h.forEach((e => {e.isErr() && l.IndexingRetrievalLogger.error(e.error())})), l.IndexingRetrievalLogger.debug('[startSync]: ------------------'), l.IndexingRetrievalLogger.debug('[startSync]: updates: ' + JSON.stringify(Array.from(n), null, 2)), l.IndexingRetrievalLogger.debug('[startSync]: newDirectoriesToSend: ' + JSON.stringify(Array.from(s))), l.IndexingRetrievalLogger.debug('[startSync]: newFilesToSend: ' + JSON.stringify(Array.from(o))), l.IndexingRetrievalLogger.debug('[startSync]: pathsToDelete: ' + JSON.stringify(Array.from(a))), l.IndexingRetrievalLogger.debug('[startSync]: ------------------')
		let E = [...Array.from(n), ...Array.from(o)]
		const C = Array.from(s)
		let I = await this.updateNumberOfUploadJobs(E, C, this.repoInfo.workspaceUri.fsPath)
		if (l.IndexingRetrievalLogger.info('[startSync]: numJobs: ' + I), I >= this.config.absoluteMaxNumberFiles) return l.IndexingRetrievalLogger.error('Too many jobs to upload. Aborting.'), this.status.set({
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
		return this.abortController.signal.aborted ? (0, d.Err)('Aborted') : B.isErr() ? (l.IndexingRetrievalLogger.error('Failed to upload files.'), (0, d.Err)(B.error())) : (0, d.Ok)(!0)
	}

	async startRepoUpload (e) {
		if (l.IndexingRetrievalLogger.info('Starting repository upload from scratch.'), 'onlyCallThisFromStartFastRemoteSync' !== e) return (0, d.Err)('You must call this from startFastRemoteSync')
		const t = await this.merkleClient.getAllFiles()
		if (this.abortController.signal.aborted) return (0, d.Err)('Aborted')
		const r = await this.syncFileListToServer(t.map((e => ({
			absolutePath: e,
			relativePath: (0, u.getRelativePath)(e),
			updateType: m.FastUpdateFileRequest_UpdateType.ADD
		}))))
		return this.abortController.signal.aborted ? (0, d.Err)('Aborted') : r.isErr() ? (l.IndexingRetrievalLogger.error('Failed to upload files.'), (0, d.Err)(r.error())) : (0, d.Ok)(!0)
	}

	async startFastRemoteSync (e) {
		if (l.IndexingRetrievalLogger.info('Starting fast remote sync.'), this.abortController.signal.aborted) return (0, d.Ok)(!1)
		this.currentIndexingJobs.reset()
		const t = await this.merkleClient.getNumEmbeddableFiles()
		if (this.abortController.signal.aborted) return (0, d.Ok)(!1)
		if (this.currentIndexingJobs.setTotalNumEmbeddableFiles(t), l.IndexingRetrievalLogger.info('Total num embeddable files: ' + t), t > this.config.absoluteMaxNumberFiles) return l.IndexingRetrievalLogger.error('Too many files to upload.'), this.status.set({
			case: 'error',
			error: 'Too many files to upload.'
		}), (0, d.Err)('Too many files to upload.')
		const r = await this.merkleClient.getSubtreeHash('.')
		if (this.abortController.signal.aborted) return (0, d.Ok)(!1)
		l.IndexingRetrievalLogger.info('Root hash: ' + r)
		const n = 'onlyCallThisFromStartFastRemoteSync'
		switch (e) {
			case m.FastRepoInitHandshakeResponse_Status.EMPTY: {
				this.status.set({ case: 'indexing-setup' })
				let e = await this.startRepoUpload(n)
				return this.abortController.signal.aborted ? (0, d.Ok)(!1) : e.isErr() ? (0, d.Err)(e.error()) : (0, d.Ok)(!0)
			}
			case m.FastRepoInitHandshakeResponse_Status.OUT_OF_SYNC: {
				l.IndexingRetrievalLogger.info('In the out of sync case.'), this.status.set({ case: 'indexing-setup' })
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

	async getServerStatus () {
		l.IndexingRetrievalLogger.info('Doing a startup handshake.'), l.IndexingRetrievalLogger.debug('Repository info: ' + JSON.stringify(this.repoInfo))
		const e = await (async () => {
			try {
				if (this.context.storageUri) {
					const e = a.Uri.joinPath(this.context.storageUri, 'embeddable_files.txt')
					return await a.workspace.fs.writeFile(e, new Uint8Array), e.fsPath
				}
			} catch (e) {return void l.IndexingRetrievalLogger.error('Failed to create embeddable_files.txt: ' + (e instanceof Error ? e.message : 'unknown error'))}
		})(), t = await this.initializeMerkleTreeWithRipgrepIgnore(e)
		if (!t.ok()) return (0, d.Err)(t.error())
		this.highLevelDescriptionJob.compute()
		const r = async () => !0, n = await this.merkleClient.getSubtreeHash('.')
		l.IndexingRetrievalLogger.info('Doing the initial handshake with hash: ' + n)
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
		} catch (e) {i = e}
		if (this.abortController.signal.aborted) return (0, d.Err)('Aborted')
		if (void 0 === o) return l.IndexingRetrievalLogger.error('Handshake failed:'), l.IndexingRetrievalLogger.error(i), (0, d.Err)('Handshake failed.')
		switch (l.IndexingRetrievalLogger.info('Handshake result:', JSON.stringify(o)), o.status) {
			case m.FastRepoInitHandshakeResponse_Status.EMPTY:
				return a.cursor.registerIsNewIndexProvider(r), this.status.set({ case: 'not-indexed' }), (0, d.Ok)(o.status)
			case m.FastRepoInitHandshakeResponse_Status.OUT_OF_SYNC:
				return a.cursor.registerIsNewIndexProvider(r), this.status.set({ case: 'out-of-sync' }), (0, d.Ok)(o.status)
			case m.FastRepoInitHandshakeResponse_Status.FAILURE:
				return this.status.set({ case: 'error', error: i }), (0, d.Err)('Handshake failed.')
			case m.FastRepoInitHandshakeResponse_Status.UP_TO_DATE:
				return a.cursor.registerIsNewIndexProvider(r), this.status.set({ case: 'synced' }), a.cursor.updateUploadProgress(1, a.UploadType.Syncing, !0), this.currentIndexingJobs.setNumJobsToGo(0), (0, d.Ok)(o.status)
			case m.FastRepoInitHandshakeResponse_Status.UNSPECIFIED:
				return this.status.set({ case: 'error', error: 'Handshake failed.' + i }), (0, d.Err)('Handshake failed.')
			default: {
				const e = o.status
				throw new Error(`Unhandled case: ${e}`)
			}
		}
	}

	async initializeMerkleTreeWithRipgrepIgnore (e) {
		try {
			l.IndexingRetrievalLogger.debug('Initializing merkle tree.')
			let t = performance.now()
			if (this.abortController.signal.aborted) return (0, d.Err)('Aborted')
			await this.merkleClient.initWithRipgrepIgnore(e, { maxNumFiles: this.config.absoluteMaxNumberFiles }), l.IndexingRetrievalLogger.info(`Finished initializing merkle tree in ${performance.now() - t} ms.`)
			const r = await this.merkleClient.getNumEmbeddableFiles()
			if (this.indexingIntent === T.IndexingIntent.FallBackToDefault && r > this.config.autoIndexingMaxNumFiles) return this.abortController.abort(), this.status.set({
				case: 'not-auto-indexing',
				numFiles: r
			}), (0, d.Err)(`Not automatically indexing because folder has ${r} files.`)
		} catch (e) {return (0, d.Err)(e)}
		return (0, d.Ok)(!0)
	}

	async startIndexingRepository () {
		if (this.repoInfo.workspaceUri.fsPath === B.homedir()) return l.IndexingRetrievalLogger.error('We currently do not allow indexing the home directory.'), void this.status.set({
			case: 'error',
			error: 'We currently do not allow indexing the home directory. Please open a specific workspace in the home directory.'
		})
		this.status.set({ case: 'indexing-setup' })
		const e = await this.getServerStatus()
		if (e.ok()) {
			if (!this.abortController.signal.aborted) {
				l.IndexingRetrievalLogger.debug('Starting to send up the repository.')
				try {
					const t = await this.startFastRemoteSync(e.v)
					if (this.abortController.signal.aborted) return
					if (t.isErr()) return void (!1 === this.abortController.signal.aborted ? (this.status.set({
						case: 'error',
						error: t.error().toString()
					}), l.IndexingRetrievalLogger.error(t.error())) : l.IndexingRetrievalLogger.debug('Aborted', t.error()))
				} catch (e) {return void (!1 === this.abortController.signal.aborted ? l.IndexingRetrievalLogger.error(e) : l.IndexingRetrievalLogger.debug('Aborted', e))}
				this.abortController.signal.aborted || (this.currentIndexingJobs.set([]), l.IndexingRetrievalLogger.info('Finished indexing repository.'))
			}
		} else !1 === this.abortController.signal.aborted ? (this.status.set({
			case: 'error',
			error: e.error().toString()
		}), l.IndexingRetrievalLogger.error(e.error())) : l.IndexingRetrievalLogger.debug('Aborted', e.error())
	}

	async deletePathOnServer (e, t, r) {
		try {
			let n = []
			try {
				const t = this.hackyGetSplineWhenYouCantRelyOnTree(e)
				n = t?.map((e => new m.PartialPathItem({
					relativeWorkspacePath: (0, y.encryptPath)(e, this.repoInfo.pathEncryptionKey),
					hashOfNode: ''
				})))
			} catch (e) {e instanceof Error && l.IndexingRetrievalLogger.warn('hackyGetSplineWhenYouCantRelyOnTree failed: ' + e.message)}
			l.IndexingRetrievalLogger.debug('deleting directory: ' + t)
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
					value: { relativeWorkspacePath: (0, y.encryptPath)(t, this.repoInfo.pathEncryptionKey), hashOfNode: '' }
				},
				ancestorSpline: n,
				updateType: m.FastUpdateFileRequest_UpdateType.DELETE
			}, r)
			return s.status === m.FastUpdateFileResponse_Status.SUCCESS ? (0, d.Ok)({ relativePath: t }) : s.status === m.FastUpdateFileResponse_Status.EXPECTED_FAILURE ? (0, d.Err)('Expected failure') : (0, d.Err)('Unexpected failure')
		} catch (e) {return (0, d.Err)(e)}
	}

	async deleteFileListFromServer (e) {
		l.IndexingRetrievalLogger.debug('Deleting ' + e.length + ' files from the server.')
		try {
			const t = [], r = 10
			let n = 0, s = 0
			for (; s < e.length;) {
				if (this.abortController.signal.aborted) return (0, d.Err)('Aborted')
				if (n < r) {
					const r = e[s], o = i.join(this.repoInfo.workspaceUri.fsPath, r),
						a = this.deletePathOnServer(o, r, this.abortController.signal)
					t.push(a), a.finally((() => n--)), n++, s++
				} else await new Promise((e => setTimeout(e, 300)))
			}
			const o = await Promise.allSettled(t)
			l.IndexingRetrievalLogger.debug('[startSync]: pathsToDeleteResults: ' + JSON.stringify(o))
		} catch (e) {return (0, d.Err)(e)}
		return (0, d.Ok)(!0)
	}

	async syncFileListToServer (e, t) {
		if (this.abortController.signal.aborted) return (0, d.Err)('Aborted')
		if (l.IndexingRetrievalLogger.info(`Uploading ${e.length} files.`), this.syncFileListToServerCalled) throw new Error('syncFileListToServer should only be called once in the life of the indexing job!')
		this.syncFileListToServerCalled = !0
		const r = await this.merkleClient.getNumEmbeddableFiles()
		if (this.abortController.signal.aborted) return (0, d.Err)('Aborted')
		this.status.set({ case: 'indexing' }), this.currentIndexingJobs.setTotalNumEmbeddableFiles(r), this.currentIndexingJobs.setNumJobsToGo(e.length), this.currentIndexingJobs.set([])
		let n = 0
		const s = e.map((e => ({ ...e, errorCount: 0 })))
		let o = { current: 2 }, i = { current: 0 }
		const a = new C.SlidingWindow(3e5), u = new C.SlidingWindow(3e5), p = { current: Date.now() - 6e4 },
			A = (e, t) => {
				if (e) i.current > 0 ? i.current = Math.max(0, i.current / 2 - 100) : u.getCurrentValue() / a.getCurrentValue() < .1 && (o.current = Math.min(this.config.maxConcurrentUploads, o.current + 1)) else {
					if (u.getCurrentValue() / a.getCurrentValue() < .3 && !0 !== t) return
					if (p.current > Date.now() - 3e4 && !0 !== t) return
					p.current = Date.now(), 1 === o.current && (i.current = Math.min(1e4, 2 * (i.current + 100))), o.current = Math.max(1, o.current / 2)
				}
			}
		for (; s.length > 0 || this.currentIndexingJobs.length > 0;) {
			if (this.abortController.signal.aborted) return (0, d.Err)('Aborted')
			for (l.IndexingRetrievalLogger.debug('fileQueue.length: ' + s.length); this.currentIndexingJobs.length >= o.current || 0 === s.length;) {
				if (await new Promise((e => setTimeout(e, i.current))), this.abortController.signal.aborted) return (0, d.Err)('Aborted')
				if (0 === this.currentIndexingJobs.length) break
				const e = this.currentIndexingJobs.get(), r = await Promise.race(e.map((e => e.future))), o = r.jobId,
					p = r.error
				let c = e.findIndex((e => e.id === o))
				if (-1 !== c) {
					const t = e.splice(c, 1)
					if (this.currentIndexingJobs.set(e), n += 1, 1 !== t.length) throw l.IndexingRetrievalLogger.error('VIOLATION: Completed job length is not 1'), new Error('VIOLATION: Completed job length is not 1')
					if (void 0 === p || '' === p) l.IndexingRetrievalLogger.debug('Completed job successfully: ' + t[0].relativePath), a.incr(1), A(!0), this.currentIndexingJobs.updateNumJobsToGo(-1) else {
						if (!0 === r.errorIsFatal) return this.currentIndexingJobs.updateNumJobsToGo(-1), (0, d.Err)(p ?? 'Unknown fatal error')
						!0 === r.errorIsRetryable ? (l.IndexingRetrievalLogger.debug('Completed job unsuccessfully, will retry: ' + t[0].relativePath + ' error: ' + p), u.incr(1), A(!1, r.errorIsRateLimitError), t[0].errorCount < this.config.maxFileRetries ? s.push({
							absolutePath: t[0].absolutePath,
							errorCount: t[0].errorCount + 1,
							relativePath: t[0].relativePath,
							updateType: t[0].updateType
						}) : (this.currentIndexingJobs.updateNumJobsToGo(-1), l.IndexingRetrievalLogger.debug('Ignoring file because it has too many errors: ' + t[0].relativePath))) : (this.currentIndexingJobs.updateNumJobsToGo(1), l.IndexingRetrievalLogger.debug(`Non-retryable error for file ${t[0].relativePath}: ` + p))
					}
				}
				n % 50 == 0 && l.IndexingRetrievalLogger.info('Completed ' + n + ' jobs for absoluteDirectoryPath: ' + t)
			}
			if (0 === s.length) continue
			let e = s.shift(), r = (0, g.v4)()
			if (void 0 !== e) {
				const t = e.absolutePath, n = e.relativePath, s = e.updateType, o = async () => {
					let e = []
					try {e = await this.merkleClient.getSpline(t)} catch (e) {
						return l.IndexingRetrievalLogger.info('weird. maybe the file was deleted?'), {
							jobId: r,
							error: 'weird. maybe the file was deleted?'
						}
					}
					if (this.abortController.signal.aborted) return { jobId: r, error: 'aborted' }
					try {
						const o = await this.syncFile(t, n, e, s)
						return o.isErr() ? {
							jobId: r,
							error: o.err.error,
							errorIsRetryable: o.err.errorIsRetryable,
							errorIsFatal: o.err.errorIsFatal,
							errorIsRateLimitError: o.err.errorIsRateLimitError
						} : { jobId: r }
					} catch (e) {
						return this.abortController.signal.aborted || l.IndexingRetrievalLogger.debug(e), {
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
		if (l.IndexingRetrievalLogger.debug('Finished uploading files in the while loop.'), this.abortController.signal.aborted) return (0, d.Err)('Aborted')
		const c = this.currentIndexingJobs.get()
		if (await Promise.allSettled(c.map((e => e.future))), this.abortController.signal.aborted) return (0, d.Err)('Aborted')
		this.status.set({ case: 'creating-index' })
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
			return this.status.set({ case: 'error', error: 'Creating index failed: ' + t }), (0, d.Err)(e)
		}
		return this.abortController.signal.aborted ? (0, d.Err)('Aborted') : (l.IndexingRetrievalLogger.debug('Should set to synced.'), this.status.set({ case: 'synced' }), this.currentIndexingJobs.setNumJobsToGo(0), this.currentIndexingJobs.forceUpdateProgressBar(), this.currentIndexingJobs.set([]), (0, d.Ok)(!0))
	}

	async syncFile (e, t, r, n) {
		try {
			const s = r.map((e => (0, u.getRelativePath)(e))), o = s.map((e => new m.PartialPathItem({
				relativeWorkspacePath: (0, y.encryptPath)(e, this.repoInfo.pathEncryptionKey),
				hashOfNode: ''
			}))), i = await a.workspace.fs.readFile(a.Uri.file(e)), p = new TextDecoder('utf-8').decode(i), A = {
				repository: { ...this.repoInfo.export(), isLocal: !0 },
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
			l.IndexingRetrievalLogger.debug('syncing file: ' + t)
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
