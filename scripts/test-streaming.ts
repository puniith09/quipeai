/**
 * Test script to verify streaming responses with tool calls
 */

async function testStreaming() {
  console.log('🧪 Testing streaming with tool calls...\n');

  const messages = [
    {
      role: 'user',
      content: 'Find me a good salon nearby'
    }
  ];

  const location = { lat: 17.438, lng: 78.448 };

  console.log('📤 Sending request to /api/chat');
  console.log('📍 Location:', location);
  console.log('💬 Message:', messages[0].content);
  console.log('');

  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        location,
        temperature: 0.7,
        max_tokens: 1000,
      })
    });

    if (!response.ok) {
      console.error('❌ API error:', response.status);
      const error = await response.text();
      console.error(error);
      return;
    }

    // Check if it's a streaming response
    const contentType = response.headers.get('content-type');
    console.log('📡 Content-Type:', contentType);

    if (contentType?.includes('text/event-stream')) {
      console.log('\n✅ Streaming response detected!\n');
      console.log('📝 Streaming text:\n');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      let accumulatedText = '';
      let receivedComponents = false;
      let toolCallsDetected = false;

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
                console.log('\n\n✅ Stream complete!');
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                
                // Handle custom events (components)
                if (parsed.type === 'components') {
                  receivedComponents = true;
                  console.log('\n\n🎨 Components received:', JSON.stringify(parsed.data, null, 2));
                  
                  // Log suggested components if present
                  const firstCard = parsed.data?.[0];
                  if (firstCard) {
                    console.log('\n📋 First component type:', firstCard.type);
                    console.log('📋 Component props keys:', Object.keys(firstCard.props || {}).join(', '));
                  }
                  continue;
                }
                
                // Log tool calls if detected
                if (parsed.choices?.[0]?.message?.tool_calls) {
                  toolCallsDetected = true;
                  const toolCalls = parsed.choices[0].message.tool_calls;
                  console.log('\n\n🔧 Tool calls detected:', toolCalls.length);
                  toolCalls.forEach((tc: any) => {
                    console.log(`  - ${tc.function.name}(${tc.function.arguments})`);
                    const args = JSON.parse(tc.function.arguments);
                    if (args.suggestedComponents) {
                      console.log(`    📌 Suggested components: ${args.suggestedComponents.join(', ')}`);
                    }
                  });
                }
                
                // Handle standard OpenRouter streaming format
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  accumulatedText += delta;
                  process.stdout.write(delta); // Print character by character
                }
              } catch (parseError) {
                // Ignore parse errors for malformed chunks
              }
            }
          }
        }
      }

      console.log('\n\n📊 Results:');
      console.log('- Total text length:', accumulatedText.length);
      console.log('- Tool calls detected:', toolCallsDetected ? '✅ Yes' : '❌ No');
      console.log('- Received components:', receivedComponents ? '✅ Yes' : '❌ No');
      
    } else {
      console.log('\n⚠️  Non-streaming response');
      const data = await response.json();
      console.log('Response:', JSON.stringify(data, null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the test
testStreaming();
