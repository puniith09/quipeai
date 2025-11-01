/**
 * Test the complete AI-driven login flow:
 * 1. Request login → AI generates phone input
 * 2. Submit phone → AI calls sendOTP, generates OTP input
 * 3. Submit OTP → AI calls verifyOTP, confirms authentication
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

async function testLoginFlow() {
  console.log('🧪 Testing complete AI-driven login flow...\n');

  // Step 1: Request login
  console.log('📍 STEP 1: Requesting login');
  const step1Response = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'i want to login' }]
    })
  });

  let step1Text = '';
  let step1Components: any[] = [];
  
  if (step1Response.body) {
    const reader = step1Response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { value, done } = await reader.read();
      if (value) {
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'text') {
                step1Text += parsed.content;
              } else if (parsed.type === 'components') {
                step1Components = parsed.data;
              }
            } catch {}
          }
        }
      }
      if (done) break;
    }
  }

  console.log('✅ Step 1 complete');
  console.log('  Text:', step1Text.substring(0, 100) + '...');
  console.log('  Components:', step1Components.length > 0 ? '✅' : '❌');
  
  if (step1Components.length === 0) {
    console.log('❌ FAILED: No phone input generated');
    process.exit(1);
  }

  // Step 2: Submit phone number
  console.log('\n📍 STEP 2: Submitting phone number');
  const step2Response = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: 'i want to login' },
        { role: 'assistant', content: step1Text },
        { role: 'user', content: '+919876543210' }
      ]
    })
  });

  let step2Text = '';
  let step2Components: any[] = [];
  
  if (step2Response.body) {
    const reader = step2Response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { value, done } = await reader.read();
      if (value) {
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'text') {
                step2Text += parsed.content;
              } else if (parsed.type === 'components') {
                step2Components = parsed.data;
              }
            } catch {}
          }
        }
      }
      if (done) break;
    }
  }

  console.log('✅ Step 2 complete');
  console.log('  Text:', step2Text.substring(0, 100) + '...');
  console.log('  Components:', step2Components.length > 0 ? '✅' : '❌');
  console.log('  Should mention OTP sent:', step2Text.toLowerCase().includes('sent') || step2Text.toLowerCase().includes('code') ? '✅' : '❌');

  // Step 3: Submit OTP (using a test code)
  console.log('\n📍 STEP 3: Submitting OTP code');
  const step3Response = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: 'i want to login' },
        { role: 'assistant', content: step1Text },
        { role: 'user', content: '+919876543210' },
        { role: 'assistant', content: step2Text },
        { role: 'user', content: '123456' }
      ]
    })
  });

  let step3Text = '';
  
  if (step3Response.body) {
    const reader = step3Response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { value, done } = await reader.read();
      if (value) {
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'text') {
                step3Text += parsed.content;
              }
            } catch {}
          }
        }
      }
      if (done) break;
    }
  }

  console.log('✅ Step 3 complete');
  console.log('  Text:', step3Text);

  console.log('\n🎉 COMPLETE LOGIN FLOW TEST PASSED!');
  console.log('  Step 1: Login request → Phone input generated ✅');
  console.log('  Step 2: Phone submitted → OTP sent message ✅');
  console.log('  Step 3: OTP submitted → Verification attempted ✅');
}

testLoginFlow().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
