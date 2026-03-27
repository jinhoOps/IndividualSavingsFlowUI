import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # createBackupEntry -> IsfBackupManager.createBackupEntry
    content = re.sub(
        r'await createBackupEntry\(([^,]+),\s*\{(.*?)\}\);',
        r'await IsfBackupManager.createBackupEntry(state.backupEntries, \1, {\2, appKey: SHARE_STATE_KEY}); syncBackupUi();',
        content
    )
    
    # remove checkLatestVersion click listener completely
    content = re.sub(
        r'if \(dom\.checkLatestVersion\) \{\s*dom\.checkLatestVersion\.addEventListener\("click", \(\) => \{\s*void maybeCheckRemotePwaVersion\(\{ force: true, showUpToDateFeedback: true \}\);\s*\}\);\s*\}',
        '',
        content
    )
    
    # remove single line syncVersionCheckTriggerVisibility();
    content = content.replace('syncVersionCheckTriggerVisibility();', '')
    
    # remove maybeCreateAutoBackupIfDue
    content = re.sub(
        r'\bvoid maybeCreateAutoBackupIfDue\(\{.*?\}\);',
        '/* auto backup handled in wrapper */',
        content
    )
    
    # For loadBackupEntriesFromDb block, the original had idbTransactionDone and idbRequestToPromise
    # We should just wipe the legacy local implementation of loadLegacyBackupEntries and loadBackupEntriesFromDb completely.
    # Wait, my previous python script only deleted functions by name. Did it delete loadBackupEntriesFromDb? YES!
    # BUT wait... why did the checker find idbTransactionDone? Let's check where it is!
    # It must be inside `loadBackupEntries`? No, inside `clearLegacyBackupEntries`?
    # Ah, the legacy backup cleanup or some IDB raw requests were still inside `app.js`!
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file(r'd:\jhkSandBox\CODE\IndividualSavingsFlowUI\apps\step1\app.js')
process_file(r'd:\jhkSandBox\CODE\IndividualSavingsFlowUI\apps\step2\app.js')
