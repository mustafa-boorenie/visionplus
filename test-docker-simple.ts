import Docker from 'dockerode';

async function testDocker() {
  const docker = new Docker();
  
  try {
    // Test 1: Check Docker connection
    console.log('1️⃣ Testing Docker connection...');
    const info = await docker.info();
    console.log(`✅ Docker is running: ${info.Name}`);
    console.log(`   Containers: ${info.Containers}`);
    console.log(`   Images: ${info.Images}\n`);
    
    // Test 2: Check if our image exists
    console.log('2️⃣ Checking for ai-playwright-browser image...');
    try {
      const image = await docker.getImage('ai-playwright-browser:latest').inspect();
      console.log(`✅ Image found: ${image.Id.substring(0, 12)}`);
      console.log(`   Size: ${(image.Size / 1024 / 1024).toFixed(2)} MB\n`);
    } catch (error) {
      console.log('❌ Image not found. Please build it first.\n');
      return;
    }
    
    // Test 3: Try to create and start a container
    console.log('3️⃣ Creating test container...');
    const container = await docker.createContainer({
      Image: 'ai-playwright-browser:latest',
      ExposedPorts: { '3000/tcp': {} },
      HostConfig: {
        PortBindings: { 
          '3000/tcp': [{ HostPort: '0' }]
        },
        AutoRemove: true
      },
      Env: [
        'START_URL=https://example.com',
        'HEADLESS=true'
      ]
    });
    
    console.log(`✅ Container created: ${container.id.substring(0, 12)}`);
    
    console.log('4️⃣ Starting container...');
    await container.start();
    
    const inspect = await container.inspect();
    const port = inspect.NetworkSettings.Ports['3000/tcp'][0].HostPort;
    console.log(`✅ Container started on port: ${port}`);
    
    // Test 4: Stop container
    console.log('\n5️⃣ Stopping container...');
    await container.stop({ t: 5 });
    console.log('✅ Container stopped');
    
    console.log('\n🎉 All Docker tests passed!');
    
  } catch (error) {
    console.error('❌ Docker test failed:', error);
  }
}

testDocker(); 