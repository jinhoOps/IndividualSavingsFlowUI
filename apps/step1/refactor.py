import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    funcs_to_remove = [
        "formatMoney", "formatTimestamp", "sanitizeMoney", "sanitizeRate", "createId", "escapeHtml", "formatWeight",
        "lzCompressToUriComponent", "lzDecompressFromUriComponent", "lzCompress", "lzDecompress",
        "encodeBase64Url", "decodeBase64Url", "buildStateEnvelope", "parseStateEnvelope",
        "encodeInputsForHash", "loadInputsFromHash", "detectViewMode", "getShareIdFromUrl",
        "exportInputsAsJson", "parseImportedInputs", "shouldUseServiceWorker", "isStandaloneDisplayMode",
        "parseSemver", "compareSemver", "bindPwaLifecycleFeedback", "syncVersionCheckTriggerVisibility",
        "shouldCheckRemotePwaVersion", "getRemotePwaVersionLastCheckedAt", "setRemotePwaVersionLastCheckedAt",
        "maybeTriggerServiceWorkerUpdateCheck", "maybeCheckRemotePwaVersion", "bindPwaVersionAwareness",
        "maybeShowStandaloneLaunchFeedback", "bindServiceWorkerUpdateFeedback", "registerServiceWorker",
        "getBackupDb", "idbRequestToPromise", "idbTransactionDone", "loadBackupEntries", "loadLegacyBackupEntries",
        "clearLegacyBackupEntries", "loadBackupEntriesFromDb", "normalizeBackupEntries", "persistBackupEntries",
        "normalizeBackupEntry", "createBackupEntryId", "getBackupTimestampMs", "buildBackupSignature",
        "createBackupEntry", "maybeCreateAutoBackupIfDue", "showApplyFeedback", "showStep2Feedback",
        "exportPortfolioAsJson", "parseImportedPortfolioJson", "encodePortfolioForHash", "loadPortfolioFromHash",
        "detectStep2ViewMode", "getStep2ShareIdFromUrl", "setPendingBar", "toWon", "sanitizeWeight"
    ]

    consts_to_remove = [
        "currencyFormatter", "backupTimestampFormatter", "APP_VERSION", "HASH_COMPRESSED_PREFIX",
        "HASH_STATE_MAX_LENGTH", "SHARE_ID_QUERY_PARAM", "VIEW_MODE_QUERY_PARAM", "VIEW_MODE_QUERY_VALUE",
        "LZ_URI_SAFE_ALPHABET", "LZ_URI_SAFE_REVERSE_MAP", "PWA_STANDALONE_NOTICE_KEY",
        "PWA_REMOTE_VERSION_NOTICE_KEY", "PWA_REMOTE_VERSION_LAST_CHECK_KEY", "PWA_REMOTE_VERSION_CHECK_INTERVAL_MS",
        "BACKUP_DB_NAME", "BACKUP_DB_VERSION", "BACKUP_DB_STORE", "MAX_BACKUP_ENTRIES", "AUTO_BACKUP_INTERVAL_MS",
        "BACKUP_STORAGE_KEY", "BACKUP_SCHEMA_VERSION"
    ]

    lines = content.split('\n')
    skip_mode = False
    skip_brackets = 0

    new_lines = []
    
    for i, line in enumerate(lines):
        if not skip_mode:
            m = re.match(r'^(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(', line)
            if m and m.group(1) in funcs_to_remove:
                skip_mode = True
                skip_brackets = line.count('{') - line.count('}')
                if skip_brackets == 0:
                    skip_mode = False
                continue
            
            m2 = re.match(r'^const\s+([A-Z_0-9]+)\s*=', line)
            if m2 and m2.group(1) in consts_to_remove:
                if not line.rstrip().endswith(';'):
                    skip_mode = True
                    # multiline Map uses parenthesis mostly
                    skip_brackets = line.count('(') - line.count(')')
                    if m2.group(1) == 'LZ_URI_SAFE_REVERSE_MAP':
                        skip_brackets = 1 # hack for the known 3 line const
                    if skip_brackets == 0:
                        skip_mode = False
                continue
            
            new_lines.append(line)
        else:
            skip_brackets += line.count('{') - line.count('}')
            skip_brackets += line.count('(') - line.count(')') # track parens too for map
            if skip_brackets <= 0:
                skip_mode = False

    out = '\n'.join(new_lines)
    
    out = re.sub(r'(?<!function )(?<!IsfUtils\.)\bformatMoney\(', 'IsfUtils.formatMoney(', out)
    out = re.sub(r'(?<!function )(?<!IsfUtils\.)\bformatTimestamp\(', 'IsfUtils.formatTimestamp(', out)
    out = re.sub(r'(?<!function )(?<!IsfUtils\.)\bsanitizeMoney\(', 'IsfUtils.sanitizeMoney(', out)
    out = re.sub(r'(?<!function )(?<!IsfUtils\.)\bsanitizeRate\(', 'IsfUtils.sanitizeRate(', out)
    out = re.sub(r'(?<!function )(?<!IsfUtils\.)\bsanitizeWeight\(', 'IsfUtils.sanitizeWeight(', out)
    out = re.sub(r'(?<!function )(?<!IsfUtils\.)\btoWon\(', 'IsfUtils.toWon(', out)
    out = re.sub(r'(?<!function )(?<!IsfUtils\.)\bcreateId\(', 'IsfUtils.createId(', out)
    
    out = re.sub(r'(?<!function )(?<!IsfShare\.)\bdetectViewMode\(\)', 'IsfShare.detectViewMode()', out)
    out = re.sub(r'(?<!function )(?<!IsfShare\.)\bdetectStep2ViewMode\(\)', 'IsfShare.detectViewMode()', out)
    out = re.sub(r'(?<!function )(?<!IsfShare\.)\bexportInputsAsJson\((.*?)\)', r'IsfShare.exportAsJson(IsfShare.buildStateEnvelope(SHARE_STATE_KEY, SHARE_STATE_SCHEMA, \1), "my-household-flow-backup")', out)
    out = re.sub(r'(?<!function )(?<!IsfShare\.)\bexportPortfolioAsJson\((.*?)\)', r'IsfShare.exportAsJson(IsfShare.buildStateEnvelope(null, 1, \1), "isf-portfolio-backup")', out)
    
    out = re.sub(r'(?<!function )(?<!IsfShare\.)\bparseImportedInputs\((.*?)\)', r'IsfShare.parseImportedJson(\1, SHARE_STATE_KEY)', out)
    out = re.sub(r'(?<!function )(?<!IsfShare\.)\bparseImportedPortfolioJson\((.*?)\)', r'IsfShare.parseImportedJson(\1, null)', out)
    
    out = re.sub(r'(?<!function )(?<!IsfShare\.)\bencodeInputsForHash\((.*?)\)', r'IsfShare.encodePayloadForHash(IsfShare.buildStateEnvelope(SHARE_STATE_KEY, SHARE_STATE_SCHEMA, \1))', out)
    out = re.sub(r'(?<!function )(?<!IsfShare\.)\bencodePortfolioForHash\((.*?)\)', r'IsfShare.encodePayloadForHash(IsfShare.buildStateEnvelope(null, 1, \1))', out)
    
    out = re.sub(r'(?<!function )(?<!IsfShare\.)\bloadInputsFromHash\(\)', r'IsfShare.decodePayloadFromHash(new URLSearchParams(window.location.hash.replace(/^#/, "")).get(IsfShare.HASH_STATE_PARAM), SHARE_STATE_KEY)', out)
    out = re.sub(r'(?<!function )(?<!IsfShare\.)\bloadPortfolioFromHash\(\)', r'IsfShare.decodePayloadFromHash(new URLSearchParams(window.location.hash.replace(/^#/, "")).get(IsfShare.HASH_STATE_PARAM), null)', out)
    out = re.sub(r'(?<!function )(?<!IsfShare\.)\bgetShareIdFromUrl\(\)', 'IsfShare.getShareIdFromUrl()', out)
    out = re.sub(r'(?<!function )(?<!IsfShare\.)\bgetStep2ShareIdFromUrl\(\)', 'IsfShare.getShareIdFromUrl()', out)
    
    out = re.sub(r'(?<!function )(?<!IsfBackupManager\.)\bgetBackupTimestampMs\(', 'IsfBackupManager.getBackupTimestampMs(', out)
    
    out = out.replace('VIEW_MODE_QUERY_PARAM', 'IsfShare.VIEW_MODE_QUERY_PARAM')
    out = out.replace('VIEW_MODE_QUERY_VALUE', 'IsfShare.VIEW_MODE_QUERY_VALUE')
    out = out.replace('SHARE_ID_QUERY_PARAM', 'IsfShare.SHARE_ID_QUERY_PARAM')
    
    out = re.sub(r'(?<!function )(?<!IsfFeedback\.)\bshowApplyFeedback\((.*?)\)', r'IsfFeedback.showFeedback(dom.applyFeedback, \1)', out)
    out = re.sub(r'(?<!function )(?<!IsfFeedback\.)\bshowStep2Feedback\((.*?)\)', r'IsfFeedback.showFeedback(dom.step2Feedback, \1)', out)
    out = re.sub(r'(?<!function )(?<!IsfFeedback\.)\bsetPendingBar\((.*?)\)', r'IsfFeedback.markPendingBar(dom.pendingBar, dom.pendingSummary, \1)', out)
    
    with open(filepath + '.new.js', 'w', encoding='utf-8') as f:
        f.write(out)

process_file(r'd:\jhkSandBox\CODE\IndividualSavingsFlowUI\apps\step1\app.js')
process_file(r'd:\jhkSandBox\CODE\IndividualSavingsFlowUI\apps\step2\app.js')
