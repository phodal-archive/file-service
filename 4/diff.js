class Differ {
    constructor() {
        const diffingProvider = {
            wordDiffForPartialCode: async (originalText, modifiedText, strict = false) => {
                // Ensure modifiedText does not end with a newline
                if (modifiedText.endsWith('\n')) {
                    modifiedText = modifiedText.slice(0, -1);
                }

                const diffEngine = new r.diff_match_patch();
                const originalLines = originalText.split('\n');
                const modifiedLines = modifiedText.split('\n');
                const lineFrequencyMap = this._buildFrequencyMap(modifiedLines);

                let optimalStartIndex = null;
                let minimalCost = Infinity;
                let optimalDiffs = null;
                let potentialCutoff = originalLines.length + 1;

                this._updateFrequencyMap(lineFrequencyMap, originalLines, modifiedLines, potentialCutoff);

                for (let startIndex = Math.min(potentialCutoff + 1, originalLines.length); startIndex <= originalLines.length; startIndex++) {
                    const combinedLines = [...modifiedLines, ...originalLines.slice(startIndex)];
                    const diffs = diffEngine.diff_main(originalLines.join('\n'), combinedLines.join('\n'));
                    const cost = this._calculateDiffCost(diffs);

                    if (cost < minimalCost) {
                        optimalStartIndex = startIndex;
                        optimalDiffs = diffs;
                        minimalCost = cost;
                    }
                }

                if (optimalDiffs === null) {
                    throw new Error("Changes are null. This shouldn't be happening.");
                }

                const lineChanges = B.diffLines(originalText, modifiedText, { newlineIsToken: true });
                const wordChanges = B.diffWords(originalText, modifiedText);

                return {
                    finalText: [...modifiedLines, ...(optimalStartIndex ? originalLines.slice(optimalStartIndex) : [])].join('\n'),
                    fullLineChanges: lineChanges,
                    changes: wordChanges,
                };
            },

            wordDiff: async (originalText, modifiedText) => {
                const diffEngine = new r.diff_match_patch();
                const diffs = diffEngine.diff_main(originalText, modifiedText);

                return {
                    changes: diffs.map(([type, value]) => ({
                        value,
                        added: type === 1 || undefined,
                        removed: type === -1 || undefined,
                    })),
                };
            },
        };

        s.cursor.registerDiffingProvider(diffingProvider);
    }

    dispose() {
        // Cleanup resources if needed
    }

    _buildFrequencyMap(lines) {
        const frequencyMap = {};
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine !== '') {
                frequencyMap[trimmedLine] = (frequencyMap[trimmedLine] || 0) + 1;
            }
        }
        return frequencyMap;
    }

    _updateFrequencyMap(frequencyMap, originalLines, modifiedLines, potentialCutoff) {
        for (let index = 0; index < originalLines.length; index++) {
            const line = originalLines[index].trim();
            if (line !== '' && !this._isPunctuationOnly(line)) {
                const matches = o.search(line, modifiedLines, { returnMatchData: true });
                if (matches.length > 0 && matches[0].score > 0.95) {
                    const match = matches[0].item.trim();
                    if (frequencyMap.hasOwnProperty(match)) {
                        frequencyMap[match]--;
                        if (frequencyMap[match] === 0) {
                            potentialCutoff = index;
                        }
                    }
                }
            }
        }
    }

    _isPunctuationOnly(line) {
        const punctuationChars = ['[', '{', '(', ')', '}', ']', ',', ' ', '\t'];
        return line.split('').every(char => punctuationChars.includes(char));
    }

    _calculateDiffCost(diffs) {
        const insertions = diffs.filter(([type]) => type === 1).length;
        const deletions = diffs.filter(([type]) => type === -1).length;
        const totalLength = diffs
            .filter(([type]) => type !== 0)
            .map(([, value]) => value.length)
            .reduce((sum, length) => sum + length, 0);

        return totalLength + 5 * insertions + 5 * deletions;
    }
}


// 初始化行差异实例
e.lineDiff = new t.Diff();

// 自定义行差异的分词方法
e.lineDiff.tokenize = function (text) {
    // 根据配置去除尾随的回车符
    if (this.options.stripTrailingCr) {
        text = text.replace(/\r\n/g, '\n');
    }

    // 按行分割文本
    let lines = text.split(/(\n|\r\n)/);

    // 移除最后一个空元素（如果存在）
    if (!lines[lines.length - 1]) {
        lines.pop();
    }

    let tokens = [];
    for (let index = 0; index < lines.length; index++) {
        let line = lines[index];
        // 处理换行符
        if (index % 2 && !this.options.newlineIsToken) {
            tokens[tokens.length - 1] += line;
        } else {
            // 根据配置忽略空白字符
            if (this.options.ignoreWhitespace) {
                line = line.trim();
            }
            tokens.push(line);
        }
    }
    return tokens;
};

