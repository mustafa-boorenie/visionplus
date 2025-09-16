# Three.js Scroll Animation with GSAP

This project demonstrates how to create a 3D object using Three.js and animate it based on scroll position using GSAP's ScrollTrigger plugin.

## Features

- **3D Torus Knot Object**: A colorful, animated 3D shape created with Three.js
- **Scroll-based Animation**: The object moves, rotates, and scales as you scroll
- **Particle System**: Background particles that add depth to the scene
- **Dynamic Color Changes**: The object's color changes based on scroll progress
- **Smooth Transitions**: GSAP provides smooth, performant animations
- **Responsive Design**: Works on desktop and mobile devices

## Installation

1. Clone or download this project
2. Open `index.html` in a modern web browser, or
3. Use a local server:
   ```bash
   npm install
   npm start
   ```
   Then open http://localhost:8080 in your browser

## How It Works

### Three.js Setup
- Creates a 3D scene with a torus knot geometry
- Adds lighting for realistic shading
- Implements a particle system for visual depth
- Sets up a perspective camera

### GSAP ScrollTrigger Animation
- Animates object position, rotation, and scale based on scroll progress
- Changes object color dynamically using HSL color space
- Moves camera position for different viewing angles
- Triggers section animations as they come into view

### Key Components

1. **HTML Structure**: Scrollable content sections that trigger animations
2. **CSS Styling**: Fixed canvas with scrollable content overlay
3. **JavaScript**:
   - `initThreeJS()`: Sets up the 3D scene
   - `setupScrollAnimations()`: Configures GSAP scroll animations
   - `animate()`: Renders the scene continuously

## Customization

You can modify:
- **Object Type**: Change the geometry in `initThreeJS()`
- **Animation Path**: Adjust position/rotation values in `setupScrollAnimations()`
- **Colors**: Modify material colors and particle colors
- **Timing**: Adjust duration and easing in GSAP timeline

## Browser Support

Requires a modern browser with WebGL support:
- Chrome 58+
- Firefox 52+
- Safari 11+
- Edge 79+

## Dependencies

- Three.js r128
- GSAP 3.12.2
- GSAP ScrollTrigger Plugin