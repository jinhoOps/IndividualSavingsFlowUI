import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. createBackupEntry
    content = re.sub(
        r'await createBackupEntry\((.*?), \{(.*?)\}\);',
        r'const res = await IsfBackupManager.createBackupEntry(state.backupEntries, \1, {\2, appKey: IsfShare.SHARE_STATE_KEY}); if(res.created) { state.backupEntries = res.nextEntries; syncBackupUi(); }',
        content,
        flags=re.DOTALL
    )

    # 2. dom.checkLatestVersion handler
    content = re.sub(
        r'if \(dom\.checkLatestVersion\) \{\s*dom\.checkLatestVersion\.addEventListener\("click", \(\) => \{\s*void maybeCheckRemotePwaVersion\(\{ force: true, showUpToDateFeedback: true \}\);\s*\}\);\s*\}',
        '',
        content
    )

    # 3. syncVersionCheckTriggerVisibility
    content = content.replace('syncVersionCheckTriggerVisibility();', '')

    # 4. maybeCreateAutoBackupIfDue
    content = re.sub(
        r'void maybeCreateAutoBackupIfDue\(\{.*?\}\);',
        'void IsfBackupManager.maybeCreateAutoBackupIfDue(state.backupEntries, inputs, IsfShare.SHARE_STATE_KEY).then(r => { if(r.created) { state.backupEntries = r.nextEntries; syncBackupUi(); } });',
        content
    )

    # 5. isIndexedDbAvailable missing prefix in loadShareSnapshotById
    content = content.replace('!isIndexedDbAvailable()', '!IsfBackupManager.isIndexedDbAvailable()')

    # 6. IDB Helpers restoration
    helpers = """function idbRequestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function idbTransactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(new Error("Transaction aborted"));
  });
}

"""
    # Insert before saveShareSnapshot
    if 'function idbRequestToPromise' not in content:
        content = content.replace('async function saveShareSnapshot', helpers + 'async function saveShareSnapshot')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file(r'd:\jhkSandBox\CODE\IndividualSavingsFlowUI\apps\step1\app.js')
