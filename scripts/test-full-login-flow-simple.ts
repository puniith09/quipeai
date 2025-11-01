/**
 * Full login flow test: login → phone → OTP
 */

async function test() {
  console.log('🧪 Testing full login flow\n');
  
  // Step 1: Login request
  console.log('📍 Step 1: Request login');
  const step1 = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'i want to login' }]
    })
  });

  const step1Components = await getComponents(step1);
  console.log('✅ Phone input received:', step1Components.length > 0 ? 'YES' : 'NO');
  if (step1Components.length > 0) {
    console.log('   Type:', step1Components[0].type);
    console.log('   Action:', step1Components[0].props.action);
  }
  
  // Step 2: Submit phone number
  console.log('\n📍 Step 2: Submit phone number');
  const step2 = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: 'i want to login' },
        { role: 'assistant', content: 'Please provide your phone number' },
        { role: 'user', content: '+919876543210' }
      ]
    })
  });

  const step2Components = await getComponents(step2);
  console.log('✅ OTP input received:', step2Components.length > 0 ? 'YES' : 'NO');
  if (step2Components.length > 0) {
    console.log('   Type:', step2Components[0].type);
    console.log('   Action:', step2Components[0].props.action);
    console.log('   Label:', step2Components[0].props.label);
  }
  
  console.log('\n🎉 Full login flow test complete!');
  process.exit(step1Components.length > 0 && step2Components.length > 0 ? 0 : 1);
}

async function getComponents(response: Response): Promise<any[]> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const components: any[] = [];
  
  while (true) {
    const { done, value } = await reader.read();
    
    if (value) {
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          if (data === '[DONE]') continue;
          
          try {
            const json = JSON.parse(data);
            if (json.type === 'components') {
              components.push(...json.data);
            }
          } catch {}
        }
      }
    }
    
    if (done) break;
  }
  
  return components;
}

test();
