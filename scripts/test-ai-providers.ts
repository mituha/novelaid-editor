import { ProviderFactory } from '../src/main/ai/ProviderFactory';

async function main() {
  const args = process.argv.slice(2);
  const providerType = args[0] as 'lmstudio' | 'gemini';

  if (!providerType) {
    console.error('Usage: ts-node scripts/test-ai-providers.ts <lmstudio|gemini> [apiKey/modelName]');
    console.log('  For LMStudio: ts-node scripts/test-ai-providers.ts lmstudio [model_name] (default: loaded model)');
    console.log('  For Gemini:   ts-node scripts/test-ai-providers.ts gemini <API_KEY> [model_name] (default: gemini-1.5-flash)');
    process.exit(1);
  }

  try {
    let provider;
    if (providerType === 'lmstudio') {
        const modelName = args[1] || 'local-model'; // Default or user provided
        console.log(`Initializing LMStudio provider with model: ${modelName}...`);
        provider = ProviderFactory.createProvider({
            type: 'lmstudio',
            modelName: modelName,
            baseUrl: 'http://127.0.0.1:1234'
        });
    } else if (providerType === 'gemini') {
        const apiKey = args[1];
        if (!apiKey) {
             console.error('Error: API Key required for Gemini.');
             process.exit(1);
        }
        const modelName = args[2] || 'gemini-1.5-flash';
        console.log(`Initializing Gemini provider with model: ${modelName}...`);
        provider = ProviderFactory.createProvider({
            type: 'gemini',
            apiKey: apiKey,
            modelName: modelName
        });
    } else {
        console.error('Invalid provider type.');
        process.exit(1);
    }

    const testPrompt = 'Hello, tell me a short joke.';
    console.log(`\nSending prompt: "${testPrompt}"\n`);

    console.log('--- Generating Content ---');
    const response = await provider.generateContent(testPrompt);
    console.log('Response:', response);

    console.log('\n--- Streaming Content ---');
    process.stdout.write('Stream: ');
    for await (const chunk of provider.streamContent(testPrompt)) {
        process.stdout.write(chunk);
    }
    console.log('\n\nDone.');

  } catch (error) {
    console.error('Error during execution:', error);
  }
}

main();
