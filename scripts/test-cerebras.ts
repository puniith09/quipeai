/**
 * Simple test for Cerebras provider via OpenRouter
 */

async function testCerebras() {
  console.log('🧪 Testing Cerebras provider for component generation...\n');

  try {
    const response = await fetch('http://localhost:3002/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'Find me a salon nearby' }
        ],
        location: { lat: 17.438, lng: 78.448 }
      })
    });

    console.log('📡 Response status:', response.status);
    console.log('📡 Content-Type:', response.headers.get('content-type'));

    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      console.log('\n✅ Streaming response detected!\n');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let components: any[] = [];

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                console.log('\n✅ Stream complete!\n');
                continue;
              }

              try {
                const parsed = JSON.parse(data);

                // Check for components
                if (parsed.type === 'components') {
                  components = parsed.data;
                  console.log('🎨 Components received:', components.length);
                  console.log('📋 First component:', JSON.stringify(components[0], null, 2).substring(0, 200));
                  continue;
                }

                // Regular text content
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  process.stdout.write(delta);
                  fullText += delta;
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      }

      console.log('\n\n📊 Results:');
      console.log('- Text length:', fullText.length);
      console.log('- Components count:', components.length);
      console.log('✅ Test passed!');

    } else {
      const text = await response.text();
      console.log('❌ Expected streaming response, got:', text.substring(0, 200));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testCerebras();
