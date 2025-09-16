// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

// Three.js Scene Setup
let scene, camera, renderer, geometry, material, mesh;
let particles, particlesGeometry, particlesMaterial;

// Initialize Three.js
function initThreeJS() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // Create camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.z = 5;

    // Create renderer
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Add renderer to DOM
    const container = document.getElementById('canvas-container');
    container.appendChild(renderer.domElement);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Create main geometry - a colorful torus knot
    geometry = new THREE.TorusKnotGeometry(1.5, 0.5, 100, 16);
    material = new THREE.MeshPhongMaterial({
        color: 0x667eea,
        emissive: 0x764ba2,
        emissiveIntensity: 0.2,
        shininess: 100,
        specular: 0xffffff
    });
    mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Create particle system for background
    particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 500;
    const posArray = new Float32Array(particlesCount * 3);

    for (let i = 0; i < particlesCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 20;
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    particlesMaterial = new THREE.PointsMaterial({
        size: 0.05,
        color: 0x764ba2,
        transparent: true,
        opacity: 0.8
    });
    particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);

    // Handle window resize
    window.addEventListener('resize', onWindowResize);
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Rotate particles
    particles.rotation.x += 0.0005;
    particles.rotation.y += 0.0005;
    
    renderer.render(scene, camera);
}

// Setup GSAP scroll animations
function setupScrollAnimations() {
    // Create timeline for scroll animations
    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: ".content",
            start: "top top",
            end: "bottom bottom",
            scrub: 1,
            onUpdate: (self) => {
                // Update material color based on scroll progress
                const progress = self.progress;
                const hue = progress * 360;
                mesh.material.color.setHSL(hue / 360, 0.7, 0.5);
            }
        }
    });

    // Animate mesh position, rotation, and scale
    tl.to(mesh.position, {
        x: 3,
        y: -2,
        z: 2,
        duration: 0.3
    })
    .to(mesh.rotation, {
        x: Math.PI * 2,
        y: Math.PI * 2,
        z: Math.PI,
        duration: 0.3
    }, "<")
    .to(mesh.scale, {
        x: 1.5,
        y: 1.5,
        z: 1.5,
        duration: 0.3
    }, "<")
    .to(mesh.position, {
        x: -3,
        y: 2,
        z: -1,
        duration: 0.3
    })
    .to(mesh.rotation, {
        x: Math.PI * 4,
        y: Math.PI * 3,
        z: Math.PI * 2,
        duration: 0.3
    }, "<")
    .to(mesh.scale, {
        x: 0.8,
        y: 0.8,
        z: 0.8,
        duration: 0.3
    }, "<")
    .to(mesh.position, {
        x: 0,
        y: 0,
        z: 0,
        duration: 0.4
    })
    .to(mesh.rotation, {
        x: Math.PI * 6,
        y: Math.PI * 4,
        z: Math.PI * 3,
        duration: 0.4
    }, "<");

    // Animate camera position
    gsap.to(camera.position, {
        z: 8,
        scrollTrigger: {
            trigger: ".section:nth-child(3)",
            start: "top center",
            end: "bottom center",
            scrub: 1
        }
    });

    gsap.to(camera.position, {
        z: 5,
        x: 2,
        scrollTrigger: {
            trigger: ".section:nth-child(4)",
            start: "top center",
            end: "bottom center",
            scrub: 1
        }
    });

    // Particle animation
    gsap.to(particles.rotation, {
        x: Math.PI * 2,
        y: Math.PI * 2,
        scrollTrigger: {
            trigger: ".content",
            start: "top top",
            end: "bottom bottom",
            scrub: 2
        }
    });

    // Individual section animations
    gsap.utils.toArray(".section").forEach((section, index) => {
        gsap.from(section.querySelectorAll("h2, p"), {
            y: 50,
            opacity: 0,
            duration: 1,
            stagger: 0.2,
            scrollTrigger: {
                trigger: section,
                start: "top 80%",
                end: "bottom 20%",
                toggleActions: "play none none reverse"
            }
        });
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initThreeJS();
    animate();
    setupScrollAnimations();
});