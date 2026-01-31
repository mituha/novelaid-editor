import { LMStudioClient } from '@lmstudio/sdk';

async function testLMStudio() {
    console.log('--- Testing LMStudio ---');
    try {
        const client = new LMStudioClient({ baseUrl: 'http://127.0.0.1:1234' });
        // Try to find listing methods
        if ((client as any).system && (client as any).system.listDownloadedModels) {
             console.log('Found client.system.listDownloadedModels');
             const models = await (client as any).system.listDownloadedModels();
             console.log('Models:', models);
        } else if ((client as any).llm && (client as any).llm.listLoaded) {
             console.log('Found client.llm.listLoaded');
             const models = await (client as any).llm.listLoaded();
             console.log('Models:', models);
        } else {
             console.log('Could not find obvious list method on LMStudioClient');
             console.log('Keys:', Object.keys(client));
        }
    } catch (e) {
        console.error('LMStudio Error:', e);
    }
}

async function main() {
    await testLMStudio();
}

main();
