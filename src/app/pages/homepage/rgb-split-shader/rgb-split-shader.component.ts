import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import * as THREE from 'three';

@Component({
  standalone: true,
  selector: 'app-fabric-shader',
  template: `<div
    #canvasContainer
    style="width: 100%; height: 100vh; position: relative; overflow: hidden;"
  ></div>`,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class FabricRgbShaderComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer', { static: true })
  container!: ElementRef;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private fabricMesh!: THREE.Mesh;
  private animationId!: number;

  // Shader uniforms.
  private uniforms: any;

  // Scroll-driven variables.
  private lastScrollY = window.scrollY;
  private lastScrollTime = performance.now();
  private targetOffset = 0.0;
  private currentOffset = 0.0;

  ngAfterViewInit(): void {
    this.initThree();
    this.animate();
    window.addEventListener('scroll', this.onScroll.bind(this));
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('scroll', this.onScroll.bind(this));
  }

  initThree(): void {
    const width = this.container.nativeElement.clientWidth;
    const height = this.container.nativeElement.clientHeight;

    // Create the renderer.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x000000, 0); // 0 alpha means transparent
    this.container.nativeElement.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.backgroundColor = 'transparent';

    // Create the scene.
    this.scene = new THREE.Scene();
    this.scene.background = null;

    // Set up a perspective camera.
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 0, 3);
    this.scene.add(this.camera);

    // Define uniforms. uOffset drives both the vertex displacement and the RGB shift.
    this.uniforms = {
      uOffset: { value: 0.0 },
      uNoiseScale: { value: 1.0 },
      uTexture: { value: null },
    };

    // Load the fabric texture.
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load('react.png', (texture) => {
      this.uniforms.uTexture.value = texture;
    });

    // Create a high-resolution plane geometry (4×3 units, 200 segments per side).
    const geometry = new THREE.PlaneGeometry(1, 1, 200, 200);

    // Create the ShaderMaterial that combines vertex displacement with an RGB split.
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: this.vertexShader(),
      fragmentShader: this.fragmentShader(),
      transparent: true,
    });

    this.fabricMesh = new THREE.Mesh(geometry, material);

    // Create a group to hold multiple planes.
    const fabricGroup = new THREE.Group();

    // Create multiple meshes.
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(geometry, material);
      // Position each plane with a slight offset.
      mesh.position.set(i - 1, 0, 0);
      fabricGroup.add(mesh);
    }

    // Add the group to your scene.
    this.scene.add(fabricGroup);
    // this.scene.add(this.fabricMesh);

    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  onWindowResize(): void {
    const width = this.container.nativeElement.clientWidth;
    const height = this.container.nativeElement.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  onScroll(event: Event): void {
    const currentScrollY = window.scrollY;
    const now = performance.now();
    const deltaY = currentScrollY - this.lastScrollY;
    const deltaT = now - this.lastScrollTime;
    const scrollSpeed = deltaT ? deltaY / deltaT : 0;

    // Compute a scroll-based offset. Adjust factor/throttle as needed.
    const factor = 0.05;
    const throttle = 0.3; // ~30% throttle
    this.targetOffset = scrollSpeed * factor * throttle;

    this.lastScrollY = currentScrollY;
    this.lastScrollTime = now;
  }

  animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    const now = performance.now();
    // If no scroll events for a short time, ease targetOffset toward zero.
    if (now - this.lastScrollTime > 100) {
      this.targetOffset = THREE.MathUtils.lerp(this.targetOffset, 0, 0.1);
    }
    // Smoothly interpolate currentOffset toward targetOffset.
    this.currentOffset = THREE.MathUtils.lerp(
      this.currentOffset,
      this.targetOffset,
      0.2
    );
    this.uniforms.uOffset.value = this.currentOffset;

    this.renderer.render(this.scene, this.camera);
  };

  // Vertex shader: Deforms the fabric using simplex noise.
  // The deformation amplitude is a base value plus a term scaled by uOffset.
  vertexShader(): string {
    return `
      uniform float uOffset;
      uniform float uNoiseScale;
      varying vec2 vUv;

      // Simplex noise (2D) – Ashima Arts version.
      vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
      float snoise(vec2 v){
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                            -0.577350269189626, 0.024390243902439);
        vec2 i = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                         + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m * m;
        m = m * m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
        vec3 g;
        g.x = a0.x * x0.x + h.x * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      void main() {
        vUv = uv;
        // Compute noise from the UV coordinates.
        float noise = snoise(uv * uNoiseScale);
        // The deformation amplitude: a base (0.1) plus an additional term from uOffset.
        float amplitude = 0.1 + uOffset * 5.0;
        vec3 newPosition = position + normal * noise * amplitude;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
      }
    `;
  }

  // Fragment shader: Applies an RGB split by shifting the red and blue channels.
  // The shift amount is directly proportional to uOffset.
  fragmentShader(): string {
    return `
      uniform float uOffset;
      uniform sampler2D uTexture;
      varying vec2 vUv;

      void main() {
        float shift = uOffset;
        // Sample the texture at different offsets for RGB.
        float r = texture2D(uTexture, vUv + vec2(0.0, shift)).r;
        float g = texture2D(uTexture, vUv).g;
        float b = texture2D(uTexture, vUv - vec2(0.0, shift)).b;
        // Sample the original texture alpha.
        float a = texture2D(uTexture, vUv).a;
        gl_FragColor = vec4(r, g, b, a);
      }
    `;
  }
}
