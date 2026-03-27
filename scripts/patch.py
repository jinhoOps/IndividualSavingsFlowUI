import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # createBackupEntry
    content = re.sub(
        r'await createBackupEntry\((.*?),\s*\{(.*?)\}\);',
        r'await IsfBackupManager.createBackupEntry(state.backupEntries, \1, {\2, appKey: SHARE_STATE_KEY}); syncBackupUi();',
        content
    )
    
    # maybeCheckRemotePwaVersion
    content = re.sub(r'\bmaybeCheckRemotePwaVersion\b', 'pwaManager.maybeCheckRemotePwaVersion', content)
    
    # syncVersionCheckTriggerVisibility
    content = content.replace('syncVersionCheckTriggerVisibility();', '')
    
    # maybeCreateAutoBackupIfDue
    content = re.sub(r'maybeCreateAutoBackupIfDue\(\{.*?\}\);', '/* auto backup handled in backup manager wrapper */', content)
    
    # idbTransactionDone and idbRequestToPromise
    content = content.replace('await idbTransactionDone(transaction);', '')
    content = content.replace('const entry = await idbRequestToPromise(request);', 'const entry = request.result;')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file(r'd:\jhkSandBox\CODE\IndividualSavingsFlowUI\apps\step1\app.js')
process_file(r'd:\jhkSandBox\CODE\IndividualSavingsFlowUI\apps\step2\app.js')