// 比较两段文本的行差异
e.diffLines = function (oldText, newText, options = {}) {
    return e.lineDiff.diff(oldText, newText, options);
};

// 比较两段文本，保留前缀和后缀的共同部分
e.diffWithPrefixPostfix = function (oldText, newText, diffInstance) {
    let newlineCount = 0;

    // 确保文本以换行符结尾
    if (!oldText.endsWith('\n')) {
        oldText += '\n';
        newlineCount++;
    }
    if (!newText.endsWith('\n')) {
        newText += '\n';
        newlineCount++;
    }

    let prefix = [];
    let suffix = [];
    let oldLines = oldText.split('\n');
    let newLines = newText.split('\n');

    // 计算前缀
    while (oldLines.length && newLines.length && oldLines[0] === newLines[0]) {
        prefix.push({ value: oldLines.shift(), count: 1 });
        newLines.shift();
    }

    // 计算后缀
    while (oldLines.length && newLines.length && oldLines[oldLines.length - 1] === newLines[newLines.length - 1]) {
        suffix.unshift({ value: oldLines.pop(), count: 1 });
        newLines.pop();
    }

    // 计算中间差异
    const diffs = diffInstance.diff(oldLines.join('\n'), newLines.join('\n'));

    // 合并结果
    const result = [...prefix, ...diffs, ...suffix];

    // 移除最后一个空白差异
    const lastDiff = result[result.length - 1];
    if (newlineCount === 1 && lastDiff && !lastDiff.value && !lastDiff.added && !lastDiff.removed) {
        result.pop();
    }

    return result;
};

// 比较两段文本的行差异，忽略空白字符
e.diffTrimmedLines = function (oldText, newText, options = {}) {
    const defaultOptions = { ignoreWhitespace: true };
    const finalOptions = { ...options, ...defaultOptions };
    return e.lineDiff.diff(oldText, newText, finalOptions);
};

var e = function () {this.Diff_Timeout = 1, this.Diff_EditCost = 4, this.Match_Threshold = .5, this.Match_Distance = 1e3, this.Patch_DeleteThreshold = .5, this.Patch_Margin = 4, this.Match_MaxBits = 32},
    i = -1
