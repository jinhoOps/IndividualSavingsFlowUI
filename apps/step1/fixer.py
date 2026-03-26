import re

def process_file(filepath, is_step2=False):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    app_key = "null" if is_step2 else "SHARE_STATE_KEY"

    # Replace backup store initialization
    content = content.replace('if (!isIndexedDbAvailable()) {', 'if (!IsfBackupManager.isIndexedDbAvailable()) {')
    content = content.replace('await loadBackupEntries();', f'await IsfBackupManager.loadBackupEntriesFromDb({app_key});')
    
    # Replace auto backup calls
    content = re.sub(
        r'await maybeCreateAutoBackupIfDue\(\{.*?\}\);',
        f'const res = await IsfBackupManager.maybeCreateAutoBackupIfDue(state.backupEntries, state.inputs || state.portfolio, {app_key}); if(res.created) {{ state.backupEntries = res.nextEntries; syncBackupUi(); }}',
        content
    )

    # createBackupEntry
    content = re.sub(
        r'await createBackupEntry\(state\.([a-zA-Z]+),\s*\{(.*?)\}\);',
        f'const res = await IsfBackupManager.createBackupEntry(state.backupEntries, state.\\1, {{\\2, appKey: {app_key}}}); if(res.created) {{ state.backupEntries = res.nextEntries; syncBackupUi(); }}',
        content
    )
    # createBackupEntry with inline dict
    content = re.sub(
        r'await createBackupEntry\((.*?), \{(.*?)\}\);',
        f'const res = await IsfBackupManager.createBackupEntry(state.backupEntries, \\1, {{\\2, appKey: {app_key}}}); if(res.created) {{ state.backupEntries = res.nextEntries; syncBackupUi(); }}',
        content
    )

    # replace PWA calls in step1
    if not is_step2:
        pwa_init = """const pwaManager = new IsfPwaManager({
    appVersion: "0.1.1",
    onFeedback: (message) => IsfFeedback.showFeedback(dom.applyFeedback, message),
    isViewMode: () => state.isViewMode,
    swPath: "../../sw.js",
    manifestPath: "../../manifest.webmanifest",
    versionCheckTriggerElement: dom.checkLatestVersion,
  });
  pwaManager.init();"""
        content = re.sub(r'registerServiceWorker\(\);\s*maybeShowStandaloneLaunchFeedback\(\);\s*bindPwaVersionAwareness\(\);', pwa_init, content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file(r'd:\jhkSandBox\CODE\IndividualSavingsFlowUI\apps\step1\app.js', False)
process_file(r'd:\jhkSandBox\CODE\IndividualSavingsFlowUI\apps\step2\app.js', True)
