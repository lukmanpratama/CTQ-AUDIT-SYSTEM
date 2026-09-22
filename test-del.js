const setupProcessId = 123; // dummy id to see if it even reaches the endpoint properly or if we can get a real ID. Wait, I must fetch tree first to get real ID!
async function run() {
    const res = await fetch("http://127.0.0.1:3001/api/ctq-setup/models");
    const json = await res.json();
    const model = json[0];

    const treeRes = await fetch(`http://127.0.0.1:3001/api/ctq-setup/models/${model.setupModelId}/tree`);
    const tree = await treeRes.json();

    // Find a process to delete
    let pId = null;
    for (const a of tree.areas) {
        if (a.setupProcesses && a.setupProcesses.length > 0) {
            pId = a.setupProcesses[0].setupProcessId;
            break;
        }
    }

    if (!pId) {
        console.log("No process found to delete");
        return;
    }

    console.log("Attempting to delete process: " + pId);
    const delRes = await fetch(`http://127.0.0.1:3001/api/ctq-setup/processes/${pId}`, { method: 'DELETE' });
    console.log("Status: " + delRes.status);
    console.log(await delRes.text());
}
run();
