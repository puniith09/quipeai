/**
 * Test script for login flow
 * Tests if login form components are generated when user requests login
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';

interface StreamChunk {
  type?: string;
  data?: any;
  choices?: Array<{
    delta?: {
      content?: string;
      tool_calls?: any[];
    };
  }>;
}

async function testLogin() {
  console.log('🧪 Testing login flow...\n');

  const requestBody = {
    messages: [
      { role: 'user', content: 'i want to login' }
    ]
  };

  console.log('📤 Sending request to /api/chat');
  console.log('💬 Message: "i want to login"\n');

  try {
    const response = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('📡 Content-Type:', response.headers.get('content-type'));

    if (response.body) {
      console.log('\n✅ Streaming response detected!\n');
      console.log('📝 Streaming text:\n');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let receivedComponents = false;
      let componentData: any = null;

      while (true) {
        const { done, value } = await reader.read();
        
        if (value) {
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
                const parsed: StreamChunk = JSON.parse(data);

                // Check for components
                if (parsed.type === 'components') {
                  receivedComponents = true;
                  componentData = parsed.data;
                  console.log('\n🎯 COMPONENTS RECEIVED!\n');
                  continue;
                }

                // Extract text content
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  process.stdout.write(delta);
                  accumulatedText += delta;
                }
              } catch (parseError) {
                // Ignore parse errors
              }
            }
          }
        }
        
        if (done) break;
      }

      console.log('\n\n📊 Results:');
      console.log('- Total text length:', accumulatedText.length);
      console.log('- Received components:', receivedComponents ? '✅ Yes' : '❌ No');
      
      if (receivedComponents && componentData) {
        console.log('\n📦 Component Data:');
        console.log(JSON.stringify(componentData, null, 2));
        
        // Verify expected components
        const hasTextInput = componentData.some((c: any) => c.type === 'textinput');
        const textInputHasAction = componentData.some((c: any) => 
          c.type === 'textinput' && c.props?.action === 'send_otp'
        );
        
        console.log('\n✅ Component Validation:');
        console.log('- TextInput component:', hasTextInput ? '✅ Found' : '❌ Missing');
        console.log('- TextInput has send_otp action:', textInputHasAction ? '✅ Yes' : '❌ No');
        console.log('- TextInput has submitLabel:', componentData.find((c: any) => c.type === 'textinput')?.props?.submitLabel || 'N/A');
        
        if (hasTextInput && textInputHasAction) {
          console.log('\n🎉 SUCCESS! Login form component generated correctly!');
          process.exit(0);
        } else {
          console.log('\n❌ FAILED! TextInput missing required action');
          process.exit(1);
        }
      } else {
        console.log('\n❌ FAILED! No components received for login request');
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testLogin();
