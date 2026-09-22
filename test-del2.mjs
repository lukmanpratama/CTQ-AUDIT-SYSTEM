import fs from 'fs';

async function run() {
    try {
        const res = await fetch("http://127.0.0.1:3001/api/ctq-setup/models");
        const json = await res.json();
        const model = json[0];

        const treeRes = await fetch(`http://127.0.0.1:3001/api/ctq-setup/models/${model.setupModelId}/tree`);
        const tree = await treeRes.json();

        let pId = null;
        for (const a of tree.areas) {
            if (a.setupProcesses && a.setupProcesses.length > 0) {
                pId = a.setupProcesses[0].setupProcessId;
                break;
            }
        }

        if (!pId) {
            fs.writeFileSync('D:\\CTQ AUDIT SYSTEM\\del-log.txt', 'No process found');
            return;
        }

        const delRes = await fetch(`http://127.0.0.1:3001/api/ctq-setup/processes/${pId}`, { method: 'DELETE' });
        const text = await delRes.text();
        fs.writeFileSync('D:\\CTQ AUDIT SYSTEM\\del-log.txt', `Status: ${delRes.status}\nResponse: ${text}\nID: ${pId}`);
    } catch (e) {
        fs.writeFileSync('D:\\CTQ AUDIT SYSTEM\\del-log.txt', `Error: ${e.message}`);
    }
}
run();
