/**
 * Simple test to verify showPhoneInput tool works
 */

async function test() {
  const response = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'i want to login' }]
    })
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  
  let hasComponents = false;
  let text = '';
  
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
              hasComponents = true;
              console.log('✅ Components received:', JSON.stringify(json.data, null, 2));
            }
            if (json.choices?.[0]?.delta?.content) {
              text += json.choices[0].delta.content;
            }
          } catch {}
        }
      }
    }
    
    if (done) break;
  }
  
  console.log('\nText:', text);
  console.log('Has components:', hasComponents ? '✅ YES' : '❌ NO');
  
  process.exit(hasComponents ? 0 : 1);
}

test();
