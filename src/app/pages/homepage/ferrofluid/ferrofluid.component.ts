import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { gsap } from 'gsap';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

@Component({
  selector: 'app-scroll-blob',
  standalone: true,
  template: `
    <div class="app-container">
      <header>
        <h1>Scroll-Reactive Blob Demo</h1>
      </header>

      <div class="blob-wrapper">
        <div #container class="blob-container"></div>
      </div>

      <section class="content">
        <div class="section" *ngFor="let i of [1, 2, 3, 4, 5]">
          <h2>Section {{ i }}</h2>
          <p>Scroll down to see the blob react to your scrolling speed.</p>
          <p>The faster you scroll, the more the blob deforms.</p>
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      .app-container {
        min-height: 300vh;
        position: relative;
      }

      header {
        height: 80px;
        padding: 20px;
        text-align: center;
      }

      .blob-wrapper {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 60vmin;
        height: 60vmin;
        z-index: -1;
      }

      .blob-container {
        width: 100%;
        height: 100%;
        overflow: hidden;
      }

      .content {
        padding: 20px;
      }

      .section {
        margin: 80vh 0;
        padding: 40px;
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(5px);
        border-radius: 10px;
      }
    `,
  ],
})
export class ScrollBlobComponent implements OnInit, OnDestroy {
  @ViewChild('container', { static: true }) container!: ElementRef;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private blob!: THREE.Mesh;
  private clock!: THREE.Clock;
  private scrollSpeed = 0;
  private lastScrollY = 0;
  private animationFrameId: number | null = null;
  private resetTimeout: any = null;

  // Perlin noise intensity that will be updated based on scroll speed
  private noiseIntensity = 0.5;
  private targetNoiseIntensity = 0.5;

  constructor(private ngZone: NgZone) {}

  ngOnInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.initThree();
      this.initScrollListener();
      this.animate();
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.handleScroll);
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
    }

    // Dispose of resources
    this.blob.geometry.dispose();
    (this.blob.material as THREE.ShaderMaterial).dispose();

    this.renderer.dispose();
  }

  private composer!: EffectComposer;
  private initThree(): void {
    // Scene setup
    this.scene = new THREE.Scene();

    // Camera setup
    const { width, height } =
      this.container.nativeElement.getBoundingClientRect();
    const aspect = width / height;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    this.camera.position.z = 5;
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.8, // strength
      0.3, // radius
      0.7 // threshold
    );

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      premultipliedAlpha: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    const renderScene = new RenderPass(this.scene, this.camera);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderScene);
    this.composer.addPass(bloomPass);
    this.container.nativeElement.appendChild(this.renderer.domElement);

    // Clock for animation
    this.clock = new THREE.Clock();

    // Create the blob
    this.createBlob();

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
  }

  private createBlob(): void {
    // Create a sphere geometry as the base for our blob
    const geometry = new THREE.IcosahedronGeometry(2, 20);

    // Create shader material with custom vertex and fragment shaders
    // Create shader material with custom vertex and fragment shaders
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uNoiseIntensity: { value: this.noiseIntensity },
        uPrimaryColor: { value: new THREE.Color(0x88ccff) },
        uSecondaryColor: { value: new THREE.Color(0xff88aa) },
        uOpacity: { value: 0.85 },
      },
      vertexShader: `
    uniform float uTime;
    uniform float uNoiseIntensity;

    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;

    // Simplex noise functions (simplified for demonstration)
    // In production, use a more complete noise implementation
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

      // First corner
      vec3 i = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);

      // Other corners
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);

      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;

      // Permutations
      i = mod289(i);
      vec4 p = permute(permute(permute(
                 i.z + vec4(0.0, i1.z, i2.z, 1.0))
               + i.y + vec4(0.0, i1.y, i2.y, 1.0))
               + i.x + vec4(0.0, i1.x, i2.x, 1.0));

      // Gradients
      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;

      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);

      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);

      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);

      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));

      vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);

      // Normalise gradients
      vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;

      // Mix final noise value
      vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
    }

    void main() {
      // Use the original vertex position as the base
      vec3 pos = position;

      // Apply noise-based deformation
      float noise = snoise(
        vec3(
          pos.x * 0.5,
          pos.y * 0.5,
          pos.z * 0.5 + uTime * 0.2
        )
      );

      // Deform the surface based on noise and intensity
      vec3 newPos = pos + normal * noise * uNoiseIntensity;

      // Pass data to fragment shader
      vNormal = normalMatrix * normal;
      vPosition = newPos;
      vUv = uv;

      // Project the vertex
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
    }
  `,
      // Update the fragment shader with edge glow effect
      fragmentShader: `
  uniform vec3 uPrimaryColor;
  uniform vec3 uSecondaryColor;
  uniform float uTime;
  uniform float uOpacity;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying float vCraterDepth;

  void main() {
    // Calculate fresnel effect for pearlescence and edge glow
    vec3 viewDirection = normalize(cameraPosition - vPosition);
    float fresnel = pow(1.0 - dot(viewDirection, normalize(vNormal)), 4.0);

    // Enhanced fresnel for edge glow effect
    float edgeGlow = pow(1.0 - dot(viewDirection, normalize(vNormal)), 8.0);

    // Create pearlescent color shifting effect
    float pearl = (sin(vUv.x * 10.0 + uTime * 0.5) * 0.5 + 0.5) *
                  (sin(vUv.y * 8.0 + uTime * 0.4) * 0.5 + 0.5);

    // Mix colors based on viewing angle and pearl pattern
    vec3 color = mix(uPrimaryColor, uSecondaryColor, fresnel * 0.7 + pearl * 0.3);

    // Apply lighting effects (enhanced for pearlescence)
    vec3 light = normalize(vec3(1.0, 2.0, 3.0));
    float diffuse = max(0.0, dot(vNormal, light)) * 0.6 + 0.4;
    color = color * diffuse;

    // Create a glowing edge effect
    // Use a brighter color that's complementary to the primary/secondary colors
    vec3 glowColor = vec3(0.6, 0.8, 1.0); // Bright blue-white glow

    // Add the glow, stronger at edges based on enhanced fresnel
    color += glowColor * edgeGlow * 0.8;

    // Add pulsating effect to the glow
    float pulse = sin(uTime * 0.8) * 0.5 + 0.5;
    color += glowColor * edgeGlow * pulse * 0.4;

    // Add iridescent highlights
    color += vec3(0.1, 0.1, 0.2) * fresnel * pearl;

    // Set final color with variable opacity
    // Make edges slightly more transparent for better glow effect
    float alpha = mix(uOpacity, uOpacity + 0.1, edgeGlow);
    gl_FragColor = vec4(color, alpha);
  }
`,
      transparent: true, // Enable transparency
      // side: THREE.DoubleSide, // Render both sides
    });

    // Create the mesh and add it to the scene
    this.blob = new THREE.Mesh(geometry, material);
    this.scene.add(this.blob);
  }

  private animate(): void {
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    // Update the shader uniforms
    const uniforms = (this.blob.material as THREE.ShaderMaterial).uniforms;
    // @ts-ignore
    uniforms.uTime.value = this.clock.getElapsedTime();

    // Smoothly interpolate noise intensity toward target value
    this.noiseIntensity +=
      (this.targetNoiseIntensity - this.noiseIntensity) * 0.05;
    // @ts-ignore
    uniforms.uNoiseIntensity.value = this.noiseIntensity;

    // Rotate the blob slightly for extra movement
    this.blob.rotation.y += 0.003;

    // Render the scene
    // this.renderer.render(this.scene, this.camera);
    this.composer.render();
  }

  private initScrollListener(): void {
    this.lastScrollY = window.scrollY;
    window.addEventListener('scroll', this.handleScroll);
  }

  private handleScroll = (): void => {
    // Calculate scroll speed
    const currentScrollY = window.scrollY;
    const scrollDelta = Math.abs(currentScrollY - this.lastScrollY);
    this.lastScrollY = currentScrollY;

    // Normalize scroll speed to a reasonable range (0.5 - 3.0)
    // You can adjust these values to tune the sensitivity
    const normalizedSpeed = Math.min(
      3.0,
      Math.max(0.5, 0.5 + scrollDelta * 0.05)
    );

    // Update target noise intensity based on scroll speed
    this.targetNoiseIntensity = normalizedSpeed;

    // Clear any existing timeout to reset the target intensity
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
    }

    // Set timeout to return to base state after scrolling stops
    this.resetTimeout = setTimeout(() => {
      this.targetNoiseIntensity = 0.5; // Default base value
    }, 1000); // Delay before returning to default (1 second)

    // Optional: use GSAP to animate the blob based on scroll speed
    gsap.to(this.blob.rotation, {
      x: scrollDelta * 0.001,
      duration: 0.5,
      ease: 'power2.out',
    });
  };

  private onWindowResize(): void {
    const { width, height } =
      this.container.nativeElement.getBoundingClientRect();
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
