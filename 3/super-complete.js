vscode.activate = async function (e) {
    const t = Date.now();
    W.ExtensionStorage.initialize(e);
    c.setWindsurfExtensionMetadata(E.EXTENSION_METADATA);
    R.MetadataProvider.initialize(e);
    V.ProductAnalyticsLogger.initialize();
    T.GuestAccessManager.initialize();
    _.DocumentAccessTimeTracker.initialize();
    I.ExtensionServer.initialize();
    B.LanguageServerClient.initialize();
    await B.LanguageServerClient.getInstance().initAsync();
    e.subscriptions.push(B.LanguageServerClient.getInstance());
    l.WindsurfAuthProvider.initialize(e);
    e.subscriptions.push(l.WindsurfAuthProvider.getInstance());
    (0, d.registerAuthHandlers)(e);
    await $.UnleashProvider.initialize();
    (0, K.initializeUIExperiments)();

    const completionProvider = new m.VscodeCompletionProvider();
    e.subscriptions.push(c.languages.registerInlineCompletionItemProvider({ pattern: '**' }, completionProvider));
    k.ChatPanelProvider.initialize(e);
    const r = k.ChatPanelProvider.getInstance();
    P.UserSettingBroadcaster.initialize();
    F.StatusBar.initialize(e);
    (0, d.initializeAuthSession)()
        .then(() => {
            r.registerAsWebviewViewProvider();
        })
        .catch((e) => {
            console.error('Initial auth session change failed', e);
        });
    J.TerminalShellCommandProvider.initialize(e);
    const i = new A.CommandManager(e);
    new p.TerminalCommandManager(e);
    i.showCommandEducationBar();
    new h.CascadeManager(e);
    c.languages.registerHoverProvider({ scheme: 'file' }, { provideHover: (0, Q.provideExplainProblemHover)(10) });

    (function (e, t, n, r) {
        e.subscriptions.push(
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.IMPORT_VS_CODE_SETTINGS, async () => {
                await (0, a.importSettingsForApplication)(N.AppType.VSCode);
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.IMPORT_VS_CODE_EXTENSIONS, () => (0, o.importExtensionsForApplication)(N.AppType.VSCode)),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.IMPORT_CURSOR_SETTINGS, async () => {
                await (0, a.importSettingsForApplication)(N.AppType.Cursor);
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.IMPORT_CURSOR_EXTENSIONS, () => (0, o.importExtensionsForApplication)(N.AppType.Cursor)),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.ACCEPT_COMPLETION, async (e, n) => {
                await (n?.());
                await t.acceptedLastCompletion(e);
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.OPEN_PROFILE, () => {
                c.env.openExternal(c.Uri.parse('https://codeium.com/profile?referrer=extension'));
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.OPEN_FEEDBACK, () => {
                c.env.openExternal(c.Uri.parse('https://codeium.com/redirect/windsurf/feedback?referrer=extension'));
                V.ProductAnalyticsLogger.getInstance().logEvent(w.ProductEventType.PROVIDE_FEEDBACK);
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.OPEN_DOCS, () => {
                c.env.openExternal(c.Uri.parse('https://docs.codeium.com?referrer=extension'));
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.OPEN_COMMUNITY, () => {
                c.env.openExternal(c.Uri.parse('https://codeium.com/redirect/windsurf/community'));
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.OPEN_FEATURE_REQUEST, () => {
                c.env.openExternal(c.Uri.parse('https://codeium.com/redirect/windsurf/feature-request?referrer=extension'));
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.OPEN_CHANGELOG, () => {
                c.env.openExternal(c.Uri.parse('https://codeium.com/changelog'));
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.TOGGLE_CHAT_FOCUS, (e = !0) => {
                const t = (0, q.getSelectedTextFromEditor)();
                (0, L.toggleChatFocus)(r, { textToInsert: t, isUserAction: e });
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.TOGGLE_CHAT_FOCUS_FROM_TERMINAL, async () => {
                const e = await (0, z.getSelectedTextFromTerminal)();
                (0, L.toggleChatFocus)(r, {
                    textToInsert: null !== e ? new w.TextBlock({
                        identifier: {
                            case: 'label',
                            value: 'terminal_selection'
                        },
                        content: e
                    }) : void 0
                });
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.OPEN_GENERIC_URL, (e) => {
                c.env.openExternal(c.Uri.parse(e));
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.SUPERCOMPLETE_ACCEPT, () => {
                !n.acceptSupercomplete() && (0, G.hasDevExtension)() && console.error('[Supercomplete] Accepted without visible completion.');
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.SUPERCOMPLETE_ESCAPE, () => {
                const e = c.window.activeTextEditor;
                e && n.resetSupercomplete(e);
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.SUPERCOMPLETE_FORCE, () => {
                const e = c.window.activeTextEditor, t = e?.selection.active;
                e && t && 'file' === e.document.uri.scheme && n.maybeTriggerSupercomplete(e, t, w.SupercompleteTriggerCondition.FORCED, !0);
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.UPDATE_AUTOCOMPLETE_SPEED, async (e) => {
                await P.UserSettingBroadcaster.getInstance().setAutocompleteSpeed(e);
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.GENERATE_FUNCTION_DOCSTRING, (e, t, n) => {
                const r = (0, Y.getFunctionInfo)(e, n);
                c.window.activeTextEditor && (0, O.generateFunctionDocstring)(r.toBinary(), e, r.language);
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.EXPLAIN, (e, t, n) => {
                (0, x.explainCodeContextItem)(e, n);
                V.ProductAnalyticsLogger.getInstance().logEvent(w.ProductEventType.EXPLAIN_CODE_BLOCK);
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.REFACTOR_FUNCTION, async (e, t, n) => {
                const r = (0, Y.getFunctionInfo)(e, n);
                c.window.activeTextEditor && await (0, M.refactorFunction)(r.toBinary(), e, r.language, c.window.activeTextEditor.document.uri);
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.FIRE_PRODUCT_ANALYTICS_EVENT, (e) => {
                const t = (0, u.stringToEnum)(e, w.ProductEventType);
                void 0 !== t && V.ProductAnalyticsLogger.getInstance().logEvent(t);
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.SNOOZE_COMPLETIONS, () => {
                F.StatusBar.getInstance().snooze();
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.CANCEL_SNOOZE_COMPLETIONS, () => {
                F.StatusBar.getInstance().cancelSnooze();
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.OPEN_COMMAND_SHORTCUT, () => {
                const e = c.window.activeTextEditor, t = e?.selection;
                t && v.InlineToolbarManager.getInstance().showCommandShortcuts(e, t);
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.COMMAND_NO_POPUP, async (e, t, n = w.CommandRequestSource.FUNCTION_CODE_LENS) => {
                await (0, M.commandNoPopup)(e, t, n);
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.EXPLAIN_PROBLEM, Q.explainProblem),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.RESTART_LS, async () => {
                await B.LanguageServerClient.getInstance().restart();
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.RESET_PRODUCT_EDUCATION, () => {
                D.OnboardingManager.getInstance().resetProductEducation();
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.EXECUTE_CASCADE_ACTION, (e) => {
                r.openView({
                    onFocus: () => {
                        (async function (e, t) {
                            const n = await B.LanguageServerClient.getInstance().client.startCascade({ metadata: R.MetadataProvider.getInstance().getMetadata() }),
                                r = new S.CascadeConfig({
                                    plannerConfig: new S.CascadePlannerConfig({
                                        plannerTypeConfig: {
                                            case: 'conversational',
                                            value: new S.CascadeConversationalPlannerConfig({})
                                        }
                                    })
                                });
                            await B.LanguageServerClient.getInstance().client.sendUserCascadeMessage(new b.SendUserCascadeMessageRequest({
                                metadata: R.MetadataProvider.getInstance().getMetadata(),
                                cascadeId: n.cascadeId,
                                items: t,
                                cascadeConfig: r
                            }));
                            e.setCascadeId(n.cascadeId);
                        })(r, e);
                    }
                });
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.OPEN_NEW_CASCADE_CONVERSATION, () => {
                r.setCascadeId('');
                c.commands.executeCommand(E.EXTENSION_COMMAND_IDS.TOGGLE_CHAT_FOCUS, !0);
            }),
            c.commands.registerCommand(E.EXTENSION_COMMAND_IDS.OPEN_CASCADE_CONVERSATION_FROM_TERMINAL, () => {
                r.setCascadeId('');
                c.commands.executeCommand(E.EXTENSION_COMMAND_IDS.TOGGLE_CHAT_FOCUS_FROM_TERMINAL, !0);
            })
        );
    })(e, completionProvider, completionProvider.supercompleteProvider, r);

    (function (e) {
        e.subscriptions.push(
            c.window.onDidChangeTextEditorVisibleRanges((e) => {
                (0, C.refreshContextForTextEditorVisibleRanges)(e, B.LanguageServerClient.getInstance());
            }),
            c.window.onDidChangeActiveTextEditor((e) => {
                (0, C.refreshContextForActiveTextEditor)(e, B.LanguageServerClient.getInstance());
            }),
            c.window.onDidChangeTextEditorSelection((e) => {
                (0, C.refreshContextForActiveTextEditor)(e.textEditor, B.LanguageServerClient.getInstance());
            })
        );
    })(e);

    (function (e) {
        e.subscriptions.push(
            J.TerminalShellCommandProvider.getInstance().onFinishedCommand((e) => {
                (0, U.trackTerminalShellCommand)(e, B.LanguageServerClient.getInstance());
            })
        );
    })(e);

    (async () => {
        await (0, j.loadOpenTextDocuments)();
        const e = c.window.activeTextEditor?.document, t = e ? (0, j.getDocumentInfo)(e) : void 0;
        await B.LanguageServerClient.getInstance().client.refreshContextForIdeAction((0, y.createRefreshContextRequestFromOpenPaths)({
            activeDocument: t?.documentInfo,
            metadata: R.MetadataProvider.getInstance().getMetadata(),
            experimentConfig: (0, H.parseExperimentConfig)()
        }));
    })();

    (0, f.initializeGenerateCommitMessage)(e);
    v.InlineToolbarManager.getInstance().showSelectionNudge();
    D.OnboardingManager.getInstance();

    const s = Date.now() - t;
    V.ProductAnalyticsLogger.getInstance().logEvent(w.ProductEventType.WINDSURF_EXTENSION_ACTIVATED, BigInt(s));
    !0 === P.UserSettingBroadcaster.getInstance().getUserConfiguration(g.USER_CONFIGURATION_KEYS.CASCADE_OPEN_ON_RELOAD) && c.commands.executeCommand(E.EXTENSION_COMMAND_IDS.TOGGLE_CHAT_FOCUS, !1);
};
function resetSupercompleteUI (editor) {
	o.commands.executeCommand('setContext', 'windsurf.supercompleteShown', false)
	editor.hideSideHint()
	editor.setDecorations(I.DELETION_DECORATOR, []);
	(0, _.resetInlineSupercompleteDecoration)(editor)
}

class LastSupercompleteTriggerState {
	update (e, t) {this.lastStr = e.document.getText(), this.lastPos = t}

	checkAndUpdate (e, t) {
		const n = {
			textChanged: this.lastStr !== e.document.getText(),
			cursorMovedLine: this.lastPos?.line !== t.line,
			cursorMovedChar: this.lastPos?.line !== t.line || this.lastPos.character !== t.character
		}
		return this.update(e, t), n
	}
}

t.VscodeCompletionProvider = class {
	constructor () {
		this.supercompleteProvider = new w.SupercompleteProvider((() => !this.autocompleteShown)), this.autocompleteShown = !1, o.window.onDidChangeTextEditorSelection((e => {
			const t = o.window.activeTextEditor
			void 0 !== t && t.document.uri.path === e.textEditor.document.uri.path && 'file' === t.document.uri.scheme && (this.autocompleteShown = !1)
		}))
	}

	async provideInlineCompletionItems (e, t, n, r) {
		const i = performance.now()
		if (A.MetadataProvider.getInstance().isUserLoggedIn() || this.updateState(l.CodeiumState.WARNING, 'User not logged in, using guest access.'), (0, I.isSnoozed)()) return
		if (!(0, m.getConfig)(m.Config.ENABLE_AUTOCOMPLETE)) return
		n.selectedCompletionInfo && (this.autocompleteShown = !0)
		const s = new AbortController
		r.onCancellationRequested((() => {s.abort()}))
		const u = s.signal, d = o.window.visibleTextEditors.find((t => t.document === e));
		(0, m.hasDevExtension)() && o.commands.executeCommand(c.EXTENSION_COMMAND_IDS.DEV_UPDATE_DOC_AND_EDITOR, e, d), this.updateState(l.CodeiumState.PROCESSING, 'Generating completions…')
		const { documentInfo: p, additionalUtf8ByteOffset: f } = (0, g.getDocumentInfo)(e, t),
			_ = (0, g.getOtherDocumentInfos)(), w = d?.options.tabSize ?? 4, S = Boolean(d?.options.insertSpaces),
			b = { tabSize: BigInt(w), insertSpaces: S, disableAutocompleteInComments: !1 },
			T = (0, E.parseExperimentConfig)()
		let v
		try {
			v = await h.LanguageServerClient.getInstance().client.getCompletions({
				metadata: A.MetadataProvider.getInstance().getMetadata(),
				document: p,
				editorOptions: b,
				otherDocuments: _,
				experimentConfig: T
			}, { signal: u })
		} catch (e) {return void (null != e && e.code === a.Code.Canceled ? (y.logger.info('Completion request was cancelled by token (%dms)', (performance.now() - i).toFixed(2)), this.updateState(l.CodeiumState.INACTIVE, 'Completion request was cancelled.')) : (y.logger.info('Completion request errored (%dms)', (performance.now() - i).toFixed(2)), this.updateState(l.CodeiumState.ERROR, e.message)))}
		const B = v.state
		B && this.updateState(B.state, B.message)
		const R = v.completionItems.map((t => function (e, t, n, r) {
			if (!e.completion || !e.range) return
			const i = t.getText(),
				s = t.positionAt((0, g.numUtf8BytesToNumCodeUnits)(i, Number(e.range.startOffset) - n)),
				a = t.positionAt((0, g.numUtf8BytesToNumCodeUnits)(i, Number(e.range.endOffset) - n)),
				u = new o.Range(s, a), l = new o.SnippetString
			let d
			if (l.appendText(e.completion.text), r && e.suffix && e.suffix.text.length > 0) {
				const n = e.suffix.deltaCursorOffset
				n < 0 && -n <= e.suffix.text.length ? (l.appendText(e.suffix.text.slice(0, Number(n))), l.appendTabstop(0), l.appendText(e.suffix.text.slice(Number(n)))) : (l.appendText(e.suffix.text), d = async () => {
					const e = t.positionAt(t.offsetAt(r.selection.active) + Number(n))
					r.selection = new o.Selection(e, e), await o.commands.executeCommand('editor.action.inlineSuggest.trigger')
				})
			}
			return new o.InlineCompletionItem(l, u, {
				title: 'Accept Completion',
				command: c.EXTENSION_COMMAND_IDS.ACCEPT_COMPLETION,
				arguments: [e.completion.completionId, d]
			})
		}(t, e, f, d))).filter(C.notNullOrUndefined)
		return this.supercompleteProvider.supercompleteShown() ? [] : (this.autocompleteShown = 0 !== R.length, (0, m.hasDevExtension)() && o.commands.executeCommand(c.EXTENSION_COMMAND_IDS.DEV_UPDATE_REQUEST_AND_COMPLETIONS, v.requestInfo, v.latencyInfo, [...v.completionItems, ...v.filteredCompletionItems]), y.logger.info('Completion request succeeded (%dms)', (performance.now() - i).toFixed(2)), o.windsurfProductEducation.showOnboardingItem('editor.action.inlineSuggest.commit'), R)
	}

	async acceptedLastCompletion (e) {
		try {h.LanguageServerClient.getInstance()} catch (e) {return void y.logger.error('Language server not initialized', e)}
		if (this.supercompleteProvider.onAcceptOnly) {
			const e = o.window.activeTextEditor, t = e?.selection.active
			if (!e || !t) return
			this.supercompleteProvider.maybeTriggerSupercomplete(e, t, u.SupercompleteTriggerCondition.AUTOCOMPLETE_ACCEPT)
		}
		try {
			await h.LanguageServerClient.getInstance().client.acceptCompletion({
				metadata: A.MetadataProvider.getInstance().getMetadata(),
				completionId: e
			})
		} catch (e) {y.logger.error('Error accepting completion', e)}
		_.ProductAnalyticsLogger.getInstance().logEvent(u.ProductEventType.AUTOCOMPLETE_ACCEPTED), o.windsurfProductEducation.hideOnboardingItem(), p.OnboardingManager.getInstance().setCompletionState([{
			id: 'editor.action.inlineSuggest.commit',
			title: 'Accept an Autocomplete while editing code',
			completed: !0,
			alwaysShow: !1
		}]), d.GuestAccessManager.getInstance().incrementAcceptedCompletions()
	}

	updateState (e, t) {
		switch (e) {
			case l.CodeiumState.PROCESSING:
				break
			case l.CodeiumState.INACTIVE:
			case l.CodeiumState.SUCCESS:
				y.logger.info(t)
				break
			case l.CodeiumState.WARNING:
				y.logger.warn(t)
				break
			case l.CodeiumState.ERROR:
				y.logger.error(t)
				break
			default:
				y.logger.error(`Unknown state: ${e} - ${t}`)
		}
		(0, m.hasDevExtension)() && o.commands.executeCommand(c.EXTENSION_COMMAND_IDS.DEV_UPDATE_STATE, e, t), f.StatusBar.getInstance().setStatus(e, t)
	}
}

t.LastSupercompleteTriggerState = LastSupercompleteTriggerState
t.SupercompleteProvider = class {
	constructor (e) {
		this.debouncedMaybeTriggerSupercomplete = (0, c.debounce(
			(e, t, n = l.SupercompleteTriggerCondition.UNSPECIFIED) => {
				this.maybeTriggerSupercomplete(e, t, n)
			},
			100
		))
		this.lastTriggeredSupercompleteState = new LastSupercompleteTriggerState()
		this.noAutocompleteShown = e
		this.numValidActionsSinceRender = 0
		this.onAcceptOnly = w.UnleashProvider.getInstance().isEnabled(l.ExperimentKey.SUPERCOMPLETE_ON_ACCEPT_ONLY)

		vscode.window.onDidChangeActiveTextEditor(() => {
			for (const e of o.window.visibleTextEditors) {
				this.resetSupercomplete(e)
			}
		})

		vscode.window.onDidChangeTextEditorSelection(e => {
			const t = o.window.activeTextEditor
			if (t && t.document.uri.path === e.textEditor.document.uri.path &&
				(t.document.uri.scheme === 'file' || t.document.uri.scheme === 'untitled')) {

				(0, S.resetPostApplyDecoration)(t)
				const n = e.selections[0].start
				const r = this.lastTriggeredSupercompleteState.checkAndUpdate(t, n)

				if (r.textChanged) {
					this.resetSupercomplete(t)
					if (!this.onAcceptOnly) {
						this.maybeTriggerSupercomplete(t, n, l.SupercompleteTriggerCondition.TYPING)
					}
				} else if (r.cursorMovedChar) {
					if (this.lastSupercompleteData && this.shouldRetainRender(n)) {
						this.numValidActionsSinceRender += 1
					} else if (r.cursorMovedLine) {
						this.resetSupercomplete(t)
						this.debouncedMaybeTriggerSupercomplete(t, n, l.SupercompleteTriggerCondition.CURSOR_LINE_NAVIGATION)
					}
				}
			}
		})
	}

	shouldRetainRender (e) {
		const hasLastSupercompleteData = this.lastSupercompleteData !== undefined
		const isNotInline = hasLastSupercompleteData && !this.lastSupercompleteData.isInline

		const startLine = Math.min(this.lastSupercompleteData.range.start.line, this.lastSupercompleteData.originalLine)
		const endLine = Math.max(this.lastSupercompleteData.range.end.line, this.lastSupercompleteData.originalLine)

		const isWithinRange = e.line >= startLine - 1 && e.line <= endLine + 1
		const hasFewValidActions = this.numValidActionsSinceRender < 3

		return isNotInline && isWithinRange && hasFewValidActions
	}

	resetSupercomplete (e) {
		// 1. 终止 supercomplete 操作
		this.supercompleteAbortController?.abort()
		this.numValidActionsSinceRender = 0

		// 2. 执行外部函数 b(e)
		resetSupercompleteUI(e)

		// 3. 获取当前打开的标签组数量
		const openTabGroupsCount = o.window.tabGroups.all.length

		// 4. 如果没有 lastSupercompleteData，直接返回
		if (!this.lastSupercompleteData) {
			this.lastSupercompleteData = undefined
			return
		}

		// 5. 提供完成反馈
		const languageServerClient = p.LanguageServerClient.getInstance()
		const metadata = f.MetadataProvider.getInstance().getMetadata()
		const documentInfo = (0, E.getDocumentInfo)(e.document).documentInfo
		const feedbackDelayMs = BigInt(Date.now() - this.lastSupercompleteData.renderTimestamp)

		languageServerClient.client.provideCompletionFeedback({
			metadata,
			experimentConfig: this.lastSupercompleteData.request.experimentConfig,
			completionId: this.lastSupercompleteData.response.completionId,
			isAccepted: false,
			promptId: this.lastSupercompleteData.response.promptId,
			latencyInfo: this.lastSupercompleteData.response.latencyInfo,
			source: l.ProviderSource.SUPERCOMPLETE,
			document: documentInfo,
			feedbackDelayMs,
			viewColumnsOpen: BigInt(openTabGroupsCount),
		})

		// 6. 隐藏 onboarding 项目
		o.windsurfProductEducation.hideOnboardingItem()

		// 7. 清除 lastSupercompleteData
		this.lastSupercompleteData = undefined
	}

	acceptSupercomplete () {
		// 1. 检查是否有 lastSupercompleteData
		if (!this.lastSupercompleteData) {
			return false
		}

		const { editor, range, response } = this.lastSupercompleteData

		// 2. 记录日志并检查 response.diff 是否存在
		console.log('[Supercomplete] acceptSupercomplete', this.lastSupercompleteData)
		if (response.diff === undefined) {
			return false
		}

		// 3. 处理 diff 数据
		let isInsertOnly = true
		const filteredLines = response.diff.lines.filter(line => {
			if (line.type !== d.UnifiedDiffLineType.INSERT) {
				isInsertOnly = false
			}
			return line.type === d.UnifiedDiffLineType.INSERT || line.type === d.UnifiedDiffLineType.UNCHANGED
		})

		const textToInsert = filteredLines.map(line => line.text).join('\n')

		// 4. 编辑文档
		editor.edit(editBuilder => {
			if (isInsertOnly) {
				editBuilder.insert(new o.Position(range.start.line + 1, 0), textToInsert + '\n')
			} else if (textToInsert) {
				editBuilder.replace(range, textToInsert)
			} else {
				editBuilder.replace(new o.Range(range.start, new o.Position(range.end.line + 1, 0)), '')
			}
		})

		// 5. 检查 characterDiff 是否存在
		if (!response.characterDiff) {
			console.warn('[Supercomplete] Character diff not found')
			return false
		}

		// 6. 添加装饰器
		(0, S.addPostApplyDecoration)(editor, range, response.characterDiff)

		// 7. 获取当前打开的标签组数量
		const openTabGroupsCount = o.window.tabGroups.all.length

		// 8. 提供完成反馈
		const languageServerClient = p.LanguageServerClient.getInstance()
		const metadata = f.MetadataProvider.getInstance().getMetadata()
		const documentInfo = (0, E.getDocumentInfo)(editor.document).documentInfo
		const feedbackDelayMs = BigInt(Date.now() - this.lastSupercompleteData.renderTimestamp)

		languageServerClient.client.provideCompletionFeedback({
			metadata,
			experimentConfig: this.lastSupercompleteData.request.experimentConfig,
			completionId: this.lastSupercompleteData.response.completionId,
			isAccepted: true,
			promptId: this.lastSupercompleteData.response.promptId,
			latencyInfo: this.lastSupercompleteData.response.latencyInfo,
			source: l.ProviderSource.SUPERCOMPLETE,
			document: documentInfo,
			feedbackDelayMs,
			viewColumnsOpen: BigInt(openTabGroupsCount),
		})

		// 9. 清理和重置状态
		this.lastSupercompleteData = undefined
		this.resetSupercomplete(editor)

		// 10. 增加接受 Supercomplete 的次数
		A.GuestAccessManager.getInstance().incrementAcceptedSupercompletes()

		// 11. 隐藏 onboarding 项目
		o.windsurfProductEducation.hideOnboardingItem()

		// 12. 设置完成状态
		m.OnboardingManager.getInstance().setCompletionState([{
			id: u.EXTENSION_COMMAND_IDS.SUPERCOMPLETE_ACCEPT,
			title: 'Accept a SuperComplete while editing code',
			completed: true,
			alwaysShow: false,
		}])

		return true
	}

	maybeTriggerSupercomplete (editor, triggerCondition, supercompleteTriggerCondition, forceTrigger = false) {
		// 1. 检查是否处于暂停状态
		if ((0, C.isSnoozed)()) {
			return
		}

		// 2. 获取当前光标位置
		const { start, end } = editor.selections[0]

		// 3. 检查是否满足触发条件
		const isSingleCursor = start.line === end.line && start.character === end.character
		const isSupercompleteEnabled = w.UnleashProvider.getInstance().isEnabled(l.ExperimentKey.ENABLE_SUPERCOMPLETE)
		const isImplicitTrajectoryEnabled = w.UnleashProvider.getInstance().isEnabled(l.ExperimentKey.USE_IMPLICIT_TRAJECTORY)
		const isConfigEnabled = (0, g.getConfig)(g.Config.ENABLE_SUPERCOMPLETE)

		if (isSingleCursor && isSupercompleteEnabled && isImplicitTrajectoryEnabled && isConfigEnabled) {
			// 4. 获取文档信息和编辑器选项
			const document = editor.document
			const { documentInfo } = (0, E.getDocumentInfo)(document, triggerCondition)
			const tabSize = editor.options.tabSize ?? 4
			const insertSpaces = editor.options.insertSpaces ?? false

			const editorOptions = {
				tabSize: BigInt(tabSize),
				insertSpaces,
				disableAutocompleteInComments: false,
			}

			// 5. 解析实验配置
			const experimentConfig = (0, y.parseExperimentConfig)()

			// 6. 创建命令请求
			const commandRequest = new h.HandleStreamingCommandRequest({
				metadata: f.MetadataProvider.getInstance().getMetadata(),
				document: documentInfo,
				editorOptions,
				experimentConfig,
				requestSource: l.CommandRequestSource.SUPERCOMPLETE,
				diffType: d.DiffType.TMP_SUPERCOMPLETE,
				parentCompletionId: '',
				diagnostics: [],
				supercompleteTriggerCondition,
			})

			// 7. 触发 Supercomplete
			this.triggerSupercomplete(commandRequest, editor, forceTrigger)
		}
	}

	async triggerSupercomplete (request, editor, forceTrigger = false) {
		// 1. 终止之前的 Supercomplete 请求并重置状态
		this.supercompleteAbortController?.abort()
		this.lastSupercompleteData = undefined

		// 2. 生成唯一的提交 ID
		const submitId = Math.random().toString(36).substring(7)
		this.lastSupercompleteSubmitId = submitId

		// 3. 重置 Supercomplete 状态并记录日志
		this.resetSupercomplete(editor)
		if ((0, g.hasDevExtension)()) {
			console.log('[Supercomplete] Sending Request', request)
		}

		// 4. 检查语言服务器是否初始化
		try {
			p.LanguageServerClient.getInstance()
		} catch (error) {
			console.error('Language server not initialized')
			return
		}

		// 5. 创建新的 AbortController 并发送请求
		this.supercompleteAbortController = new AbortController()
		const responseStream = p.LanguageServerClient.getInstance().client.handleStreamingCommand(request, {
			signal: this.supercompleteAbortController.signal,
		})

		let response
		try {
			for await (const data of responseStream) {
				response = data
			}
		} catch (error) {
			if (error.code !== a.Code.Canceled) {
				console.error('Error getting supercomplete response', error)
			}
			return
		}

		// 6. 如果没有响应，直接返回
		if (!response) {
			return
		}

		// 7. 记录响应日志
		if ((0, g.hasDevExtension)()) {
			const diffLog = response.diff?.lines
				.map(line => {
					const prefix = line.type === d.UnifiedDiffLineType.INSERT ? '+' :
						line.type === d.UnifiedDiffLineType.DELETE ? '-' : ' '
					return `${prefix}${line.text}`
				})
				.join('\n')
			console.log(`[Supercomplete] Supercomplete Response (${response.completionId}):\n`, diffLog)
		}

		// 8. 如果响应被过滤且未强制触发，直接返回
		if (!forceTrigger && response.filterReason) {
			if ((0, g.hasDevExtension)()) {
				console.log(`[Supercomplete] Response (${response.completionId}) filtered by`, response.filterReason.reason)
			}
			return
		}

		// 9. 解析响应中的选择范围
		const { selectionStartLine, selectionEndLine } = response
		const selectionRange = selectionStartLine === selectionEndLine
			? new o.Range(Number(selectionStartLine), 0, Number(selectionEndLine), Number.MAX_SAFE_INTEGER)
			: new o.Range(Number(selectionStartLine), 0, Number(selectionEndLine) - 1, Number.MAX_SAFE_INTEGER)

		// 10. 如果提交 ID 不匹配，直接返回
		if (this.lastSupercompleteSubmitId !== submitId) {
			return
		}

		// 11. 检查是否所有行都未更改
		const isAllUnchanged = (response.diff?.lines ?? []).every(line => line.type === d.UnifiedDiffLineType.UNCHANGED)
		if (!forceTrigger && isAllUnchanged) {
			return
		}

		// 12. 检查是否启用了 Tab 键触发 Supercomplete
		const isSupercompleteOnTabEnabled = w.UnleashProvider.getInstance().isEnabled(l.ExperimentKey.SUPERCOMPLETE_ON_TAB)

		// 13. 处理字符差异并渲染
		if (response.characterDiff && (this.noAutocompleteShown() || !isSupercompleteOnTabEnabled || forceTrigger)) {
			const isInlineValid = (0, _.isInlineRenderValid)(response)
			if (isInlineValid) {
				(0, _.inlineRender)(editor, selectionRange, response)
			} else {
				(0, I.renderSideHint)(editor, selectionRange, response)
			}

			// 14. 更新上下文和 UI 状态
			if (this.noAutocompleteShown()) {
				o.commands.executeCommand('setContext', 'windsurf.supercompleteShown', true)
			}
			o.windsurfProductEducation.showOnboardingItem(u.EXTENSION_COMMAND_IDS.SUPERCOMPLETE_ACCEPT)

			// 15. 保存 Supercomplete 数据
			this.lastSupercompleteData = {
				request,
				response,
				range: selectionRange,
				editor,
				renderTimestamp: Date.now(),
				originalLine: editor.selection.active.line,
				isInline: isInlineValid,
			}
		}
	}

	supercompleteShown () {
		return !!this.lastSupercompleteData
	}
}
