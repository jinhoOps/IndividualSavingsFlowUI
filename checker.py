import re

def check_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    funcs = [
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
    
    for i, line in enumerate(lines):
        for func in funcs:
            if re.search(r'(?<!IsfUtils\.)(?<!IsfShare\.)(?<!IsfFeedback\.)(?<!IsfBackupManager\.)\b' + func + r'\(', line):
                print(f"{filepath}:{i+1} : {func} -> {line.strip()}")

check_file(r'd:\jhkSandBox\CODE\IndividualSavingsFlowUI\apps\step1\app.js')
check_file(r'd:\jhkSandBox\CODE\IndividualSavingsFlowUI\apps\step2\app.js')