e.Diff = function (A, e) {return [A, e]}, e.prototype.diff_main = function (A, i, t, a) {
    void 0 === a && (a = this.Diff_Timeout <= 0 ? Number.MAX_VALUE : (new Date).getTime() + 1e3 * this.Diff_Timeout)
    var n = a
    if (null == A || null == i) throw new Error('Null input. (diff_main)')
    if (A == i) return A ? [new e.Diff(0, A)] : []
    void 0 === t && (t = !0)
    var s = t, r = this.diff_commonPrefix(A, i), o = A.substring(0, r)
    A = A.substring(r), i = i.substring(r), r = this.diff_commonSuffix(A, i)
    var B = A.substring(A.length - r)
    A = A.substring(0, A.length - r), i = i.substring(0, i.length - r)
    var E = this.diff_compute_(A, i, s, n)
    return o && E.unshift(new e.Diff(0, o)), B && E.push(new e.Diff(0, B)), this.diff_cleanupMerge(E), E
}, e.prototype.diff_compute_ = function (A, t, a, n) {
    var s
    if (!A) return [new e.Diff(1, t)]
    if (!t) return [new e.Diff(i, A)]
    var r = A.length > t.length ? A : t, o = A.length > t.length ? t : A, B = r.indexOf(o)
    if (-1 != B) return s = [new e.Diff(1, r.substring(0, B)), new e.Diff(0, o), new e.Diff(1, r.substring(B + o.length))], A.length > t.length && (s[0][0] = s[2][0] = i), s
    if (1 == o.length) return [new e.Diff(i, A), new e.Diff(1, t)]
    var E = this.diff_halfMatch_(A, t)
    if (E) {
        var Q = E[0], g = E[1], l = E[2], c = E[3], h = E[4], u = this.diff_main(Q, l, a, n),
            D = this.diff_main(g, c, a, n)
        return u.concat([new e.Diff(0, h)], D)
    }
    return a && A.length > 100 && t.length > 100 ? this.diff_lineMode_(A, t, n) : this.diff_bisect_(A, t, n)
}, e.prototype.diff_lineMode_ = function (A, t, a) {
    var n = this.diff_linesToChars_(A, t)
    A = n.chars1, t = n.chars2
    var s = n.lineArray, r = this.diff_main(A, t, !1, a)
    this.diff_charsToLines_(r, s), this.diff_cleanupSemantic(r), r.push(new e.Diff(0, ''))
    for (var o = 0, B = 0, E = 0, Q = '', g = ''; o < r.length;) {
        switch (r[o][0]) {
            case 1:
                E++, g += r[o][1]
                break
            case i:
                B++, Q += r[o][1]
                break
            case 0:
                if (B >= 1 && E >= 1) {
                    r.splice(o - B - E, B + E), o = o - B - E
                    for (var l = this.diff_main(Q, g, !1, a), c = l.length - 1; c >= 0; c--) r.splice(o, 0, l[c])
                    o += l.length
                }
                E = 0, B = 0, Q = '', g = ''
        }
        o++
    }
    return r.pop(), r
}, e.prototype.diff_bisect_ = function (A, t, a) {
    for (var n = A.length, s = t.length, r = Math.ceil((n + s) / 2), o = r, B = 2 * r, E = new Array(B), Q = new Array(B), g = 0; g < B; g++) E[g] = -1, Q[g] = -1
    E[o + 1] = 0, Q[o + 1] = 0
    for (var l = n - s, c = l % 2 != 0, h = 0, u = 0, D = 0, d = 0, w = 0; w < r && !((new Date).getTime() > a); w++) {
        for (var m = -w + h; m <= w - u; m += 2) {
            for (var p = o + m, I = (M = m == -w || m != w && E[p - 1] < E[p + 1] ? E[p + 1] : E[p - 1] + 1) - m; M < n && I < s && A.charAt(M) == t.charAt(I);) M++, I++
            if (E[p] = M, M > n) u += 2 else if (I > s) h += 2 else if (c && (O = o + l - m) >= 0 && O < B && -1 != Q[O] && M >= (f = n - Q[O])) return this.diff_bisectSplit_(A, t, M, I, a)
        }
        for (var C = -w + D; C <= w - d; C += 2) {
            for (var f, O = o + C, k = (f = C == -w || C != w && Q[O - 1] < Q[O + 1] ? Q[O + 1] : Q[O - 1] + 1) - C; f < n && k < s && A.charAt(n - f - 1) == t.charAt(s - k - 1);) f++, k++
            if (Q[O] = f, f > n) d += 2 else if (k > s) D += 2 else if (!c) {
                var M
                if ((p = o + l - C) >= 0 && p < B && -1 != E[p]) if (I = o + (M = E[p]) - p, M >= (f = n - f)) return this.diff_bisectSplit_(A, t, M, I, a)
            }
        }
    }
    return [new e.Diff(i, A), new e.Diff(1, t)]
}, e.prototype.diff_bisectSplit_ = function (A, e, i, t, a) {
    var n = A.substring(0, i), s = e.substring(0, t), r = A.substring(i), o = e.substring(t),
        B = this.diff_main(n, s, !1, a), E = this.diff_main(r, o, !1, a)
    return B.concat(E)
}, e.prototype.diff_linesToChars_ = function (A, e) {
    var i = [], t = {}

    function a (A) {
        for (var e = '', a = 0, s = -1, r = i.length; s < A.length - 1;) {
            -1 == (s = A.indexOf('\n', a)) && (s = A.length - 1)
            var o = A.substring(a, s + 1);
            (t.hasOwnProperty ? t.hasOwnProperty(o) : void 0 !== t[o]) ? e += String.fromCharCode(t[o]) : (r == n && (o = A.substring(a), s = A.length), e += String.fromCharCode(r), t[o] = r, i[r++] = o), a = s + 1
        }
        return e
    }

    i[0] = ''
    var n = 4e4, s = a(A)
    return n = 65535, { chars1: s, chars2: a(e), lineArray: i }
}, e.prototype.diff_charsToLines_ = function (A, e) {
    for (var i = 0; i < A.length; i++) {
        for (var t = A[i][1], a = [], n = 0; n < t.length; n++) a[n] = e[t.charCodeAt(n)]
        A[i][1] = a.join('')
    }
}, e.prototype.diff_commonPrefix = function (A, e) {
    if (!A || !e || A.charAt(0) != e.charAt(0)) return 0
    for (var i = 0, t = Math.min(A.length, e.length), a = t, n = 0; i < a;) A.substring(n, a) == e.substring(n, a) ? n = i = a : t = a, a = Math.floor((t - i) / 2 + i)
    return a
}, e.prototype.diff_commonSuffix = function (A, e) {
    if (!A || !e || A.charAt(A.length - 1) != e.charAt(e.length - 1)) return 0
    for (var i = 0, t = Math.min(A.length, e.length), a = t, n = 0; i < a;) A.substring(A.length - a, A.length - n) == e.substring(e.length - a, e.length - n) ? n = i = a : t = a, a = Math.floor((t - i) / 2 + i)
    return a
}, e.prototype.diff_commonOverlap_ = function (A, e) {
    var i = A.length, t = e.length
    if (0 == i || 0 == t) return 0
    i > t ? A = A.substring(i - t) : i < t && (e = e.substring(0, i))
    var a = Math.min(i, t)
    if (A == e) return a
    for (var n = 0, s = 1; ;) {
        var r = A.substring(a - s), o = e.indexOf(r)
        if (-1 == o) return n
        s += o, 0 != o && A.substring(a - s) != e.substring(0, s) || (n = s, s++)
    }
}, e.prototype.diff_halfMatch_ = function (A, e) {
    if (this.Diff_Timeout <= 0) return null
    var i = A.length > e.length ? A : e, t = A.length > e.length ? e : A
    if (i.length < 4 || 2 * t.length < i.length) return null
    var a = this

    function n (A, e, i) {
        for (var t, n, s, r, o = A.substring(i, i + Math.floor(A.length / 4)), B = -1, E = ''; -1 != (B = e.indexOf(o, B + 1));) {
            var Q = a.diff_commonPrefix(A.substring(i), e.substring(B)),
                g = a.diff_commonSuffix(A.substring(0, i), e.substring(0, B))
            E.length < g + Q && (E = e.substring(B - g, B) + e.substring(B, B + Q), t = A.substring(0, i - g), n = A.substring(i + Q), s = e.substring(0, B - g), r = e.substring(B + Q))
        }
        return 2 * E.length >= A.length ? [t, n, s, r, E] : null
    }

    var s, r, o, B, E, Q = n(i, t, Math.ceil(i.length / 4)), g = n(i, t, Math.ceil(i.length / 2))
    return Q || g ? (s = g ? Q && Q[4].length > g[4].length ? Q : g : Q, A.length > e.length ? (r = s[0], o = s[1], B = s[2], E = s[3]) : (B = s[0], E = s[1], r = s[2], o = s[3]), [r, o, B, E, s[4]]) : null
}, e.prototype.diff_cleanupSemantic = function (A) {
    for (var t = !1, a = [], n = 0, s = null, r = 0, o = 0, B = 0, E = 0, Q = 0; r < A.length;) 0 == A[r][0] ? (a[n++] = r, o = E, B = Q, E = 0, Q = 0, s = A[r][1]) : (1 == A[r][0] ? E += A[r][1].length : Q += A[r][1].length, s && s.length <= Math.max(o, B) && s.length <= Math.max(E, Q) && (A.splice(a[n - 1], 0, new e.Diff(i, s)), A[a[n - 1] + 1][0] = 1, n--, r = --n > 0 ? a[n - 1] : -1, o = 0, B = 0, E = 0, Q = 0, s = null, t = !0)), r++
    for (t && this.diff_cleanupMerge(A), this.diff_cleanupSemanticLossless(A), r = 1; r < A.length;) {
        if (A[r - 1][0] == i && 1 == A[r][0]) {
            var g = A[r - 1][1], l = A[r][1], c = this.diff_commonOverlap_(g, l), h = this.diff_commonOverlap_(l, g)
            c >= h ? (c >= g.length / 2 || c >= l.length / 2) && (A.splice(r, 0, new e.Diff(0, l.substring(0, c))), A[r - 1][1] = g.substring(0, g.length - c), A[r + 1][1] = l.substring(c), r++) : (h >= g.length / 2 || h >= l.length / 2) && (A.splice(r, 0, new e.Diff(0, g.substring(0, h))), A[r - 1][0] = 1, A[r - 1][1] = l.substring(0, l.length - h), A[r + 1][0] = i, A[r + 1][1] = g.substring(h), r++), r++
        }
        r++
    }
}, e.prototype.diff_cleanupSemanticLossless = function (A) {
    function i (A, i) {
        if (!A || !i) return 6
        var t = A.charAt(A.length - 1), a = i.charAt(0), n = t.match(e.nonAlphaNumericRegex_),
            s = a.match(e.nonAlphaNumericRegex_), r = n && t.match(e.whitespaceRegex_),
            o = s && a.match(e.whitespaceRegex_), B = r && t.match(e.linebreakRegex_),
            E = o && a.match(e.linebreakRegex_), Q = B && A.match(e.blanklineEndRegex_),
            g = E && i.match(e.blanklineStartRegex_)
        return Q || g ? 5 : B || E ? 4 : n && !r && o ? 3 : r || o ? 2 : n || s ? 1 : 0
    }

    for (var t = 1; t < A.length - 1;) {
        if (0 == A[t - 1][0] && 0 == A[t + 1][0]) {
            var a = A[t - 1][1], n = A[t][1], s = A[t + 1][1], r = this.diff_commonSuffix(a, n)
            if (r) {
                var o = n.substring(n.length - r)
                a = a.substring(0, a.length - r), n = o + n.substring(0, n.length - r), s = o + s
            }
            for (var B = a, E = n, Q = s, g = i(a, n) + i(n, s); n.charAt(0) === s.charAt(0);) {
                a += n.charAt(0), n = n.substring(1) + s.charAt(0), s = s.substring(1)
                var l = i(a, n) + i(n, s)
                l >= g && (g = l, B = a, E = n, Q = s)
            }
            A[t - 1][1] != B && (B ? A[t - 1][1] = B : (A.splice(t - 1, 1), t--), A[t][1] = E, Q ? A[t + 1][1] = Q : (A.splice(t + 1, 1), t--))
        }
        t++
    }
}, e.nonAlphaNumericRegex_ = /[^a-zA-Z0-9]/, e.whitespaceRegex_ = /\s/, e.linebreakRegex_ = /[\r\n]/, e.blanklineEndRegex_ = /\n\r?\n$/, e.blanklineStartRegex_ = /^\r?\n\r?\n/, e.prototype.diff_cleanupEfficiency = function (A) {
    for (var t = !1, a = [], n = 0, s = null, r = 0, o = !1, B = !1, E = !1, Q = !1; r < A.length;) 0 == A[r][0] ? (A[r][1].length < this.Diff_EditCost && (E || Q) ? (a[n++] = r, o = E, B = Q, s = A[r][1]) : (n = 0, s = null), E = Q = !1) : (A[r][0] == i ? Q = !0 : E = !0, s && (o && B && E && Q || s.length < this.Diff_EditCost / 2 && o + B + E + Q == 3) && (A.splice(a[n - 1], 0, new e.Diff(i, s)), A[a[n - 1] + 1][0] = 1, n--, s = null, o && B ? (E = Q = !0, n = 0) : (r = --n > 0 ? a[n - 1] : -1, E = Q = !1), t = !0)), r++
    t && this.diff_cleanupMerge(A)
}, e.prototype.diff_cleanupMerge = function (A) {
    A.push(new e.Diff(0, ''))
    for (var t, a = 0, n = 0, s = 0, r = '', o = ''; a < A.length;) switch (A[a][0]) {
        case 1:
            s++, o += A[a][1], a++
            break
        case i:
            n++, r += A[a][1], a++
            break
        case 0:
            n + s > 1 ? (0 !== n && 0 !== s && (0 !== (t = this.diff_commonPrefix(o, r)) && (a - n - s > 0 && 0 == A[a - n - s - 1][0] ? A[a - n - s - 1][1] += o.substring(0, t) : (A.splice(0, 0, new e.Diff(0, o.substring(0, t))), a++), o = o.substring(t), r = r.substring(t)), 0 !== (t = this.diff_commonSuffix(o, r)) && (A[a][1] = o.substring(o.length - t) + A[a][1], o = o.substring(0, o.length - t), r = r.substring(0, r.length - t))), a -= n + s, A.splice(a, n + s), r.length && (A.splice(a, 0, new e.Diff(i, r)), a++), o.length && (A.splice(a, 0, new e.Diff(1, o)), a++), a++) : 0 !== a && 0 == A[a - 1][0] ? (A[a - 1][1] += A[a][1], A.splice(a, 1)) : a++, s = 0, n = 0, r = '', o = ''
    }
    '' === A[A.length - 1][1] && A.pop()
    var B = !1
    for (a = 1; a < A.length - 1;) 0 == A[a - 1][0] && 0 == A[a + 1][0] && (A[a][1].substring(A[a][1].length - A[a - 1][1].length) == A[a - 1][1] ? (A[a][1] = A[a - 1][1] + A[a][1].substring(0, A[a][1].length - A[a - 1][1].length), A[a + 1][1] = A[a - 1][1] + A[a + 1][1], A.splice(a - 1, 1), B = !0) : A[a][1].substring(0, A[a + 1][1].length) == A[a + 1][1] && (A[a - 1][1] += A[a + 1][1], A[a][1] = A[a][1].substring(A[a + 1][1].length) + A[a + 1][1], A.splice(a + 1, 1), B = !0)), a++
    B && this.diff_cleanupMerge(A)
}, e.prototype.diff_xIndex = function (A, e) {
    var t, a = 0, n = 0, s = 0, r = 0
    for (t = 0; t < A.length && (1 !== A[t][0] && (a += A[t][1].length), A[t][0] !== i && (n += A[t][1].length), !(a > e)); t++) s = a, r = n
    return A.length != t && A[t][0] === i ? r : r + (e - s)
}, e.prototype.diff_prettyHtml = function (A) {
    for (var e = [], t = /&/g, a = /</g, n = />/g, s = /\n/g, r = 0; r < A.length; r++) {
        var o = A[r][0], B = A[r][1].replace(t, '&amp;').replace(a, '&lt;').replace(n, '&gt;').replace(s, '&para;<br>')
        switch (o) {
            case 1:
                e[r] = '<ins style="background:#e6ffe6;">' + B + '</ins>'
                break
            case i:
                e[r] = '<del style="background:#ffe6e6;">' + B + '</del>'
                break
            case 0:
                e[r] = '<span>' + B + '</span>'
        }
    }
    return e.join('')
}, e.prototype.diff_text1 = function (A) {
    for (var e = [], i = 0; i < A.length; i++) 1 !== A[i][0] && (e[i] = A[i][1])
    return e.join('')
}, e.prototype.diff_text2 = function (A) {
    for (var e = [], t = 0; t < A.length; t++) A[t][0] !== i && (e[t] = A[t][1])
    return e.join('')
}, e.prototype.diff_levenshtein = function (A) {
    for (var e = 0, t = 0, a = 0, n = 0; n < A.length; n++) {
        var s = A[n][0], r = A[n][1]
        switch (s) {
            case 1:
                t += r.length
                break
            case i:
                a += r.length
                break
            case 0:
                e += Math.max(t, a), t = 0, a = 0
        }
    }
    return e + Math.max(t, a)
}, e.prototype.diff_toDelta = function (A) {
    for (var e = [], t = 0; t < A.length; t++) switch (A[t][0]) {
        case 1:
            e[t] = '+' + encodeURI(A[t][1])
            break
        case i:
            e[t] = '-' + A[t][1].length
            break
        case 0:
            e[t] = '=' + A[t][1].length
    }
    return e.join('\t').replace(/%20/g, ' ')
}, e.prototype.diff_fromDelta = function (A, t) {
    for (var a = [], n = 0, s = 0, r = t.split(/\t/g), o = 0; o < r.length; o++) {
        var B = r[o].substring(1)
        switch (r[o].charAt(0)) {
            case'+':
                try {a[n++] = new e.Diff(1, decodeURI(B))} catch (A) {throw new Error('Illegal escape in diff_fromDelta: ' + B)}
                break
            case'-':
            case'=':
                var E = parseInt(B, 10)
                if (isNaN(E) || E < 0) throw new Error('Invalid number in diff_fromDelta: ' + B)
                var Q = A.substring(s, s += E)
                '=' == r[o].charAt(0) ? a[n++] = new e.Diff(0, Q) : a[n++] = new e.Diff(i, Q)
                break
            default:
                if (r[o]) throw new Error('Invalid diff operation in diff_fromDelta: ' + r[o])
        }
    }
    if (s != A.length) throw new Error('Delta length (' + s + ') does not equal source text length (' + A.length + ').')
    return a
}, e.prototype.match_main = function (A, e, i) {
    if (null == A || null == e || null == i) throw new Error('Null input. (match_main)')
    return i = Math.max(0, Math.min(i, A.length)), A == e ? 0 : A.length ? A.substring(i, i + e.length) == e ? i : this.match_bitap_(A, e, i) : -1
}, e.prototype.match_bitap_ = function (A, e, i) {
    if (e.length > this.Match_MaxBits) throw new Error('Pattern too long for this browser.')
    var t = this.match_alphabet_(e), a = this

    function n (A, t) {
        var n = A / e.length, s = Math.abs(i - t)
        return a.Match_Distance ? n + s / a.Match_Distance : s ? 1 : n
    }

    var s = this.Match_Threshold, r = A.indexOf(e, i);
    -1 != r && (s = Math.min(n(0, r), s), -1 != (r = A.lastIndexOf(e, i + e.length)) && (s = Math.min(n(0, r), s)))
    var o, B, E = 1 << e.length - 1
    r = -1
    for (var Q, g = e.length + A.length, l = 0; l < e.length; l++) {
        for (o = 0, B = g; o < B;) n(l, i + B) <= s ? o = B : g = B, B = Math.floor((g - o) / 2 + o)
        g = B
        var c = Math.max(1, i - B + 1), h = Math.min(i + B, A.length) + e.length, u = Array(h + 2)
        u[h + 1] = (1 << l) - 1
        for (var D = h; D >= c; D--) {
            var d = t[A.charAt(D - 1)]
            if (u[D] = 0 === l ? (u[D + 1] << 1 | 1) & d : (u[D + 1] << 1 | 1) & d | (Q[D + 1] | Q[D]) << 1 | 1 | Q[D + 1], u[D] & E) {
                var w = n(l, D - 1)
                if (w <= s) {
                    if (s = w, !((r = D - 1) > i)) break
                    c = Math.max(1, 2 * i - r)
                }
            }
        }
        if (n(l + 1, i) > s) break
        Q = u
    }
    return r
}, e.prototype.match_alphabet_ = function (A) {
    for (var e = {}, i = 0; i < A.length; i++) e[A.charAt(i)] = 0
    for (i = 0; i < A.length; i++) e[A.charAt(i)] |= 1 << A.length - i - 1
    return e
}, e.prototype.patch_addContext_ = function (A, i) {
    if (0 != i.length) {
        if (null === A.start2) throw Error('patch not initialized')
        for (var t = i.substring(A.start2, A.start2 + A.length1), a = 0; i.indexOf(t) != i.lastIndexOf(t) && t.length < this.Match_MaxBits - this.Patch_Margin - this.Patch_Margin;) a += this.Patch_Margin, t = i.substring(A.start2 - a, A.start2 + A.length1 + a)
        a += this.Patch_Margin
        var n = i.substring(A.start2 - a, A.start2)
        n && A.diffs.unshift(new e.Diff(0, n))
        var s = i.substring(A.start2 + A.length1, A.start2 + A.length1 + a)
        s && A.diffs.push(new e.Diff(0, s)), A.start1 -= n.length, A.start2 -= n.length, A.length1 += n.length + s.length, A.length2 += n.length + s.length
    }
}, e.prototype.patch_make = function (A, t, a) {
    var n, s
    if ('string' == typeof A && 'string' == typeof t && void 0 === a) n = A, (s = this.diff_main(n, t, !0)).length > 2 && (this.diff_cleanupSemantic(s), this.diff_cleanupEfficiency(s)) else if (A && 'object' == typeof A && void 0 === t && void 0 === a) s = A, n = this.diff_text1(s) else if ('string' == typeof A && t && 'object' == typeof t && void 0 === a) n = A, s = t else {
        if ('string' != typeof A || 'string' != typeof t || !a || 'object' != typeof a) throw new Error('Unknown call format to patch_make.')
        n = A, s = a
    }
    if (0 === s.length) return []
    for (var r = [], o = new e.patch_obj, B = 0, E = 0, Q = 0, g = n, l = n, c = 0; c < s.length; c++) {
        var h = s[c][0], u = s[c][1]
        switch (B || 0 === h || (o.start1 = E, o.start2 = Q), h) {
            case 1:
                o.diffs[B++] = s[c], o.length2 += u.length, l = l.substring(0, Q) + u + l.substring(Q)
                break
            case i:
                o.length1 += u.length, o.diffs[B++] = s[c], l = l.substring(0, Q) + l.substring(Q + u.length)
                break
            case 0:
                u.length <= 2 * this.Patch_Margin && B && s.length != c + 1 ? (o.diffs[B++] = s[c], o.length1 += u.length, o.length2 += u.length) : u.length >= 2 * this.Patch_Margin && B && (this.patch_addContext_(o, g), r.push(o), o = new e.patch_obj, B = 0, g = l, E = Q)
        }
        1 !== h && (E += u.length), h !== i && (Q += u.length)
    }
    return B && (this.patch_addContext_(o, g), r.push(o)), r
}, e.prototype.patch_deepCopy = function (A) {
    for (var i = [], t = 0; t < A.length; t++) {
        var a = A[t], n = new e.patch_obj
        n.diffs = []
        for (var s = 0; s < a.diffs.length; s++) n.diffs[s] = new e.Diff(a.diffs[s][0], a.diffs[s][1])
        n.start1 = a.start1, n.start2 = a.start2, n.length1 = a.length1, n.length2 = a.length2, i[t] = n
    }
    return i
}, e.prototype.patch_apply = function (A, e) {
    if (0 == A.length) return [e, []]
    A = this.patch_deepCopy(A)
    var t = this.patch_addPadding(A)
    e = t + e + t, this.patch_splitMax(A)
    for (var a = 0, n = [], s = 0; s < A.length; s++) {
        var r, o, B = A[s].start2 + a, E = this.diff_text1(A[s].diffs), Q = -1
        if (E.length > this.Match_MaxBits ? -1 != (r = this.match_main(e, E.substring(0, this.Match_MaxBits), B)) && (-1 == (Q = this.match_main(e, E.substring(E.length - this.Match_MaxBits), B + E.length - this.Match_MaxBits)) || r >= Q) && (r = -1) : r = this.match_main(e, E, B), -1 == r) n[s] = !1, a -= A[s].length2 - A[s].length1 else if (n[s] = !0, a = r - B, E == (o = -1 == Q ? e.substring(r, r + E.length) : e.substring(r, Q + this.Match_MaxBits))) e = e.substring(0, r) + this.diff_text2(A[s].diffs) + e.substring(r + E.length) else {
            var g = this.diff_main(E, o, !1)
            if (E.length > this.Match_MaxBits && this.diff_levenshtein(g) / E.length > this.Patch_DeleteThreshold) n[s] = !1 else {
                this.diff_cleanupSemanticLossless(g)
                for (var l, c = 0, h = 0; h < A[s].diffs.length; h++) {
                    var u = A[s].diffs[h]
                    0 !== u[0] && (l = this.diff_xIndex(g, c)), 1 === u[0] ? e = e.substring(0, r + l) + u[1] + e.substring(r + l) : u[0] === i && (e = e.substring(0, r + l) + e.substring(r + this.diff_xIndex(g, c + u[1].length))), u[0] !== i && (c += u[1].length)
                }
            }
        }
    }
    return [e = e.substring(t.length, e.length - t.length), n]
}, e.prototype.patch_addPadding = function (A) {
    for (var i = this.Patch_Margin, t = '', a = 1; a <= i; a++) t += String.fromCharCode(a)
    for (a = 0; a < A.length; a++) A[a].start1 += i, A[a].start2 += i
    var n = A[0], s = n.diffs
    if (0 == s.length || 0 != s[0][0]) s.unshift(new e.Diff(0, t)), n.start1 -= i, n.start2 -= i, n.length1 += i, n.length2 += i else if (i > s[0][1].length) {
        var r = i - s[0][1].length
        s[0][1] = t.substring(s[0][1].length) + s[0][1], n.start1 -= r, n.start2 -= r, n.length1 += r, n.length2 += r
    }
    return 0 == (s = (n = A[A.length - 1]).diffs).length || 0 != s[s.length - 1][0] ? (s.push(new e.Diff(0, t)), n.length1 += i, n.length2 += i) : i > s[s.length - 1][1].length && (r = i - s[s.length - 1][1].length, s[s.length - 1][1] += t.substring(0, r), n.length1 += r, n.length2 += r), t
}, e.prototype.patch_splitMax = function (A) {
    for (var t = this.Match_MaxBits, a = 0; a < A.length; a++) if (!(A[a].length1 <= t)) {
        var n = A[a]
        A.splice(a--, 1)
        for (var s = n.start1, r = n.start2, o = ''; 0 !== n.diffs.length;) {
            var B = new e.patch_obj, E = !0
            for (B.start1 = s - o.length, B.start2 = r - o.length, '' !== o && (B.length1 = B.length2 = o.length, B.diffs.push(new e.Diff(0, o))); 0 !== n.diffs.length && B.length1 < t - this.Patch_Margin;) {
                var Q = n.diffs[0][0], g = n.diffs[0][1]
                1 === Q ? (B.length2 += g.length, r += g.length, B.diffs.push(n.diffs.shift()), E = !1) : Q === i && 1 == B.diffs.length && 0 == B.diffs[0][0] && g.length > 2 * t ? (B.length1 += g.length, s += g.length, E = !1, B.diffs.push(new e.Diff(Q, g)), n.diffs.shift()) : (g = g.substring(0, t - B.length1 - this.Patch_Margin), B.length1 += g.length, s += g.length, 0 === Q ? (B.length2 += g.length, r += g.length) : E = !1, B.diffs.push(new e.Diff(Q, g)), g == n.diffs[0][1] ? n.diffs.shift() : n.diffs[0][1] = n.diffs[0][1].substring(g.length))
            }
            o = (o = this.diff_text2(B.diffs)).substring(o.length - this.Patch_Margin)
            var l = this.diff_text1(n.diffs).substring(0, this.Patch_Margin)
            '' !== l && (B.length1 += l.length, B.length2 += l.length, 0 !== B.diffs.length && 0 === B.diffs[B.diffs.length - 1][0] ? B.diffs[B.diffs.length - 1][1] += l : B.diffs.push(new e.Diff(0, l))), E || A.splice(++a, 0, B)
        }
    }
}, e.prototype.patch_toText = function (A) {
    for (var e = [], i = 0; i < A.length; i++) e[i] = A[i]
    return e.join('')
}, e.prototype.patch_fromText = function (A) {
    var t = []
    if (!A) return t
    for (var a = A.split('\n'), n = 0, s = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@$/; n < a.length;) {
        var r = a[n].match(s)
        if (!r) throw new Error('Invalid patch string: ' + a[n])
        var o = new e.patch_obj
        for (t.push(o), o.start1 = parseInt(r[1], 10), '' === r[2] ? (o.start1--, o.length1 = 1) : '0' == r[2] ? o.length1 = 0 : (o.start1--, o.length1 = parseInt(r[2], 10)), o.start2 = parseInt(r[3], 10), '' === r[4] ? (o.start2--, o.length2 = 1) : '0' == r[4] ? o.length2 = 0 : (o.start2--, o.length2 = parseInt(r[4], 10)), n++; n < a.length;) {
            var B = a[n].charAt(0)
            try {var E = decodeURI(a[n].substring(1))} catch (A) {throw new Error('Illegal escape in patch_fromText: ' + E)}
            if ('-' == B) o.diffs.push(new e.Diff(i, E)) else if ('+' == B) o.diffs.push(new e.Diff(1, E)) else if (' ' == B) o.diffs.push(new e.Diff(0, E)) else {
                if ('@' == B) break
                if ('' !== B) throw new Error('Invalid patch mode "' + B + '" in: ' + E)
            }
            n++
        }
    }
    return t
}, (e.patch_obj = function () {this.diffs = [], this.start1 = null, this.start2 = null, this.length1 = 0, this.length2 = 0}).prototype.toString = function () {
    for (var A, e = ['@@ -' + (0 === this.length1 ? this.start1 + ',0' : 1 == this.length1 ? this.start1 + 1 : this.start1 + 1 + ',' + this.length1) + ' +' + (0 === this.length2 ? this.start2 + ',0' : 1 == this.length2 ? this.start2 + 1 : this.start2 + 1 + ',' + this.length2) + ' @@\n'], t = 0; t < this.diffs.length; t++) {
        switch (this.diffs[t][0]) {
            case 1:
                A = '+'
                break
            case i:
                A = '-'
                break
            case 0:
                A = ' '
        }
        e[t + 1] = A + encodeURI(this.diffs[t][1]) + '\n'
    }
    return e.join('').replace(/%20/g, ' ')
}